import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { activateChapitre, markBadgeNow } from '../logic/badges'

const STORAGE_KEY = 'l3-physique-dashboard'
const STORAGE_VERSION = 1

function emptyState() {
  return {
    version: STORAGE_VERSION,
    theme: 'glacier',
    exams: [], // { id, matiere, date, createdAt } — les partiels
    devoirs: [], // { id, nom, dateEcheance, createdAt }
    chapitres: [], // voir src/logic/badges.js pour la forme d'un chapitre
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyState()
    return { ...emptyState(), ...parsed }
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

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_CHAPITRE': {
      const chapitre = {
        id: newId('ch'),
        courseId: action.courseId,
        nom: action.nom,
        description: '',
        etat: 'pas_commence',
        statut: 'standby',
        activatedAt: null,
        badgeTD: { lastActionAt: null },
        badgeCours: { lastActionAt: null },
        commentaires: '',
        createdAt: Date.now(),
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
      return {
        ...state,
        chapitres: state.chapitres.map((c) => (c.id === action.id ? activateChapitre(c) : c)),
      }
    case 'MARK_BADGE':
      return {
        ...state,
        chapitres: state.chapitres.map((c) =>
          c.id === action.id ? markBadgeNow(c, action.side) : c,
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
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'IMPORT_STATE':
      return { ...emptyState(), ...action.state, version: STORAGE_VERSION }
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
