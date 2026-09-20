import { useState } from 'react'
import {
  daysBetween,
  nextExam,
  GAUGE_START,
  SCHOOL_YEAR_END,
  isoDaysBetween,
  addDaysIso,
  todayWithinSchoolYear,
} from '../logic/dates.js'

// Étendue minimale de la vue, pour éviter un affichage dégénéré si la date
// de fin choisie est trop proche de la rentrée.
const MIN_VIEW_DAYS = 14
const DEFAULT_VIEW_SPAN_DAYS = 90

function clampPos(v) {
  return Math.max(2, Math.min(98, v))
}

/** Résumé lecture seule sur l'accueil. L'axe de la jauge est fixe, ancré sur
 * la rentrée (GAUGE_START) — "aujourd'hui" avance donc visiblement le long
 * de la barre au fil de l'année, au lieu de toujours rester au même endroit.
 * La date de fin de la vue est choisie librement (par défaut : le plus
 * lointain partiel/devoir, ou +90j si rien n'est encore prévu) ; un partiel
 * plus loin que la date choisie n'est simplement pas affiché (masqué, pas
 * tassé au bord). Affiche le prochain partiel par défaut ; survoler le
 * trait d'un autre partiel bascule l'en-tête sur celui-là (en fondu).
 * Cliquer l'en-tête ou un trait de partiel ouvre sa fiche détail (pop-up) ;
 * le lien du bas navigue vers l'écran "Partiels". */
export default function ExamGauge({ exams, devoirs, now, onOpen, onOpenExam }) {
  const [hoverDevoirId, setHoverDevoirId] = useState(null)
  const [hoverExamId, setHoverExamId] = useState(null)
  const [viewEndOverride, setViewEndOverride] = useState(null)
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

  const farthestIso = [...exams.map((e) => e.date), ...devoirs.map((d) => d.dateEcheance)].reduce(
    (max, iso) => (iso > max ? iso : max),
    addDaysIso(todayWithinSchoolYear(now), DEFAULT_VIEW_SPAN_DAYS),
  )
  const viewEnd = viewEndOverride ?? (farthestIso > SCHOOL_YEAR_END ? SCHOOL_YEAR_END : farthestIso)
  const totalDays = Math.max(MIN_VIEW_DAYS, isoDaysBetween(GAUGE_START, viewEnd))

  const positionOn = (iso) => clampPos((Math.max(isoDaysBetween(GAUGE_START, iso), 0) / totalDays) * 100)
  const inView = (iso) => isoDaysBetween(GAUGE_START, iso) <= totalDays

  const examTicks = exams.filter((e) => inView(e.date)).map((e) => ({ ...e, pos: positionOn(e.date) }))
  const devoirTicks = devoirs
    .filter((d) => inView(d.dateEcheance))
    .map((d) => ({ ...d, pos: positionOn(d.dateEcheance), j: daysBetween(now, d.dateEcheance) }))
  const hiddenExamsCount = exams.length - examTicks.length

  const todayIso = new Date(now).toISOString().slice(0, 10)
  const todayPos = Math.max(0, Math.min(100, (isoDaysBetween(GAUGE_START, todayIso) / totalDays) * 100))

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
        <div className="gauge-fill" style={{ width: `${todayPos}%` }} title="Aujourd'hui">
          <div className="gauge-cursor" />
        </div>
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
        <span className="label-mono">Voir jusqu'au</span>
        <input
          type="date"
          className="gauge-view-date"
          min={GAUGE_START}
          max={SCHOOL_YEAR_END}
          value={viewEnd}
          onChange={(ev) => ev.target.value && setViewEndOverride(ev.target.value)}
        />
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
