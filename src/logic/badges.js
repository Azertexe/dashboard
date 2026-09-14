// Logique des badges TD / Cours — indépendante de l'UI pour rester facile à
// vérifier et à ajuster (cf. Partie 3 de la spec).
//
// Cycle (précisé par l'utilisateur) : chaque couleur, une fois VALIDÉE (clic),
// déclenche une attente avant que la couleur suivante ne s'active toute seule :
//   activation du chapitre  --1j-->  rouge   (aucun clic requis, c'est automatique)
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
  INACTIVE: 'inactive', // chapitre en standby : pas d'horloge du tout
  ROUGE: 'rouge',
  ORANGE: 'orange',
  JAUNE: 'jaune',
  VERT: 'vert',
}

// Combien de jours d'attente après avoir validé une couleur avant que la
// suivante ne s'active. La clé 'none' correspond à la toute première attente,
// démarrée par l'activation du chapitre plutôt que par un clic.
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
    validatedStage: null,
    validatedAt: null,
    previousValidatedStage: null,
    previousValidatedAt: null,
  }
}

/**
 * @param {object} chapitre
 * @param {'td'|'cours'} side
 * @param {number} now epoch ms (injectable pour les tests)
 * @returns {{phase: 'inactive'|'wait'|'active', level: string, daysLeft: number, pulse: boolean, fromClick: boolean}}
 */
export function badgeStatus(chapitre, side, now = Date.now()) {
  if (chapitre.statut !== 'actif' || !chapitre.activatedAt) {
    return { phase: 'inactive', level: BADGE_LEVELS.INACTIVE, daysLeft: 0, pulse: false, fromClick: false }
  }

  const badge = (side === 'td' ? chapitre.badgeTD : chapitre.badgeCours) ?? emptyBadge()
  const stageKey = badge.validatedStage ?? 'none'
  const anchor = badge.validatedAt ?? chapitre.activatedAt
  const elapsedDays = Math.max(0, (now - anchor) / DAY_MS)
  const waitDays = WAIT_DAYS[stageKey]
  const nextLevel = NEXT_LEVEL[stageKey]

  if (elapsedDays < waitDays) {
    const daysLeft = Math.max(1, Math.ceil(waitDays - elapsedDays))
    return { phase: 'wait', level: nextLevel, daysLeft, pulse: false, fromClick: stageKey !== 'none' }
  }

  // Actif : la couleur `nextLevel` est atteinte et y reste jusqu'au prochain
  // clic. Une fois vert, un pulse bleu revient tous les 2 jours pour rappeler
  // discrètement plutôt que de rester silencieux indéfiniment.
  const pulse =
    nextLevel === BADGE_LEVELS.VERT && Math.floor(elapsedDays - waitDays) % 2 === 0
  return { phase: 'active', level: nextLevel, daysLeft: 0, pulse, fromClick: false }
}

/**
 * Vrai si ce badge mérite un signal d'alerte au niveau de la matière (orange
 * ou jaune ACTIFS : "vous prenez du retard"). Une attente en cours (grisée)
 * n'alerte pas — ce n'est pas encore le moment d'agir — et le vert (avec son
 * pulse bleu) se signale déjà tout seul.
 */
export function needsAttention(chapitre, side, now = Date.now()) {
  const { phase, level } = badgeStatus(chapitre, side, now)
  return phase === 'active' && (level === BADGE_LEVELS.ORANGE || level === BADGE_LEVELS.JAUNE)
}

/** Valide la couleur actuellement active — relance l'attente vers la couleur
 * suivante. Ne fait rien si le badge est encore en attente (pas cliquable) ou
 * inactif. Garde l'ancien état pour permettre une annulation (cf. undoBadge). */
export function markBadgeNow(chapitre, side, now = Date.now()) {
  const { phase, level } = badgeStatus(chapitre, side, now)
  if (phase !== 'active') return chapitre
  const key = side === 'td' ? 'badgeTD' : 'badgeCours'
  const prev = chapitre[key] ?? emptyBadge()
  return {
    ...chapitre,
    [key]: {
      validatedStage: level,
      validatedAt: now,
      previousValidatedStage: prev.validatedStage ?? null,
      previousValidatedAt: prev.validatedAt ?? null,
    },
  }
}

/** Annule le dernier clic (ou forçage debug) sur ce badge, au cas où c'était
 * une erreur — restaure exactement l'état d'avant, pas juste le statut
 * "auto" par défaut. */
export function undoBadge(chapitre, side) {
  const key = side === 'td' ? 'badgeTD' : 'badgeCours'
  const badge = chapitre[key]
  if (!badge || badge.validatedAt == null) return chapitre
  return {
    ...chapitre,
    [key]: {
      validatedStage: badge.previousValidatedStage ?? null,
      validatedAt: badge.previousValidatedAt ?? null,
      previousValidatedStage: null,
      previousValidatedAt: null,
    },
  }
}

/** Mode debug (Réglages) : force le badge `side` du chapitre à `level` (une
 * des 4 couleurs), ou le remet à null pour revenir au statut "auto". Ça ne
 * pose pas un simple habillage visuel : ça règle réellement l'horloge
 * (validatedStage/validatedAt) comme si l'étape précédente venait d'être
 * validée puis son attente déjà écoulée — donc ça influence le cycle normal
 * (prochaine attente, ↺ pour annuler) exactement comme un vrai clic.
 * Active le chapitre au passage si besoin, sinon rien ne serait visible. */
export function forceBadgeLevel(chapitre, side, level, now = Date.now()) {
  const key = side === 'td' ? 'badgeTD' : 'badgeCours'
  const prev = chapitre[key] ?? emptyBadge()
  const base =
    chapitre.statut === 'actif' ? chapitre : { ...chapitre, statut: 'actif', activatedAt: chapitre.activatedAt ?? now }

  if (!level) {
    return {
      ...base,
      [key]: {
        validatedStage: null,
        validatedAt: null,
        previousValidatedStage: prev.validatedStage ?? null,
        previousValidatedAt: prev.validatedAt ?? null,
      },
    }
  }

  const stageKey = PREV_STAGE_FOR[level]
  const waitMs = WAIT_DAYS[stageKey] * DAY_MS
  return {
    ...base,
    [key]: {
      validatedStage: stageKey === 'none' ? null : stageKey,
      validatedAt: now - waitMs - 60 * 1000, // largement passé l'attente -> actif tout de suite
      previousValidatedStage: prev.validatedStage ?? null,
      previousValidatedAt: prev.validatedAt ?? null,
    },
  }
}

/** Vrai s'il y a quelque chose à annuler pour ce badge (au moins un clic depuis l'activation). */
export function canUndoBadge(chapitre, side) {
  const key = side === 'td' ? 'badgeTD' : 'badgeCours'
  return chapitre[key]?.validatedAt != null
}

/** Passe un chapitre de standby à actif — démarre les deux horloges. Sens unique. */
export function activateChapitre(chapitre, now = Date.now()) {
  if (chapitre.statut === 'actif') return chapitre
  return {
    ...chapitre,
    statut: 'actif',
    activatedAt: now,
  }
}
