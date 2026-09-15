import { firebaseConfig } from './config.js'

// Un seul document partagé entre tous tes appareils — pas de compte, pas de
// code à taper : ouvrir l'app suffit pour être synchronisé. Accepté puisque
// ces données ne sont pas sensibles et que tu es seul à connaître l'URL de
// cette app (voir README pour les règles Firestore qui limitent l'accès à
// ce document précis).
const DOC_PATH = ['dashboards', 'l3-physique']

export function firebaseConfigured() {
  return Object.values(firebaseConfig).every((v) => v && !v.includes('TODO'))
}

// Le SDK Firebase est lourd (~500 Ko) — on ne le charge (via import() dynamique,
// dans un chunk séparé) que si une config valide existe, pour ne jamais
// ralentir le premier affichage sur mobile quand la sync n'est pas utilisée.
let dbPromise = null
async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ initializeApp, getApps }, { getFirestore, enableIndexedDbPersistence }] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ])
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
      const db = getFirestore(app)
      // Cache hors-ligne : les changements faits sans réseau (ex. téléphone en
      // 4G coupée) restent en attente et repartent seuls dès la reconnexion.
      await enableIndexedDbPersistence(db).catch(() => {})
      return db
    })()
  }
  return dbPromise
}

/** Écoute les changements distants (un autre appareil qui synchronise) en
 * temps réel. `onRemoteState` reçoit l'état complet dès qu'il change côté
 * serveur (y compris l'écho de nos propres écritures). Renvoie une fonction
 * pour se désabonner (peut être appelée avant que la connexion soit prête).
 * No-op si Firebase n'est pas configuré. */
export function subscribeRemoteState(onRemoteState, onError) {
  if (!firebaseConfigured()) return () => {}
  let unsub = null
  let cancelled = false
  ;(async () => {
    const { doc, onSnapshot } = await import('firebase/firestore')
    const db = await getDb()
    if (cancelled) return
    const ref = doc(db, ...DOC_PATH)
    unsub = onSnapshot(
      ref,
      (snap) => onRemoteState(snap.exists() ? snap.data() : null),
      (err) => onError?.(err),
    )
  })().catch((err) => onError?.(err))
  return () => {
    cancelled = true
    unsub?.()
  }
}

/** Pousse l'état complet vers Firestore (remplace le document). No-op si
 * Firebase n'est pas configuré. */
export async function pushRemoteState(state, onError) {
  if (!firebaseConfigured()) return
  try {
    const { doc, setDoc } = await import('firebase/firestore')
    const db = await getDb()
    const ref = doc(db, ...DOC_PATH)
    await setDoc(ref, state)
  } catch (err) {
    onError?.(err)
  }
}
