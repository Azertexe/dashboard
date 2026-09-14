import { useEffect, useRef, useState } from 'react'
import { badgeStatus } from '../logic/badges'

const LABEL = {
  inactive: '—',
  rouge: 'à réviser',
  orange: 'à réviser bientôt',
  jaune: 'ok',
  vert: 'à jour',
}

const CONFIRM_MS = 1400

export default function Badge({ chapitre, side, onMark, small, now }) {
  const { level, elapsedDays, pulse } = badgeStatus(chapitre, side, now)
  const [justMarked, setJustMarked] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const tag = side === 'td' ? 'TD' : 'Cours'
  const inactive = level === 'inactive'

  const handleClick = () => {
    onMark(chapitre.id, side)
    // Confirmation visuelle immédiate — sans ça, cliquer un badge déjà rouge
    // (jour 1) ne change ni sa couleur ni son J+0, et le clic semble ignoré.
    clearTimeout(timeoutRef.current)
    setJustMarked(true)
    timeoutRef.current = setTimeout(() => setJustMarked(false), CONFIRM_MS)
  }

  if (justMarked) {
    return (
      <div className={`badge badge-grise${small ? ' badge-small' : ''}`}>{tag} · fait ✓</div>
    )
  }

  const text = inactive
    ? `${tag} · ${LABEL.inactive}`
    : `${tag} · ${LABEL[level]} · J+${Math.floor(elapsedDays)}`

  return (
    <div
      className={`badge badge-${level}${small ? ' badge-small' : ''}${pulse ? ' pulse' : ''}`}
      onClick={inactive ? undefined : handleClick}
      title={inactive ? 'Chapitre en standby' : 'Marquer comme fait maintenant'}
    >
      {text}
    </div>
  )
}
