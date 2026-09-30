import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./firestore.js', () => ({
  fetchState: vi.fn(),
}))
vi.mock('./webpush.js', () => ({
  sendWebPush: vi.fn(),
}))

const { fetchState } = await import('./firestore.js')
const { sendWebPush } = await import('./webpush.js')
const { sendTestPush } = await import('./testPush.js')

const ENV = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY_JWK: '{}' }

function baseState(overrides = {}) {
  return { chapitres: [], devoirs: [], exams: [], pushSubscriptions: [], ...overrides }
}

describe('sendTestPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ne fait rien si VAPID n'est pas configuré", async () => {
    const result = await sendTestPush({})
    expect(result).toEqual({ skipped: true, reason: 'not-configured' })
    expect(fetchState).not.toHaveBeenCalled()
  })

  it("ne fait rien s'il n'y a aucun abonnement", async () => {
    fetchState.mockResolvedValue(baseState())
    const result = await sendTestPush(ENV)
    expect(result).toEqual({ skipped: true, reason: 'no-subscriptions' })
    expect(sendWebPush).not.toHaveBeenCalled()
  })

  it('envoie un test à tous les appareils abonnés, sans condition ni dédoublonnage', async () => {
    const state = baseState({
      pushSubscriptions: [
        { endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } },
        { endpoint: 'https://push.test/b', keys: { p256dh: 'x', auth: 'y' } },
      ],
    })
    fetchState.mockResolvedValue(state)
    sendWebPush.mockResolvedValue()

    const result = await sendTestPush(ENV)

    expect(result).toEqual({ skipped: false, sent: 2, failed: 0 })
    expect(sendWebPush).toHaveBeenCalledTimes(2)
    const [, text] = sendWebPush.mock.calls[0]
    expect(text).toContain('Test réussi')
  })

  it('compte les échecs sans planter', async () => {
    const state = baseState({
      pushSubscriptions: [{ endpoint: 'https://push.test/dead', keys: { p256dh: 'x', auth: 'y' } }],
    })
    fetchState.mockResolvedValue(state)
    sendWebPush.mockRejectedValue(new Error('Web Push a échoué (410) : gone'))

    const result = await sendTestPush(ENV)
    expect(result).toEqual({ skipped: false, sent: 0, failed: 1 })
  })
})
