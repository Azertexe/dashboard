import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { daysBetween, todayWithinSchoolYear, SCHOOL_YEAR_START, SCHOOL_YEAR_END } from '../logic/dates.js'

export default function PartielsScreen({ now, onGoHome }) {
  const { state, dispatch } = useStore()
  const [matiere, setMatiere] = useState('')
  const [date, setDate] = useState(() => todayWithinSchoolYear(now))

  const sorted = [...state.exams].sort((a, b) => new Date(a.date) - new Date(b.date))

  const add = () => {
    if (!matiere.trim() || !date) return
    dispatch({ type: 'ADD_EXAM', matiere: matiere.trim(), date })
    setMatiere('')
    setDate(todayWithinSchoolYear(now))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="crumb-row">
        <div className="pill" onClick={onGoHome}>
          ← Accueil
        </div>
        <div className="screen-title">Partiels</div>
      </div>

      <div className="glass devoirs-card">
        <div className="label-mono">Tous les partiels</div>
        {sorted.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun partiel pour l'instant.</div>
        )}
        {sorted.map((e) => {
          const j = daysBetween(now, e.date)
          return (
            <div key={e.id} className="devoir-row glass-tight">
              <div className="devoir-name">
                {e.matiere} —{' '}
                {new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
              <div className="devoir-j">
                J{j >= 0 ? '-' : '+'}
                {Math.abs(j)}
              </div>
              <button
                className="devoir-del"
                onClick={() => {
                  if (confirm(`Supprimer le partiel "${e.matiere}" ?`)) {
                    dispatch({ type: 'DELETE_EXAM', id: e.id })
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
            placeholder="Matière (ex : Optique cohérente)"
            value={matiere}
            onChange={(e) => setMatiere(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            name="date"
            type="date"
            min={SCHOOL_YEAR_START}
            max={SCHOOL_YEAR_END}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <div className="pill pill-accent" onClick={add}>
            Ajouter
          </div>
        </div>
      </div>
    </div>
  )
}
