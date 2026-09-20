// Client REST minimal pour le document Firestore partagé par le dashboard
// (src/firebase/sync.js, côté app, utilise le SDK JS pour la même chose —
// ici on parle direct au REST API puisqu'un Worker Cloudflare n'a pas accès
// au SDK Firebase). Mêmes projet/chemin, même absence d'auth (les règles
// Firestore n'autorisent que ce document précis, cf. README du dépôt
// principal — accepté pour les mêmes raisons : rien de sensible).
const PROJECT_ID = 'l3-physic'
const DOC_PATH = 'dashboards/l3-physique'
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${DOC_PATH}`

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } }
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } }
  throw new Error(`Type non supporté pour Firestore : ${typeof v}`)
}

function encodeFields(obj) {
  const fields = {}
  for (const [k, val] of Object.entries(obj)) fields[k] = encodeValue(val)
  return fields
}

function decodeValue(v) {
  if (!v || typeof v !== 'object') return null
  if ('nullValue' in v) return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {})
  return null
}

function decodeFields(fields) {
  const obj = {}
  for (const [k, v] of Object.entries(fields ?? {})) obj[k] = decodeValue(v)
  return obj
}

/** Lit l'état distant actuel. `null` si le document n'existe pas encore. */
export async function fetchState() {
  const res = await fetch(BASE_URL)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore GET a échoué (${res.status}) : ${await res.text()}`)
  const json = await res.json()
  return decodeFields(json.fields)
}

/** Remplace intégralement le document (mêmes garanties qu'un `setDoc` côté
 * app) — l'appelant doit avoir déjà fusionné avec l'état distant le plus
 * frais (cf. tools.js) pour ne pas écraser en aveugle un changement fait
 * entre-temps sur un autre appareil. */
export async function writeState(state) {
  const res = await fetch(BASE_URL, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(state) }),
  })
  if (!res.ok) throw new Error(`Firestore PATCH a échoué (${res.status}) : ${await res.text()}`)
}
