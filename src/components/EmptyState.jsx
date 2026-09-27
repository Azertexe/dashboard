/** Petit doodle réutilisé pour tous les états vides du site (dessiné à la
 * main en SVG, pas d'image importée) — juste de quoi rendre "rien pour
 * l'instant" un peu moins austère qu'un texte gris seul. */
export default function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="8"
          y="18"
          width="36"
          height="26"
          rx="4"
          stroke="var(--text-dimmer)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path d="M8 22 L26 32 L44 22" stroke="var(--text-dimmer)" strokeWidth="2" fill="none" />
        <circle cx="26" cy="10" r="3" fill="var(--text-dimmer)" />
      </svg>
      <div className="empty-state-text">{text}</div>
    </div>
  )
}
