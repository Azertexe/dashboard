import { describe, it, expect } from 'vitest'
import { encryptPayload, createVapidJWT } from './webpush.js'

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
function textBytes(str) {
  return new TextEncoder().encode(str)
}
async function hkdf(ikm, salt, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8)
  return new Uint8Array(bits)
}

/** Déchiffre indépendamment, en suivant RFC 8291 côté CLIENT (celui qui
 * possède la clé privée d'abonnement et le secret d'auth) — sert uniquement
 * à vérifier par un aller-retour complet que encryptPayload() est conforme
 * à la RFC, sans dépendre d'un vrai navigateur/service de push (impossible
 * à tester depuis ce bac à sable). Si ce déchiffrement indépendant retrouve
 * le texte clair d'origine, un vrai navigateur (qui suit la même RFC) le
 * pourra aussi. */
async function clientDecrypt(encryptedBody, clientPrivateKey, clientPublicRaw, authSecret) {
  const salt = encryptedBody.slice(0, 16)
  const rs = new DataView(encryptedBody.buffer, encryptedBody.byteOffset + 16, 4).getUint32(0, false)
  const idlen = encryptedBody[20]
  const serverPublicRaw = encryptedBody.slice(21, 21 + idlen)
  const ciphertext = encryptedBody.slice(21 + idlen)
  expect(ciphertext.length).toBe(rs)

  const serverPublicKey = await crypto.subtle.importKey(
    'raw',
    serverPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, clientPrivateKey, 256),
  )
  const keyInfo = concatBytes(textBytes('WebPush: info\0'), clientPublicRaw, serverPublicRaw)
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32)
  const cek = await hkdf(ikm, salt, textBytes('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(ikm, salt, textBytes('Content-Encoding: nonce\0'), 12)

  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cekKey, ciphertext))
  // Retire le delimiter 0x02 final (dernier — et unique — enregistrement).
  expect(decrypted[decrypted.length - 1]).toBe(0x02)
  return decrypted.slice(0, -1)
}

async function fakeSubscription() {
  const clientKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const clientPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', clientKeyPair.publicKey))
  const authSecret = crypto.getRandomValues(new Uint8Array(16))
  return {
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: base64UrlEncode(clientPublicRaw), auth: base64UrlEncode(authSecret) },
    },
    clientPrivateKey: clientKeyPair.privateKey,
    clientPublicRaw,
    authSecret,
  }
}

describe('encryptPayload (RFC 8291) — vérifié par aller-retour avec un déchiffrement indépendant côté "client"', () => {
  it('un déchiffrement suivant la RFC retrouve exactement le texte clair', async () => {
    const { subscription, clientPrivateKey, clientPublicRaw, authSecret } = await fakeSubscription()
    const plaintext = 'Optique — badge orange en retard\n2 devoirs cette semaine'
    const body = await encryptPayload(textBytes(plaintext), subscription)

    const decrypted = await clientDecrypt(body, clientPrivateKey, clientPublicRaw, authSecret)
    expect(new TextDecoder().decode(decrypted)).toBe(plaintext)
  })

  it('deux envois du même message utilisent des clés/sel différents (jamais de réutilisation)', async () => {
    const { subscription } = await fakeSubscription()
    const body1 = await encryptPayload(textBytes('même message'), subscription)
    const body2 = await encryptPayload(textBytes('même message'), subscription)
    expect(base64UrlDecode(base64UrlEncode(body1.slice(0, 16)))).not.toEqual(body2.slice(0, 16)) // sel différent
    expect(body1).not.toEqual(body2) // donc tout le reste diffère aussi
  })
})

describe('createVapidJWT (RFC 8292)', () => {
  it("produit un JWT dont la signature se vérifie avec la clé publique correspondante, et dont l'aud correspond à l'origine de l'endpoint", async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])
    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

    const jwt = await createVapidJWT('https://fcm.googleapis.com/fcm/send/xyz', privateJwk, 'mailto:test@example.com')
    const [headerB64, payloadB64, sigB64] = jwt.split('.')

    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)))
    expect(header).toEqual({ typ: 'JWT', alg: 'ES256' })

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('mailto:test@example.com')
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.publicKey,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    )
    expect(valid).toBe(true)
  })
})
