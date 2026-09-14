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
} from './badges.js'

function makeChapitre(overrides = {}) {
  return {
    id: 'ch-1',
    courseId: 'optique-coherente',
    nom: 'Test',
    statut: 'standby',
    activatedAt: null,
    badgeTD: { validatedStage: null, validatedAt: null, previousValidatedStage: null, previousValidatedAt: null, forcedAlert: null },
    badgeCours: { validatedStage: null, validatedAt: null, previousValidatedStage: null, previousValidatedAt: null, forcedAlert: null },
    ...overrides,
  }
}

const NOW = 1_700_000_000_000 // date fixe arbitraire pour des tests déterministes

describe('badgeStatus', () => {
  it('is inactive for a standby chapter', () => {
    const c = makeChapitre()
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: 'inactive', level: BADGE_LEVELS.INACTIVE })
  })

  it('is a grey wait toward rouge right after activation', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 0.3 * DAY_MS })
    const status = badgeStatus(c, 'cours', NOW)
    expect(status.phase).toBe('wait')
    expect(status.level).toBe(BADGE_LEVELS.ROUGE)
    expect(status.daysLeft).toBe(1)
    expect(status.fromClick).toBe(false)
  })

  it('becomes active rouge once 1 day has elapsed since activation, with no click needed', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    const status = badgeStatus(c, 'cours', NOW)
    expect(status).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE, pulse: true })
  })

  it('stays active rouge forever if never clicked, no automatic drift to orange', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 50 * DAY_MS })
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE })
  })

  it('TD and Cours clocks are independent', () => {
    const c = makeChapitre({
      statut: 'actif',
      activatedAt: NOW - 10 * DAY_MS,
      badgeCours: {
        validatedStage: BADGE_LEVELS.ROUGE,
        validatedAt: NOW - 2 * DAY_MS, // il y a 2j, attente de 3j vers orange -> encore en attente
        previousValidatedStage: null,
        previousValidatedAt: null,
        forcedAlert: null,
      },
    })
    expect(badgeStatus(c, 'cours', NOW).phase).toBe('wait')
    expect(badgeStatus(c, 'td', NOW).phase).toBe('active') // TD jamais touché, 10j > 1j -> actif rouge
    expect(badgeStatus(c, 'td', NOW).level).toBe(BADGE_LEVELS.ROUGE)
  })
})

describe('cycle complet valide->attente->actif', () => {
  it('walks rouge -> orange -> jaune -> vert -> vert with the right per-stage waits', () => {
    let c = makeChapitre({ statut: 'actif', activatedAt: NOW - 2 * DAY_MS })
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
    let c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    c = markBadgeNow(c, 'cours', NOW) // rouge actif -> valide, attente vers orange
    const afterFirstClick = c
    c = markBadgeNow(c, 'cours', NOW) // toujours en attente -> ne doit rien changer
    expect(c).toBe(afterFirstClick)
  })

  it('vert pulses every 2 days, rouge/orange/jaune pulse continuously once active', () => {
    let c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    expect(badgeStatus(c, 'cours', NOW).pulse).toBe(true) // rouge actif -> pulse continu

    c = markBadgeNow(c, 'cours', NOW)
    c = { ...c, badgeCours: { ...c.badgeCours } }
    // fait avancer jusqu'à vert
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
  it('is true only for an active orange or jaune badge', () => {
    const rouge = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    expect(needsAttention(rouge, 'cours', NOW)).toBe(false)

    let c = markBadgeNow(rouge, 'cours', NOW) // -> attente vers orange
    expect(needsAttention(c, 'cours', NOW)).toBe(false) // en attente, pas encore actif

    expect(needsAttention(c, 'cours', NOW + 3 * DAY_MS)).toBe(true) // orange actif

    c = markBadgeNow(c, 'cours', NOW + 3 * DAY_MS) // valide orange -> attente vers jaune
    expect(needsAttention(c, 'cours', NOW + 3 * DAY_MS + 7 * DAY_MS)).toBe(true) // jaune actif
  })

  it('is false for an active vert badge (the pulse is enough)', () => {
    const c = makeChapitre({
      statut: 'actif',
      activatedAt: NOW - 20 * DAY_MS,
      badgeCours: {
        validatedStage: BADGE_LEVELS.JAUNE,
        validatedAt: NOW - 3 * DAY_MS,
        previousValidatedStage: null,
        previousValidatedAt: null,
        forcedAlert: null,
      },
    })
    expect(badgeStatus(c, 'cours', NOW).level).toBe(BADGE_LEVELS.VERT)
    expect(needsAttention(c, 'cours', NOW)).toBe(false)
  })
})

describe('undoBadge / canUndoBadge', () => {
  it('has nothing to undo before any click', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    expect(canUndoBadge(c, 'cours')).toBe(false)
    expect(undoBadge(c, 'cours')).toBe(c) // no-op
  })

  it('restores the exact previous state after one click, not just the "auto" status', () => {
    let c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    const before = badgeStatus(c, 'cours', NOW)
    c = markBadgeNow(c, 'cours', NOW)
    expect(canUndoBadge(c, 'cours')).toBe(true)

    c = undoBadge(c, 'cours')
    expect(canUndoBadge(c, 'cours')).toBe(false)
    expect(badgeStatus(c, 'cours', NOW)).toMatchObject({ phase: before.phase, level: before.level })
  })
})

describe('forceBadgeLevel (mode debug)', () => {
  it('makes the badge immediately active at the requested level', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 5 * DAY_MS })
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.JAUNE, NOW)
    expect(badgeStatus(forced, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.JAUNE })
  })

  it('activates a standby chapter so the forced color is actually visible', () => {
    const c = makeChapitre() // standby
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.ORANGE, NOW)
    expect(forced.statut).toBe('actif')
    expect(badgeStatus(forced, 'cours', NOW).level).toBe(BADGE_LEVELS.ORANGE)
  })

  it('sets the real clock, so it behaves like a real click for undo and the next wait', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 20 * DAY_MS })
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.ROUGE, NOW)
    expect(canUndoBadge(forced, 'cours')).toBe(true)

    const undone = undoBadge(forced, 'cours')
    expect(badgeStatus(undone, 'cours', NOW)).toMatchObject(badgeStatus(c, 'cours', NOW))
  })

  it('clearing the force (level=null) goes back to the auto-computed status', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    const forced = forceBadgeLevel(c, 'cours', BADGE_LEVELS.VERT, NOW)
    expect(badgeStatus(forced, 'cours', NOW).level).toBe(BADGE_LEVELS.VERT)

    const cleared = forceBadgeLevel(forced, 'cours', null, NOW)
    expect(badgeStatus(cleared, 'cours', NOW)).toMatchObject({ phase: 'active', level: BADGE_LEVELS.ROUGE })
  })
})

describe('setForcedAlert (mode debug)', () => {
  it('overrides needsAttention regardless of the real computed status', () => {
    const rouge = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
    expect(needsAttention(rouge, 'cours', NOW)).toBe(false)

    const shown = setForcedAlert(rouge, 'cours', true)
    expect(needsAttention(shown, 'cours', NOW)).toBe(true)

    const hidden = setForcedAlert(rouge, 'cours', false)
    expect(needsAttention(hidden, 'cours', NOW)).toBe(false)

    const auto = setForcedAlert(shown, 'cours', null)
    expect(needsAttention(auto, 'cours', NOW)).toBe(false)
  })

  it('survives a real click, an undo, and a color force on the same badge', () => {
    let c = makeChapitre({ statut: 'actif', activatedAt: NOW - 1.5 * DAY_MS })
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
  it('turns a standby chapter active and starts the clock', () => {
    const c = makeChapitre()
    const activated = activateChapitre(c, NOW)
    expect(activated.statut).toBe('actif')
    expect(activated.activatedAt).toBe(NOW)
  })

  it('is a no-op if already active', () => {
    const c = makeChapitre({ statut: 'actif', activatedAt: NOW - DAY_MS })
    expect(activateChapitre(c, NOW + DAY_MS)).toBe(c)
  })
})
