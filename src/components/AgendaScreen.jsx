import { useStore } from '../state/store.jsx'
import { courseName, courseAccentStyle } from '../data/courses.js'
import { needsAttention } from '../logic/badges.js'
import { daysBetween } from '../logic/dates.js'
import { BadgeWithUndo } from './Badge.jsx'

/** Vue "Agenda" : ce qui presse, réuni en un seul endroit — les chapitres
 * dont le badge a besoin d'une révision maintenant (orange/jaune actif),
 * puis les devoirs et partiels à venir triés par date. */
export default function AgendaScreen({ now, onGoHome, onOpenCourse }) {
  const { state } = useStore()

  const aReviser = state.chapitres.filter((c) => needsAttention(c, c.side, now))

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
        {aReviser.map((chapitre) => (
          <div key={chapitre.id} className="chapitre-row card" style={courseAccentStyle(chapitre.courseId)}>
            <div
              className="chapitre-name"
              style={{ cursor: 'pointer' }}
              onClick={() => onOpenCourse(chapitre.courseId, chapitre.side)}
            >
              {courseName(chapitre.courseId)} — {chapitre.nom}
            </div>
            <BadgeWithUndo chapitre={chapitre} side={chapitre.side} small now={now} chapitreId={chapitre.id} />
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
