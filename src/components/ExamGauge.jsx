import { useState } from 'react'
import { daysBetween, nextExam } from '../logic/dates.js'

const HORIZON_DAYS = 30 // fenêtre de visualisation de la jauge (pas de sens fonctionnel fort)

/** Résumé lecture seule sur l'accueil — clic pour aller gérer les partiels. */
export default function ExamGauge({ exams, devoirs, now, onOpen }) {
  const [hover, setHover] = useState(null)
  const exam = nextExam(exams, now)

  if (!exam) {
    return (
      <div className="glass exam-card summary-card" onClick={onOpen}>
        <div className="label-mono">Prochain partiel</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>Aucun partiel enregistré.</div>
        <div className="summary-hint">Cliquer pour en ajouter →</div>
      </div>
    )
  }

  const daysLeft = daysBetween(now, exam.date)
  const fillPct = Math.max(0, Math.min(100, (1 - daysLeft / HORIZON_DAYS) * 100))

  const ticks = devoirs.map((d) => {
    const j = daysBetween(now, d.dateEcheance)
    const pos = Math.max(2, Math.min(94, (Math.max(j, 0) / HORIZON_DAYS) * 100))
    return { ...d, j, pos }
  })

  return (
    <div className="glass exam-card summary-card" onClick={onOpen}>
      <div className="exam-head">
        <div>
          <div className="label-mono">Prochain partiel</div>
          <div style={{ fontSize: 19 }}>
            {exam.matiere} —{' '}
            {new Date(exam.date + 'T00:00:00').toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </div>
        </div>
        <div className="exam-days">
          <div className="exam-days-n">{daysLeft}</div>
          <div className="label-mono" style={{ letterSpacing: '.08em' }}>
            jour{Math.abs(daysLeft) > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="gauge">
        <div className="gauge-fill" style={{ right: `${100 - fillPct}%` }} />
        {ticks.map((d) => (
          <div
            key={d.id}
            className="gauge-tick"
            style={{ left: `${d.pos}%` }}
            onMouseEnter={(e) => {
              e.stopPropagation()
              setHover(d.id)
            }}
            onMouseLeave={() => setHover(null)}
          >
            <div className="gauge-tick-line" style={hover === d.id ? { background: 'var(--text)' } : undefined} />
            <div className="gauge-tip" style={hover === d.id ? { opacity: 1 } : undefined}>
              {d.nom} · J-{d.j}
            </div>
          </div>
        ))}
        <div className="gauge-cursor" />
      </div>
      {exams.length > 1 && <div className="summary-hint">+{exams.length - 1} autre(s) partiel(s)</div>}
      <div className="summary-hint">Cliquer pour gérer les partiels →</div>
    </div>
  )
}
