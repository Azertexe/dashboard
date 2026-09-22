import { describe, it, expect } from 'vitest'
import { mergeById, mergeStates } from './store.jsx'

describe('mergeById (fusion additive de la sync Firebase)', () => {
  it('garde tout le local et ajoute ce qui manque, sans rien retirer', () => {
    const local = [{ id: 'a' }, { id: 'b' }]
    const remote = [{ id: 'b', edited: true }, { id: 'c' }]
    expect(mergeById(local, remote)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })

  it('un élément présent des deux côtés garde la version locale (jamais écrasée par le distant)', () => {
    const local = [{ id: 'a', notes: 'ma version locale' }]
    const remote = [{ id: 'a', notes: 'version distante plus vieille' }]
    expect(mergeById(local, remote)).toEqual([{ id: 'a', notes: 'ma version locale' }])
  })

  it("renvoie exactement la même référence locale si le distant n'apporte rien de nouveau (évite un re-render inutile)", () => {
    const local = [{ id: 'a' }]
    expect(mergeById(local, [{ id: 'a' }])).toBe(local)
    expect(mergeById(local, [])).toBe(local)
    expect(mergeById(local, null)).toBe(local)
    expect(mergeById(local, undefined)).toBe(local)
  })

  it('marche aussi quand le local est vide (tout vient du distant)', () => {
    const remote = [{ id: 'a' }, { id: 'b' }]
    expect(mergeById([], remote)).toEqual(remote)
  })
})

describe('mergeStates', () => {
  it('fusionne exams/devoirs/chapitres indépendamment et garde le reste du local tel quel', () => {
    const local = {
      version: 1,
      theme: 'glacier',
      exams: [{ id: 'e1' }],
      devoirs: [{ id: 'd1' }],
      chapitres: [{ id: 'c1' }],
    }
    const remote = {
      theme: 'volcanique', // ne doit pas écraser le thème local
      exams: [{ id: 'e1' }, { id: 'e2' }], // e2 est nouveau
      devoirs: [{ id: 'd1' }],
      chapitres: [],
    }
    const merged = mergeStates(local, remote)
    expect(merged.theme).toBe('glacier')
    expect(merged.exams).toEqual([{ id: 'e1' }, { id: 'e2' }])
    expect(merged.devoirs).toBe(local.devoirs)
    expect(merged.chapitres).toBe(local.chapitres)
  })

  it('renvoie le local tel quel si le distant est null (pas encore de document, ou pas joignable)', () => {
    const local = { exams: [{ id: 'e1' }], devoirs: [], chapitres: [] }
    expect(mergeStates(local, null)).toBe(local)
  })

  it("scénario réel : un partiel tapé localement juste avant qu'une mise à jour distante (sans lui) n'arrive n'est pas perdu", () => {
    const local = {
      exams: [{ id: 'existant' }, { id: 'tout-juste-tape', matiere: 'Optique' }],
      devoirs: [],
      chapitres: [],
    }
    // Le distant ne connaît pas encore le partiel tout juste tapé.
    const remote = { exams: [{ id: 'existant' }], devoirs: [], chapitres: [] }
    const merged = mergeStates(local, remote)
    expect(merged.exams).toContainEqual({ id: 'tout-juste-tape', matiere: 'Optique' })
    expect(merged.exams).toHaveLength(2)
  })

  it('fusionne pushSubscriptions par endpoint (pas d\'id) sans rien perdre', () => {
    const local = {
      exams: [],
      devoirs: [],
      chapitres: [],
      pushSubscriptions: [{ endpoint: 'https://push.test/a' }],
    }
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [],
      pushSubscriptions: [{ endpoint: 'https://push.test/a' }, { endpoint: 'https://push.test/b' }],
    }
    const merged = mergeStates(local, remote)
    expect(merged.pushSubscriptions.map((s) => s.endpoint).sort()).toEqual([
      'https://push.test/a',
      'https://push.test/b',
    ])
  })

  it("lastPushSentDate : prend toujours la valeur distante (seul le serveur l'écrit) plutôt qu'une copie locale périmée", () => {
    const local = { exams: [], devoirs: [], chapitres: [], lastPushSentDate: '2026-09-20' }
    const remote = { exams: [], devoirs: [], chapitres: [], lastPushSentDate: '2026-09-22' }
    expect(mergeStates(local, remote).lastPushSentDate).toBe('2026-09-22')

    // Si le distant n'a rien (jamais envoyé), on garde ce que le local avait déjà reçu.
    const remoteEmpty = { exams: [], devoirs: [], chapitres: [] }
    expect(mergeStates(local, remoteEmpty).lastPushSentDate).toBe('2026-09-20')
  })
})
