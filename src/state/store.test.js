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

  it("un id tombstoné (deletedIds) n'est jamais ré-ajouté depuis le distant, même absent du local", () => {
    const local = [{ id: 'a' }]
    const remote = [{ id: 'a' }, { id: 'b' }]
    const deletedIds = new Set(['b'])
    expect(mergeById(local, remote, deletedIds)).toEqual([{ id: 'a' }])
  })

  it("un id tombstoné est aussi retiré du LOCAL s'il y est encore (appareil resté hors ligne, suppression faite ailleurs)", () => {
    const local = [{ id: 'a' }, { id: 'b' }]
    const remote = [{ id: 'a' }]
    const deletedIds = new Set(['b'])
    expect(mergeById(local, remote, deletedIds)).toEqual([{ id: 'a' }])
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

  it("une partie/sous-partie ajoutée à distance (ex. serveur MCP) sur un chapitre déjà connu localement n'est pas effacée par le prochain cycle sync→fusion→réécriture", () => {
    const local = {
      exams: [],
      devoirs: [],
      chapitres: [
        {
          id: 'c1',
          nom: 'Chapitre local',
          parties: [{ id: 'p1', nom: 'Partie déjà connue', sousParties: [] }],
        },
      ],
    }
    // Le distant a la même partie p1 (avec une nouvelle sous-partie) ET une
    // toute nouvelle partie p2 — aucune des deux n'a été tapée localement.
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [
        {
          id: 'c1',
          nom: 'Chapitre local',
          parties: [
            { id: 'p1', nom: 'Partie déjà connue', sousParties: [{ id: 'sp1', nom: 'Ajoutée à distance' }] },
            { id: 'p2', nom: 'Nouvelle partie distante', sousParties: [] },
          ],
        },
      ],
    }
    const merged = mergeStates(local, remote)
    const p1 = merged.chapitres[0].parties.find((p) => p.id === 'p1')
    expect(p1.sousParties).toEqual([{ id: 'sp1', nom: 'Ajoutée à distance' }])
    expect(merged.chapitres[0].parties.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it("un lien de ressource ajouté à distance (ex. serveur MCP) n'est pas effacé par une copie locale en retard ou vide", () => {
    const local = {
      exams: [],
      devoirs: [],
      chapitres: [],
      resources: {
        maths: { revision: { url: 'https://local.test/rev', label: 'Révision' }, methode: null, polys: [] },
      },
    }
    // Le distant a un lien "méthode" pour maths (jamais vu localement), ET
    // une toute nouvelle matière "physique" (jamais vue localement non plus).
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [],
      resources: {
        maths: {
          revision: { url: 'https://remote.test/rev-plus-vieux', label: 'Ancienne révision' },
          methode: { url: 'https://remote.test/methode', label: 'Méthode' },
          polys: [{ id: 'poly1', url: 'https://remote.test/poly1', label: 'Poly 1' }],
        },
        physique: { revision: null, methode: { url: 'https://remote.test/phys', label: 'Méthode physique' }, polys: [] },
      },
    }
    const merged = mergeStates(local, remote)
    // La révision locale n'est jamais écrasée par la distante.
    expect(merged.resources.maths.revision).toEqual({ url: 'https://local.test/rev', label: 'Révision' })
    // Le champ méthode, absent localement, est repris du distant.
    expect(merged.resources.maths.methode).toEqual({ url: 'https://remote.test/methode', label: 'Méthode' })
    expect(merged.resources.maths.polys).toEqual([{ id: 'poly1', url: 'https://remote.test/poly1', label: 'Poly 1' }])
    // Une matière entièrement absente localement est reprise du distant.
    expect(merged.resources.physique).toEqual(remote.resources.physique)
  })

  it("un événement de progression (history) ajouté ailleurs n'est pas perdu au prochain cycle sync→fusion→réécriture", () => {
    const local = { exams: [], devoirs: [], chapitres: [], history: [{ id: 'h1', at: 1 }] }
    const remote = { exams: [], devoirs: [], chapitres: [], history: [{ id: 'h1', at: 1 }, { id: 'h2', at: 2 }] }
    const merged = mergeStates(local, remote)
    expect(merged.history.map((h) => h.id).sort()).toEqual(['h1', 'h2'])
  })

  it('history fusionné garde au plus 300 événements (les plus récents), même fusionné depuis deux appareils', () => {
    const local = {
      exams: [],
      devoirs: [],
      chapitres: [],
      history: Array.from({ length: 300 }, (_, i) => ({ id: `h-${i}`, at: i })),
    }
    // Le distant apporte 5 événements plus récents, jamais vus localement.
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [],
      history: Array.from({ length: 5 }, (_, i) => ({ id: `h-remote-${i}`, at: 300 + i })),
    }
    const merged = mergeStates(local, remote)
    expect(merged.history).toHaveLength(300)
    expect(merged.history.map((h) => h.id)).not.toContain('h-0') // les plus anciens tombent
    expect(merged.history.map((h) => h.id)).toContain('h-remote-4') // les plus récents restent
  })

  it("lastPushSentDate : prend toujours la valeur distante (seul le serveur l'écrit) plutôt qu'une copie locale périmée", () => {
    const local = { exams: [], devoirs: [], chapitres: [], lastPushSentDate: '2026-09-20' }
    const remote = { exams: [], devoirs: [], chapitres: [], lastPushSentDate: '2026-09-22' }
    expect(mergeStates(local, remote).lastPushSentDate).toBe('2026-09-22')

    // Si le distant n'a rien (jamais envoyé), on garde ce que le local avait déjà reçu.
    const remoteEmpty = { exams: [], devoirs: [], chapitres: [] }
    expect(mergeStates(local, remoteEmpty).lastPushSentDate).toBe('2026-09-20')
  })

  // Bug signalé : "quand je supprime un chapitre il réapparaît". Scénario
  // exact : je supprime un chapitre → mon state local ne l'a plus → mon
  // propre effet de sync (store.jsx) relit le distant AVANT d'avoir eu le
  // temps d'y écrire la suppression → mergeStates(local sans le chapitre,
  // distant qui l'a encore) le traitait comme un AJOUT distant et le
  // rajoutait, y compris dans ce que je repoussais sur Firestore juste
  // après (la suppression n'était donc jamais écrite du tout).
  it("un chapitre supprimé localement ne réapparaît PAS même si le distant (pas encore à jour) l'a encore — y compris juste après l'avoir supprimé soi-même", () => {
    const local = {
      exams: [],
      devoirs: [],
      // Le chapitre vient d'être supprimé : deletedIds le tombstone.
      chapitres: [{ id: 'c1', nom: 'Reste' }],
      deletedIds: [{ id: 'c2', at: Date.now() }],
    }
    // Le distant n'a pas encore vu la suppression (c'est justement le push
    // qui doit l'y écrire) : il a toujours c2.
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [
        { id: 'c1', nom: 'Reste' },
        { id: 'c2', nom: 'Supprimé — ne doit pas revenir' },
      ],
    }
    const merged = mergeStates(local, remote)
    expect(merged.chapitres.map((c) => c.id)).toEqual(['c1'])
  })

  it("un chapitre supprimé sur UN AUTRE appareil (déjà remonté au serveur) disparaît aussi d'un appareil resté hors ligne qui en avait encore une copie", () => {
    const local = {
      exams: [],
      devoirs: [],
      // Cet appareil n'a jamais supprimé quoi que ce soit lui-même — il a
      // juste une copie périmée de c2, supprimé ailleurs entre-temps.
      chapitres: [
        { id: 'c1', nom: 'Reste' },
        { id: 'c2', nom: 'Supprimé ailleurs' },
      ],
      deletedIds: [],
    }
    // Le serveur a déjà vu la suppression de c2 (un autre appareil l'a
    // poussée) : il ne l'a plus dans ses chapitres, et porte le tombstone.
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [{ id: 'c1', nom: 'Reste' }],
      deletedIds: [{ id: 'c2', at: Date.now() }],
    }
    const merged = mergeStates(local, remote)
    expect(merged.chapitres.map((c) => c.id)).toEqual(['c1'])
  })

  it('un lien de ressource supprimé localement (revision) ne réapparaît pas si le distant (pas encore à jour) le porte encore', () => {
    const local = {
      exams: [],
      devoirs: [],
      chapitres: [],
      resources: { maths: { revision: null, methode: null, polys: [] } },
      deletedIds: [{ id: 'resource:maths:revision', at: Date.now() }],
    }
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [],
      resources: { maths: { revision: { url: 'https://old.test', label: 'Ancien lien' }, methode: null, polys: [] } },
    }
    const merged = mergeStates(local, remote)
    expect(merged.resources.maths.revision).toBeNull()
  })

  it('les tombstones se fusionnent en additif (union) et ne dépassent pas 500 entrées, en gardant les plus récentes', () => {
    const local = {
      exams: [],
      devoirs: [],
      chapitres: [],
      deletedIds: Array.from({ length: 500 }, (_, i) => ({ id: `d-${i}`, at: i })),
    }
    const remote = {
      exams: [],
      devoirs: [],
      chapitres: [],
      deletedIds: Array.from({ length: 3 }, (_, i) => ({ id: `d-remote-${i}`, at: 500 + i })),
    }
    const merged = mergeStates(local, remote)
    expect(merged.deletedIds).toHaveLength(500)
    expect(merged.deletedIds.map((d) => d.id)).not.toContain('d-0')
    expect(merged.deletedIds.map((d) => d.id)).toContain('d-remote-2')
  })
})
