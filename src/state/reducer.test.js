import { describe, it, expect } from 'vitest'
import { reducer, migrateChapitre, emptyState } from './reducer.js'

describe('sommaire (parties/sous-parties) — sans rapport avec le badge, qui reste unique par chapitre', () => {
  it('ADD_CHAPITRE crée un chapitre avec un sommaire vide et un seul badge', () => {
    const state = reducer(emptyState(), {
      type: 'ADD_CHAPITRE',
      courseId: 'optique-coherente',
      side: 'cours',
      nom: 'Interférences',
    })
    const c = state.chapitres[0]
    expect(c.parties).toEqual([])
    expect(c.badgeCours.statut).toBe('standby')
    expect(c).not.toHaveProperty('partitionMode')
  })

  it('ADD_PARTIE ajoute une partie au sommaire sans toucher au badge du chapitre', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ACTIVATE_CHAPITRE', id: chapitreId, side: 'cours' })
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Exercice 1' })

    const c = state.chapitres[0]
    expect(c.parties).toHaveLength(1)
    expect(c.parties[0]).toMatchObject({ nom: 'Exercice 1', sousParties: [] })
    expect(c.badgeCours.statut).toBe('actif') // inchangé par l'ajout de partie
  })

  it('EDIT_PARTIE ne modifie que le nom', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Avant' })
    const partieId = state.chapitres[0].parties[0].id
    state = reducer(state, { type: 'EDIT_PARTIE', chapitreId, partieId, patch: { nom: 'Après' } })
    expect(state.chapitres[0].parties[0].nom).toBe('Après')
  })

  it('ADD_SOUS_PARTIE ajoute une sous-partie à la bonne partie, sans toucher les autres', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Partie A' })
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Partie B' })
    const [partieA, partieB] = state.chapitres[0].parties
    state = reducer(state, { type: 'ADD_SOUS_PARTIE', chapitreId, partieId: partieA.id, nom: 'Sous 1' })

    const c = state.chapitres[0]
    expect(c.parties.find((p) => p.id === partieA.id).sousParties).toHaveLength(1)
    expect(c.parties.find((p) => p.id === partieB.id).sousParties).toHaveLength(0)
  })

  it('DELETE_SOUS_PARTIE retire uniquement la sous-partie visée', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Partie A' })
    const partieId = state.chapitres[0].parties[0].id
    state = reducer(state, { type: 'ADD_SOUS_PARTIE', chapitreId, partieId, nom: 'Sous 1' })
    state = reducer(state, { type: 'ADD_SOUS_PARTIE', chapitreId, partieId, nom: 'Sous 2' })
    const [sp1, sp2] = state.chapitres[0].parties[0].sousParties
    state = reducer(state, { type: 'DELETE_SOUS_PARTIE', chapitreId, partieId, sousPartieId: sp1.id })

    const sousParties = state.chapitres[0].parties[0].sousParties
    expect(sousParties).toHaveLength(1)
    expect(sousParties[0].id).toBe(sp2.id)
  })

  it('DELETE_PARTIE retire la partie et ses sous-parties', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Partie A' })
    const partieId = state.chapitres[0].parties[0].id
    state = reducer(state, { type: 'ADD_SOUS_PARTIE', chapitreId, partieId, nom: 'Sous 1' })
    state = reducer(state, { type: 'DELETE_PARTIE', chapitreId, partieId })
    expect(state.chapitres[0].parties).toEqual([])
  })
})

describe('migration : anciennes parties à badge → sommaire (juste le nom, plus de badge)', () => {
  it('garde le nom des anciennes parties et laisse leurs sous-parties vides, sans partitionMode', () => {
    const legacy = {
      id: 'ch-1',
      courseId: 'optique-coherente',
      side: 'cours',
      nom: 'Ch',
      badgeCours: { statut: 'standby' },
      badgeTD: { statut: 'standby' },
      partitionMode: 'parties',
      parties: [
        { id: 'pt-1', nom: 'Exercice 1', description: 'vieux texte', badgeCours: { statut: 'actif' }, badgeTD: { statut: 'standby' } },
      ],
    }
    const migrated = migrateChapitre(legacy)
    expect(migrated.parties).toEqual([{ id: 'pt-1', nom: 'Exercice 1', createdAt: expect.any(Number), sousParties: [] }])
    expect(migrated.parties[0]).not.toHaveProperty('badgeCours')
    expect(migrated.parties[0]).not.toHaveProperty('description')
  })
})
