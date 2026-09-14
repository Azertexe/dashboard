// Silhouette stylisée façon Chamrousse/Belledonne — un petit logo, pas une carte.
export default function MountainLogo({ size = 56 }) {
  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 100 62"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 56 L28 18 L40 34 L52 10 L68 38 L78 24 L98 56 Z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="52" cy="10" r="2.4" fill="var(--accent)" />
    </svg>
  )
}
