import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { activateChapitre, markBadgeNow, undoBadge, forceBadgeLevel, setForcedAlert } from '../logic/badges'

const STORAGE_KEY = 'l3-physique-dashboard'
const STORAGE_VERSION = 1

function emptyState() {
  return {
    version: STORAGE_VERSION,
    theme: 'glacier',
    exams: [], // { id, matiere, date, createdAt } — les partiels
    devoirs: [], // { id, nom, dateEcheance, createdAt }
    chapitres: [], // voir src/logic/badges.js pour la forme d'un chapitre
    resources: {}, // { [courseId]: { revision: {url,label}|null, methode: {url,label}|null, polys: [{id,url,label}] } }
  }
}

// Ancien format : `statut`/`activatedAt` vivaient sur le chapitre (partagés
// entre Cours et TD). Ils vivent maintenant sur badgeCours/badgeTD (chaque
// côté a sa propre activation indépendante) — on bascule les anciennes
// données existantes plutôt que de perdre leur progression.
function migrateBadgeSide(badge, legacyActif, legacyActivatedAt) {
  return {
    statut: badge?.statut ?? (legacyActif ? 'actif' : 'standby'),
    activatedAt: badge?.activatedAt ?? (legacyActif ? legacyActivatedAt : null),
    validatedStage: badge?.validatedStage ?? null,
    validatedAt: badge?.validatedAt ?? null,
    // L'ancien format gardait previousValidatedStage/previousValidatedAt à
    // plat ; le nouveau garde un instantané complet — cette petite perte
    // d'historique d'annulation (un seul cran) est acceptable à la migration.
    previousSnapshot: badge?.previousSnapshot ?? null,
    forcedAlert: badge?.forcedAlert ?? null,
  }
}

function migrateChapitre(c) {
  const legacyActif = c.statut === 'actif'
  return {
    ...c,
    // Avant, un seul chapitre était partagé entre Cours et TD (juste ses 2
    // badges étaient indépendants) — un chapitre créé côté Cours apparaissait
    // donc aussi côté TD. Chaque chapitre appartient maintenant à un seul
    // côté ; les anciens (sans `side`) sont rattachés à Cours par défaut.
    side: c.side ?? 'cours',
    badgeCours: migrateBadgeSide(c.badgeCours, legacyActif, c.activatedAt),
    badgeTD: migrateBadgeSide(c.badgeTD, legacyActif, c.activatedAt),
    partitionMode: c.partitionMode ?? 'chapitre',
    parties: (c.parties ?? []).map((p) => ({
      ...p,
      badgeCours: migrateBadgeSide(p.badgeCours, false, null),
      badgeTD: migrateBadgeSide(p.badgeTD, false, null),
    })),
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyState()
    const merged = { ...emptyState(), ...parsed }
    return { ...merged, chapitres: merged.chapitres.map(migrateChapitre) }
  } catch {
    return emptyState()
  }
}

function newId(prefix) {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}-${rand}`
}

// Champs qu'une édition "nom/description" a le droit de toucher — jamais les
// horloges de badges ni la date d'activation (voir spec, Partie 5).
const EDITABLE_CHAPITRE_FIELDS = ['nom', 'description', 'etat', 'commentaires']
const EDITABLE_PARTIE_FIELDS = ['nom', 'description', 'commentaires']

function emptyBadge() {
  return {
    statut: 'standby',
    activatedAt: null,
    validatedStage: null,
    validatedAt: null,
    previousSnapshot: null,
    forcedAlert: null,
  }
}

// Les actions de badge (MARK_BADGE, UNDO_BADGE, FORCE_BADGE, SET_FORCED_ALERT,
// ACTIVATE_CHAPITRE) visent soit le chapitre lui-même (action.partieId absent),
// soit une de ses sous-parties (action.partieId présent) — `fn` (une des
// fonctions de badges.js, déjà génériques sur {badgeCours,badgeTD}) s'applique
// au bon objet et le résultat est réinjecté au bon endroit.
function updateChapitreOrPartie(state, id, partieId, fn) {
  return {
    ...state,
    chapitres: state.chapitres.map((c) => {
      if (c.id !== id) return c
      if (!partieId) return fn(c)
      return { ...c, parties: c.parties.map((p) => (p.id === partieId ? fn(p) : p)) }
    }),
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_CHAPITRE': {
      const chapitre = {
        id: newId('ch'),
        courseId: action.courseId,
        side: action.side, // le chapitre n'existe QUE de ce côté (Cours ou TD) — jamais les deux
        nom: action.nom,
        description: '',
        etat: 'pas_commence',
        badgeTD: emptyBadge(),
        badgeCours: emptyBadge(),
        commentaires: '',
        createdAt: Date.now(),
        partitionMode: 'chapitre', // 'chapitre' (un badge pour tout) | 'parties' (un badge par sous-partie)
        parties: [],
      }
      return { ...state, chapitres: [...state.chapitres, chapitre] }
    }
    case 'EDIT_CHAPITRE': {
      const patch = {}
      for (const k of EDITABLE_CHAPITRE_FIELDS) {
        if (k in action.patch) patch[k] = action.patch[k]
      }
      return {
        ...state,
        chapitres: state.chapitres.map((c) => (c.id === action.id ? { ...c, ...patch } : c)),
      }
    }
    case 'DELETE_CHAPITRE':
      return { ...state, chapitres: state.chapitres.filter((c) => c.id !== action.id) }
    case 'ACTIVATE_CHAPITRE':
      return updateChapitreOrPartie(state, action.id, action.partieId, (target) =>
        activateChapitre(target, action.side),
      )
    case 'MARK_BADGE':
      return updateChapitreOrPartie(state, action.id, action.partieId, (target) =>
        markBadgeNow(target, action.side),
      )
    case 'UNDO_BADGE':
      return updateChapitreOrPartie(state, action.id, action.partieId, (target) =>
        undoBadge(target, action.side),
      )
    case 'FORCE_BADGE':
      return updateChapitreOrPartie(state, action.id, action.partieId, (target) =>
        forceBadgeLevel(target, action.side, action.level),
      )
    case 'SET_FORCED_ALERT':
      return updateChapitreOrPartie(state, action.id, action.partieId, (target) =>
        setForcedAlert(target, action.side, action.value),
      )
    case 'SET_PARTITION_MODE':
      return {
        ...state,
        chapitres: state.chapitres.map((c) =>
          c.id === action.id ? { ...c, partitionMode: action.mode } : c,
        ),
      }
    case 'ADD_PARTIE': {
      const partie = {
        id: newId('pt'),
        nom: action.nom,
        description: '',
        commentaires: '',
        badgeCours: emptyBadge(),
        badgeTD: emptyBadge(),
        createdAt: Date.now(),
      }
      return {
        ...state,
        chapitres: state.chapitres.map((c) =>
          c.id === action.chapitreId ? { ...c, parties: [...c.parties, partie] } : c,
        ),
      }
    }
    case 'EDIT_PARTIE': {
      const patch = {}
      for (const k of EDITABLE_PARTIE_FIELDS) {
        if (k in action.patch) patch[k] = action.patch[k]
      }
      return {
        ...state,
        chapitres: state.chapitres.map((c) =>
          c.id === action.chapitreId
            ? { ...c, parties: c.parties.map((p) => (p.id === action.partieId ? { ...p, ...patch } : p)) }
            : c,
        ),
      }
    }
    case 'DELETE_PARTIE':
      return {
        ...state,
        chapitres: state.chapitres.map((c) =>
          c.id === action.chapitreId
            ? { ...c, parties: c.parties.filter((p) => p.id !== action.partieId) }
            : c,
        ),
      }
    case 'ADD_DEVOIR': {
      const devoir = {
        id: newId('dev'),
        nom: action.nom,
        dateEcheance: action.dateEcheance,
        createdAt: Date.now(),
      }
      return { ...state, devoirs: [...state.devoirs, devoir] }
    }
    case 'DELETE_DEVOIR':
      return { ...state, devoirs: state.devoirs.filter((d) => d.id !== action.id) }
    case 'ADD_EXAM': {
      const exam = {
        id: newId('exam'),
        matiere: action.matiere,
        date: action.date,
        createdAt: Date.now(),
      }
      return { ...state, exams: [...state.exams, exam] }
    }
    case 'DELETE_EXAM':
      return { ...state, exams: state.exams.filter((e) => e.id !== action.id) }
    case 'SET_RESOURCE_LINK': {
      const bucket = state.resources[action.courseId] || { revision: null, methode: null, polys: [] }
      return {
        ...state,
        resources: {
          ...state.resources,
          [action.courseId]: { ...bucket, [action.kind]: { url: action.url, label: action.label } },
        },
      }
    }
    case 'DELETE_RESOURCE_LINK': {
      const bucket = state.resources[action.courseId] || { revision: null, methode: null, polys: [] }
      return {
        ...state,
        resources: { ...state.resources, [action.courseId]: { ...bucket, [action.kind]: null } },
      }
    }
    case 'ADD_POLY': {
      const bucket = state.resources[action.courseId] || { revision: null, methode: null, polys: [] }
      const poly = { id: newId('poly'), url: action.url, label: action.label }
      return {
        ...state,
        resources: {
          ...state.resources,
          [action.courseId]: { ...bucket, polys: [...bucket.polys, poly] },
        },
      }
    }
    case 'DELETE_POLY': {
      const bucket = state.resources[action.courseId] || { revision: null, methode: null, polys: [] }
      return {
        ...state,
        resources: {
          ...state.resources,
          [action.courseId]: { ...bucket, polys: bucket.polys.filter((p) => p.id !== action.polyId) },
        },
      }
    }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'IMPORT_STATE': {
      const merged = { ...emptyState(), ...action.state, version: STORAGE_VERSION }
      return { ...merged, chapitres: merged.chapitres.map(migrateChapitre) }
    }
    default:
      return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé sous <StoreProvider>')
  return ctx
}
