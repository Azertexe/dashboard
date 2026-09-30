import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./firestore.js', () => ({
  fetchState: vi.fn(),
  writeState: vi.fn(),
}))
vi.mock('./webpush.js', () => ({
  sendWebPush: vi.fn(),
}))

const { fetchState, writeState } = await import('./firestore.js')
const { sendWebPush } = await import('./webpush.js')
const { sendOverdueReminderIfDue, sendMorningDueTodayIfDue, sendEveningDueTodayIfDue } = await import(
  './scheduledNotifications.js'
)

const ENV = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY_JWK: '{}' }
const SUB = { endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } }

// Toutes les instants ci-dessous portent un décalage explicite (+02:00,
// Europe/Paris en heure d'été) plutôt que de dépendre du fuseau du runtime
// de test — Intl.DateTimeFormat(timeZone:'Europe/Paris') les reconvertit
// ensuite vers l'heure locale française attendue, quel que soit le fuseau
// système sur lequel vitest tourne.
const AT_8H_PARIS = new Date('2026-09-15T08:00:00+02:00').getTime()
const AT_14H_PARIS = new Date('2026-09-15T14:00:00+02:00').getTime()
const AT_22H_PARIS = new Date('2026-09-15T22:00:00+02:00').getTime()
const AT_23H_PARIS = new Date('2026-09-15T23:00:00+02:00').getTime()
const AT_7H_PARIS = new Date('2026-09-15T07:00:00+02:00').getTime()
const AT_18H_PARIS = new Date('2026-09-15T18:00:00+02:00').getTime()
const TODAY_PARIS = '2026-09-15'

function overdueChapitre(now) {
  return {
    id: 'ch-1',
    courseId: 'optique-coherente',
    side: 'cours',
    nom: 'En retard',
    badgeCours: {
      statut: 'actif',
      activatedAt: now - 10 * 86_400_000,
      validatedStage: 'rouge',
      validatedAt: now - 5 * 86_400_000, // orange actif (attente 3j) largement dépassé
    },
  }
}

// Chapitre dont le rouge devient actif PILE à `now` (activatedAt il y a
// exactement 1 jour, le délai 'none') — donc activeSinceTimestamp(now) tombe
// aujourd'hui même côté Europe/Paris.
function dueTodayChapitre(now, overrides = {}) {
  return {
    id: 'ch-2',
    courseId: 'maths-physique',
    side: 'cours',
    nom: 'Devient actif aujourd\'hui',
    badgeCours: { statut: 'actif', activatedAt: now - 86_400_000, validatedStage: null, validatedAt: null },
    ...overrides,
  }
}

function baseState(overrides = {}) {
  return { chapitres: [], devoirs: [], exams: [], pushSubscriptions: [SUB], ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendOverdueReminderIfDue', () => {
  it("ne fait rien si VAPID n'est pas configuré", async () => {
    const result = await sendOverdueReminderIfDue({}, AT_14H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'not-configured' })
    expect(fetchState).not.toHaveBeenCalled()
  })

  it('ne fait rien en dehors de 8h-22h (heure de Paris) — ex. 23h', async () => {
    const result = await sendOverdueReminderIfDue(ENV, AT_23H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'outside-hours' })
    expect(fetchState).not.toHaveBeenCalled()
  })

  it('8h et 22h (bornes incluses) déclenchent bien la vérification', async () => {
    fetchState.mockResolvedValue(baseState())
    await sendOverdueReminderIfDue(ENV, AT_8H_PARIS)
    await sendOverdueReminderIfDue(ENV, AT_22H_PARIS)
    expect(fetchState).toHaveBeenCalledTimes(2)
  })

  it('ne fait rien si déjà envoyé sur ce créneau horaire', async () => {
    fetchState.mockResolvedValue(baseState({ lastOverdueNotifSlot: '2026-09-15T14', chapitres: [overdueChapitre(AT_14H_PARIS)] }))
    const result = await sendOverdueReminderIfDue(ENV, AT_14H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'already-sent-this-slot' })
    expect(sendWebPush).not.toHaveBeenCalled()
  })

  it("ne fait rien s'il n'y a aucun abonnement", async () => {
    fetchState.mockResolvedValue(baseState({ pushSubscriptions: [], chapitres: [overdueChapitre(AT_14H_PARIS)] }))
    const result = await sendOverdueReminderIfDue(ENV, AT_14H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'no-subscriptions' })
  })

  it("ne fait rien si rien n'est en retard", async () => {
    fetchState.mockResolvedValue(baseState())
    const result = await sendOverdueReminderIfDue(ENV, AT_14H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'nothing-overdue' })
    expect(sendWebPush).not.toHaveBeenCalled()
  })

  it('envoie UNE SEULE notification groupée (pas une par badge) et marque le créneau', async () => {
    const state = baseState({ chapitres: [overdueChapitre(AT_14H_PARIS), { ...overdueChapitre(AT_14H_PARIS), id: 'ch-3', nom: 'Aussi en retard' }] })
    fetchState.mockResolvedValue(state)
    sendWebPush.mockResolvedValue()

    const result = await sendOverdueReminderIfDue(ENV, AT_14H_PARIS)

    expect(result).toMatchObject({ skipped: false, count: 2 })
    expect(sendWebPush).toHaveBeenCalledTimes(1) // un seul envoi, pas un par badge
    const [, text] = sendWebPush.mock.calls[0]
    expect(text).toContain('2 badge(s) en retard')
    const written = writeState.mock.calls[0][0]
    expect(written.lastOverdueNotifSlot).toBe('2026-09-15T14')
  })
})

describe('sendMorningDueTodayIfDue (7h Paris)', () => {
  it("ne fait rien si ce n'est pas 7h", async () => {
    const result = await sendMorningDueTodayIfDue(ENV, AT_8H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'not-morning-hour' })
    expect(fetchState).not.toHaveBeenCalled()
  })

  it("ne fait rien si déjà envoyé aujourd'hui", async () => {
    fetchState.mockResolvedValue(baseState({ lastMorningNotifDate: TODAY_PARIS }))
    const result = await sendMorningDueTodayIfDue(ENV, AT_7H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'already-sent-today' })
  })

  it('envoie une notification PAR badge devenu actif aujourd\'hui, et marque la date même si aucun', async () => {
    fetchState.mockResolvedValue(baseState())
    const empty = await sendMorningDueTodayIfDue(ENV, AT_7H_PARIS)
    expect(empty).toMatchObject({ skipped: false, count: 0 })
    expect(writeState.mock.calls[0][0].lastMorningNotifDate).toBe(TODAY_PARIS)

    vi.clearAllMocks()
    const state = baseState({
      chapitres: [dueTodayChapitre(AT_7H_PARIS), dueTodayChapitre(AT_7H_PARIS, { id: 'ch-4', nom: 'Un autre' })],
    })
    fetchState.mockResolvedValue(state)
    sendWebPush.mockResolvedValue()

    const result = await sendMorningDueTodayIfDue(ENV, AT_7H_PARIS)
    expect(result).toMatchObject({ skipped: false, count: 2 })
    expect(sendWebPush).toHaveBeenCalledTimes(2) // une notif par badge, pas groupée
  })
})

describe('sendEveningDueTodayIfDue (18h Paris)', () => {
  it("ne fait rien si ce n'est pas 18h", async () => {
    const result = await sendEveningDueTodayIfDue(ENV, AT_14H_PARIS)
    expect(result).toEqual({ skipped: true, reason: 'not-evening-hour' })
  })

  it("un badge devenu actif ce matin et toujours pas validé déclenche un rappel à 18h", async () => {
    const state = baseState({ chapitres: [dueTodayChapitre(AT_18H_PARIS)] })
    fetchState.mockResolvedValue(state)
    sendWebPush.mockResolvedValue()

    const result = await sendEveningDueTodayIfDue(ENV, AT_18H_PARIS)
    expect(result).toMatchObject({ skipped: false, count: 1 })
    expect(sendWebPush).toHaveBeenCalledTimes(1)
    const [, text] = sendWebPush.mock.calls[0]
    expect(text).toContain('Toujours pas validé')
  })

  it("un badge déjà validé aujourd'hui (nouvelle ancre) ne redéclenche pas de rappel le soir", async () => {
    // Le badge est devenu actif il y a 1 jour (comme dueTodayChapitre) MAIS a
    // été validé juste après (validatedAt tout récent) — sa phase n'est donc
    // plus 'active' à 18h (elle attend la couleur suivante), activeSinceTimestamp
    // renvoie null, il sort naturellement de la liste.
    const c = {
      id: 'ch-5',
      courseId: 'maths-physique',
      side: 'cours',
      nom: 'Déjà coché ce matin',
      badgeCours: {
        statut: 'actif',
        activatedAt: AT_18H_PARIS - 20 * 86_400_000,
        validatedStage: 'rouge',
        validatedAt: AT_18H_PARIS - 60 * 60 * 1000, // validé il y a 1h
      },
    }
    fetchState.mockResolvedValue(baseState({ chapitres: [c] }))
    const result = await sendEveningDueTodayIfDue(ENV, AT_18H_PARIS)
    expect(result).toMatchObject({ skipped: false, count: 0 })
    expect(sendWebPush).not.toHaveBeenCalled()
  })
})
