import { useState } from 'react'
import Badge from './Badge.jsx'
import { useStore } from '../state/store.jsx'
import { ETATS, etatLabel } from '../data/etats.js'

/** Ligne compacte : nom + 2 badges. Utilisée dans la vue "Cours"/"TD" groupée par matière. */
export function ChapitreRowCompact({ chapitre, side, now }) {
  const { dispatch } = useStore()
  const onMark = (id, s) => dispatch({ type: 'MARK_BADGE', id, side: s })
  return (
    <div className="chapitre-row">
      <div className="chapitre-name">{chapitre.nom}</div>
      <Badge chapitre={chapitre} side={side} onMark={onMark} small now={now} />
    </div>
  )
}

/** Ligne complète, éditable : utilisée dans le détail d'un cours. */
export function ChapitreRowFull({ chapitre, now }) {
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    nom: chapitre.nom,
    description: chapitre.description,
    commentaires: chapitre.commentaires,
    etat: chapitre.etat,
  }))

  const onMark = (id, side) => dispatch({ type: 'MARK_BADGE', id, side })
  const onActivate = () => dispatch({ type: 'ACTIVATE_CHAPITRE', id: chapitre.id })
  const onDelete = () => {
    if (confirm(`Supprimer "${chapitre.nom}" ? Cette action est définitive.`)) {
      dispatch({ type: 'DELETE_CHAPITRE', id: chapitre.id })
    }
  }
  const startEdit = () => {
    setDraft({
      nom: chapitre.nom,
      description: chapitre.description,
      commentaires: chapitre.commentaires,
      etat: chapitre.etat,
    })
    setEditing(true)
  }
  const saveEdit = () => {
    dispatch({ type: 'EDIT_CHAPITRE', id: chapitre.id, patch: draft })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="chapitre-editor glass-tight">
        <div className="field-row">
          <label>Nom</label>
          <input
            value={draft.nom}
            onChange={(e) => setDraft((d) => ({ ...d, nom: e.target.value }))}
          />
        </div>
        <div className="field-row">
          <label>Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </div>
        <div className="field-row">
          <label>État</label>
          <select
            value={draft.etat}
            onChange={(e) => setDraft((d) => ({ ...d, etat: e.target.value }))}
          >
            {ETATS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>Commentaires</label>
          <textarea
            value={draft.commentaires}
            onChange={(e) => setDraft((d) => ({ ...d, commentaires: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="pill pill-accent" onClick={saveEdit}>
            Enregistrer
          </div>
          <div className="pill" onClick={() => setEditing(false)}>
            Annuler
          </div>
          <div style={{ flex: 1 }} />
          <div className="pill" onClick={onDelete}>
            Supprimer
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chapitre-editor glass-tight">
      <div className="chapitre-row">
        <div className="chapitre-name">{chapitre.nom}</div>
        <span className="label-mono">{etatLabel(chapitre.etat)}</span>
        <button className="icon-btn" onClick={startEdit} title="Modifier">
          ✎
        </button>
      </div>
      {chapitre.description && (
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{chapitre.description}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {chapitre.statut === 'standby' ? (
          <div className="pill pill-accent" onClick={onActivate}>
            Activer
          </div>
        ) : (
          <>
            <Badge chapitre={chapitre} side="cours" onMark={onMark} now={now} />
            <Badge chapitre={chapitre} side="td" onMark={onMark} now={now} />
          </>
        )}
      </div>
      {chapitre.commentaires && (
        <div style={{ fontSize: 12, color: 'var(--text-dimmer)', whiteSpace: 'pre-wrap' }}>
          {chapitre.commentaires}
        </div>
      )}
    </div>
  )
}
