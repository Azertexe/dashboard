// Web Push implémenté à la main avec le seul Web Crypto natif (SubtleCrypto)
// — pas de dépendance npm, pour rester déployable en collant un seul fichier
// dans l'éditeur Cloudflare (voir mcp-server/README.md), comme le reste de
// ce Worker. Suit RFC 8291 (chiffrement du message, aes128gcm/RFC 8188) et
// RFC 8292 (VAPID, l'en-tête d'autorisation signée).

function base64UrlEncode(bytes) {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4)
  const bin = atob(b64)
  return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)))
}

function textBytes(str) {
  return new TextEncoder().encode(str)
}

function concatBytes(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

/** HKDF (extract+expand en un appel, natif) — utilisé deux fois avec le même
 * sel/ikm mais des `info` différents pour dériver CEK et nonce du même PRK
 * (RFC 8188 §2.1), ce qui est équivalent à un extract partagé suivi de deux
 * expand puisque HKDF-Extract est déterministe pour un (sel, ikm) donné. */
async function hkdf(ikmBytes, saltBytes, infoBytes, lengthBytes) {
  const key = await crypto.subtle.importKey('raw', ikmBytes, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: infoBytes },
    key,
    lengthBytes * 8,
  )
  return new Uint8Array(bits)
}

/** Chiffre `plaintextBytes` pour une subscription {endpoint, keys:{p256dh,auth}}
 * donnée — renvoie le corps binaire à poster tel quel (Content-Encoding:
 * aes128gcm). Une paire de clés ECDH éphémère est générée à chaque appel
 * (jamais réutilisée entre deux messages, comme l'exige la RFC). */
export async function encryptPayload(plaintextBytes, subscription) {
  const clientPublicRaw = base64UrlDecode(subscription.keys.p256dh)
  const authSecret = base64UrlDecode(subscription.keys.auth)

  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256),
  )

  // RFC 8291 §3.4 : combine le secret ECDH et le secret d'auth du client en
  // un IKM, en mélangeant les deux clés publiques dans le contexte pour lier
  // le résultat à cette paire précise (protège contre certaines substitutions).
  const keyInfo = concatBytes(textBytes('WebPush: info\0'), clientPublicRaw, serverPublicRaw)
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32)

  // RFC 8188 (aes128gcm) : un sel aléatoire par message, CEK et nonce dérivés du même ikm.
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(ikm, salt, textBytes('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(ikm, salt, textBytes('Content-Encoding: nonce\0'), 12)

  // Un seul enregistrement (le message tient toujours dans une seule
  // notification push) : le padding est juste le delimiter 0x02 ("dernier
  // enregistrement, rien après"), pas de padding supplémentaire.
  const recordPlaintext = concatBytes(plaintextBytes, new Uint8Array([0x02]))
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, recordPlaintext))

  const rsBytes = new Uint8Array(4)
  new DataView(rsBytes.buffer).setUint32(0, ciphertext.length, false)
  const header = concatBytes(salt, rsBytes, new Uint8Array([serverPublicRaw.length]), serverPublicRaw)

  return concatBytes(header, ciphertext)
}

/** Jeton VAPID (RFC 8292) signé avec la clé privée du serveur (ES256) —
 * `privateKeyJwk` est le JWK complet (kty/crv/x/y/d), stocké en secret
 * Cloudflare (`VAPID_PRIVATE_KEY_JWK`). `aud` doit être l'origine exacte de
 * l'endpoint visé, recalculée à chaque envoi (elle diffère selon le
 * fournisseur de push du navigateur — Apple, Mozilla, Google...). */
export async function createVapidJWT(endpoint, privateKeyJwk, subject) {
  const origin = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }
  const signingInput = `${base64UrlEncode(textBytes(JSON.stringify(header)))}.${base64UrlEncode(textBytes(JSON.stringify(payload)))}`

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // Web Crypto renvoie directement la signature au format JOSE (r||s, 64
  // octets) attendu par un JWT — pas de conversion DER nécessaire.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, textBytes(signingInput))
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

const VAPID_SUBJECT = 'mailto:push@l3-physique.invalid'

// Clé publique — pas un secret (elle ne fait que prouver que les push
// viennent bien de ce serveur ; identique à src/logic/push.js côté app).
// Seule la clé privée correspondante (VAPID_PRIVATE_KEY_JWK, un secret
// Cloudflare) permet de signer avec elle.
export const VAPID_PUBLIC_KEY = 'BIp7O-NSO3PZsDXfJYh4o_vrDd9DlDxgt7hZjUKQzuLpDvCuJt7mLHYlGNd2MNtbxRHilWOKJhUAnaxJ6DDFYLw'

/** Envoie une notification push (texte brut) à un abonnement donné.
 * `env` doit fournir VAPID_PRIVATE_KEY_JWK (secret Cloudflare). */
export async function sendWebPush(subscription, text, env) {
  const body = await encryptPayload(textBytes(text), subscription)
  const jwt = await createVapidJWT(subscription.endpoint, JSON.parse(env.VAPID_PRIVATE_KEY_JWK), VAPID_SUBJECT)

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Web Push a échoué (${res.status}) : ${await res.text()}`)
}
