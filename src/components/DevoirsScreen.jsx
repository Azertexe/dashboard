import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { daysBetween, isoDatePlusDays, deadlineStyle } from '../logic/dates.js'

export default function DevoirsScreen({ now, onGoHome }) {
  const { state, dispatch } = useStore()
  const [nom, setNom] = useState('')
  const [jours, setJours] = useState('')

  const sorted = [...state.devoirs].sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance))

  const add = () => {
    const n = parseInt(jours, 10)
    if (!nom.trim() || Number.isNaN(n)) return
    dispatch({ type: 'ADD_DEVOIR', nom: nom.trim(), dateEcheance: isoDatePlusDays(now, n) })
    setNom('')
    setJours('')
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
            <div key={d.id} className="devoir-row glass-tight">
              <div className="devoir-name">{d.nom}</div>
              <div className="devoir-j" style={deadlineStyle(j)}>
                J{j >= 0 ? '-' : '+'}
                {Math.abs(j)}
              </div>
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
