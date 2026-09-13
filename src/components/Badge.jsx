import { badgeStatus } from '../logic/badges'

const LABEL = {
  inactive: '—',
  neutre: 'à jour',
  jaune: 'à réviser bientôt',
  orange: 'à réviser',
  rouge: 'en retard',
}

export default function Badge({ chapitre, side, onMark, small, now }) {
  const { level, elapsedDays, pulse } = badgeStatus(chapitre, side, now)
  const tag = side === 'td' ? 'TD' : 'Cours'
  const inactive = level === 'inactive'
  const text = inactive
    ? `${tag} · ${LABEL.inactive}`
    : `${tag} · ${LABEL[level]}${level !== 'neutre' ? ` · J+${Math.floor(elapsedDays)}` : ''}`

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
