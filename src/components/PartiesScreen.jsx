import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { courseAccentStyle, courseName } from '../data/courses.js'
import { canUndoBadge } from '../logic/badges.js'
import Badge from './Badge.jsx'

/** Ligne d'une sous-partie : même logique qu'un chapitre (nom, édition,
 * activation/badge/undo par côté), mais opère sur `partie` au lieu du
 * chapitre — les fonctions de badges.js sont déjà génériques là-dessus. */
function PartieRow({ chapitre, partie, side, now, dispatch }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    nom: partie.nom,
    description: partie.description,
    commentaires: partie.commentaires,
  }))

  const onMark = (_id, s) => dispatch({ type: 'MARK_BADGE', id: chapitre.id, partieId: partie.id, side: s })
  const onUndo = (s) => dispatch({ type: 'UNDO_BADGE', id: chapitre.id, partieId: partie.id, side: s })
  const onActivate = (s) =>
    dispatch({ type: 'ACTIVATE_CHAPITRE', id: chapitre.id, partieId: partie.id, side: s })
  const onDelete = () => {
    if (confirm(`Supprimer la partie "${partie.nom}" ? Cette action est définitive.`)) {
      dispatch({ type: 'DELETE_PARTIE', chapitreId: chapitre.id, partieId: partie.id })
    }
  }
  const startEdit = () => {
    setDraft({ nom: partie.nom, description: partie.description, commentaires: partie.commentaires })
    setEditing(true)
  }
  const saveEdit = () => {
    dispatch({ type: 'EDIT_PARTIE', chapitreId: chapitre.id, partieId: partie.id, patch: draft })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="chapitre-editor glass-tight">
        <div className="field-row">
          <label>Nom</label>
          <input value={draft.nom} onChange={(e) => setDraft((d) => ({ ...d, nom: e.target.value }))} />
        </div>
        <div className="field-row">
          <label>Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
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
            {['cours', 'td'].map((s) => {
              const badge = s === 'td' ? partie.badgeTD : partie.badgeCours
              const tag = s === 'td' ? 'TD' : 'Cours'
              if (badge?.statut !== 'actif') {
                return (
                  <div key={s} className="pill pill-accent" onClick={() => onActivate(s)}>
                    Activer {tag}
                  </div>
                )
              }
              return (
                <div key={s} className="badge-with-undo">
                  <Badge chapitre={partie} side={s} onMark={onMark} now={now} />
                  {canUndoBadge(partie, s) && (
                    <button
                      className="icon-btn"
                      onClick={() => onUndo(s)}
                      title={`Annuler le dernier clic sur ce badge (${tag})`}
                    >
                      ↺
                    </button>
                  )}
                </div>
              )
            })}
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
      <div className="chapitre-name">{partie.nom}</div>
      {(side === 'td' ? partie.badgeTD : partie.badgeCours)?.statut !== 'actif' ? (
        <div className="pill pill-accent" onClick={() => onActivate(side)}>
          Activer
        </div>
      ) : (
        <Badge chapitre={partie} side={side} onMark={onMark} now={now} />
      )}
      <button className="icon-btn" onClick={startEdit} title="Modifier">
        ✎
      </button>
    </div>
  )
}

/** Le "sous-menu" d'un chapitre en mode "un badge par partie" : liste de ses
 * sous-parties, chacune avec son propre badge Cours/TD indépendant. */
export default function PartiesScreen({ chapitre, side, now, onBack, onGoHome }) {
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
          Parties · {courseName(chapitre.courseId)} — {chapitre.nom}
        </div>

        {parties.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucune partie pour l'instant.</div>
        )}
        {parties.length > 0 && (
          <div className="chapitre-list">
            {parties.map((p) => (
              <PartieRow key={p.id} chapitre={chapitre} partie={p} side={side} now={now} dispatch={dispatch} />
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
