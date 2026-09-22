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
const { sendDigestPushIfDue } = await import('./digestPush.js')

const ENV = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY_JWK: '{}' }

function stateWithOneOverdueChapitre(overrides = {}) {
  const now = Date.now()
  return {
    chapitres: [
      {
        id: 'ch-1',
        courseId: 'optique-coherente',
        side: 'cours',
        nom: 'En retard',
        badgeCours: {
          statut: 'actif',
          activatedAt: now - 10 * 86400000,
          validatedStage: 'rouge',
          validatedAt: now - 5 * 86400000,
        },
      },
    ],
    devoirs: [],
    exams: [],
    pushSubscriptions: [{ endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } }],
    ...overrides,
  }
}

describe('sendDigestPushIfDue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ne fait rien si VAPID n'est pas configuré", async () => {
    const result = await sendDigestPushIfDue({})
    expect(result.skipped).toBe(true)
    expect(fetchState).not.toHaveBeenCalled()
  })

  it("ne fait rien si déjà envoyé aujourd'hui", async () => {
    const today = new Date().toISOString().slice(0, 10)
    fetchState.mockResolvedValue(stateWithOneOverdueChapitre({ lastPushSentDate: today }))
    const result = await sendDigestPushIfDue(ENV)
    expect(result).toEqual({ skipped: true, reason: 'already-sent-today' })
    expect(sendWebPush).not.toHaveBeenCalled()
  })

  it("ne fait rien s'il n'y a aucun abonnement", async () => {
    fetchState.mockResolvedValue(stateWithOneOverdueChapitre({ pushSubscriptions: [] }))
    const result = await sendDigestPushIfDue(ENV)
    expect(result).toEqual({ skipped: true, reason: 'no-subscriptions' })
  })

  it("ne fait rien si rien n'est urgent (jamais de push \"rien à faire\")", async () => {
    fetchState.mockResolvedValue({
      chapitres: [],
      devoirs: [],
      exams: [],
      pushSubscriptions: [{ endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } }],
    })
    const result = await sendDigestPushIfDue(ENV)
    expect(result).toEqual({ skipped: true, reason: 'nothing-urgent' })
    expect(sendWebPush).not.toHaveBeenCalled()
  })

  it('envoie un résumé, marque la date, et retire les abonnements en 410 (expirés)', async () => {
    const state = stateWithOneOverdueChapitre({
      pushSubscriptions: [
        { endpoint: 'https://push.test/alive', keys: { p256dh: 'x', auth: 'y' } },
        { endpoint: 'https://push.test/dead', keys: { p256dh: 'x', auth: 'y' } },
      ],
    })
    fetchState.mockResolvedValueOnce(state).mockResolvedValueOnce(state)
    sendWebPush.mockImplementation((sub) => {
      if (sub.endpoint === 'https://push.test/dead') return Promise.reject(new Error('Web Push a échoué (410) : gone'))
      return Promise.resolve()
    })

    const result = await sendDigestPushIfDue(ENV)

    expect(result).toMatchObject({ skipped: false, sent: 1, failed: 1, removed: 1 })
    expect(sendWebPush).toHaveBeenCalledTimes(2)
    const written = writeState.mock.calls[0][0]
    expect(written.lastPushSentDate).toBe(new Date().toISOString().slice(0, 10))
    expect(written.pushSubscriptions.map((s) => s.endpoint)).toEqual(['https://push.test/alive'])
  })
})
