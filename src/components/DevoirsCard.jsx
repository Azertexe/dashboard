import { daysBetween, deadlineStyle } from '../logic/dates.js'

/** Résumé lecture seule sur l'accueil — clic pour aller gérer les devoirs. */
export default function DevoirsCard({ devoirs, now, onOpen }) {
  const sorted = [...devoirs].sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance))
  const shown = sorted.slice(0, 3)
  const rest = sorted.length - shown.length

  return (
    <div className="glass devoirs-card summary-card" onClick={onOpen}>
      <div className="label-mono">Devoirs à faire</div>
      {shown.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun devoir pour l'instant.</div>
      )}
      {shown.map((d) => {
        const j = daysBetween(now, d.dateEcheance)
        return (
          <div key={d.id} className="devoir-row glass-tight">
            <div className="devoir-name">{d.nom}</div>
            <div className="devoir-j" style={deadlineStyle(j)}>
              J{j >= 0 ? '-' : '+'}
              {Math.abs(j)}
            </div>
          </div>
        )
      })}
      {rest > 0 && <div className="summary-hint">+{rest} autre(s)</div>}
      <div className="summary-hint">Cliquer pour gérer les devoirs →</div>
    </div>
  )
}
