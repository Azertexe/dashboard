import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { daysBetween, isoDatePlusDays } from '../logic/dates.js'

export default function PartielsScreen({ now, onGoHome }) {
  const { state, dispatch } = useStore()
  const [matiere, setMatiere] = useState('')
  const [jours, setJours] = useState('')

  const sorted = [...state.exams].sort((a, b) => new Date(a.date) - new Date(b.date))

  const add = () => {
    const n = parseInt(jours, 10)
    if (!matiere.trim() || Number.isNaN(n)) return
    dispatch({ type: 'ADD_EXAM', matiere: matiere.trim(), date: isoDatePlusDays(now, n) })
    setMatiere('')
    setJours('')
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
                onClick={() => dispatch({ type: 'DELETE_EXAM', id: e.id })}
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
            name="jours"
            type="number"
            placeholder="J-…"
            value={jours}
            onChange={(e) => setJours(e.target.value)}
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
