import { activateChapitre, markBadgeNow, undoBadge, forceBadgeLevel, setForcedAlert } from '../logic/badges.js'

// Logique d'état pure (reducer + migrations + fusion de sync) — aucune
// dépendance à React ni à Firebase, pour pouvoir être réutilisée telle
// quelle par autre chose que l'app (ex. le serveur MCP dans mcp-server/,
// qui applique les mêmes actions sur le même document Firestore plutôt que
// de dupliquer cette logique).

export const STORAGE_VERSION = 1

export function emptyState() {
  return {
    version: STORAGE_VERSION,
    theme: 'glacier',
    exams: [], // { id, matiere, date, notes, prepStatut, createdAt } — les partiels
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

// Anciennes parties (avant qu'elles ne deviennent un simple sommaire) avaient
// chacune leur propre badgeCours/badgeTD — cette notion a disparu (le badge
// ne vit plus qu'au niveau du chapitre) ; on garde juste ce qui a été tapé
// (nom), rien d'autre à migrer puisque badges/description/commentaires
// n'ont plus d'équivalent.
function migratePartie(p) {
  return {
    id: p.id,
    nom: p.nom,
    createdAt: p.createdAt ?? Date.now(),
    sousParties: (p.sousParties ?? []).map((sp) => ({
      id: sp.id,
      nom: sp.nom,
      createdAt: sp.createdAt ?? Date.now(),
    })),
  }
}

export function migrateChapitre(c) {
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
    // `parties` est maintenant un simple sommaire (parties → sous-parties,
    // juste des noms, aucun badge) — voir migratePartie. `partitionMode`
    // (ancien choix "un badge par partie") n'existe plus : un chapitre n'a
    // toujours qu'un seul badge, quel que soit son sommaire.
    parties: (c.parties ?? []).map(migratePartie),
  }
}

// Anciens partiels sans `notes`/`prepStatut` (ajoutés pour la fiche détaillée) —
// on les complète plutôt que de perdre les partiels déjà enregistrés.
export function migrateExam(e) {
  return { ...e, notes: e.notes ?? '', prepStatut: e.prepStatut ?? null }
}

// Anciens devoirs sans `fait`/`courseId` (ajoutés pour pouvoir les clore et
// les rattacher à une matière) — complétés plutôt que perdus.
export function migrateDevoir(d) {
  return { ...d, fait: d.fait ?? false, courseId: d.courseId ?? null }
}

/** Reconstruit un état complet et migré à partir de données brutes (venant
 * de localStorage ou de Firestore) — mêmes règles des deux côtés. */
export function normalizeState(raw) {
  const merged = { ...emptyState(), ...raw }
  return {
    ...merged,
    chapitres: merged.chapitres.map(migrateChapitre),
    exams: merged.exams.map(migrateExam),
    devoirs: merged.devoirs.map(migrateDevoir),
  }
}

export function newId(prefix) {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}-${rand}`
}

// Champs qu'une édition "nom/description" a le droit de toucher — jamais les
// horloges de badges ni la date d'activation (voir spec, Partie 5).
export const EDITABLE_CHAPITRE_FIELDS = ['nom', 'description', 'etat', 'commentaires']
// Une partie/sous-partie du sommaire n'est plus qu'un nom (plus de badge, plus
// de description/commentaires séparés — c'est juste un plan de ce qu'il y a
// dans le chapitre).
export const EDITABLE_PARTIE_FIELDS = ['nom']
export const EDITABLE_SOUS_PARTIE_FIELDS = ['nom']
export const EDITABLE_EXAM_FIELDS = ['notes', 'prepStatut']

export function emptyBadge() {
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
// ACTIVATE_CHAPITRE) visent toujours le chapitre lui-même — `fn` (une des
// fonctions de badges.js, déjà génériques sur {badgeCours,badgeTD}) s'applique
// au chapitre trouvé par id.
function updateChapitre(state, id, fn) {
  return { ...state, chapitres: state.chapitres.map((c) => (c.id === id ? fn(c) : c)) }
}

// Les actions sur une partie/sous-partie du sommaire visent une partie du
// chapitre `chapitreId` (fn s'applique à cette partie) ou, si `sousPartieId`
// est fourni, une sous-partie précise à l'intérieur de cette partie.
function updatePartie(state, chapitreId, partieId, fn) {
  return {
    ...state,
    chapitres: state.chapitres.map((c) =>
      c.id === chapitreId
        ? { ...c, parties: c.parties.map((p) => (p.id === partieId ? fn(p) : p)) }
        : c,
    ),
  }
}

function updateSousPartie(state, chapitreId, partieId, sousPartieId, fn) {
  return updatePartie(state, chapitreId, partieId, (p) => ({
    ...p,
    sousParties: p.sousParties.map((sp) => (sp.id === sousPartieId ? fn(sp) : sp)),
  }))
}

export function reducer(state, action) {
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
        parties: [], // sommaire (plan) du chapitre — voir ADD_PARTIE/ADD_SOUS_PARTIE, sans rapport avec le badge
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
      return updateChapitre(state, action.id, (c) => activateChapitre(c, action.side))
    case 'MARK_BADGE':
      return updateChapitre(state, action.id, (c) => markBadgeNow(c, action.side))
    case 'UNDO_BADGE':
      return updateChapitre(state, action.id, (c) => undoBadge(c, action.side))
    case 'FORCE_BADGE':
      return updateChapitre(state, action.id, (c) => forceBadgeLevel(c, action.side, action.level))
    case 'SET_FORCED_ALERT':
      return updateChapitre(state, action.id, (c) => setForcedAlert(c, action.side, action.value))
    case 'ADD_PARTIE': {
      const partie = { id: newId('pt'), nom: action.nom, createdAt: Date.now(), sousParties: [] }
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
      return updatePartie(state, action.chapitreId, action.partieId, (p) => ({ ...p, ...patch }))
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
    case 'ADD_SOUS_PARTIE': {
      const sousPartie = { id: newId('sp'), nom: action.nom, createdAt: Date.now() }
      return updatePartie(state, action.chapitreId, action.partieId, (p) => ({
        ...p,
        sousParties: [...p.sousParties, sousPartie],
      }))
    }
    case 'EDIT_SOUS_PARTIE': {
      const patch = {}
      for (const k of EDITABLE_SOUS_PARTIE_FIELDS) {
        if (k in action.patch) patch[k] = action.patch[k]
      }
      return updateSousPartie(state, action.chapitreId, action.partieId, action.sousPartieId, (sp) => ({
        ...sp,
        ...patch,
      }))
    }
    case 'DELETE_SOUS_PARTIE':
      return updatePartie(state, action.chapitreId, action.partieId, (p) => ({
        ...p,
        sousParties: p.sousParties.filter((sp) => sp.id !== action.sousPartieId),
      }))
    case 'ADD_DEVOIR': {
      const devoir = {
        id: newId('dev'),
        nom: action.nom,
        dateEcheance: action.dateEcheance,
        courseId: action.courseId ?? null,
        fait: false,
        createdAt: Date.now(),
      }
      return { ...state, devoirs: [...state.devoirs, devoir] }
    }
    case 'TOGGLE_DEVOIR_FAIT':
      return {
        ...state,
        devoirs: state.devoirs.map((d) => (d.id === action.id ? { ...d, fait: !d.fait } : d)),
      }
    case 'DELETE_DEVOIR':
      return { ...state, devoirs: state.devoirs.filter((d) => d.id !== action.id) }
    case 'ADD_EXAM': {
      const exam = {
        id: newId('exam'),
        matiere: action.matiere,
        date: action.date,
        notes: '',
        prepStatut: null, // null (à faire) | 'urgent' | 'fait'
        createdAt: Date.now(),
      }
      return { ...state, exams: [...state.exams, exam] }
    }
    case 'EDIT_EXAM': {
      const patch = {}
      for (const k of EDITABLE_EXAM_FIELDS) {
        if (k in action.patch) patch[k] = action.patch[k]
      }
      return {
        ...state,
        exams: state.exams.map((e) => (e.id === action.id ? { ...e, ...patch } : e)),
      }
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
    case 'IMPORT_STATE':
      return normalizeState({ ...action.state, version: STORAGE_VERSION })
    default:
      return state
  }
}

// Fusionne un tableau distant dans le tableau local en n'ajoutant QUE ce qui
// manque localement (union par id) — jamais de suppression, jamais d'écrasement
// d'un élément qu'on a déjà. Utilisé des deux côtés de la sync (envoi ET
// réception) pour qu'un appareil ne puisse jamais effacer silencieusement ce
// qu'un autre vient d'ajouter, même en cas d'événement mal chronométré (ex. un
// partiel tapé pile pendant qu'une mise à jour distante arrive). Contrepartie
// assumée : une suppression faite sur un appareil peut être "ressuscitée" si
// l'autre appareil pousse encore l'ancienne version avant d'avoir vu la
// suppression — accepté, perdre une donnée tapée est pire qu'un doublon à
// re-supprimer.
export function mergeById(localArr, remoteArr) {
  if (!remoteArr?.length) return localArr
  const localIds = new Set(localArr.map((x) => x.id))
  const onlyRemote = remoteArr.filter((x) => !localIds.has(x.id))
  return onlyRemote.length ? [...localArr, ...onlyRemote] : localArr
}

export function mergeStates(local, remote) {
  if (!remote) return local
  return {
    ...local,
    exams: mergeById(local.exams, remote.exams),
    devoirs: mergeById(local.devoirs, remote.devoirs),
    chapitres: mergeById(local.chapitres, remote.chapitres),
  }
}
