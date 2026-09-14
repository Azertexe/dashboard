import { COURSES, courseAccentStyle } from '../data/courses.js'
import { ETATS, etatLabel } from '../data/etats.js'
import { badgeUnits, needsAttention } from '../logic/badges.js'
import { useStore } from '../state/store.jsx'

export default function StatsScreen({ now, onGoHome, onOpenCourse }) {
  const { state } = useStore()
  const chapitres = state.chapitres

  const nbChapitres = chapitres.length
  const nbActifs = chapitres.filter(
    (c) => c.badgeCours?.statut === 'actif' || c.badgeTD?.statut === 'actif',
  ).length
  const nbStandby = nbChapitres - nbActifs
  const nbAlertes = chapitres.reduce((n, c) => {
    return badgeUnits(c).reduce(
      (m, u) => m + (needsAttention(u.target, 'cours', now) ? 1 : 0) + (needsAttention(u.target, 'td', now) ? 1 : 0),
      n,
    )
  }, 0)

  const parEtat = ETATS.map((e) => ({
    ...e,
    count: chapitres.filter((c) => c.etat === e.id).length,
  }))

  const parCours = COURSES.map((course) => {
    const ch = chapitres.filter((c) => c.courseId === course.id)
    const alert = ch.some((c) =>
      badgeUnits(c).some((u) => needsAttention(u.target, 'cours', now) || needsAttention(u.target, 'td', now)),
    )
    return { course, count: ch.length, alert }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="crumb-row">
        <div className="pill" onClick={onGoHome}>
          ← Accueil
        </div>
        <div className="screen-title">Vue d'ensemble</div>
      </div>

      <div className="stat-grid">
        <div className="glass-strong stat-tile">
          <div className="stat-number">{nbChapitres}</div>
          <div className="stat-label">Chapitres</div>
        </div>
        <div className="glass-strong stat-tile">
          <div className="stat-number">{nbActifs}</div>
          <div className="stat-label">Actifs</div>
        </div>
        <div className="glass-strong stat-tile">
          <div className="stat-number">{nbStandby}</div>
          <div className="stat-label">En standby</div>
        </div>
        <div className="glass-strong stat-tile">
          <div className="stat-number" style={{ color: nbAlertes > 0 ? 'var(--orange-bg)' : 'inherit' }}>
            {nbAlertes}
          </div>
          <div className="stat-label">Badges en retard</div>
        </div>
      </div>

      <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="label-mono">Par état</div>
        {nbChapitres === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Pas encore de chapitre.</div>
        )}
        {parEtat.map((e) => (
          <div key={e.id} className="stat-etat-row">
            <div className="stat-etat-label">{etatLabel(e.id)}</div>
            <div className="stat-etat-bar">
              <div
                className="stat-etat-fill"
                style={{ width: nbChapitres ? `${(e.count / nbChapitres) * 100}%` : 0 }}
              />
            </div>
            <div className="stat-etat-count">{e.count}</div>
          </div>
        ))}
      </div>

      <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label-mono">Par matière</div>
        <div className="stat-course-list">
          {parCours.map(({ course, count, alert }) => (
            <div
              key={course.id}
              className="stat-course-row"
              style={courseAccentStyle(course.id)}
              onClick={() => onOpenCourse(course.id)}
            >
              <span className="course-dot" />
              <div className="stat-course-name">{course.nom}</div>
              {alert && <div className="stat-course-alert">!</div>}
              <div className="stat-course-count">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
