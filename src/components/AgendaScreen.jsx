import { useStore } from '../state/store.jsx'
import { courseName, courseAccentStyle } from '../data/courses.js'
import { needsAttention } from '../logic/badges.js'
import { daysBetween } from '../logic/dates.js'
import Badge from './Badge.jsx'

/** Vue "Agenda" : ce qui presse, réuni en un seul endroit — les badges qui
 * ont besoin d'une révision maintenant (orange/jaune actifs), puis les
 * devoirs et partiels à venir triés par date. */
export default function AgendaScreen({ now, onGoHome, onOpenCourse }) {
  const { state, dispatch } = useStore()
  const onMark = (id, side) => dispatch({ type: 'MARK_BADGE', id, side })

  const aReviser = []
  for (const c of state.chapitres) {
    for (const side of ['cours', 'td']) {
      if (needsAttention(c, side, now)) aReviser.push({ chapitre: c, side })
    }
  }

  const avenir = [
    ...state.devoirs.map((d) => ({ type: 'devoir', id: d.id, nom: d.nom, date: d.dateEcheance })),
    ...state.exams.map((e) => ({ type: 'exam', id: e.id, nom: e.matiere, date: e.date })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="crumb-row">
        <div className="pill" onClick={onGoHome}>
          ← Accueil
        </div>
        <div className="screen-title">Agenda</div>
      </div>

      <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label-mono">À réviser maintenant</div>
        {aReviser.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Rien en retard — tu es à jour.</div>
        )}
        {aReviser.map(({ chapitre, side }) => (
          <div
            key={`${chapitre.id}-${side}`}
            className="chapitre-row card"
            style={courseAccentStyle(chapitre.courseId)}
          >
            <div
              className="chapitre-name"
              style={{ cursor: 'pointer' }}
              onClick={() => onOpenCourse(chapitre.courseId, side)}
            >
              {courseName(chapitre.courseId)} — {chapitre.nom}
            </div>
            <Badge chapitre={chapitre} side={side} onMark={onMark} small now={now} />
          </div>
        ))}
      </div>

      <div className="glass devoirs-card">
        <div className="label-mono">À venir</div>
        {avenir.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun devoir ni partiel enregistré.</div>
        )}
        {avenir.map((item) => {
          const j = daysBetween(now, item.date)
          return (
            <div key={`${item.type}-${item.id}`} className="devoir-row glass-tight">
              <div className="devoir-name">
                {item.type === 'exam' ? 'Partiel — ' : ''}
                {item.nom} —{' '}
                {new Date(item.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
              <div className="devoir-j">
                J{j >= 0 ? '-' : '+'}
                {Math.abs(j)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
