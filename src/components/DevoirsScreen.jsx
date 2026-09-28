import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { COURSES, courseName } from '../data/courses.js'
import { daysBetween, deadlineStyle, formatDaysLeft, todayWithinSchoolYear, SCHOOL_YEAR_START, SCHOOL_YEAR_END } from '../logic/dates.js'
import EmptyState from './EmptyState.jsx'
import DevoirsTrashModal from './DevoirsTrashModal.jsx'

export default function DevoirsScreen({ now, onGoHome }) {
  const { state, dispatch } = useStore()
  const [nom, setNom] = useState('')
  const [dateEcheance, setDateEcheance] = useState(() => todayWithinSchoolYear(now))
  const [courseId, setCourseId] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)

  // Cocher un devoir l'envoie aussitôt à la corbeille (cf. TOGGLE_DEVOIR_FAIT
  // / DevoirsTrashModal) — cette liste ne montre donc plus que ce qui reste
  // à faire, triée par échéance.
  const sorted = [...state.devoirs].filter((d) => !d.fait).sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance))
  const trashCount = state.devoirs.filter((d) => d.fait).length

  const add = () => {
    if (!nom.trim() || !dateEcheance) return
    dispatch({ type: 'ADD_DEVOIR', nom: nom.trim(), dateEcheance, courseId: courseId || null })
    setNom('')
    setDateEcheance(todayWithinSchoolYear(now))
    setCourseId('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="crumb-row">
        <div className="pill" onClick={onGoHome}>
          ← Accueil
        </div>
        <div className="screen-title" style={{ flex: 1 }}>
          Devoirs
        </div>
        <button className="icon-btn icon-btn-badged" onClick={() => setTrashOpen(true)} title="Corbeille" aria-label="Corbeille">
          🗑
          {trashCount > 0 && <span className="icon-btn-badge">{trashCount}</span>}
        </button>
      </div>

      <div className="glass devoirs-card">
        <div className="label-mono">Tous les devoirs</div>
        {sorted.length === 0 && <EmptyState text="Aucun devoir pour l'instant." />}
        {sorted.map((d) => {
          const j = daysBetween(now, d.dateEcheance)
          return (
            <div key={d.id} className="devoir-row glass-tight">
              <button
                className="devoir-check"
                onClick={() => dispatch({ type: 'TOGGLE_DEVOIR_FAIT', id: d.id })}
                aria-label="Marquer fait"
                title="Marquer fait"
              >
                ✓
              </button>
              <div className="devoir-name">{d.nom}</div>
              {d.courseId && <div className="devoir-course-tag">{courseName(d.courseId)}</div>}
              <div className="devoir-j" style={deadlineStyle(j)}>
                {formatDaysLeft(j)}
              </div>
            </div>
          )
        })}
        <div className="devoir-form">
          <input
            name="nom"
            placeholder="Nouveau devoir…"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            name="date"
            type="date"
            min={SCHOOL_YEAR_START}
            max={SCHOOL_YEAR_END}
            value={dateEcheance}
            onChange={(e) => setDateEcheance(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Matière (optionnel)</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <div className="pill pill-accent" onClick={add}>
            Ajouter
          </div>
        </div>
      </div>

      {trashOpen && <DevoirsTrashModal onClose={() => setTrashOpen(false)} />}
    </div>
  )
}
