import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./firestore.js', () => ({
  fetchState: vi.fn(),
  writeState: vi.fn(),
}))

const { fetchState } = await import('./firestore.js')
const { runBackup } = await import('./backup.js')

describe('runBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('ne fait rien (et ne touche pas Firestore) si GIST_TOKEN/GIST_ID ne sont pas configurés', async () => {
    const result = await runBackup({})
    expect(result).toEqual({ skipped: true })
    expect(fetchState).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('PATCH le gist fixe avec le JSON et le Markdown de l\'état actuel quand configuré', async () => {
    fetchState.mockResolvedValue({ chapitres: [], exams: [], devoirs: [] })
    fetch.mockResolvedValue({ ok: true })

    const result = await runBackup({ GIST_TOKEN: 'tok', GIST_ID: 'abc123' })

    expect(result.skipped).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/gists/abc123')
    expect(opts.method).toBe('PATCH')
    expect(opts.headers.Authorization).toBe('Bearer tok')
    const payload = JSON.parse(opts.body)
    expect(Object.keys(payload.files)).toEqual(['l3-physique-backup.json', 'l3-physique-etat.md'])
  })

  it('lève une erreur explicite si GitHub répond une erreur', async () => {
    fetchState.mockResolvedValue({})
    fetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'Bad credentials' })

    await expect(runBackup({ GIST_TOKEN: 'tok', GIST_ID: 'abc123' })).rejects.toThrow(/401/)
  })
})
