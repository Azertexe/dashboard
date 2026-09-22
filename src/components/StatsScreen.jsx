import { COURSES, courseAccentStyle } from '../data/courses.js'
import { ETATS, etatLabel } from '../data/etats.js'
import { badgeStatus, needsAttention } from '../logic/badges.js'
import { useStore } from '../state/store.jsx'

/** Score d'une matière pour le classement : proportion de ses chapitres
 * ACTIFS actuellement au vert (à jour), parmi ses chapitres actifs
 * seulement — les chapitres jamais activés ne comptent ni pour ni contre
 * (pas encore commencés, pas "en retard"). `null` si rien n'est encore actif
 * (matière pas commencée, classée à part plutôt que dernière par défaut). */
function scoreForCourse(courseId, chapitres, now) {
  const actifs = chapitres.filter((c) => c.courseId === courseId && badgeStatus(c, c.side, now).phase !== 'inactive')
  if (actifs.length === 0) return null
  const auVert = actifs.filter((c) => {
    const s = badgeStatus(c, c.side, now)
    return s.phase === 'active' && s.level === 'vert'
  }).length
  return auVert / actifs.length
}

export default function StatsScreen({ now, onGoHome, onOpenCourse }) {
  const { state } = useStore()
  const chapitres = state.chapitres

  const nbChapitres = chapitres.length
  const nbActifs = chapitres.filter(
    (c) => c.badgeCours?.statut === 'actif' || c.badgeTD?.statut === 'actif',
  ).length
  const nbStandby = nbChapitres - nbActifs
  const nbAlertes = chapitres.reduce((n, c) => n + (needsAttention(c, c.side, now) ? 1 : 0), 0)

  const parEtat = ETATS.map((e) => ({
    ...e,
    count: chapitres.filter((c) => c.etat === e.id).length,
  }))

  const parCours = COURSES.map((course) => {
    const ch = chapitres.filter((c) => c.courseId === course.id)
    return { course, count: ch.length }
  })

  const classement = [...COURSES]
    .map((course) => ({ course, score: scoreForCourse(course.id, chapitres, now) }))
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0
      if (a.score === null) return 1
      if (b.score === null) return -1
      return b.score - a.score
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
        <div className="label-mono">Classement par matière</div>
        <div className="settings-note" style={{ padding: 0 }}>
          Part des chapitres actifs actuellement au vert (à jour), matière par matière.
        </div>
        <div className="stat-course-list">
          {classement.map(({ course, score }, i) => (
            <div
              key={course.id}
              className="stat-course-row"
              style={courseAccentStyle(course.id)}
              onClick={() => onOpenCourse(course.id)}
            >
              <div className="stat-rank">{score === null ? '—' : `#${i + 1}`}</div>
              <div className="stat-course-name">{course.nom}</div>
              {score !== null && (
                <div className="stat-etat-bar" style={{ flex: '0 0 70px' }}>
                  <div className="stat-etat-fill" style={{ width: `${score * 100}%` }} />
                </div>
              )}
              <div className="stat-course-count">{score === null ? 'pas commencé' : `${Math.round(score * 100)}%`}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label-mono">Par matière</div>
        <div className="stat-course-list">
          {parCours.map(({ course, count }) => (
            <div
              key={course.id}
              className="stat-course-row"
              style={courseAccentStyle(course.id)}
              onClick={() => onOpenCourse(course.id)}
            >
              <span className="course-dot" />
              <div className="stat-course-name">{course.nom}</div>
              <div className="stat-course-count">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
