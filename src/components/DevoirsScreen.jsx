import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { COURSES, courseName } from '../data/courses.js'
import { daysBetween, deadlineStyle, todayWithinSchoolYear, SCHOOL_YEAR_START, SCHOOL_YEAR_END } from '../logic/dates.js'

export default function DevoirsScreen({ now, onGoHome }) {
  const { state, dispatch } = useStore()
  const [nom, setNom] = useState('')
  const [dateEcheance, setDateEcheance] = useState(() => todayWithinSchoolYear(now))
  const [courseId, setCourseId] = useState('')

  // Pas faits d'abord (triés par échéance), faits relégués en bas — les voir
  // encore permet de décocher par erreur, sans qu'ils gênent la lecture du
  // "reste à faire".
  const sorted = [...state.devoirs].sort((a, b) => {
    if (a.fait !== b.fait) return a.fait ? 1 : -1
    return new Date(a.dateEcheance) - new Date(b.dateEcheance)
  })

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
        <div className="screen-title">Devoirs</div>
      </div>

      <div className="glass devoirs-card">
        <div className="label-mono">Tous les devoirs</div>
        {sorted.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun devoir pour l'instant.</div>
        )}
        {sorted.map((d) => {
          const j = daysBetween(now, d.dateEcheance)
          return (
            <div key={d.id} className={`devoir-row glass-tight${d.fait ? ' devoir-fait' : ''}`}>
              <button
                className={`devoir-check${d.fait ? ' checked' : ''}`}
                onClick={() => dispatch({ type: 'TOGGLE_DEVOIR_FAIT', id: d.id })}
                aria-label={d.fait ? 'Marquer non fait' : 'Marquer fait'}
                title={d.fait ? 'Marquer non fait' : 'Marquer fait'}
              >
                ✓
              </button>
              <div className="devoir-name">{d.nom}</div>
              {d.courseId && <div className="devoir-course-tag">{courseName(d.courseId)}</div>}
              {!d.fait && (
                <div className="devoir-j" style={deadlineStyle(j)}>
                  J{j >= 0 ? '-' : '+'}
                  {Math.abs(j)}
                </div>
              )}
              <button
                className="devoir-del"
                onClick={() => {
                  if (confirm(`Supprimer "${d.nom}" ?`)) {
                    dispatch({ type: 'DELETE_DEVOIR', id: d.id })
                  }
                }}
                aria-label="Supprimer"
              >
                ×
              </button>
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
    </div>
  )
}
