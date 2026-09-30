import { describe, it, expect } from 'vitest'
import { reducer, migrateChapitre, migrateDevoir, emptyState, stableStringify } from './reducer.js'

describe('stableStringify — indépendant de l\'ordre des clés (cf. state/store.jsx)', () => {
  it('donne le même résultat pour deux objets aux clés dans un ordre différent', () => {
    const a = { x: 1, y: 2, z: { p: 1, q: 2 } }
    const b = { z: { q: 2, p: 1 }, y: 2, x: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('donne un résultat différent si les valeurs diffèrent réellement', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }))
  })

  it("préserve l'ordre des éléments d'un tableau (il porte du sens)", () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]))
  })

  it('gère les tableaux d\'objets aux clés dans un ordre différent', () => {
    const a = [{ id: 1, nom: 'x' }]
    const b = [{ nom: 'x', id: 1 }]
    expect(stableStringify(a)).toBe(stableStringify(b))
  })
})

describe('abonnements push', () => {
  it('SUBSCRIBE_PUSH ajoute un abonnement, ignore un doublon (même endpoint)', () => {
    const sub = { endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } }
    let state = reducer(emptyState(), { type: 'SUBSCRIBE_PUSH', subscription: sub })
    expect(state.pushSubscriptions).toEqual([sub])

    state = reducer(state, { type: 'SUBSCRIBE_PUSH', subscription: sub })
    expect(state.pushSubscriptions).toHaveLength(1)
  })

  it('UNSUBSCRIBE_PUSH retire uniquement l\'endpoint visé', () => {
    let state = reducer(emptyState(), { type: 'SUBSCRIBE_PUSH', subscription: { endpoint: 'a' } })
    state = reducer(state, { type: 'SUBSCRIBE_PUSH', subscription: { endpoint: 'b' } })
    state = reducer(state, { type: 'UNSUBSCRIBE_PUSH', endpoint: 'a' })
    expect(state.pushSubscriptions).toEqual([{ endpoint: 'b' }])
  })
})

describe('journal de progression (history) — un événement par couleur réellement validée', () => {
  const DAY_MS = 24 * 60 * 60 * 1000

  function activatedChapitre(now, waitedDays) {
    return {
      id: 'ch-1',
      courseId: 'optique-coherente',
      side: 'cours',
      nom: 'Ch',
      badgeCours: {
        statut: 'actif',
        activatedAt: now - waitedDays * DAY_MS,
        validatedStage: null,
        validatedAt: null,
        previousSnapshot: null,
        forcedAlert: null,
      },
      badgeTD: { statut: 'standby', activatedAt: null, validatedStage: null, validatedAt: null, previousSnapshot: null, forcedAlert: null },
      parties: [],
    }
  }

  it('MARK_BADGE sur un badge ACTIF ajoute un événement avec la bonne couleur', () => {
    const now = Date.now()
    const state = { ...emptyState(), chapitres: [activatedChapitre(now, 2)] } // 2j écoulés >= 1j (attente initiale) -> rouge actif
    const next = reducer(state, { type: 'MARK_BADGE', id: 'ch-1', side: 'cours' })
    expect(next.history).toHaveLength(1)
    expect(next.history[0]).toMatchObject({ chapitreId: 'ch-1', courseId: 'optique-coherente', side: 'cours', level: 'rouge' })
  })

  it("MARK_BADGE sur un badge encore en attente (pas cliquable) n'ajoute rien au journal", () => {
    const now = Date.now()
    const state = { ...emptyState(), chapitres: [activatedChapitre(now, 0)] } // vient d'être activé, encore en attente
    const next = reducer(state, { type: 'MARK_BADGE', id: 'ch-1', side: 'cours' })
    expect(next.history).toEqual([])
  })

  it('le journal garde au plus 300 événements — le plus ancien tombe', () => {
    const now = Date.now()
    const old = Array.from({ length: 300 }, (_, i) => ({
      id: `hist-${i}`,
      at: i,
      chapitreId: 'x',
      courseId: 'x',
      side: 'cours',
      level: 'rouge',
    }))
    const state = { ...emptyState(), history: old, chapitres: [activatedChapitre(now, 2)] }
    const next = reducer(state, { type: 'MARK_BADGE', id: 'ch-1', side: 'cours' })
    expect(next.history).toHaveLength(300)
    expect(next.history[0].id).toBe('hist-1')
    expect(next.history[next.history.length - 1].chapitreId).toBe('ch-1')
  })
})

describe('devoirs — fait / rattachement à une matière', () => {
  it('ADD_DEVOIR crée un devoir non fait, sans matière par défaut', () => {
    const state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'TP1', dateEcheance: '2026-10-01' })
    expect(state.devoirs[0]).toMatchObject({ nom: 'TP1', fait: false, courseId: null })
  })

  it('ADD_DEVOIR accepte une matière optionnelle', () => {
    const state = reducer(emptyState(), {
      type: 'ADD_DEVOIR',
      nom: 'TP1',
      dateEcheance: '2026-10-01',
      courseId: 'optique-coherente',
    })
    expect(state.devoirs[0].courseId).toBe('optique-coherente')
  })

  it('TOGGLE_DEVOIR_FAIT bascule uniquement le devoir visé', () => {
    let state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'TP1', dateEcheance: '2026-10-01' })
    state = reducer(state, { type: 'ADD_DEVOIR', nom: 'TP2', dateEcheance: '2026-10-02' })
    const [d1, d2] = state.devoirs
    state = reducer(state, { type: 'TOGGLE_DEVOIR_FAIT', id: d1.id })
    expect(state.devoirs.find((d) => d.id === d1.id).fait).toBe(true)
    expect(state.devoirs.find((d) => d.id === d2.id).fait).toBe(false)

    state = reducer(state, { type: 'TOGGLE_DEVOIR_FAIT', id: d1.id })
    expect(state.devoirs.find((d) => d.id === d1.id).fait).toBe(false)
  })

  it('migrateDevoir complète les anciens devoirs sans casser leurs champs existants', () => {
    const legacy = { id: 'dev-1', nom: 'TP1', dateEcheance: '2026-10-01', createdAt: 1 }
    expect(migrateDevoir(legacy)).toEqual({ ...legacy, fait: false, courseId: null, faitAt: null })
  })

  it('TOGGLE_DEVOIR_FAIT enregistre depuis quand le devoir est fait (faitAt), et l\'oublie si on décoche', () => {
    let state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'TP1', dateEcheance: '2026-10-01' })
    const [d1] = state.devoirs
    expect(d1.faitAt).toBeNull()

    state = reducer(state, { type: 'TOGGLE_DEVOIR_FAIT', id: d1.id })
    expect(state.devoirs[0].faitAt).toEqual(expect.any(Number))

    state = reducer(state, { type: 'TOGGLE_DEVOIR_FAIT', id: d1.id })
    expect(state.devoirs[0].faitAt).toBeNull()
  })

  it('PURGE_TRASHED_DEVOIRS retire les devoirs cochés un jour civil local antérieur, garde les autres', () => {
    const hier = new Date('2026-10-01T10:00:00').getTime()
    const aujourdhui = new Date('2026-10-02T09:00:00').getTime()
    let state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'Coché hier', dateEcheance: '2026-10-01' })
    state = reducer(state, { type: 'ADD_DEVOIR', nom: 'Coché aujourd\'hui', dateEcheance: '2026-10-01' })
    state = reducer(state, { type: 'ADD_DEVOIR', nom: 'Pas fait', dateEcheance: '2026-10-05' })
    const [dHier, dAujourdhui] = state.devoirs

    // Simule : dHier coché hier (faitAt = hier), dAujourdhui coché aujourd'hui.
    state = {
      ...state,
      devoirs: state.devoirs.map((d) => {
        if (d.id === dHier.id) return { ...d, fait: true, faitAt: hier }
        if (d.id === dAujourdhui.id) return { ...d, fait: true, faitAt: aujourdhui }
        return d
      }),
    }

    const purged = reducer(state, { type: 'PURGE_TRASHED_DEVOIRS', now: aujourdhui })
    expect(purged.devoirs.find((d) => d.id === dHier.id)).toBeUndefined()
    expect(purged.devoirs.find((d) => d.id === dAujourdhui.id)).toBeDefined()
    expect(purged.devoirs).toHaveLength(2)
  })

  it("PURGE_TRASHED_DEVOIRS renvoie exactement le même état si rien n'est à purger (évite un re-render/sync inutile)", () => {
    const now = Date.now()
    let state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'TP1', dateEcheance: '2026-10-01' })
    state = reducer(state, { type: 'TOGGLE_DEVOIR_FAIT', id: state.devoirs[0].id })
    const purged = reducer(state, { type: 'PURGE_TRASHED_DEVOIRS', now })
    expect(purged).toBe(state)
  })
})

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

describe("SET_CHAPITRE_POSITION — forcer la position d'un chapitre (ex. recréé après une suppression accidentelle)", () => {
  function chapitre(id, courseId, side, ordre) {
    return { id, courseId, side, nom: id, ordre, createdAt: ordre, parties: [] }
  }

  it('déplace le chapitre visé au rang demandé et réindexe ses frères (même matière + même côté) en conséquence', () => {
    const state = {
      ...emptyState(),
      chapitres: [
        chapitre('a', 'optique-coherente', 'cours', 0),
        chapitre('b', 'optique-coherente', 'cours', 1),
        chapitre('c', 'optique-coherente', 'cours', 2),
      ],
    }
    // "c" (recréé après une suppression accidentelle) doit reprendre la 1ère place.
    const next = reducer(state, { type: 'SET_CHAPITRE_POSITION', id: 'c', position: 1 })
    const order = [...next.chapitres].sort((x, y) => x.ordre - y.ordre).map((c) => c.id)
    expect(order).toEqual(['c', 'a', 'b'])
  })

  it('une position hors bornes est bornée à la taille du groupe (jamais de trou ni de plantage)', () => {
    const state = {
      ...emptyState(),
      chapitres: [chapitre('a', 'optique-coherente', 'cours', 0), chapitre('b', 'optique-coherente', 'cours', 1)],
    }
    const tropLoin = reducer(state, { type: 'SET_CHAPITRE_POSITION', id: 'a', position: 99 })
    expect([...tropLoin.chapitres].sort((x, y) => x.ordre - y.ordre).map((c) => c.id)).toEqual(['b', 'a'])

    const negatif = reducer(state, { type: 'SET_CHAPITRE_POSITION', id: 'b', position: -5 })
    expect([...negatif.chapitres].sort((x, y) => x.ordre - y.ordre).map((c) => c.id)).toEqual(['b', 'a'])
  })

  it("ne touche jamais les chapitres d'une autre matière ou d'un autre côté (Cours/TD)", () => {
    const autreMatiere = chapitre('x', 'mecanique-analytique', 'cours', 0)
    const autreCote = chapitre('y', 'optique-coherente', 'td', 0)
    const state = {
      ...emptyState(),
      chapitres: [chapitre('a', 'optique-coherente', 'cours', 0), chapitre('b', 'optique-coherente', 'cours', 1), autreMatiere, autreCote],
    }
    const next = reducer(state, { type: 'SET_CHAPITRE_POSITION', id: 'b', position: 1 })
    expect(next.chapitres.find((c) => c.id === 'x').ordre).toBe(0)
    expect(next.chapitres.find((c) => c.id === 'y').ordre).toBe(0)
  })

  it('un id inconnu ne fait rien (pas de plantage)', () => {
    const state = { ...emptyState(), chapitres: [chapitre('a', 'optique-coherente', 'cours', 0)] }
    expect(reducer(state, { type: 'SET_CHAPITRE_POSITION', id: 'inconnu', position: 1 })).toBe(state)
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

  it("un chapitre sans `ordre` (ancien format) hérite de son createdAt — tri chronologique inchangé tant qu'on n'a rien forcé", () => {
    const legacy = { id: 'ch-1', courseId: 'optique-coherente', side: 'cours', nom: 'Ch', createdAt: 12345 }
    expect(migrateChapitre(legacy).ordre).toBe(12345)
  })

  it('un `ordre` déjà présent (position forcée à la main) est conservé tel quel à la migration', () => {
    const legacy = { id: 'ch-1', courseId: 'optique-coherente', side: 'cours', nom: 'Ch', createdAt: 12345, ordre: 0 }
    expect(migrateChapitre(legacy).ordre).toBe(0)
  })
})

// Chaque suppression doit poser un tombstone (deletedIds) — sinon
// mergeStates ne peut pas distinguer "je viens de supprimer ceci" d'"un
// autre appareil vient d'ajouter ceci", et la fusion additive de la sync le
// ressuscite au cycle suivant (bug signalé : "quand je supprime un chapitre
// il réapparaît"). Voir store.test.js pour la reproduction complète au
// niveau de mergeStates.
describe('tombstones (deletedIds) posés par chaque suppression', () => {
  it('DELETE_CHAPITRE pose un tombstone pour le chapitre supprimé', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const id = state.chapitres[0].id
    state = reducer(state, { type: 'DELETE_CHAPITRE', id })
    expect(state.deletedIds).toEqual([{ id, at: expect.any(Number) }])
  })

  it('DELETE_DEVOIR pose un tombstone pour le devoir supprimé', () => {
    let state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'TP1', dateEcheance: '2026-10-01' })
    const id = state.devoirs[0].id
    state = reducer(state, { type: 'DELETE_DEVOIR', id })
    expect(state.deletedIds).toEqual([{ id, at: expect.any(Number) }])
  })

  it('PURGE_TRASHED_DEVOIRS pose un tombstone pour chaque devoir purgé', () => {
    const hier = new Date('2026-10-01T10:00:00').getTime()
    const aujourdhui = new Date('2026-10-02T09:00:00').getTime()
    let state = reducer(emptyState(), { type: 'ADD_DEVOIR', nom: 'TP1', dateEcheance: '2026-10-01' })
    const id = state.devoirs[0].id
    state = { ...state, devoirs: [{ ...state.devoirs[0], fait: true, faitAt: hier }] }
    state = reducer(state, { type: 'PURGE_TRASHED_DEVOIRS', now: aujourdhui })
    expect(state.deletedIds).toEqual([{ id, at: expect.any(Number) }])
  })

  it('DELETE_EXAM pose un tombstone pour le partiel supprimé', () => {
    let state = reducer(emptyState(), { type: 'ADD_EXAM', matiere: 'Optique', date: '2026-10-12' })
    const id = state.exams[0].id
    state = reducer(state, { type: 'DELETE_EXAM', id })
    expect(state.deletedIds).toEqual([{ id, at: expect.any(Number) }])
  })

  it('DELETE_PARTIE pose un tombstone pour la partie supprimée', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Partie A' })
    const partieId = state.chapitres[0].parties[0].id
    state = reducer(state, { type: 'DELETE_PARTIE', chapitreId, partieId })
    expect(state.deletedIds).toEqual([{ id: partieId, at: expect.any(Number) }])
  })

  it('DELETE_SOUS_PARTIE pose un tombstone pour la sous-partie supprimée', () => {
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    const chapitreId = state.chapitres[0].id
    state = reducer(state, { type: 'ADD_PARTIE', chapitreId, nom: 'Partie A' })
    const partieId = state.chapitres[0].parties[0].id
    state = reducer(state, { type: 'ADD_SOUS_PARTIE', chapitreId, partieId, nom: 'Sous 1' })
    const sousPartieId = state.chapitres[0].parties[0].sousParties[0].id
    state = reducer(state, { type: 'DELETE_SOUS_PARTIE', chapitreId, partieId, sousPartieId })
    expect(state.deletedIds).toEqual([{ id: sousPartieId, at: expect.any(Number) }])
  })

  it('DELETE_RESOURCE_LINK pose un tombstone à clé synthétique (courseId + champ)', () => {
    let state = reducer(emptyState(), {
      type: 'SET_RESOURCE_LINK',
      courseId: 'maths-physique',
      kind: 'revision',
      url: 'https://test.example/rev',
      label: 'Révision',
    })
    state = reducer(state, { type: 'DELETE_RESOURCE_LINK', courseId: 'maths-physique', kind: 'revision' })
    expect(state.deletedIds).toEqual([{ id: 'resource:maths-physique:revision', at: expect.any(Number) }])
  })

  it('DELETE_POLY pose un tombstone pour le poly supprimé', () => {
    let state = reducer(emptyState(), {
      type: 'ADD_POLY',
      courseId: 'maths-physique',
      url: 'https://test.example/poly',
      label: 'Poly 1',
    })
    const polyId = state.resources['maths-physique'].polys[0].id
    state = reducer(state, { type: 'DELETE_POLY', courseId: 'maths-physique', polyId })
    expect(state.deletedIds).toEqual([{ id: polyId, at: expect.any(Number) }])
  })

  it('les tombstones ne dépassent pas 500 entrées — les plus anciennes tombent', () => {
    const old = Array.from({ length: 500 }, (_, i) => ({ id: `d-${i}`, at: i }))
    let state = reducer(emptyState(), { type: 'ADD_CHAPITRE', courseId: 'optique-coherente', side: 'cours', nom: 'Ch' })
    state = { ...state, deletedIds: old }
    const id = state.chapitres[0].id
    state = reducer(state, { type: 'DELETE_CHAPITRE', id })
    expect(state.deletedIds).toHaveLength(500)
    expect(state.deletedIds.map((d) => d.id)).not.toContain('d-0')
    expect(state.deletedIds.map((d) => d.id)).toContain(id)
  })
})
