import { useState } from 'react'
import { daysBetween, nextExam } from '../logic/dates.js'

const HORIZON_DAYS = 30 // fenêtre de visualisation de la jauge (pas de sens fonctionnel fort)

function positionOn(now, iso) {
  const j = daysBetween(now, iso)
  return { j, pos: Math.max(2, Math.min(94, (Math.max(j, 0) / HORIZON_DAYS) * 100)) }
}

/** Résumé lecture seule sur l'accueil. Affiche le prochain partiel par
 * défaut ; survoler le trait d'un autre partiel sur la jauge bascule
 * l'en-tête sur celui-là (en fondu). Cliquer l'en-tête ou un trait de
 * partiel ouvre sa fiche détail (pop-up) ; le lien du bas navigue vers
 * l'écran "Partiels". */
export default function ExamGauge({ exams, devoirs, now, onOpen, onOpenExam }) {
  const [hoverDevoirId, setHoverDevoirId] = useState(null)
  const [hoverExamId, setHoverExamId] = useState(null)
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

  const displayExam = (hoverExamId && exams.find((e) => e.id === hoverExamId)) || exam
  const displayDaysLeft = daysBetween(now, displayExam.date)
  const { j: fillDaysLeft } = positionOn(now, exam.date)
  const fillPct = Math.max(0, Math.min(100, (1 - fillDaysLeft / HORIZON_DAYS) * 100))

  const devoirTicks = devoirs.map((d) => ({ ...d, ...positionOn(now, d.dateEcheance) }))
  const examTicks = exams.map((e) => ({ ...e, ...positionOn(now, e.date) }))

  return (
    <div className="glass exam-card summary-card">
      <div className="exam-head">
        <div
          key={displayExam.id}
          className="exam-head-info"
          style={{ cursor: 'pointer' }}
          onClick={() => onOpenExam(displayExam.id)}
        >
          <div className="label-mono">{hoverExamId ? 'Partiel' : 'Prochain partiel'}</div>
          <div style={{ fontSize: 19 }}>
            {displayExam.matiere} —{' '}
            {new Date(displayExam.date + 'T00:00:00').toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </div>
        </div>
        <div className="exam-days">
          <div className="exam-days-n">{displayDaysLeft}</div>
          <div className="label-mono" style={{ letterSpacing: '.08em' }}>
            jour{Math.abs(displayDaysLeft) > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="gauge">
        <div className="gauge-fill" style={{ right: `${100 - fillPct}%` }} />
        {examTicks.map((e) => (
          <div
            key={e.id}
            className="gauge-tick gauge-tick-exam"
            style={{ left: `${e.pos}%` }}
            onMouseEnter={(ev) => {
              ev.stopPropagation()
              setHoverExamId(e.id)
            }}
            onMouseLeave={() => setHoverExamId(null)}
            onClick={(ev) => {
              ev.stopPropagation()
              onOpenExam(e.id)
            }}
          >
            <div className="gauge-tick-line" />
          </div>
        ))}
        {devoirTicks.map((d) => (
          <div
            key={d.id}
            className="gauge-tick"
            style={{ left: `${d.pos}%` }}
            onMouseEnter={(ev) => {
              ev.stopPropagation()
              setHoverDevoirId(d.id)
            }}
            onMouseLeave={() => setHoverDevoirId(null)}
          >
            <div className="gauge-tick-line" />
            <div className="gauge-tip" style={hoverDevoirId === d.id ? { opacity: 1 } : undefined}>
              {d.nom} · J-{d.j}
            </div>
          </div>
        ))}
        <div className="gauge-cursor" />
      </div>
      {exams.length > 1 && (
        <div className="summary-hint" style={{ cursor: 'pointer' }} onClick={onOpen}>
          +{exams.length - 1} autre(s) partiel(s)
        </div>
      )}
      <div className="summary-hint" style={{ cursor: 'pointer' }} onClick={onOpen}>
        Cliquer pour gérer les partiels →
      </div>
    </div>
  )
}
