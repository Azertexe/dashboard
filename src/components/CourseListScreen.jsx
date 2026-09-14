import { COURSES, courseAccentStyle } from '../data/courses.js'
import { ChapitreRowCompact } from './ChapitreRow.jsx'
import { needsAttention } from '../logic/badges.js'

export default function CourseListScreen({ chapitres, side, now, onGoHome, onOpenCourse }) {
  const sideLabel = side === 'td' ? 'TD' : 'Cours'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="crumb-row">
        <div className="pill" onClick={onGoHome}>
          ← Accueil
        </div>
        <div className="screen-title">{sideLabel}</div>
      </div>

      <div className="group-grid">
        {COURSES.map((course) => {
          const ch = chapitres
            .filter((c) => c.courseId === course.id)
            .sort((a, b) => b.createdAt - a.createdAt)
          const shown = ch.slice(0, 2)
          const rest = ch.length - shown.length
          const alert = ch.some((c) => needsAttention(c, side, now))

          return (
            <div
              key={course.id}
              className="glass-strong group-card"
              style={courseAccentStyle(course.id)}
            >
              {alert && (
                <div className="group-alert" title="Révisions en retard sur cette matière">
                  !
                </div>
              )}
              <div className="group-head" onClick={() => onOpenCourse(course.id)}>
                <div className="group-title">
                  <span className="course-dot" />
                  {course.nom}
                </div>
                <div className="group-open">{sideLabel} ↗</div>
              </div>
              {shown.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun chapitre.</div>
              )}
              {shown.map((c) => (
                <ChapitreRowCompact key={c.id} chapitre={c} side={side} now={now} />
              ))}
              <div className="group-more" onClick={() => onOpenCourse(course.id)}>
                {rest > 0 ? `+ ${rest} chapitre(s) plus ancien(s) →` : 'Ouvrir le cours →'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
