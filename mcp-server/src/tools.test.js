import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./firestore.js', () => ({
  fetchState: vi.fn(),
  writeState: vi.fn(),
}))

// Importés après le mock pour que tools.js reçoive les versions mockées.
const { fetchState, writeState } = await import('./firestore.js')
const { TOOLS } = await import('./tools.js')

function tool(name) {
  return TOOLS.find((t) => t.name === name)
}

describe('outils MCP — écriture (aucun appel réseau réel, firestore.js mocké)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('add_partiel relit le distant, ajoute le partiel via le reducer, puis écrit le tout', async () => {
    fetchState.mockResolvedValue({ exams: [{ id: 'exam-1', matiere: 'Optique', date: '2026-10-01' }] })
    await tool('add_partiel').handler({ matiere: 'Chimie', date: '2026-11-01' })

    expect(fetchState).toHaveBeenCalledTimes(1)
    expect(writeState).toHaveBeenCalledTimes(1)
    const written = writeState.mock.calls[0][0]
    expect(written.exams).toHaveLength(2)
    expect(written.exams.find((e) => e.matiere === 'Chimie')).toMatchObject({ date: '2026-11-01', notes: '' })
    // Le partiel déjà présent côté distant n'est pas perdu.
    expect(written.exams.find((e) => e.id === 'exam-1')).toBeTruthy()
  })

  it('edit_partiel ne touche que les champs autorisés (notes/prepStatut)', async () => {
    fetchState.mockResolvedValue({
      exams: [{ id: 'exam-1', matiere: 'Optique', date: '2026-10-01', notes: '', prepStatut: null }],
    })
    await tool('edit_partiel').handler({ id: 'exam-1', prepStatut: 'urgent' })

    const written = writeState.mock.calls[0][0]
    const edited = written.exams.find((e) => e.id === 'exam-1')
    expect(edited.prepStatut).toBe('urgent')
    expect(edited.matiere).toBe('Optique') // inchangé
  })

  it('add_devoir accepte une matière optionnelle et toggle_devoir_fait bascule bien le bon devoir', async () => {
    fetchState.mockResolvedValue({ devoirs: [] })
    await tool('add_devoir').handler({ nom: 'TP1', dateEcheance: '2026-10-01', courseId: 'optique-coherente' })
    const written1 = writeState.mock.calls[0][0]
    expect(written1.devoirs[0]).toMatchObject({ nom: 'TP1', courseId: 'optique-coherente', fait: false })

    fetchState.mockResolvedValue(written1)
    await tool('toggle_devoir_fait').handler({ id: written1.devoirs[0].id })
    const written2 = writeState.mock.calls[1][0]
    expect(written2.devoirs[0].fait).toBe(true)
  })

  it('delete_partiel retire bien le partiel visé et garde les autres', async () => {
    fetchState.mockResolvedValue({
      exams: [
        { id: 'exam-1', matiere: 'Optique', date: '2026-10-01' },
        { id: 'exam-2', matiere: 'Chimie', date: '2026-11-01' },
      ],
    })
    await tool('delete_partiel').handler({ id: 'exam-1' })

    const written = writeState.mock.calls[0][0]
    expect(written.exams.map((e) => e.id)).toEqual(['exam-2'])
  })

  it("mark_badge ne fait rien (mais écrit quand même l'état inchangé) si le badge est encore en attente", async () => {
    const now = Date.now()
    fetchState.mockResolvedValue({
      chapitres: [
        {
          id: 'ch-1',
          courseId: 'optique-coherente',
          side: 'cours',
          nom: 'Interférences',
          badgeCours: { statut: 'actif', activatedAt: now, validatedStage: null, validatedAt: null },
        },
      ],
    })
    await tool('mark_badge').handler({ id: 'ch-1', side: 'cours' })

    const written = writeState.mock.calls[0][0]
    // Encore en attente (rouge pas encore atteint) : validatedStage reste null.
    expect(written.chapitres[0].badgeCours.validatedStage).toBeNull()
  })

  it('activate_chapitre démarre bien l\'horloge du côté demandé', async () => {
    fetchState.mockResolvedValue({
      chapitres: [{ id: 'ch-1', courseId: 'optique-coherente', side: 'cours', nom: 'Interférences' }],
    })
    await tool('activate_chapitre').handler({ id: 'ch-1', side: 'cours' })

    const written = writeState.mock.calls[0][0]
    expect(written.chapitres[0].badgeCours.statut).toBe('actif')
  })
})

describe('get_state (lecture seule)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('résume chapitres/partiels/devoirs avec des id exploitables et ne modifie rien', async () => {
    fetchState.mockResolvedValue({
      exams: [{ id: 'exam-1', matiere: 'Optique', date: '2026-10-01' }],
      devoirs: [{ id: 'dev-1', nom: 'TP1', dateEcheance: '2026-10-05' }],
      chapitres: [],
    })
    const result = await tool('get_state').handler({})

    expect(writeState).not.toHaveBeenCalled()
    expect(result.partiels[0]).toMatchObject({ id: 'exam-1', matiere: 'Optique' })
    expect(result.devoirs[0]).toMatchObject({ id: 'dev-1', nom: 'TP1' })
    expect(result.matieres.length).toBe(7)
  })
})
