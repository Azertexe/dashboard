import { useState } from 'react'
import Badge from './Badge.jsx'
import { useStore } from '../state/store.jsx'
import { ETATS } from '../data/etats.js'
import { canUndoBadge } from '../logic/badges.js'

/** Ligne compacte : nom + 1 badge (celui du contexte Cours/TD courant). Utilisée
 * dans la vue "Cours"/"TD" groupée par matière. En mode "un badge par partie",
 * il n'y a pas de badge unique à montrer ici — juste le nombre de parties. */
export function ChapitreRowCompact({ chapitre, side, now }) {
  const { dispatch } = useStore()
  const onMark = (id, s) => dispatch({ type: 'MARK_BADGE', id, side: s })

  if (chapitre.partitionMode === 'parties') {
    return (
      <div className="chapitre-row">
        <div className="chapitre-name">{chapitre.nom}</div>
        <div className="badge badge-inactive badge-small">{chapitre.parties.length} partie(s)</div>
      </div>
    )
  }

  return (
    <div className="chapitre-row">
      <div className="chapitre-name">{chapitre.nom}</div>
      <Badge chapitre={chapitre} side={side} onMark={onMark} small now={now} />
    </div>
  )
}

/** Ligne plate dans le détail d'un cours : nom + 1 badge (contexte courant) + crayon.
 * Le crayon ouvre un panneau d'édition (métadonnées, badge/activation UNIQUEMENT
 * pour le côté courant — Cours et TD ne se croisent jamais sur le même écran —
 * et le choix entre un badge pour tout le chapitre ou un badge par sous-partie). */
export function ChapitreRowFull({ chapitre, side, now, onOpenParties }) {
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const parties = chapitre.parties ?? []
  const byParties = chapitre.partitionMode === 'parties'
  const [draft, setDraft] = useState(() => ({
    nom: chapitre.nom,
    description: chapitre.description,
    commentaires: chapitre.commentaires,
    etat: chapitre.etat,
  }))

  const onMark = (id, s) => dispatch({ type: 'MARK_BADGE', id, side: s })
  const onUndo = (s) => dispatch({ type: 'UNDO_BADGE', id: chapitre.id, side: s })
  const onActivate = (s) => dispatch({ type: 'ACTIVATE_CHAPITRE', id: chapitre.id, side: s })
  const setMode = (mode) => dispatch({ type: 'SET_PARTITION_MODE', id: chapitre.id, mode })
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
          <label>Suivi des révisions</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: byParties ? 10 : 0 }}>
            <div className={'pill' + (!byParties ? ' pill-accent' : '')} onClick={() => setMode('chapitre')}>
              Un badge pour le chapitre
            </div>
            <div className={'pill' + (byParties ? ' pill-accent' : '')} onClick={() => setMode('parties')}>
              Un badge par partie
            </div>
          </div>
          {byParties ? (
            <div className="pill" onClick={() => onOpenParties(chapitre.id)}>
              Gérer les parties ({parties.length}) →
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {(() => {
                const badge = side === 'td' ? chapitre.badgeTD : chapitre.badgeCours
                const tag = side === 'td' ? 'TD' : 'Cours'
                if (badge?.statut !== 'actif') {
                  return (
                    <div className="pill pill-accent" onClick={() => onActivate(side)}>
                      Activer {tag}
                    </div>
                  )
                }
                return (
                  <div className="badge-with-undo">
                    <Badge chapitre={chapitre} side={side} onMark={onMark} now={now} />
                    {canUndoBadge(chapitre, side) && (
                      <button
                        className="icon-btn"
                        onClick={() => onUndo(side)}
                        title={`Annuler le dernier clic sur ce badge (${tag})`}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
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
      {byParties ? (
        <div className="pill" onClick={() => onOpenParties(chapitre.id)}>
          {parties.length} partie{parties.length > 1 ? 's' : ''} →
        </div>
      ) : (side === 'td' ? chapitre.badgeTD : chapitre.badgeCours)?.statut !== 'actif' ? (
        <div className="pill pill-accent" onClick={() => onActivate(side)}>
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
