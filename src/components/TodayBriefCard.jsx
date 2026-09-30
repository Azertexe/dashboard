import { useStore } from '../state/store.jsx'
import { courseName, courseAccentStyle } from '../data/courses.js'
import { needsAttention, activeSinceTimestamp } from '../logic/badges.js'
import { isSameLocalDay, isoDateLocal, formatDateFr } from '../logic/dates.js'

/** Carte "Aujourd'hui", en haut de l'accueil — un condensé de ce qui presse
 * VRAIMENT aujourd'hui, pour ne pas avoir à ouvrir Agenda/Cours/TD juste
 * pour le savoir. Reprend les mêmes règles que les notifications push (cf.
 * mcp-server/src/scheduledNotifications.js) pour rester cohérente avec
 * elles : badges en retard (orange/jaune actifs non validés, cf.
 * needsAttention) + badges devenus actifs aujourd'hui même (cf.
 * activeSinceTimestamp — le rouge n'apparaît jamais dans "en retard", c'est
 * le point de départ normal du cycle) + devoirs/partiels dont l'échéance est
 * aujourd'hui. Masquée entièrement s'il n'y a rien à signaler — jamais une
 * carte "rien à faire" qui prendrait de la place pour rien. */
export default function TodayBriefCard({ now, onOpenCourse }) {
  const { state } = useStore()

  const enRetard = state.chapitres.filter((c) => needsAttention(c, c.side, now))
  const dueToday = state.chapitres.filter((c) => {
    const ts = activeSinceTimestamp(c, c.side, now)
    return ts != null && isSameLocalDay(ts, now)
  })
  const todayIso = isoDateLocal(now)
  const devoirsToday = state.devoirs.filter((d) => !d.fait && d.dateEcheance === todayIso)
  const partielsToday = state.exams.filter((e) => e.date === todayIso)

  const hasSomething = enRetard.length + dueToday.length + devoirsToday.length + partielsToday.length > 0
  if (!hasSomething) return null

  return (
    <div className="glass-strong" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="label-mono">Aujourd'hui — {formatDateFr(todayIso, { weekday: 'long', day: 'numeric', month: 'long' })}</div>

      {enRetard.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="settings-note" style={{ padding: 0, color: 'var(--orange-ink, var(--text-dim))' }}>
            {enRetard.length} badge{enRetard.length > 1 ? 's' : ''} en retard
          </div>
          {enRetard.map((c) => (
            <div
              key={`retard-${c.id}`}
              className="chapitre-row card glass-tight"
              style={{ cursor: 'pointer', ...courseAccentStyle(c.courseId) }}
              onClick={() => onOpenCourse(c.courseId, c.side)}
            >
              <span className="course-dot" />
              <div className="chapitre-name">
                {courseName(c.courseId)} — {c.nom} ({c.side === 'td' ? 'TD' : 'Cours'})
              </div>
            </div>
          ))}
        </div>
      )}

      {dueToday.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="settings-note" style={{ padding: 0 }}>
            {dueToday.length} à valider aujourd'hui
          </div>
          {dueToday.map((c) => (
            <div
              key={`due-${c.id}`}
              className="chapitre-row card glass-tight"
              style={{ cursor: 'pointer', ...courseAccentStyle(c.courseId) }}
              onClick={() => onOpenCourse(c.courseId, c.side)}
            >
              <span className="course-dot" />
              <div className="chapitre-name">
                {courseName(c.courseId)} — {c.nom} ({c.side === 'td' ? 'TD' : 'Cours'})
              </div>
            </div>
          ))}
        </div>
      )}

      {(devoirsToday.length > 0 || partielsToday.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="settings-note" style={{ padding: 0 }}>
            Échéance aujourd'hui
          </div>
          {devoirsToday.map((d) => (
            <div key={d.id} className="devoir-row glass-tight">
              <div className="devoir-name">{d.nom}</div>
            </div>
          ))}
          {partielsToday.map((e) => (
            <div key={e.id} className="devoir-row glass-tight">
              <div className="devoir-name">{e.matiere} — partiel</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
