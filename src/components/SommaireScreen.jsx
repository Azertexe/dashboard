import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { courseAccentStyle, courseName } from '../data/courses.js'

/** Nom éditable en place : texte + crayon, qui se change en input + ✓/× au
 * clic sur le crayon. Partagé par les parties et les sous-parties du
 * sommaire (mêmes deux boutons, ni badge ni autre champ à ces niveaux-là). */
function EditableName({ value, onSave, onDelete, deleteConfirm, big }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <div className="sommaire-edit-row">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              onSave(draft.trim())
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <button
          className="icon-btn"
          title="Enregistrer"
          onClick={() => {
            if (!draft.trim()) return
            onSave(draft.trim())
            setEditing(false)
          }}
        >
          ✓
        </button>
        <button className="icon-btn" title="Annuler" onClick={() => setEditing(false)}>
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="sommaire-name-row">
      <div className={big ? 'sommaire-partie-nom' : 'sommaire-souspartie-nom'}>{value}</div>
      <button
        className="icon-btn"
        title="Modifier"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        ✎
      </button>
      <button
        className="icon-btn"
        title="Supprimer"
        onClick={() => {
          if (confirm(deleteConfirm)) onDelete()
        }}
      >
        ×
      </button>
    </div>
  )
}

function SousPartieRow({ chapitreId, partieId, sousPartie, dispatch }) {
  return (
    <EditableName
      value={sousPartie.nom}
      onSave={(nom) =>
        dispatch({
          type: 'EDIT_SOUS_PARTIE',
          chapitreId,
          partieId,
          sousPartieId: sousPartie.id,
          patch: { nom },
        })
      }
      onDelete={() => dispatch({ type: 'DELETE_SOUS_PARTIE', chapitreId, partieId, sousPartieId: sousPartie.id })}
      deleteConfirm={`Supprimer "${sousPartie.nom}" ?`}
    />
  )
}

/** Une partie du sommaire — cliquer sur son nom la déplie pour montrer (et
 * gérer) ses sous-parties, en accordéon (pas de nouvel écran). */
function PartieRow({ chapitreId, partie, dispatch }) {
  const [open, setOpen] = useState(false)
  const [nomSousPartie, setNomSousPartie] = useState('')
  const sousParties = partie.sousParties ?? []

  const addSousPartie = () => {
    if (!nomSousPartie.trim()) return
    dispatch({ type: 'ADD_SOUS_PARTIE', chapitreId, partieId: partie.id, nom: nomSousPartie.trim() })
    setNomSousPartie('')
  }

  return (
    <div className="sommaire-partie">
      <div className="sommaire-partie-head">
        <div className="sommaire-chevron" onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'}
        </div>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
          <EditableName
            big
            value={partie.nom}
            onSave={(nom) => dispatch({ type: 'EDIT_PARTIE', chapitreId, partieId: partie.id, patch: { nom } })}
            onDelete={() => dispatch({ type: 'DELETE_PARTIE', chapitreId, partieId: partie.id })}
            deleteConfirm={`Supprimer "${partie.nom}" et ses sous-parties ?`}
          />
        </div>
      </div>
      {open && (
        <div className="sommaire-souspartie-list">
          {sousParties.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-dimmer)', padding: '4px 0' }}>
              Aucune sous-partie pour l'instant.
            </div>
          )}
          {sousParties.map((sp) => (
            <SousPartieRow key={sp.id} chapitreId={chapitreId} partieId={partie.id} sousPartie={sp} dispatch={dispatch} />
          ))}
          <div className="devoir-form">
            <input
              placeholder="Nom de la sous-partie…"
              value={nomSousPartie}
              onChange={(e) => setNomSousPartie(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSousPartie()}
            />
            <div className="pill pill-course-accent" onClick={addSousPartie}>
              Ajouter
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Le sommaire d'un chapitre : un plan (parties → sous-parties, juste des
 * noms) pour noter ce qu'il y a dedans — complètement indépendant du badge
 * de révision, qui reste unique pour tout le chapitre. Toujours accessible,
 * quel que soit l'état de ce badge. */
export default function SommaireScreen({ chapitre, side, onBack, onGoHome }) {
  const { dispatch } = useStore()
  const [nom, setNom] = useState('')
  const parties = chapitre.parties ?? []
  const sideLabel = side === 'td' ? 'TD' : 'Cours'

  const addPartie = () => {
    if (!nom.trim()) return
    dispatch({ type: 'ADD_PARTIE', chapitreId: chapitre.id, nom: nom.trim() })
    setNom('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...courseAccentStyle(chapitre.courseId) }}>
      <div className="crumb-row">
        <div className="pill" onClick={onBack}>
          ← {sideLabel}
        </div>
        <div className="screen-title" style={{ flex: 1 }}>
          {chapitre.nom}
        </div>
        <div className="pill" onClick={onGoHome}>
          Accueil
        </div>
      </div>

      <div
        className="glass course-accent-card"
        style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div className="label-mono">
          Sommaire · {courseName(chapitre.courseId)} — {chapitre.nom}
        </div>
        <div className="settings-note" style={{ padding: 0 }}>
          Un plan de ce qu'il y a dans ce chapitre — sans rapport avec le badge de révision (qui reste unique
          pour tout le chapitre).
        </div>

        {parties.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucune partie pour l'instant.</div>
        )}
        {parties.length > 0 && (
          <div className="chapitre-list">
            {parties.map((p) => (
              <PartieRow key={p.id} chapitreId={chapitre.id} partie={p} dispatch={dispatch} />
            ))}
          </div>
        )}

        <div className="devoir-form">
          <input
            name="nom"
            placeholder="Nom de la partie (ex : Exercice 1)…"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPartie()}
          />
          <div className="pill pill-course-accent" onClick={addPartie}>
            Ajouter
          </div>
        </div>
      </div>
    </div>
  )
}
