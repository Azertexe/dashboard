import { useState } from 'react'
import Badge from './Badge.jsx'
import { useStore } from '../state/store.jsx'
import { ETATS } from '../data/etats.js'
import { canUndoBadge } from '../logic/badges.js'

/** Ligne compacte : nom + 1 badge (celui du contexte Cours/TD courant). Utilisée
 * dans la vue "Cours"/"TD" groupée par matière. */
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

/** Ligne plate dans le détail d'un cours : nom + 1 badge (contexte courant) + crayon.
 * Le crayon ouvre un panneau d'édition (métadonnées + accès à l'autre badge / activation). */
export function ChapitreRowFull({ chapitre, side, now }) {
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    nom: chapitre.nom,
    description: chapitre.description,
    commentaires: chapitre.commentaires,
    etat: chapitre.etat,
  }))

  const onMark = (id, s) => dispatch({ type: 'MARK_BADGE', id, side: s })
  const onUndo = (s) => dispatch({ type: 'UNDO_BADGE', id: chapitre.id, side: s })
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
        <div className="field-row">
          <label>Badges</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {chapitre.statut === 'standby' ? (
              <div className="pill pill-accent" onClick={onActivate}>
                Activer
              </div>
            ) : (
              <>
                <div className="badge-with-undo">
                  <Badge chapitre={chapitre} side="cours" onMark={onMark} now={now} />
                  {canUndoBadge(chapitre, 'cours') && (
                    <button
                      className="icon-btn"
                      onClick={() => onUndo('cours')}
                      title="Annuler le dernier clic sur ce badge (Cours)"
                    >
                      ↺
                    </button>
                  )}
                </div>
                <div className="badge-with-undo">
                  <Badge chapitre={chapitre} side="td" onMark={onMark} now={now} />
                  {canUndoBadge(chapitre, 'td') && (
                    <button
                      className="icon-btn"
                      onClick={() => onUndo('td')}
                      title="Annuler le dernier clic sur ce badge (TD)"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
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
    <div className="chapitre-list-row">
      <div className="chapitre-name">{chapitre.nom}</div>
      {chapitre.statut === 'standby' ? (
        <div className="pill pill-accent" onClick={onActivate}>
          Activer
        </div>
      ) : (
        <Badge chapitre={chapitre} side={side} onMark={onMark} now={now} />
      )}
      <button className="icon-btn" onClick={startEdit} title="Modifier">
        ✎
      </button>
    </div>
  )
}
