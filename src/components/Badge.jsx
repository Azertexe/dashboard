import { badgeStatus } from '../logic/badges'

const COLOR_NAME = {
  rouge: 'Rouge',
  orange: 'Orange',
  jaune: 'Jaune',
  vert: 'Vert turquoise',
}

const ACTIVE_LABEL = {
  rouge: 'à réviser !',
  orange: 'à réviser bientôt',
  jaune: 'ok',
  vert: 'à jour',
}

export default function Badge({ chapitre, side, onMark, small, now }) {
  const { phase, level, daysLeft, pulse, fromClick } = badgeStatus(chapitre, side, now)
  const tag = side === 'td' ? 'TD' : 'Cours'

  if (phase === 'inactive') {
    return <div className={`badge badge-inactive${small ? ' badge-small' : ''}`}>{tag} · —</div>
  }

  if (phase === 'wait') {
    return (
      <div
        className={`badge badge-attente${small ? ' badge-small' : ''}`}
        title={`Prochain statut : ${COLOR_NAME[level]} dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
      >
        {tag} · {fromClick ? '✓ ' : ''}🕐 {COLOR_NAME[level]} · J-{daysLeft}
      </div>
    )
  }

  return (
    <div
      className={`badge badge-${level}${small ? ' badge-small' : ''}${pulse ? ' pulse' : ''}`}
      onClick={() => onMark(chapitre.id, side)}
      title="Marquer comme fait maintenant"
    >
      {tag} · {ACTIVE_LABEL[level]}
    </div>
  )
}
