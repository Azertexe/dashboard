import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { badgeStatus, needsAttention, canUndoBadge, BADGE_COLOR_NAME, BADGE_ACTIVE_LABEL } from '../logic/badges'

const CONFETTI_COLORS = ['var(--vert-bg)', 'var(--bleu-bg)', 'var(--jaune-bg)', 'var(--accent)']
const CONFETTI_PIECES = 10

/** Petite salve de confettis CSS (pas de librairie, pas de canvas) déclenchée
 * une fois quand un badge vient de passer au vert — purement décorative,
 * auto-supprimée par le parent après son animation (cf. Badge ci-dessous). */
function ConfettiBurst() {
  return (
    <div className="confetti-burst" aria-hidden="true">
      {Array.from({ length: CONFETTI_PIECES }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            '--angle': `${(360 / CONFETTI_PIECES) * i}deg`,
            '--delay': `${(i % 3) * 40}ms`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }}
        />
      ))}
    </div>
  )
}

export default function Badge({ chapitre, side, onMark, small, now }) {
  const { phase, level, daysLeft, pulse, fromClick } = badgeStatus(chapitre, side, now)
  const tag = side === 'td' ? 'TD' : 'Cours'
  const alert = needsAttention(chapitre, side, now)

  // Confettis une seule fois, au moment précis où ce badge devient vert actif
  // (pas au montage si déjà vert, pas répété tant qu'il le reste).
  const isVertActive = phase === 'active' && level === 'vert'
  const wasVertRef = useRef(isVertActive)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (isVertActive && !wasVertRef.current) {
      setCelebrate(true)
      const id = setTimeout(() => setCelebrate(false), 750)
      wasVertRef.current = isVertActive
      return () => clearTimeout(id)
    }
    wasVertRef.current = isVertActive
    return undefined
  }, [isVertActive])

  let inner
  if (phase === 'inactive') {
    inner = <div className={`badge badge-inactive${small ? ' badge-small' : ''}`}>{tag} · —</div>
  } else if (phase === 'wait') {
    inner = (
      <div
        className={`badge badge-attente${small ? ' badge-small' : ''}`}
        title={`Prochain statut : ${BADGE_COLOR_NAME[level]} dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
      >
        {tag} · {fromClick ? '✓ ' : ''}🕐 {BADGE_COLOR_NAME[level]} · J-{daysLeft}
      </div>
    )
  } else {
    inner = (
      <div
        className={`badge badge-${level}${small ? ' badge-small' : ''}${pulse ? ' pulse' : ''}`}
        onClick={() => onMark(chapitre.id, side)}
        title="Marquer comme fait maintenant"
      >
        {tag} · {BADGE_ACTIVE_LABEL[level]}
      </div>
    )
  }

  if (!alert && !celebrate) return inner

  return (
    <div className="badge-alert-wrap">
      {inner}
      {alert && (
        <div className="badge-alert-dot" title="Ce badge prend du retard">
          !
        </div>
      )}
      {celebrate && <ConfettiBurst />}
    </div>
  )
}

/** Badge + un mini bouton ↺ juste à côté, visible partout (pas seulement
 * dans un panneau d'édition) — pour rattraper un clic sur une couleur fait
 * par erreur là où on le remarque, sans devoir ouvrir l'édition. */
export function BadgeWithUndo({ chapitre, side, small, now, chapitreId }) {
  const { dispatch } = useStore()
  const onMark = (id, s) => dispatch({ type: 'MARK_BADGE', id: chapitreId, side: s })
  const onUndo = () => dispatch({ type: 'UNDO_BADGE', id: chapitreId, side })

  return (
    <div className="badge-with-undo">
      <Badge chapitre={chapitre} side={side} onMark={onMark} small={small} now={now} />
      {canUndoBadge(chapitre, side) && (
        <button className="icon-btn" onClick={onUndo} title="Annuler le dernier clic sur ce badge">
          ↺
        </button>
      )}
    </div>
  )
}
