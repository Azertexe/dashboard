import { useStore } from '../state/store.jsx'
import { badgeStatus, needsAttention, canUndoBadge, BADGE_COLOR_NAME, BADGE_ACTIVE_LABEL } from '../logic/badges'

export default function Badge({ chapitre, side, onMark, small, now }) {
  const { phase, level, daysLeft, pulse, fromClick } = badgeStatus(chapitre, side, now)
  const tag = side === 'td' ? 'TD' : 'Cours'
  const alert = needsAttention(chapitre, side, now)

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

  if (!alert) return inner

  return (
    <div className="badge-alert-wrap">
      {inner}
      <div className="badge-alert-dot" title="Ce badge prend du retard">
        !
      </div>
    </div>
  )
}

/** Badge + un mini bouton ↺ juste à côté, visible partout (pas seulement
 * dans un panneau d'édition) — pour rattraper un clic sur une couleur fait
 * par erreur là où on le remarque, sans devoir ouvrir l'édition. */
export function BadgeWithUndo({ chapitre, side, small, now, chapitreId, partieId }) {
  const { dispatch } = useStore()
  const onMark = (id, s) => dispatch({ type: 'MARK_BADGE', id: chapitreId, partieId, side: s })
  const onUndo = () => dispatch({ type: 'UNDO_BADGE', id: chapitreId, partieId, side })

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
