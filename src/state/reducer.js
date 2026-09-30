import {
  activateChapitre,
  markBadgeNow,
  undoBadge,
  forceBadgeLevel,
  setForcedAlert,
  badgeStatus,
} from '../logic/badges.js'
import { isSameLocalDay } from '../logic/dates.js'

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
    history: [], // { id, at, chapitreId, courseId, side, level } — un événement par couleur VALIDÉE (clic réel), pour le graphe de progression
    pushSubscriptions: [], // { endpoint, keys: {p256dh, auth} } — un par appareil abonné aux notifications push (optionnel, voir mcp-server/)
    lastPushSentDate: null, // 'YYYY-MM-DD' — évite d'envoyer plus d'un résumé push par jour (cf. mcp-server/src/index.js)
    // Écrits uniquement par le serveur MCP (cron horaire, cf.
    // mcp-server/src/scheduledNotifications.js), jamais par l'app — même
    // principe anti-doublon que lastPushSentDate, mais pour les 3 nouveaux
    // rappels : badges en retard (une fois par créneau horaire), badges
    // devenus actifs aujourd'hui le matin, et rappel du soir pour ceux
    // encore pas validés.
    lastOverdueNotifSlot: null, // 'YYYY-MM-DDTHH' (heure Europe/Paris) du dernier rappel groupé "en retard" envoyé
    lastMorningNotifDate: null, // 'YYYY-MM-DD' (Europe/Paris) du dernier envoi du récap 7h
    lastEveningNotifDate: null, // 'YYYY-MM-DD' (Europe/Paris) du dernier envoi du rappel 18h
    // { id, at } — un par suppression (chapitre, devoir, partiel, partie,
    // sous-partie, lien de ressource, poly). Sans ça, la fusion additive de
    // mergeStates (conçue pour ne jamais perdre un AJOUT concurrent) ne peut
    // pas distinguer "un autre appareil vient d'ajouter ceci" de "je viens
    // de le supprimer, le serveur ne le sait juste pas encore" — dans les
    // deux cas l'élément manque en local mais existe côté distant, donc sans
    // tombstone la fusion le "ressuscite" en le rajoutant. Concrètement,
    // sans ce champ, une suppression était annulée dès le cycle
    // sync→fusion→réécriture suivant, y compris sur l'appareil qui vient de
    // supprimer (son propre push relit le distant, pas encore à jour, juste
    // avant d'écrire). Voir mergeStates/mergeById plus bas.
    deletedIds: [],
  }
}

// Le journal ne garde que les N derniers événements, pour ne pas laisser le
// document Firestore grossir indéfiniment au fil des années.
const MAX_HISTORY = 300
// Même principe pour les tombstones de suppression : inutile de les garder
// indéfiniment une fois que tous les appareils ont eu l'occasion de
// synchroniser (largement le cas après quelques centaines de suppressions).
const MAX_DELETED_IDS = 500

function appendHistory(state, event) {
  const history = [...state.history, event]
  return history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history
}

function appendTombstones(state, ids) {
  const now = Date.now()
  const deletedIds = [...state.deletedIds, ...ids.map((id) => ({ id, at: now }))]
  return deletedIds.length > MAX_DELETED_IDS ? deletedIds.slice(deletedIds.length - MAX_DELETED_IDS) : deletedIds
}

function appendTombstone(state, id) {
  return appendTombstones(state, [id])
}

// revision/methode n'ont pas d'id propre (un seul lien par matière et par
// champ, pas un tableau) — clé synthétique pour pouvoir quand même les
// tombstoner comme le reste.
function resourceLinkTombstoneId(courseId, kind) {
  return `resource:${courseId}:${kind}`
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
    // Position d'affichage dans la liste (cf. SET_CHAPITRE_POSITION) — par
    // défaut égale à createdAt, donc identique au tri chronologique existant
    // tant que personne n'a forcé de position à la main. Un chapitre
    // recréé après une suppression accidentelle a un createdAt tout récent
    // et atterrit sinon en bas de liste ; forcer sa position le remet là où
    // il devrait être sans devoir re-taper tout le sommaire dans le bon ordre.
    ordre: c.ordre ?? c.createdAt,
  }
}

// Anciens partiels sans `notes`/`prepStatut` (ajoutés pour la fiche détaillée) —
// on les complète plutôt que de perdre les partiels déjà enregistrés.
export function migrateExam(e) {
  return { ...e, notes: e.notes ?? '', prepStatut: e.prepStatut ?? null }
}

// Anciens devoirs sans `fait`/`courseId`/`faitAt` (ajoutés au fil du temps :
// pouvoir les clore, les rattacher à une matière, savoir depuis quand ils
// sont faits) — complétés plutôt que perdus. Un devoir déjà fait avant
// l'ajout de `faitAt` reste affiché (pas de date connue à comparer) plutôt
// que de risquer de le faire disparaître par surprise.
export function migrateDevoir(d) {
  return { ...d, fait: d.fait ?? false, courseId: d.courseId ?? null, faitAt: d.faitAt ?? null }
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
      const now = Date.now()
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
        createdAt: now,
        ordre: now, // position d'affichage — cf. migrateChapitre/SET_CHAPITRE_POSITION
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
    // Force la position d'affichage d'un chapitre parmi ses "frères" (même
    // matière ET même côté Cours/TD — le seul groupe dans lequel un ordre a
    // un sens, cf. tri de CourseDetailScreen/CourseListScreen/exportData).
    // `position` est un rang 1-based tel que vu par l'utilisateur ; on
    // retire le chapitre visé de la liste triée de ses frères, on le
    // réinsère à ce rang (borné à la taille du groupe), puis on réattribue
    // un `ordre` entier séquentiel à TOUT le groupe — pas seulement au
    // chapitre déplacé — pour que l'ordre reste total et sans collision,
    // sans jamais toucher aux chapitres des autres matières/côtés.
    case 'SET_CHAPITRE_POSITION': {
      const target = state.chapitres.find((c) => c.id === action.id)
      if (!target) return state
      const siblingIds = state.chapitres
        .filter((c) => c.courseId === target.courseId && c.side === target.side)
        .sort((a, b) => (a.ordre ?? a.createdAt) - (b.ordre ?? b.createdAt))
        .map((c) => c.id)
      const withoutTarget = siblingIds.filter((sid) => sid !== action.id)
      const clamped = Math.max(1, Math.min(action.position, withoutTarget.length + 1))
      withoutTarget.splice(clamped - 1, 0, action.id)
      const ordreById = new Map(withoutTarget.map((sid, i) => [sid, i]))
      return {
        ...state,
        chapitres: state.chapitres.map((c) => (ordreById.has(c.id) ? { ...c, ordre: ordreById.get(c.id) } : c)),
      }
    }
    case 'DELETE_CHAPITRE':
      return {
        ...state,
        chapitres: state.chapitres.filter((c) => c.id !== action.id),
        deletedIds: appendTombstone(state, action.id),
      }
    case 'ACTIVATE_CHAPITRE':
      return updateChapitre(state, action.id, (c) => activateChapitre(c, action.side))
    case 'MARK_BADGE': {
      const chapitre = state.chapitres.find((c) => c.id === action.id)
      if (!chapitre) return state
      const status = badgeStatus(chapitre, action.side, Date.now())
      const next = updateChapitre(state, action.id, (c) => markBadgeNow(c, action.side))
      // Un seul événement par clic réel (badge encore en attente = pas de
      // clic possible, markBadgeNow n'aurait rien changé) — c'est la
      // couleur qu'on vient de valider, pas celle qu'on atteint après.
      if (status.phase !== 'active') return next
      return {
        ...next,
        history: appendHistory(next, {
          id: newId('hist'),
          at: Date.now(),
          chapitreId: chapitre.id,
          courseId: chapitre.courseId,
          side: action.side,
          level: status.level,
        }),
      }
    }
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
        deletedIds: appendTombstone(state, action.partieId),
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
      return {
        ...updatePartie(state, action.chapitreId, action.partieId, (p) => ({
          ...p,
          sousParties: p.sousParties.filter((sp) => sp.id !== action.sousPartieId),
        })),
        deletedIds: appendTombstone(state, action.sousPartieId),
      }
    case 'ADD_DEVOIR': {
      const devoir = {
        id: newId('dev'),
        nom: action.nom,
        dateEcheance: action.dateEcheance,
        courseId: action.courseId ?? null,
        fait: false,
        faitAt: null,
        createdAt: Date.now(),
      }
      return { ...state, devoirs: [...state.devoirs, devoir] }
    }
    case 'TOGGLE_DEVOIR_FAIT':
      return {
        ...state,
        devoirs: state.devoirs.map((d) => {
          if (d.id !== action.id) return d
          const fait = !d.fait
          // Cocher un devoir l'envoie à la corbeille (faitAt = maintenant,
          // cf. PURGE_TRASHED_DEVOIRS) ; le décocher = "Annuler" depuis la
          // corbeille, qui l'en retire aussitôt (cf. DevoirsTrashModal.jsx).
          return { ...d, fait, faitAt: fait ? Date.now() : null }
        }),
      }
    case 'DELETE_DEVOIR':
      return {
        ...state,
        devoirs: state.devoirs.filter((d) => d.id !== action.id),
        deletedIds: appendTombstone(state, action.id),
      }
    // Vide la corbeille des devoirs cochés depuis un jour civil local
    // antérieur à `action.now` — un devoir coché n'y reste donc qu'un jour
    // avant d'être définitivement supprimé (cf. DevoirsScreen.jsx). Référence
    // inchangée si rien à purger, pour ne pas déclencher un re-render/sync
    // inutile à chaque appel périodique (cf. App.jsx). Tombstone chaque
    // devoir purgé, sinon un appareil qui n'a pas encore vu la purge (ou le
    // propre prochain cycle de sync de cet appareil) le ressuscite.
    case 'PURGE_TRASHED_DEVOIRS': {
      const isStale = (d) => d.fait && d.faitAt && !isSameLocalDay(d.faitAt, action.now)
      const stale = state.devoirs.filter(isStale)
      if (stale.length === 0) return state
      return {
        ...state,
        devoirs: state.devoirs.filter((d) => !isStale(d)),
        deletedIds: appendTombstones(state, stale.map((d) => d.id)),
      }
    }
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
      return {
        ...state,
        exams: state.exams.filter((e) => e.id !== action.id),
        deletedIds: appendTombstone(state, action.id),
      }
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
        deletedIds: appendTombstone(state, resourceLinkTombstoneId(action.courseId, action.kind)),
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
        deletedIds: appendTombstone(state, action.polyId),
      }
    }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SUBSCRIBE_PUSH': {
      const exists = state.pushSubscriptions.some((s) => s.endpoint === action.subscription.endpoint)
      if (exists) return state
      return { ...state, pushSubscriptions: [...state.pushSubscriptions, action.subscription] }
    }
    case 'UNSUBSCRIBE_PUSH':
      return {
        ...state,
        pushSubscriptions: state.pushSubscriptions.filter((s) => s.endpoint !== action.endpoint),
      }
    case 'IMPORT_STATE':
      return normalizeState({ ...action.state, version: STORAGE_VERSION })
    default:
      return state
  }
}

// Fusionne un tableau distant dans le tableau local en n'ajoutant QUE ce qui
// manque localement (union par id) — jamais d'écrasement d'un élément qu'on a
// déjà. Utilisé des deux côtés de la sync (envoi ET réception) pour qu'un
// appareil ne puisse jamais effacer silencieusement ce qu'un autre vient
// d'ajouter, même en cas d'événement mal chronométré (ex. un partiel tapé
// pile pendant qu'une mise à jour distante arrive).
//
// `deletedIds` (les tombstones de mergeStates) est ce qui distingue un ajout
// concurrent (à garder) d'une suppression pas encore vue par l'autre côté (à
// ne PAS ressusciter) — sans lui, tout id absent du local mais présent côté
// distant serait traité comme un ajout, y compris juste après l'avoir
// supprimé soi-même : le tout premier cycle sync→fusion→réécriture qui suit
// une suppression relit encore l'ancien distant (pas à jour) et rajoutait
// l'élément avant même que la suppression ait eu la moindre chance d'être
// écrite. Avec `deletedIds`, on retire aussi les entrées déjà tombstonées du
// LOCAL (pas seulement du distant) : un appareil resté longtemps hors ligne,
// qui a donc encore une copie qu'un autre a supprimée entre-temps, la perd
// dès qu'il reçoit ce tombstone — plutôt que de la garder indéfiniment et de
// risquer de la ressusciter à son tour à son prochain push.
export function mergeById(localArr, remoteArr, deletedIds = new Set()) {
  const local = deletedIds.size ? localArr.filter((x) => !deletedIds.has(x.id)) : localArr
  if (!remoteArr?.length) return local
  const localIds = new Set(local.map((x) => x.id))
  const onlyRemote = remoteArr.filter((x) => !localIds.has(x.id) && !deletedIds.has(x.id))
  return onlyRemote.length ? [...local, ...onlyRemote] : local
}

// Même principe que mergeById, mais par `endpoint` — les abonnements push
// n'ont pas d'`id`, leur endpoint (l'URL du service de push du navigateur)
// en tient déjà lieu de clé naturelle.
function mergeByEndpoint(localArr, remoteArr) {
  if (!remoteArr?.length) return localArr
  const localEndpoints = new Set(localArr.map((x) => x.endpoint))
  const onlyRemote = remoteArr.filter((x) => !localEndpoints.has(x.endpoint))
  return onlyRemote.length ? [...localArr, ...onlyRemote] : localArr
}

// mergeById seul suffit pour un tableau de "feuilles" (exams, devoirs...),
// mais un chapitre a un sommaire (parties → sous-parties) qui peut être
// modifié à distance (serveur MCP) sans qu'aucun appareil local n'ait
// jamais vu ce changement précis — mergeById au niveau du chapitre, lui,
// ne regarderait que l'id du chapitre : le chapitre existant localement
// "gagnerait" tel quel, effaçant silencieusement toute partie/sous-partie
// ajoutée côté serveur au prochain cycle sync→fusion→réécriture de cet
// appareil (c'est le bug que ça corrige). On refait donc la même fusion
// additive par id, mais un niveau plus profond : partie par partie, puis
// sous-partie par sous-partie.
function mergeSommaire(localParties, remoteParties, deletedIds) {
  const local = deletedIds.size ? localParties.filter((p) => !deletedIds.has(p.id)) : localParties
  if (!remoteParties?.length) return local
  const localIds = new Set(local.map((p) => p.id))
  const merged = local.map((p) => {
    const remoteP = remoteParties.find((rp) => rp.id === p.id)
    if (!remoteP) return p
    return { ...p, sousParties: mergeById(p.sousParties ?? [], remoteP.sousParties, deletedIds) }
  })
  const onlyRemote = remoteParties.filter((rp) => !localIds.has(rp.id) && !deletedIds.has(rp.id))
  return onlyRemote.length ? [...merged, ...onlyRemote] : merged
}

function mergeChapitres(localArr, remoteArr, deletedIds) {
  const local = deletedIds.size ? localArr.filter((c) => !deletedIds.has(c.id)) : localArr
  if (!remoteArr?.length) return local
  const remoteById = new Map(remoteArr.map((c) => [c.id, c]))
  const merged = local.map((c) => {
    const remoteC = remoteById.get(c.id)
    if (!remoteC) return c
    return { ...c, parties: mergeSommaire(c.parties ?? [], remoteC.parties, deletedIds) }
  })
  const localIds = new Set(local.map((c) => c.id))
  const onlyRemote = remoteArr.filter((c) => !localIds.has(c.id) && !deletedIds.has(c.id))
  return onlyRemote.length ? [...merged, ...onlyRemote] : merged
}

// `resources` a la même forme de piège que `chapitres` avant sa fusion
// dédiée : un objet keyé par courseId, jamais parcouru par mergeById (qui
// ne sait fusionner que des tableaux). Sans ça, `{...local}` dans
// mergeStates prend `resources` intégralement du côté local — un appareil
// dont la copie locale de `resources` est en retard (ou vide, ex. juste
// après une réinstallation / un cache vidé) efface silencieusement au
// prochain push tout lien ajouté ailleurs (ex. via le serveur MCP). Même
// principe de fusion additive : par matière, puis par champ.
function mergeResourceBucket(courseId, localBucket, remoteBucket, deletedIds) {
  const revisionGone = deletedIds.has(resourceLinkTombstoneId(courseId, 'revision'))
  const methodeGone = deletedIds.has(resourceLinkTombstoneId(courseId, 'methode'))
  if (!remoteBucket) {
    if (!revisionGone && !methodeGone) return localBucket ?? null
    const local = localBucket ?? { revision: null, methode: null, polys: [] }
    return { ...local, revision: revisionGone ? null : local.revision, methode: methodeGone ? null : local.methode }
  }
  const local = localBucket ?? { revision: null, methode: null, polys: [] }
  return {
    revision: revisionGone ? null : (local.revision ?? remoteBucket.revision ?? null),
    methode: methodeGone ? null : (local.methode ?? remoteBucket.methode ?? null),
    polys: mergeById(local.polys ?? [], remoteBucket.polys ?? [], deletedIds),
  }
}

function mergeResources(localRes, remoteRes, deletedIds) {
  if (!remoteRes && deletedIds.size === 0) return localRes
  const merged = { ...localRes }
  const courseIds = new Set([...Object.keys(localRes ?? {}), ...Object.keys(remoteRes ?? {})])
  for (const courseId of courseIds) {
    merged[courseId] = mergeResourceBucket(courseId, localRes?.[courseId], remoteRes?.[courseId], deletedIds)
  }
  return merged
}

// mergeById est additive et ne raccourcit jamais — sur `history`, laissé
// tel quel, un cycle sync→fusion→réécriture pourrait donc repousser le
// document Firestore au-delà de la limite MAX_HISTORY que seul appendHistory
// (au clic réel d'une couleur) fait normalement respecter. On réapplique
// donc la même coupe ici, en gardant les événements les plus récents.
function mergeHistory(localArr, remoteArr) {
  const merged = mergeById(localArr, remoteArr)
  if (!merged || merged.length <= MAX_HISTORY) return merged
  return [...merged].sort((a, b) => a.at - b.at).slice(merged.length - MAX_HISTORY)
}

// Les tombstones eux-mêmes se fusionnent en additif classique (par id) — un
// appareil doit connaître les suppressions faites ailleurs pour ne pas les
// ressusciter à son tour — plafonné comme `history`, en gardant les plus
// récents.
function mergeTombstones(localArr, remoteArr) {
  const merged = mergeById(localArr ?? [], remoteArr)
  if (merged.length <= MAX_DELETED_IDS) return merged
  return [...merged].sort((a, b) => a.at - b.at).slice(merged.length - MAX_DELETED_IDS)
}

export function mergeStates(local, remote) {
  if (!remote) return local
  // Union des tombstones LOCAUX et DISTANTS : une suppression faite sur cet
  // appareil doit continuer à se protéger elle-même (local), et une
  // suppression faite ailleurs et déjà remontée au serveur doit aussi
  // empêcher CET appareil de ressusciter sa propre copie périmée (distant) —
  // cf. le commentaire de mergeById plus haut.
  const deletedIds = new Set([...(local.deletedIds ?? []), ...(remote.deletedIds ?? [])].map((d) => d.id))
  return {
    ...local,
    exams: mergeById(local.exams, remote.exams, deletedIds),
    devoirs: mergeById(local.devoirs, remote.devoirs, deletedIds),
    chapitres: mergeChapitres(local.chapitres, remote.chapitres, deletedIds),
    resources: mergeResources(local.resources, remote.resources, deletedIds),
    history: mergeHistory(local.history, remote.history),
    pushSubscriptions: mergeByEndpoint(local.pushSubscriptions, remote.pushSubscriptions),
    deletedIds: mergeTombstones(local.deletedIds, remote.deletedIds),
    // Écrit uniquement côté serveur (cron de notifications push dans
    // mcp-server/, jamais par l'app) — on prend toujours la valeur distante
    // la plus fraîche plutôt que de risquer d'écraser son garde-fou
    // anti-doublon avec une copie locale périmée (l'app elle-même ne
    // modifie jamais ce champ).
    lastPushSentDate: remote.lastPushSentDate ?? local.lastPushSentDate,
    lastOverdueNotifSlot: remote.lastOverdueNotifSlot ?? local.lastOverdueNotifSlot,
    lastMorningNotifDate: remote.lastMorningNotifDate ?? local.lastMorningNotifDate,
    lastEveningNotifDate: remote.lastEveningNotifDate ?? local.lastEveningNotifDate,
  }
}
