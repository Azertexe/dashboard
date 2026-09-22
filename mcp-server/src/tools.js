import { reducer, normalizeState } from '../../src/state/reducer.js'
import { badgeStatus, needsAttention } from '../../src/logic/badges.js'
import { daysBetween } from '../../src/logic/dates.js'
import { COURSES, courseName } from '../../src/data/courses.js'
import { etatLabel } from '../../src/data/etats.js'
import { fetchState, writeState } from './firestore.js'

// Chaque outil d'écriture relit l'état distant le plus frais juste avant
// d'appliquer son action (même filet que src/state/store.jsx côté app) pour
// réduire la fenêtre de course avec un autre appareil qui synchronise en
// même temps, plutôt que d'écrire en aveugle par-dessus.
async function applyAction(action) {
  const remote = await fetchState()
  const current = normalizeState(remote ?? {})
  const next = reducer(current, action)
  await writeState(next)
  return next
}

function summarizeBadge(chapitre, side, now) {
  const status = badgeStatus(chapitre, side, now)
  return { ...status, alerte: needsAttention(chapitre, side, now) }
}

// Le sommaire (parties/sous-parties) n'est qu'un plan texte, sans rapport
// avec le badge — qui reste unique par chapitre, cf. reducer.js.
function summarizeSommaire(c) {
  return (c.parties ?? []).map((p) => ({
    id: p.id,
    nom: p.nom,
    sousParties: (p.sousParties ?? []).map((sp) => ({ id: sp.id, nom: sp.nom })),
  }))
}

function summarizeChapitre(c, now) {
  return {
    id: c.id,
    courseId: c.courseId,
    matiere: courseName(c.courseId),
    side: c.side,
    nom: c.nom,
    etat: c.etat,
    etatLabel: etatLabel(c.etat),
    description: c.description,
    commentaires: c.commentaires,
    badge: summarizeBadge(c, c.side, now),
    sommaire: summarizeSommaire(c),
  }
}

function summarizeExam(e, now) {
  return {
    id: e.id,
    matiere: e.matiere,
    date: e.date,
    joursRestants: daysBetween(now, e.date),
    notes: e.notes,
    prepStatut: e.prepStatut,
  }
}

function summarizeDevoir(d, now) {
  return {
    id: d.id,
    nom: d.nom,
    dateEcheance: d.dateEcheance,
    joursRestants: daysBetween(now, d.dateEcheance),
    fait: d.fait,
    courseId: d.courseId,
    matiere: d.courseId ? courseName(d.courseId) : null,
  }
}

function summarizeResources(resources) {
  const out = {}
  for (const [courseId, bucket] of Object.entries(resources ?? {})) {
    out[courseName(courseId)] = {
      revision: bucket.revision,
      methode: bucket.methode,
      polys: bucket.polys ?? [],
    }
  }
  return out
}

async function getStateSummary() {
  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  const now = Date.now()
  return {
    theme: state.theme,
    matieres: COURSES.map((c) => ({ id: c.id, nom: c.nom })),
    chapitres: state.chapitres.map((c) => summarizeChapitre(c, now)),
    partiels: [...state.exams].sort((a, b) => a.date.localeCompare(b.date)).map((e) => summarizeExam(e, now)),
    devoirs: [...state.devoirs]
      .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
      .map((d) => summarizeDevoir(d, now)),
    ressources: summarizeResources(state.resources),
  }
}

// Vue condensée "qu'est-ce qui presse" — pensée pour être appelée seule,
// sans avoir à relire tout get_state pour répondre à "qu'est-ce qui est en
// retard/approche ?". Mêmes seuils que l'Agenda de l'app pour les badges
// (orange/jaune actifs) ; 7 jours pour les devoirs, 14 pour les partiels
// (fenêtres un peu plus larges puisqu'un partiel se prépare à l'avance).
const DIGEST_DEVOIR_WINDOW_DAYS = 7
const DIGEST_PARTIEL_WINDOW_DAYS = 14

// Version pure (état déjà chargé) — réutilisée par le cron de notifications
// push (digestPush.js) pour éviter un deuxième aller-retour Firestore en
// plus de celui déjà fait pour lire pushSubscriptions/lastPushSentDate.
export function computeDigest(state, now) {
  const enRetard = state.chapitres.filter((c) => needsAttention(c, c.side, now)).map((c) => summarizeChapitre(c, now))
  const devoirsProches = state.devoirs
    .filter((d) => !d.fait && daysBetween(now, d.dateEcheance) <= DIGEST_DEVOIR_WINDOW_DAYS)
    .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
    .map((d) => summarizeDevoir(d, now))
  const partielsProches = state.exams
    .filter((e) => daysBetween(now, e.date) >= 0 && daysBetween(now, e.date) <= DIGEST_PARTIEL_WINDOW_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => summarizeExam(e, now))
  return { enRetard, devoirsProches, partielsProches }
}

async function getDigest() {
  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  return computeDigest(state, Date.now())
}

const SIDE_ENUM = ['cours', 'td']
const COURSE_ID_ENUM = COURSES.map((c) => c.id)
const ETAT_ENUM = ['pas_commence', 'en_cours', 'fragile', 'solide']
const PREP_STATUT_ENUM = ['urgent', 'fait', null]

const idProp = (desc) => ({ type: 'string', description: desc })

export const TOOLS = [
  {
    name: 'get_state',
    description:
      "Lit l'état complet et à jour du dashboard L3 Physique : chapitres (Cours et TD) avec le statut de leur badge de révision (phase, couleur, jours restants avant que la couleur active change) et leur sommaire (parties/sous-parties, un plan texte sans rapport avec le badge), plus partiels et devoirs (avec jours restants). Toujours appeler cet outil avant de modifier quoi que ce soit, pour avoir les bons id.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => getStateSummary(),
  },
  {
    name: 'get_digest',
    description:
      "Résumé condensé de ce qui presse maintenant, sans avoir à relire tout get_state : chapitres avec un badge en retard (orange/jaune actif), devoirs pas faits dans les 7 prochains jours, partiels dans les 14 prochains jours. À utiliser pour répondre directement à \"qu'est-ce qu'il y a à faire ?\".",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => getDigest(),
  },
  {
    name: 'add_partiel',
    description: 'Ajoute un nouveau partiel (examen).',
    inputSchema: {
      type: 'object',
      properties: {
        matiere: { type: 'string', description: 'Nom de la matière, ex. "Optique cohérente"' },
        date: { type: 'string', description: 'Date au format YYYY-MM-DD, dans l\'année scolaire 2026-2027' },
      },
      required: ['matiere', 'date'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'ADD_EXAM', matiere: args.matiere, date: args.date }),
  },
  {
    name: 'edit_partiel',
    description:
      "Modifie les notes (\"ce qu'il y aura\") et/ou le badge d'avancement d'un partiel existant.",
    inputSchema: {
      type: 'object',
      properties: {
        id: idProp("id du partiel (voir get_state)"),
        notes: { type: 'string', description: "Contenu du partiel, en texte libre" },
        prepStatut: { type: ['string', 'null'], enum: PREP_STATUT_ENUM, description: 'null = aucun badge' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const patch = {}
      if ('notes' in args) patch.notes = args.notes
      if ('prepStatut' in args) patch.prepStatut = args.prepStatut
      return applyAction({ type: 'EDIT_EXAM', id: args.id, patch })
    },
  },
  {
    name: 'delete_partiel',
    description: 'Supprime un partiel.',
    inputSchema: {
      type: 'object',
      properties: { id: idProp('id du partiel (voir get_state)') },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'DELETE_EXAM', id: args.id }),
  },
  {
    name: 'add_devoir',
    description: 'Ajoute un nouveau devoir avec sa date limite, optionnellement rattaché à une matière.',
    inputSchema: {
      type: 'object',
      properties: {
        nom: { type: 'string' },
        dateEcheance: { type: 'string', description: "Date au format YYYY-MM-DD, dans l'année scolaire 2026-2027" },
        courseId: { type: 'string', enum: COURSE_ID_ENUM, description: 'optionnel — voir get_state → matieres' },
      },
      required: ['nom', 'dateEcheance'],
      additionalProperties: false,
    },
    handler: (args) =>
      applyAction({ type: 'ADD_DEVOIR', nom: args.nom, dateEcheance: args.dateEcheance, courseId: args.courseId }),
  },
  {
    name: 'toggle_devoir_fait',
    description: "Bascule un devoir entre fait et pas fait.",
    inputSchema: {
      type: 'object',
      properties: { id: idProp('id du devoir (voir get_state)') },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'TOGGLE_DEVOIR_FAIT', id: args.id }),
  },
  {
    name: 'delete_devoir',
    description: 'Supprime un devoir.',
    inputSchema: {
      type: 'object',
      properties: { id: idProp('id du devoir (voir get_state)') },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'DELETE_DEVOIR', id: args.id }),
  },
  {
    name: 'add_chapitre',
    description: "Ajoute un chapitre à une matière, côté Cours ou TD (un chapitre n'existe que d'un seul côté).",
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', enum: COURSE_ID_ENUM, description: 'voir get_state → matieres' },
        side: { type: 'string', enum: SIDE_ENUM },
        nom: { type: 'string' },
      },
      required: ['courseId', 'side', 'nom'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'ADD_CHAPITRE', courseId: args.courseId, side: args.side, nom: args.nom }),
  },
  {
    name: 'edit_chapitre',
    description: 'Modifie le nom/description/état/commentaires d\'un chapitre — ne touche jamais à son badge de révision.',
    inputSchema: {
      type: 'object',
      properties: {
        id: idProp('id du chapitre (voir get_state)'),
        nom: { type: 'string' },
        description: { type: 'string' },
        etat: { type: 'string', enum: ETAT_ENUM },
        commentaires: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => {
      const patch = {}
      for (const k of ['nom', 'description', 'etat', 'commentaires']) if (k in args) patch[k] = args[k]
      return applyAction({ type: 'EDIT_CHAPITRE', id: args.id, patch })
    },
  },
  {
    name: 'delete_chapitre',
    description: 'Supprime un chapitre (et son sommaire).',
    inputSchema: {
      type: 'object',
      properties: { id: idProp('id du chapitre (voir get_state)') },
      required: ['id'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'DELETE_CHAPITRE', id: args.id }),
  },
  {
    name: 'activate_chapitre',
    description:
      "Démarre l'horloge de révision d'un chapitre côté Cours ou TD (passe de \"non suivi\" à rouge après 1 jour). Ne fait rien si déjà actif.",
    inputSchema: {
      type: 'object',
      properties: {
        id: idProp('id du chapitre (voir get_state)'),
        side: { type: 'string', enum: SIDE_ENUM },
      },
      required: ['id', 'side'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'ACTIVATE_CHAPITRE', id: args.id, side: args.side }),
  },
  {
    name: 'mark_badge',
    description:
      "Valide la couleur actuellement ACTIVE du badge (Cours ou TD) d'un chapitre — relance l'attente vers la couleur suivante du cycle rouge→orange→jaune→vert. Ne fait rien si le badge est encore grisé (en attente) ou inactif — vérifier avec get_state d'abord.",
    inputSchema: {
      type: 'object',
      properties: {
        id: idProp('id du chapitre (voir get_state)'),
        side: { type: 'string', enum: SIDE_ENUM },
      },
      required: ['id', 'side'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'MARK_BADGE', id: args.id, side: args.side }),
  },
  {
    name: 'undo_badge',
    description: "Annule la dernière action sur un badge (activation ou validation de couleur) — un seul cran d'historique.",
    inputSchema: {
      type: 'object',
      properties: {
        id: idProp('id du chapitre (voir get_state)'),
        side: { type: 'string', enum: SIDE_ENUM },
      },
      required: ['id', 'side'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'UNDO_BADGE', id: args.id, side: args.side }),
  },
  {
    name: 'add_partie',
    description: "Ajoute une partie au sommaire d'un chapitre (un plan de ce qu'il y a dedans — aucun rapport avec le badge de révision).",
    inputSchema: {
      type: 'object',
      properties: {
        chapitreId: idProp('id du chapitre (voir get_state)'),
        nom: { type: 'string' },
      },
      required: ['chapitreId', 'nom'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'ADD_PARTIE', chapitreId: args.chapitreId, nom: args.nom }),
  },
  {
    name: 'delete_partie',
    description: 'Supprime une partie du sommaire (et ses sous-parties).',
    inputSchema: {
      type: 'object',
      properties: {
        chapitreId: idProp('id du chapitre (voir get_state)'),
        partieId: idProp('id de la partie (voir get_state → chapitres[].sommaire)'),
      },
      required: ['chapitreId', 'partieId'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'DELETE_PARTIE', chapitreId: args.chapitreId, partieId: args.partieId }),
  },
  {
    name: 'add_sous_partie',
    description: "Ajoute une sous-partie sous une partie du sommaire.",
    inputSchema: {
      type: 'object',
      properties: {
        chapitreId: idProp('id du chapitre (voir get_state)'),
        partieId: idProp('id de la partie (voir get_state → chapitres[].sommaire)'),
        nom: { type: 'string' },
      },
      required: ['chapitreId', 'partieId', 'nom'],
      additionalProperties: false,
    },
    handler: (args) =>
      applyAction({ type: 'ADD_SOUS_PARTIE', chapitreId: args.chapitreId, partieId: args.partieId, nom: args.nom }),
  },
  {
    name: 'delete_sous_partie',
    description: 'Supprime une sous-partie du sommaire.',
    inputSchema: {
      type: 'object',
      properties: {
        chapitreId: idProp('id du chapitre (voir get_state)'),
        partieId: idProp('id de la partie'),
        sousPartieId: idProp('id de la sous-partie'),
      },
      required: ['chapitreId', 'partieId', 'sousPartieId'],
      additionalProperties: false,
    },
    handler: (args) =>
      applyAction({
        type: 'DELETE_SOUS_PARTIE',
        chapitreId: args.chapitreId,
        partieId: args.partieId,
        sousPartieId: args.sousPartieId,
      }),
  },
  {
    name: 'set_resource_link',
    description: "Définit (ou remplace) la fiche de révision ou la fiche méthode d'une matière.",
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', enum: COURSE_ID_ENUM, description: 'voir get_state → matieres' },
        kind: { type: 'string', enum: ['revision', 'methode'] },
        url: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['courseId', 'kind', 'url', 'label'],
      additionalProperties: false,
    },
    handler: (args) =>
      applyAction({ type: 'SET_RESOURCE_LINK', courseId: args.courseId, kind: args.kind, url: args.url, label: args.label }),
  },
  {
    name: 'delete_resource_link',
    description: "Retire la fiche de révision ou la fiche méthode d'une matière.",
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', enum: COURSE_ID_ENUM },
        kind: { type: 'string', enum: ['revision', 'methode'] },
      },
      required: ['courseId', 'kind'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'DELETE_RESOURCE_LINK', courseId: args.courseId, kind: args.kind }),
  },
  {
    name: 'add_poly',
    description: "Ajoute un lien de poly/annexe à une matière (il peut y en avoir plusieurs).",
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', enum: COURSE_ID_ENUM },
        url: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['courseId', 'url', 'label'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'ADD_POLY', courseId: args.courseId, url: args.url, label: args.label }),
  },
  {
    name: 'delete_poly',
    description: "Supprime un poly/annexe d'une matière.",
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', enum: COURSE_ID_ENUM },
        polyId: idProp('id du poly (voir get_state → ressources)'),
      },
      required: ['courseId', 'polyId'],
      additionalProperties: false,
    },
    handler: (args) => applyAction({ type: 'DELETE_POLY', courseId: args.courseId, polyId: args.polyId }),
  },
]
