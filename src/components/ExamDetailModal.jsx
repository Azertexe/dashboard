import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { daysBetween } from '../logic/dates.js'

const PREP_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'fait', label: 'Fait' },
]

/** Fiche détail d'un partiel — pop-up par-dessus la page (jamais une navigation) :
 * contenu à réviser (texte libre, éditable) + un badge d'avancement dédié
 * ("Urgent" / "Fait"), pour suivre où on en est sans mélanger ça avec les
 * badges de révision Cours/TD (logique complètement différente, cf. badges.js). */
export default function ExamDetailModal({ exam, now, onClose }) {
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(exam.notes)

  const j = daysBetween(now, exam.date)

  const setPrep = (value) =>
    dispatch({ type: 'EDIT_EXAM', id: exam.id, patch: { prepStatut: exam.prepStatut === value ? null : value } })

  const startEdit = () => {
    setDraft(exam.notes)
    setEditing(true)
  }

  const save = () => {
    dispatch({ type: 'EDIT_EXAM', id: exam.id, patch: { notes: draft } })
    setEditing(false)
  }

  const onDelete = () => {
    if (confirm(`Supprimer le partiel "${exam.matiere}" ?`)) {
      dispatch({ type: 'DELETE_EXAM', id: exam.id })
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-strong modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <div className="settings-title">{exam.matiere}</div>
            <div className="modal-subtitle">
              {new Date(exam.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}{' '}
              — J{j >= 0 ? '-' : '+'}
              {Math.abs(j)}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-section-title">Avancement</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PREP_OPTIONS.map((o) => (
              <div
                key={o.value}
                className={`exam-prep-tag${exam.prepStatut === o.value ? ` prep-${o.value}` : ''}`}
                style={{ cursor: 'pointer', padding: '9px 16px', fontSize: 12.5 }}
                onClick={() => setPrep(o.value)}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-row">
            <div className="settings-section-title" style={{ marginBottom: 0 }}>
              Ce qu'il y aura
            </div>
            {!editing && (
              <div className="pill" onClick={startEdit}>
                Modifier
              </div>
            )}
          </div>
          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder="Chapitres couverts, type d'exercices, consignes du prof…"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border)',
                  outline: 'none',
                  font: 'inherit',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="pill pill-accent" onClick={save}>
                  Enregistrer
                </div>
                <div className="pill" onClick={() => setEditing(false)}>
                  Annuler
                </div>
              </div>
            </>
          ) : (
            <div className="settings-row-desc" style={{ whiteSpace: 'pre-wrap' }}>
              {exam.notes || "Rien de renseigné pour l'instant — clique sur Modifier pour ajouter le programme."}
            </div>
          )}
        </div>

        <div className="pill" onClick={onDelete}>
          Supprimer le partiel
        </div>
      </div>
    </div>
  )
}
