import { useStore } from '../state/store.jsx'
import { courseName } from '../data/courses.js'
import EmptyState from './EmptyState.jsx'

/** Corbeille des devoirs cochés : un devoir coché depuis DevoirsScreen y
 * atterrit aussitôt (cf. TOGGLE_DEVOIR_FAIT) plutôt que de rester barré dans
 * la liste. "Annuler" le décoche et le renvoie dans "Tous les devoirs". Sans
 * ça, il y reste jusqu'à la fin de la journée civile locale, puis en est
 * définitivement retiré (cf. PURGE_TRASHED_DEVOIRS dans reducer.js, purgé
 * par App.jsx). */
export default function DevoirsTrashModal({ onClose }) {
  const { state, dispatch } = useStore()
  const trashed = [...state.devoirs].filter((d) => d.fait).sort((a, b) => (b.faitAt ?? 0) - (a.faitAt ?? 0))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-strong modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <div className="settings-title">Corbeille</div>
            <div className="modal-subtitle">Un devoir coché y reste jusqu'à la fin de la journée, puis disparaît.</div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {trashed.length === 0 && <EmptyState text="La corbeille est vide." />}
        {trashed.map((d) => (
          <div key={d.id} className="devoir-row glass-tight devoir-fait">
            <div className="devoir-name">{d.nom}</div>
            {d.courseId && <div className="devoir-course-tag">{courseName(d.courseId)}</div>}
            <div className="pill" onClick={() => dispatch({ type: 'TOGGLE_DEVOIR_FAIT', id: d.id })}>
              Annuler
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
