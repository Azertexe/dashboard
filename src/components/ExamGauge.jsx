import { useState } from 'react'
import { daysBetween, nextExam } from '../logic/dates.js'

// Présets de la vue (en jours) + "Tout" (s'étend automatiquement jusqu'au
// partiel/devoir le plus lointain). Ajustable à la volée sans jamais changer
// la position réelle de "aujourd'hui" (toujours fixe, au tout début).
const VIEW_PRESETS = [30, 60, 90]
const DEFAULT_VIEW_DAYS = 60

function positionOn(now, iso, horizonDays) {
  const j = daysBetween(now, iso)
  return { j, pos: Math.max(2, Math.min(98, (Math.max(j, 0) / horizonDays) * 100)) }
}

/** Résumé lecture seule sur l'accueil. "Aujourd'hui" est toujours fixe au
 * début de la jauge — l'étendue affichée (30j / 60j / 90j / Tout) ne fait
 * que dézoomer/zoomer les traits, jamais bouger le repère du jour même. Un
 * partiel plus loin que l'étendue choisie n'est simplement pas affiché (au
 * lieu d'être tassé au bord, trompeur). Affiche le prochain partiel par
 * défaut ; survoler le trait d'un autre partiel bascule l'en-tête sur
 * celui-là (en fondu). Cliquer l'en-tête ou un trait de partiel ouvre sa
 * fiche détail (pop-up) ; le lien du bas navigue vers l'écran "Partiels". */
export default function ExamGauge({ exams, devoirs, now, onOpen, onOpenExam }) {
  const [hoverDevoirId, setHoverDevoirId] = useState(null)
  const [hoverExamId, setHoverExamId] = useState(null)
  const [viewDays, setViewDays] = useState(DEFAULT_VIEW_DAYS) // null = "Tout"
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

  const farthestDays = Math.max(
    30,
    1,
    ...exams.map((e) => daysBetween(now, e.date)),
    ...devoirs.map((d) => daysBetween(now, d.dateEcheance)),
  )
  const horizonDays = viewDays ?? farthestDays

  const inView = (j) => j >= 0 && j <= horizonDays
  const examTicks = exams
    .filter((e) => inView(daysBetween(now, e.date)))
    .map((e) => ({ ...e, ...positionOn(now, e.date, horizonDays) }))
  const devoirTicks = devoirs
    .filter((d) => inView(daysBetween(now, d.dateEcheance)))
    .map((d) => ({ ...d, ...positionOn(now, d.dateEcheance, horizonDays) }))
  const hiddenExamsCount = exams.length - examTicks.length

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
        <div className="gauge-today" title="Aujourd'hui" />
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
      </div>
      <div className="gauge-view-controls" onClick={(ev) => ev.stopPropagation()}>
        <span className="label-mono">Vue</span>
        {VIEW_PRESETS.map((d) => (
          <div
            key={d}
            className={`pill gauge-view-pill${viewDays === d ? ' active' : ''}`}
            onClick={() => setViewDays(d)}
          >
            {d}j
          </div>
        ))}
        <div
          className={`pill gauge-view-pill${viewDays === null ? ' active' : ''}`}
          onClick={() => setViewDays(null)}
        >
          Tout
        </div>
      </div>
      {hiddenExamsCount > 0 && (
        <div className="summary-hint" style={{ cursor: 'pointer' }} onClick={onOpen}>
          +{hiddenExamsCount} partiel(s) hors de la vue actuelle →
        </div>
      )}
      <div className="summary-hint" style={{ cursor: 'pointer' }} onClick={onOpen}>
        Cliquer pour gérer les partiels →
      </div>
    </div>
  )
}
