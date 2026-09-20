import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { subscribeRemoteState, pushRemoteState, fetchRemoteState, firebaseConfigured } from '../firebase/sync.js'
import { emptyState, normalizeState, reducer, mergeStates } from './reducer.js'

// mergeById/mergeStates/reducer vivent dans reducer.js (aucune dépendance
// React/Firebase) pour pouvoir être réutilisés par autre chose que l'app —
// voir mcp-server/, qui applique les mêmes actions au même document
// Firestore. Ré-exportés ici pour ne pas casser le reste du code/tests qui
// les importe déjà depuis store.jsx.
export { mergeById, mergeStates } from './reducer.js'

const STORAGE_KEY = 'l3-physique-dashboard'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyState()
    return normalizeState(parsed)
  } catch {
    return emptyState()
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [syncStatus, setSyncStatus] = useState(firebaseConfigured() ? 'syncing' : 'off')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Synchronisation Firebase temps réel, sans compte : un seul document
  // partagé entre tous les appareils. Les refs (pas du state React) évitent
  // le ping-pong entre "recevoir un changement distant" et "republier ce
  // qu'on vient de recevoir" — voir les commentaires ci-dessous.
  const lastRemoteJSONRef = useRef(null)
  const lastLocalPushedJSONRef = useRef(null)
  // L'abonnement ne se (ré)installe qu'au montage (deps []) ; ce ref donne à
  // son callback accès à l'état LOCAL courant (pas celui, figé, du montage)
  // pour pouvoir fusionner correctement à la réception.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!firebaseConfigured()) return
    // Si aucune confirmation (snapshot ou erreur) n'arrive dans ce délai, la
    // connexion est probablement bloquée (réseau restrictif, bloqueur de
    // pub…) plutôt que juste lente — sans ce filet, le statut resterait
    // coincé sur "Synchronisation…" indéfiniment sans jamais prévenir.
    let settled = false
    const stallTimer = setTimeout(() => {
      if (!settled) setSyncStatus('stalled')
    }, 10_000)

    const unsub = subscribeRemoteState(
      (remoteState) => {
        settled = true
        clearTimeout(stallTimer)
        setSyncStatus('synced')
        if (!remoteState) return
        const remoteJSON = JSON.stringify(remoteState)
        // Soit un doublon d'événement, soit l'écho de notre propre écriture
        // (Firestore renvoie toujours un snapshot après un push) : dans les
        // deux cas, rien à réappliquer.
        if (remoteJSON === lastRemoteJSONRef.current || remoteJSON === lastLocalPushedJSONRef.current) {
          lastRemoteJSONRef.current = remoteJSON
          return
        }
        lastRemoteJSONRef.current = remoteJSON
        // Fusion additive plutôt que remplacement : si ce device avait déjà
        // ajouté quelque chose localement (pas encore poussé) au moment où
        // cette mise à jour distante arrive, on ne l'écrase pas.
        const merged = mergeStates(stateRef.current, remoteState)
        if (JSON.stringify(merged) !== JSON.stringify(stateRef.current)) {
          dispatch({ type: 'IMPORT_STATE', state: merged })
        }
      },
      () => {
        settled = true
        clearTimeout(stallTimer)
        setSyncStatus('error')
      },
    )
    return () => {
      clearTimeout(stallTimer)
      unsub()
    }
  }, [])

  useEffect(() => {
    if (!firebaseConfigured()) return
    const json = JSON.stringify(state)
    // Cet état EST ce qu'on vient de recevoir d'un autre appareil : ne pas
    // le republier (sinon boucle inutile, même si sans risque).
    if (json === lastRemoteJSONRef.current) return
    const t = setTimeout(async () => {
      setSyncStatus('syncing')
      // Relit l'état distant juste avant d'écrire et fusionne dedans plutôt
      // que d'écraser en aveugle — protège un ajout fait sur un autre
      // appareil entre-temps et pas encore reçu par celui-ci.
      const remote = await fetchRemoteState()
      const merged = mergeStates(state, remote)
      const mergedJSON = JSON.stringify(merged)
      lastLocalPushedJSONRef.current = mergedJSON
      lastRemoteJSONRef.current = mergedJSON
      await pushRemoteState(merged, () => setSyncStatus('error'))
      if (mergedJSON !== json) dispatch({ type: 'IMPORT_STATE', state: merged })
    }, 800)
    return () => clearTimeout(t)
  }, [state])

  const value = useMemo(() => ({ state, dispatch, syncStatus }), [state, syncStatus])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé sous <StoreProvider>')
  return ctx
}
