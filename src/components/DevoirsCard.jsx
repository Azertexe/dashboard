import { useState } from 'react'
import { useStore } from '../state/store.jsx'

function daysBetween(now, iso) {
  const target = new Date(iso + 'T00:00:00')
  return Math.ceil((target.getTime() - now) / 86_400_000)
}

function jStyle(j) {
  if (j <= 3) return { color: 'oklch(0.75 0.16 25)' }
  if (j <= 7) return { color: 'oklch(0.82 0.14 55)' }
  return { color: 'var(--text-dim)' }
}

function isoDatePlusDays(now, days) {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function DevoirsCard({ devoirs, now }) {
  const { dispatch } = useStore()
  const [nom, setNom] = useState('')
  const [jours, setJours] = useState('')

  const sorted = [...devoirs].sort(
    (a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance),
  )

  const add = () => {
    const n = parseInt(jours, 10)
    if (!nom.trim() || Number.isNaN(n)) return
    dispatch({ type: 'ADD_DEVOIR', nom: nom.trim(), dateEcheance: isoDatePlusDays(now, n) })
    setNom('')
    setJours('')
  }

  return (
    <div className="glass devoirs-card">
      <div className="label-mono">Devoirs à faire</div>
      {sorted.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun devoir pour l'instant.</div>
      )}
      {sorted.map((d) => {
        const j = daysBetween(now, d.dateEcheance)
        return (
          <div key={d.id} className="devoir-row glass-tight">
            <div className="devoir-name">{d.nom}</div>
            <div className="devoir-j" style={jStyle(j)}>
              J{j >= 0 ? '-' : '+'}
              {Math.abs(j)}
            </div>
            <button
              className="devoir-del"
              onClick={() => dispatch({ type: 'DELETE_DEVOIR', id: d.id })}
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
  )
}
