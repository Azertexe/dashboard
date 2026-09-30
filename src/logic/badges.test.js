import { describe, it, expect } from 'vitest'
import {
  DAY_MS,
  BADGE_LEVELS,
  badgeStatus,
  needsAttention,
  markBadgeNow,
  undoBadge,
  canUndoBadge,
  activateChapitre,
  forceBadgeLevel,
  setForcedAlert,
  activeSinceTimestamp,
} from './badges.js'

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

function activeBadge(activatedAt, overrides = {}) {
  return { ...emptyBadge(), statut: 'actif', activatedAt, ...overrides }
}

function makeChapitre(overrides = {}) {
  return {
    id: 'ch-1',
    courseId: 'optique-coherente',
    nom: 'Test',
    badgeTD: emptyBadge(),
    badgeCours: emptyBadge(),
    ...overrides,
  }
}

function makePartie(overrides = {}) {
  return {
    id: 'pt-1',
    nom: 'Partie',
    badgeTD: emptyBadge(),
    badgeCours: emptyBadge(),
    ...overrides,
  }
}

const NOW = 1_700_000_000_000 // date fixe arbitraire pour des tests déterministes

describe('badgeStatus', () => {
  it('is inactive for a standby side', () => {
    const c = makeChapitre()
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: 'inactive', level: BADGE_LEVELS.INACTIVE })
  })

  it('is a grey wait toward rouge right after activation', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 0.3 * DAY_MS) })
    const status = badgeStatus(c, 'cours', NOW)
    expect(status.phase).toBe('wait')
    expect(status.level).toBe(BADGE_LEVELS.ROUGE)
    expect(status.daysLeft).toBe(1)
    expect(status.fromClick).toBe(false)
  })

  it('becomes active rouge once 1 day has elapsed since activation, with no click needed', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const status = badgeStatus(c, 'cours', NOW)
    expect(status).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE, pulse: true })
  })

  it('stays active rouge forever if never clicked, no automatic drift to orange', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 50 * DAY_MS) })
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE })
  })

  it('TD and Cours are fully independent, including standby vs actif', () => {
    const c = makeChapitre({
      badgeCours: activeBadge(NOW - 10 * DAY_MS, { validatedStage: BADGE_LEVELS.ROUGE, validatedAt: NOW - 2 * DAY_MS }),
      // TD reste en standby : jamais activé
      badgeTD: emptyBadge(),
    })
    expect(badgeStatus(c, 'cours', NOW).phase).toBe('wait') // rouge validé il y a 2j, attente de 3j vers orange
    expect(badgeStatus(c, 'td', NOW)).toMatchObject({ phase: 'inactive', level: BADGE_LEVELS.INACTIVE })
  })
})

describe('cycle complet valide->attente->actif', () => {
  it('walks rouge -> orange -> jaune -> vert -> vert with the right per-stage waits', () => {
    let c = makeChapitre({ badgeCours: activeBadge(NOW - 2 * DAY_MS) })
    // actif rouge (2j > 1j d'attente)
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.ROUGE)

    // valide rouge -> attente 3j vers orange
    c = markBadgeNow(c, 'cours', NOW)
    let status = badgeStatus(c, 'cours', NOW)
    expect(status).toMatchObject({ phase: 'wait', level: BADGE_LEVELS.ORANGE, daysLeft: 3, fromClick: true })

    // pas encore actif après 2j
    status = badgeStatus(c, 'cours', NOW + 2 * DAY_MS)
    expect(status.phase).toBe('wait')

    // actif après 3j
    status = badgeStatus(c, 'cours', NOW + 3 * DAY_MS)
    expect(status).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ORANGE })

    // valide orange -> attente 7j vers jaune
    c = markBadgeNow(c, 'cours', NOW + 3 * DAY_MS)
    status = badgeStatus(c, 'cours', NOW + 3 * DAY_MS)
    expect(status).toMatchObject({ phase: 'wait', level: BADGE_LEVELS.JAUNE, daysLeft: 7 })
    status = badgeStatus(c, 'cours', NOW + 3 * DAY_MS + 7 * DAY_MS)
    expect(status).toMatchObject({ phase: 'active', level: BADGE_LEVELS.JAUNE })

    // valide jaune -> attente 2j vers vert
    const tJaune = NOW + 3 * DAY_MS + 7 * DAY_MS
    c = markBadgeNow(c, 'cours', tJaune)
    status = badgeStatus(c, 'cours', tJaune + 2 * DAY_MS)
    expect(status).toMatchObject({ phase: 'active', level: BADGE_LEVELS.VERT })

    // valide vert -> attente 2j vers vert (boucle)
    const tVert = tJaune + 2 * DAY_MS
    c = markBadgeNow(c, 'cours', tVert)
    expect(badgeStatus(c, 'cours', tVert + 1 * DAY_MS).phase).toBe('wait')
    expect(badgeStatus(c, 'cours', tVert + 2 * DAY_MS).phase).toBe('active')
    expect(badgeStatus(c, 'cours', tVert + 2 * DAY_MS).level).toBe(BADGE_LEVELS.VERT)
  })

  it('markBadgeNow is a no-op while the badge is in a grey wait (not clickable)', () => {
    let c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    c = markBadgeNow(c, 'cours', NOW) // rouge actif -> valide, attente vers orange
    const afterFirstClick = c
    c = markBadgeNow(c, 'cours', NOW) // toujours en attente -> ne doit rien changer
    expect(c).toBe(afterFirstClick)
  })

  it('vert pulses every 2 days, rouge/orange/jaune pulse continuously once active', () => {
    let c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    expect(badgeStatus(c, 'cours', NOW).pulse).toBe(true) // rouge actif -> pulse continu

    c = markBadgeNow(c, 'cours', NOW)
    c = markBadgeNow(c, 'cours', NOW + 3 * DAY_MS)
    const tOrangeValidated = NOW + 3 * DAY_MS
    c = markBadgeNow(c, 'cours', tOrangeValidated + 7 * DAY_MS)
    const tJauneValidated = tOrangeValidated + 7 * DAY_MS

    const tVertReached = tJauneValidated + 2 * DAY_MS
    expect(badgeStatus(c, 'cours', tVertReached).pulse).toBe(true)
    expect(badgeStatus(c, 'cours', tVertReached + 1 * DAY_MS).pulse).toBe(false)
    expect(badgeStatus(c, 'cours', tVertReached + 2 * DAY_MS).pulse).toBe(true)
  })
})

describe('needsAttention', () => {
  it('is true immediately for an active orange or jaune badge', () => {
    const rouge = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    expect(needsAttention(rouge, 'cours', NOW)).toBe(false) // rouge actif depuis 0.5j (< 1j de grâce)

    let c = markBadgeNow(rouge, 'cours', NOW) // -> attente vers orange
    expect(needsAttention(c, 'cours', NOW)).toBe(false) // en attente, pas encore actif

    expect(needsAttention(c, 'cours', NOW + 3 * DAY_MS)).toBe(true) // orange actif

    c = markBadgeNow(c, 'cours', NOW + 3 * DAY_MS) // valide orange -> attente vers jaune
    expect(needsAttention(c, 'cours', NOW + 3 * DAY_MS + 7 * DAY_MS)).toBe(true) // jaune actif
  })

  it('is false for a rouge badge active less than 1 day (point de départ normal du cycle)', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 1.9 * DAY_MS) }) // actif depuis 0.9j
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.ROUGE)
    expect(needsAttention(c, 'cours', NOW)).toBe(false)
  })

  it('becomes true for a rouge badge active for 1 full day without a click (oubli réel)', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 2 * DAY_MS) }) // actif depuis 1j
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.ROUGE)
    expect(needsAttention(c, 'cours', NOW)).toBe(true)
  })

  it('is false for an active vert badge (the pulse is enough)', () => {
    const c = makeChapitre({
      badgeCours: activeBadge(NOW - 3 * DAY_MS, { validatedStage: BADGE_LEVELS.JAUNE, validatedAt: NOW - 3 * DAY_MS }),
    })
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.VERT)
    expect(needsAttention(c, 'cours', NOW)).toBe(false)
  })
})

describe('undoBadge / canUndoBadge', () => {
  it('has nothing to undo before any click', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    expect(canUndoBadge(c, 'cours')).toBe(false)
    expect(undoBadge(c, 'cours')).toBe(c) // no-op
  })

  it('restores the exact previous state after one click, not just the "auto" status', () => {
    let c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const before = badgeStatus(c, 'cours', NOW)
    c = markBadgeNow(c, 'cours', NOW)
    expect(canUndoBadge(c, 'cours')).toBe(true)

    c = undoBadge(c, 'cours')
    expect(canUndoBadge(c, 'cours')).toBe(false)
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: before.phase, level: before.level })
  })

  it('a simple "Activer" click IS undoable — goes back to standby', () => {
    const c = makeChapitre() // standby des deux côtés
    const activated = activateChapitre(c, 'cours', NOW)
    expect(canUndoBadge(activated, 'cours')).toBe(true)

    const reverted = undoBadge(activated, 'cours')
    expect(badgeStatus(reverted, 'cours', NOW)).toMatchObject({ phase: 'inactive' })
    expect(canUndoBadge(reverted, 'cours')).toBe(false) // un seul cran
  })

  it('undoing a validated color works the same on any {badgeCours,badgeTD}-shaped object, not just a chapter', () => {
    const p = makePartie({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const before = badgeStatus(p, 'cours', NOW)
    const validated = markBadgeNow(p, 'cours', NOW)
    expect(canUndoBadge(validated, 'cours')).toBe(true)

    const reverted = undoBadge(validated, 'cours')
    expect(badgeStatus(reverted, 'cours', NOW)).toMatchObject({ phase: before.phase, level: before.level })
  })

  it('only undoes the most recent action: undo after activate+validate goes back to just-activated, not standby', () => {
    let c = makeChapitre()
    c = activateChapitre(c, 'cours', NOW - 1.5 * DAY_MS)
    const afterActivate = c
    c = markBadgeNow(c, 'cours', NOW) // valide rouge -> attente vers orange

    c = undoBadge(c, 'cours')
    expect(c.badgeCours).toMatchObject({
      statut: afterActivate.badgeCours.statut,
      activatedAt: afterActivate.badgeCours.activatedAt,
      validatedStage: afterActivate.badgeCours.validatedStage,
      validatedAt: afterActivate.badgeCours.validatedAt,
    })
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE })
  })
})

describe('forceBadgeLevel (mode debug)', () => {
  it('makes the badge immediately active at the requested level', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 5 * DAY_MS) })
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.JAUNE, NOW)
    expect(badgeStatus(forced, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.JAUNE })
  })

  it('activates only the forced side, never the other one (regression: they used to be coupled)', () => {
    const c = makeChapitre() // standby des deux côtés
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.ORANGE, NOW)
    expect(forced.badgeCours.statut).toBe('actif')
    expect(badgeStatus(forced, 'cours', NOW).level).toBe(BADGE_LEVELS.ORANGE)
    // Le TD ne doit pas avoir bougé du tout.
    expect(forced.badgeTD).toEqual(c.badgeTD)
    expect(badgeStatus(forced, 'td', NOW)).toMatchObject({ phase: 'inactive', level: BADGE_LEVELS.INACTIVE })
  })

  it('sets the real clock, so it behaves like a real click for undo and the next wait', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 20 * DAY_MS) })
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.ROUGE, NOW)
    expect(canUndoBadge(forced, 'cours')).toBe(true)

    const undone = undoBadge(forced, 'cours')
    expect(badgeStatus(undone, 'cours', NOW)).toMatchObject(badgeStatus(c, 'cours', NOW))
  })

  it('clearing the force (level=null) goes back to the auto-computed status', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.VERT, NOW)
    expect(badgeStatus(forced, 'cours', NOW).level).toBe(BADGE_LEVELS.VERT)

    const cleared = forceBadgeLevel(forced, 'cours', null, NOW)
    expect(badgeStatus(cleared, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE })
  })
})

describe('setForcedAlert (mode debug)', () => {
  it('overrides needsAttention regardless of the real computed status, only on the given side', () => {
    const rouge = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    expect(needsAttention(rouge, 'cours', NOW)).toBe(false)

    const shown = setForcedAlert(rouge, 'cours', true)
    expect(needsAttention(shown, 'cours', NOW)).toBe(true)
    expect(needsAttention(shown, 'td', NOW)).toBe(false) // TD non affecté

    const hidden = setForcedAlert(rouge, 'cours', false)
    expect(needsAttention(hidden, 'cours', NOW)).toBe(false)

    const auto = setForcedAlert(shown, 'cours', null)
    expect(needsAttention(auto, 'cours', NOW)).toBe(false)
  })

  it('is ignored while the badge is in a grey wait or standby — a forced "!" only applies to a colored active badge', () => {
    const rouge = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const forcedShown = setForcedAlert(rouge, 'cours', true)

    // valide rouge -> repasse en attente grisée vers orange : le forçage ne doit plus s'appliquer
    const waiting = markBadgeNow(forcedShown, 'cours', NOW)
    expect(badgeStatus(waiting, 'cours', NOW).phase).toBe('wait')
    expect(needsAttention(waiting, 'cours', NOW)).toBe(false)

    // une fois orange redevenu actif, le forçage s'applique de nouveau
    expect(needsAttention(waiting, 'cours', NOW + 3 * DAY_MS)).toBe(true)

    // un forçage laissé sur un côté jamais activé (standby) ne doit rien afficher non plus
    const standby = setForcedAlert(makeChapitre(), 'cours', true)
    expect(needsAttention(standby, 'cours', NOW)).toBe(false)
  })

  it('survives a real click, an undo, and a color force on the same badge', () => {
    let c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    c = setForcedAlert(c, 'cours', true)

    c = markBadgeNow(c, 'cours', NOW)
    expect(c.badgeCours.forcedAlert).toBe(true)

    c = undoBadge(c, 'cours')
    expect(c.badgeCours.forcedAlert).toBe(true)

    c = forceBadgeLevel(c, 'cours', BADGE_LEVELS.ORANGE, NOW)
    expect(c.badgeCours.forcedAlert).toBe(true)
  })
})

describe('activateChapitre', () => {
  it('turns one side active and starts its clock, without touching the other side', () => {
    const c = makeChapitre()
    const activated = activateChapitre(c, 'cours', NOW)
    expect(activated.badgeCours.statut).toBe('actif')
    expect(activated.badgeCours.activatedAt).toBe(NOW)
    expect(activated.badgeTD).toEqual(c.badgeTD) // TD intact
  })

  it('is a no-op if that side is already active', () => {
    const c = makeChapitre({ badgeCours: activeBadge(NOW - DAY_MS) })
    expect(activateChapitre(c, 'cours', NOW + DAY_MS)).toBe(c)
  })
})

describe('activeSinceTimestamp (détection "devenu actif aujourd\'hui", cf. notifications 7h/18h)', () => {
  it('renvoie null si le badge est en standby ou encore en attente (pas encore actif)', () => {
    const standby = makeChapitre()
    expect(activeSinceTimestamp(standby, 'cours', NOW)).toBeNull()

    const enAttente = makeChapitre({ badgeCours: activeBadge(NOW - 0.5 * DAY_MS) }) // rouge pas encore atteint (attend 1j)
    expect(activeSinceTimestamp(enAttente, 'cours', NOW)).toBeNull()
  })

  it("renvoie l'instant exact où le rouge est devenu actif (activatedAt + 1 jour, le délai 'none')", () => {
    const activatedAt = NOW - 1.5 * DAY_MS
    const c = makeChapitre({ badgeCours: activeBadge(activatedAt) })
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.ROUGE)
    expect(activeSinceTimestamp(c, 'cours', NOW)).toBe(activatedAt + DAY_MS)
  })

  it("après un clic, l'ancre change (validatedAt) et le délai suit la couleur validée (orange : 3 jours)", () => {
    const activatedAt = NOW - 10 * DAY_MS
    let c = makeChapitre({ badgeCours: activeBadge(activatedAt) })
    c = markBadgeNow(c, 'cours', NOW - 4 * DAY_MS) // valide le rouge il y a 4 jours
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.ORANGE) // 4j > 3j d'attente
    expect(activeSinceTimestamp(c, 'cours', NOW)).toBe((NOW - 4 * DAY_MS) + 3 * DAY_MS)
  })

  it("un badge validé CE MATIN n'a plus le même activeSinceTimestamp que ce matin (se décale, pas besoin de suivi séparé)", () => {
    const activatedAt = NOW - 10 * DAY_MS
    let c = makeChapitre({ badgeCours: activeBadge(activatedAt) })
    // Ce matin : rouge devient actif (attente 'none' déjà écoulée depuis longtemps).
    const matin = activeSinceTimestamp(c, 'cours', NOW)
    // L'utilisateur clique (valide le rouge) ce matin même.
    c = markBadgeNow(c, 'cours', NOW)
    // Ce soir, tant que l'attente vers l'orange (3j) n'est pas écoulée : phase 'wait', donc null.
    expect(activeSinceTimestamp(c, 'cours', NOW + 8 * 60 * 60 * 1000)).toBeNull()
    expect(activeSinceTimestamp(c, 'cours', NOW + 8 * 60 * 60 * 1000)).not.toBe(matin)
  })
})

describe('généricité sur un objet {badgeCours,badgeTD} quelconque', () => {
  it('marquer une couleur sur un objet ne touche jamais un autre objet indépendant', () => {
    const p1 = makePartie({ id: 'pt-1', badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const p2 = makePartie({ id: 'pt-2', badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })
    const c = makeChapitre({ badgeCours: activeBadge(NOW - 1.5 * DAY_MS) })

    const updatedP1 = markBadgeNow(p1, 'cours', NOW)
    expect(badgeStatus(updatedP1, 'cours', NOW).phase).toBe('wait')
    // p2 et le chapitre lui-même n'ont pas bougé.
    expect(p2).toEqual(makePartie({ id: 'pt-2', badgeCours: activeBadge(NOW - 1.5 * DAY_MS) }))
    expect(badgeStatus(c, 'cours', NOW).phase).toBe('active')
  })
})
