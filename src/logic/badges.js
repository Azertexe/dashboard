// Logique des badges TD / Cours — indépendante de l'UI pour rester facile à
// vérifier et à ajuster (cf. Partie 3 de la spec).
//
// Règles (précisées par l'utilisateur) :
//  - l'horloge d'un badge démarre à la date d'ACTIVATION du chapitre, pas à sa
//    création ;
//  - elle ne bouge que quand on clique sur CE badge (TD et Cours sont deux
//    horloges indépendantes) ;
//  - 4 couleurs selon le temps écoulé depuis la dernière action :
//      jour 1 (< 24h)  -> rouge
//      24h – 3j        -> orange
//      3j – 7j         -> jaune
//      >= 7j           -> vert
//  - une fois au vert, un signal bleu revient tous les 2 jours pour relancer
//    l'alerte plutôt que de rester silencieux indéfiniment.

export const DAY_MS = 24 * 60 * 60 * 1000

export const BADGE_LEVELS = {
  INACTIVE: 'inactive', // chapitre en standby : pas d'horloge du tout
  ROUGE: 'rouge',
  ORANGE: 'orange',
  JAUNE: 'jaune',
  VERT: 'vert',
}

/**
 * @param {object} chapitre
 * @param {'td'|'cours'} side
 * @param {number} now epoch ms (injectable pour les tests)
 */
export function badgeStatus(chapitre, side, now = Date.now()) {
  if (chapitre.statut !== 'actif' || !chapitre.activatedAt) {
    return { level: BADGE_LEVELS.INACTIVE, elapsedDays: 0, pulse: false }
  }

  const badge = side === 'td' ? chapitre.badgeTD : chapitre.badgeCours
  const lastAction = badge?.lastActionAt ?? chapitre.activatedAt
  const elapsedDays = Math.max(0, (now - lastAction) / DAY_MS)

  let level
  if (elapsedDays < 1) level = BADGE_LEVELS.ROUGE
  else if (elapsedDays < 3) level = BADGE_LEVELS.ORANGE
  else if (elapsedDays < 7) level = BADGE_LEVELS.JAUNE
  else level = BADGE_LEVELS.VERT

  // Une fois au vert, on relance le signal (pulse bleu) tous les 2 jours
  // plutôt que de laisser le badge silencieux indéfiniment.
  const pulse = level === BADGE_LEVELS.VERT && Math.floor(elapsedDays - 7) % 2 === 0

  return { level, elapsedDays, pulse }
}

/** Marque le badge comme "fait maintenant" — remet son horloge à zéro. */
export function markBadgeNow(chapitre, side, now = Date.now()) {
  const key = side === 'td' ? 'badgeTD' : 'badgeCours'
  return {
    ...chapitre,
    [key]: { ...chapitre[key], lastActionAt: now },
  }
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
