import { badgeStatus } from '../logic/badges'

const LABEL = {
  inactive: '—',
  rouge: 'à réviser',
  orange: 'à réviser bientôt',
  jaune: 'ok',
  vert: 'à jour',
}

export default function Badge({ chapitre, side, onMark, small, now }) {
  const { level, elapsedDays, pulse } = badgeStatus(chapitre, side, now)
  const tag = side === 'td' ? 'TD' : 'Cours'
  const inactive = level === 'inactive'
  const text = inactive
    ? `${tag} · ${LABEL.inactive}`
    : `${tag} · ${LABEL[level]} · J+${Math.floor(elapsedDays)}`

  return (
    <div
      className={`badge badge-${level}${small ? ' badge-small' : ''}${pulse ? ' pulse' : ''}`}
      onClick={inactive ? undefined : () => onMark(chapitre.id, side)}
      title={inactive ? 'Chapitre en standby' : 'Marquer comme fait maintenant'}
    >
      {text}
    </div>
  )
}
