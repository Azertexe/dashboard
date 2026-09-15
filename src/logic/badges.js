// Logique des badges TD / Cours — indépendante de l'UI pour rester facile à
// vérifier et à ajuster (cf. Partie 3 de la spec).
//
// Cours et TD sont deux horloges totalement indépendantes, y compris pour
// leur standby/actif : activer l'un ne touche pas l'autre (chacun a son
// propre `statut`/`activatedAt`, portés par badgeCours/badgeTD plutôt que
// par le chapitre).
//
// Cycle (précisé par l'utilisateur) : chaque couleur, une fois VALIDÉE (clic),
// déclenche une attente avant que la couleur suivante ne s'active toute seule :
//   activation du côté (Cours ou TD)  --1j-->  rouge   (aucun clic requis, c'est automatique)
//   rouge validé (clic)     --3j-->  orange
//   orange validé (clic)    --7j-->  jaune
//   jaune validé (clic)     --2j-->  vert
//   vert validé (clic)      --2j-->  vert   (le cycle se répète tant qu'on continue à cliquer)
//
// Pendant l'attente, le badge est grisé et affiche juste le prochain statut à
// venir (horloge + jours restants, pas d'heure précise) — il n'est pas
// cliquable. Une fois la couleur active (attente écoulée), le badge est
// cliquable : cliquer "valide" cette couleur et relance l'attente vers la
// suivante. Si on ne clique jamais, le badge reste simplement allumé dans sa
// couleur active indéfiniment (pas de pénalité, pas de progression automatique
// au-delà de la première étape rouge).

export const DAY_MS = 24 * 60 * 60 * 1000

export const BADGE_LEVELS = {
  INACTIVE: 'inactive', // ce côté est en standby : pas d'horloge du tout
  ROUGE: 'rouge',
  ORANGE: 'orange',
  JAUNE: 'jaune',
  VERT: 'vert',
}

// Combien de jours d'attente après avoir validé une couleur avant que la
// suivante ne s'active. La clé 'none' correspond à la toute première attente,
// démarrée par l'activation du côté plutôt que par un clic.
const WAIT_DAYS = {
  none: 1,
  rouge: 3,
  orange: 7,
  jaune: 2,
  vert: 2,
}

const NEXT_LEVEL = {
  none: BADGE_LEVELS.ROUGE,
  rouge: BADGE_LEVELS.ORANGE,
  orange: BADGE_LEVELS.JAUNE,
  jaune: BADGE_LEVELS.VERT,
  vert: BADGE_LEVELS.VERT,
}

// Pour forcer une couleur ACTIVE donnée (mode debug), on part de l'étape
// validée juste avant elle dans le cycle normal, et on recule son horloge
// assez loin pour que l'attente soit déjà écoulée.
const PREV_STAGE_FOR = {
  rouge: 'none',
  orange: 'rouge',
  jaune: 'orange',
  vert: 'jaune',
}

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

function badgeOf(chapitre, side) {
  return (side === 'td' ? chapitre.badgeTD : chapitre.badgeCours) ?? emptyBadge()
}

function withBadge(chapitre, side, badge) {
  const key = side === 'td' ? 'badgeTD' : 'badgeCours'
  return { ...chapitre, [key]: badge }
}

// Un ↺ doit pouvoir annuler N'IMPORTE QUELLE dernière action sur ce badge —
// une activation ("Activer" cliqué par erreur) tout comme une validation de
// couleur — donc on capture un instantané complet (statut/activatedAt/
// validatedStage/validatedAt) avant chaque action plutôt que de ne garder
// que les champs touchés par la précédente version de cette logique.
function snapshot(badge) {
  return {
    statut: badge.statut,
    activatedAt: badge.activatedAt,
    validatedStage: badge.validatedStage,
    validatedAt: badge.validatedAt,
  }
}

/**
 * @param {object} chapitre
 * @param {'td'|'cours'} side
 * @param {number} now epoch ms (injectable pour les tests)
 * @returns {{phase: 'inactive'|'wait'|'active', level: string, daysLeft: number, pulse: boolean, fromClick: boolean}}
 */
export function badgeStatus(chapitre, side, now = Date.now()) {
  const badge = badgeOf(chapitre, side)

  if (badge.statut !== 'actif' || !badge.activatedAt) {
    return { phase: 'inactive', level: BADGE_LEVELS.INACTIVE, daysLeft: 0, pulse: false, fromClick: false }
  }

  const stageKey = badge.validatedStage ?? 'none'
  const anchor = badge.validatedAt ?? badge.activatedAt
  const elapsedDays = Math.max(0, (now - anchor) / DAY_MS)
  const waitDays = WAIT_DAYS[stageKey]
  const nextLevel = NEXT_LEVEL[stageKey]

  if (elapsedDays < waitDays) {
    const daysLeft = Math.max(1, Math.ceil(waitDays - elapsedDays))
    return { phase: 'wait', level: nextLevel, daysLeft, pulse: false, fromClick: stageKey !== 'none' }
  }

  // Actif : la couleur `nextLevel` est atteinte et y reste jusqu'au prochain
  // clic. Rouge/orange/jaune pulsent en continu pour attirer l'oeil (simple
  // variation de leur propre couleur). Vert turquoise, lui, ne pulse (en
  // bleu) que tous les 2 jours pour rappeler discrètement plutôt que de
  // rester silencieux indéfiniment.
  const pulse =
    nextLevel === BADGE_LEVELS.VERT ? Math.floor(elapsedDays - waitDays) % 2 === 0 : true
  return { phase: 'active', level: nextLevel, daysLeft: 0, pulse, fromClick: false }
}

/**
 * Vrai si ce badge mérite un signal d'alerte au niveau de la matière (orange
 * ou jaune ACTIFS : "vous prenez du retard"). Une attente en cours (grisée)
 * n'alerte pas — ce n'est pas encore le moment d'agir — et le vert (avec son
 * pulse bleu) se signale déjà tout seul.
 */
export function needsAttention(chapitre, side, now = Date.now()) {
  const badge = badgeOf(chapitre, side)
  if (badge.forcedAlert != null) return badge.forcedAlert
  const { phase, level } = badgeStatus(chapitre, side, now)
  return phase === 'active' && (level === BADGE_LEVELS.ORANGE || level === BADGE_LEVELS.JAUNE)
}

/** Mode debug (Réglages) : force l'affichage (ou le masquage) du point
 * d'exclamation "!" pour ce badge, indépendamment de son statut réel.
 * `value` : true (forcer affiché), false (forcer masqué), null (revenir au
 * calcul automatique). N'affecte que ce côté (Cours ou TD). */
export function setForcedAlert(chapitre, side, value) {
  const badge = badgeOf(chapitre, side)
  return withBadge(chapitre, side, { ...badge, forcedAlert: value })
}

/** Valide la couleur actuellement active — relance l'attente vers la couleur
 * suivante. Ne fait rien si le badge est encore en attente (pas cliquable) ou
 * inactif. Garde un instantané de l'état d'avant pour permettre une
 * annulation (cf. undoBadge). N'affecte que ce côté (Cours ou TD). */
export function markBadgeNow(chapitre, side, now = Date.now()) {
  const { phase, level } = badgeStatus(chapitre, side, now)
  if (phase !== 'active') return chapitre
  const badge = badgeOf(chapitre, side)
  return withBadge(chapitre, side, {
    ...badge,
    validatedStage: level,
    validatedAt: now,
    previousSnapshot: snapshot(badge),
  })
}

/** Annule la dernière action sur ce badge (une validation de couleur, un
 * forçage debug, OU une activation cliquée par erreur) — restaure exactement
 * l'état d'avant, pas juste le statut "auto" par défaut. N'affecte que ce
 * côté (Cours ou TD). */
export function undoBadge(chapitre, side) {
  const badge = badgeOf(chapitre, side)
  if (!badge.previousSnapshot) return chapitre
  return withBadge(chapitre, side, {
    ...badge,
    ...badge.previousSnapshot,
    previousSnapshot: null,
  })
}

/** Mode debug (Réglages) : force le badge `side` du chapitre à `level` (une
 * des 4 couleurs), ou le remet à null pour revenir au statut "auto". Ça ne
 * pose pas un simple habillage visuel : ça règle réellement l'horloge
 * (validatedStage/validatedAt) comme si l'étape précédente venait d'être
 * validée puis son attente déjà écoulée — donc ça influence le cycle normal
 * (prochaine attente, ↺ pour annuler) exactement comme un vrai clic. Active
 * ce côté au passage si besoin (et UNIQUEMENT ce côté — jamais l'autre),
 * sinon rien ne serait visible. */
export function forceBadgeLevel(chapitre, side, level, now = Date.now()) {
  const prev = badgeOf(chapitre, side)
  const activated = prev.statut === 'actif' ? prev : { ...prev, statut: 'actif', activatedAt: prev.activatedAt ?? now }

  if (!level) {
    return withBadge(chapitre, side, {
      ...activated,
      validatedStage: null,
      validatedAt: null,
      previousSnapshot: snapshot(prev),
    })
  }

  const stageKey = PREV_STAGE_FOR[level]
  const waitMs = WAIT_DAYS[stageKey] * DAY_MS
  return withBadge(chapitre, side, {
    ...activated,
    validatedStage: stageKey === 'none' ? null : stageKey,
    validatedAt: now - waitMs - 60 * 1000, // largement passé l'attente -> actif tout de suite
    previousSnapshot: snapshot(prev),
  })
}

/** Vrai s'il y a quelque chose à annuler pour ce badge (une validation, un
 * forçage debug, ou une simple activation depuis le standby). */
export function canUndoBadge(chapitre, side) {
  return badgeOf(chapitre, side).previousSnapshot != null
}

/** Passe un côté (Cours ou TD) de standby à actif — démarre SON horloge, sans
 * toucher à l'autre côté. Garde un instantané pour pouvoir annuler (↺) une
 * activation cliquée par erreur, tant que rien n'a encore été validé depuis. */
export function activateChapitre(chapitre, side, now = Date.now()) {
  const badge = badgeOf(chapitre, side)
  if (badge.statut === 'actif') return chapitre
  return withBadge(chapitre, side, { ...badge, statut: 'actif', activatedAt: now, previousSnapshot: snapshot(badge) })
}

// ---- sous-parties ----
//
// Un chapitre peut suivre ses révisions de deux façons (réglable chapitre par
// chapitre, cf. `partitionMode`) :
//  - 'chapitre' (défaut) : un seul badge Cours et un seul badge TD pour tout
//    le chapitre — c'est le chapitre lui-même qui porte badgeCours/badgeTD.
//  - 'parties' : le chapitre est découpé en sous-parties (`chapitre.parties`),
//    chacune avec SON propre badgeCours/badgeTD, complètement indépendant des
//    autres parties et du chapitre. Toutes les fonctions ci-dessus
//    (badgeStatus, markBadgeNow, activateChapitre, etc.) sont déjà
//    génériques sur un objet {badgeCours, badgeTD} — elles marchent donc
//    aussi bien sur un chapitre que sur une sous-partie, sans changement.

/** Renvoie les "unités" de suivi d'un chapitre pour un côté donné : soit le
 * chapitre lui-même (mode 'chapitre'), soit chacune de ses sous-parties
 * (mode 'parties'). Chaque unité expose `target` (l'objet {badgeCours,
 * badgeTD} sur lequel agir), `partieId` (null si c'est le chapitre) et
 * `label` (le nom de la partie, pour savoir d'où ça vient quand plusieurs
 * chapitres/parties sont mélangés dans une même liste, ex. l'Agenda). */
export function badgeUnits(chapitre) {
  if (chapitre.partitionMode === 'parties' && chapitre.parties?.length) {
    return chapitre.parties.map((p) => ({ target: p, partieId: p.id, label: p.nom }))
  }
  return [{ target: chapitre, partieId: null, label: null }]
}

/** Vrai si AU MOINS une unité de suivi du chapitre (lui-même, ou une de ses
 * sous-parties en mode 'parties') a besoin d'attention sur ce côté. Utilisé
 * pour le "!" au niveau de la matière/du chapitre, qui doit rester visible
 * même quand le retard est caché dans une sous-partie précise. */
export function chapitreNeedsAttention(chapitre, side, now = Date.now()) {
  return badgeUnits(chapitre).some(({ target }) => needsAttention(target, side, now))
}

/** Vrai si le chapitre a au moins un côté actif quelque part — sur lui-même
 * (mode 'chapitre') ou sur une de ses sous-parties (mode 'parties'). */
export function chapitreHasActiveSide(chapitre) {
  return badgeUnits(chapitre).some(
    ({ target }) => target.badgeCours?.statut === 'actif' || target.badgeTD?.statut === 'actif',
  )
}
