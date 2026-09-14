// Liste fixe des matières suivies (confirmée avec l'utilisateur — 7 cours).
// `hue` donne à chaque matière sa propre teinte (bordure/pastille) pour les
// distinguer visuellement dans les listes — sans rapport avec la couleur des
// badges de révision, qui reste indexée sur l'urgence (rouge/orange/jaune/vert).
export const COURSES = [
  { id: 'analyse-donnees', nom: 'Analyse de données', hue: 210 },
  { id: 'maths-physique', nom: 'Mathématiques pour la physique', hue: 265 },
  { id: 'optique-coherente', nom: 'Optique cohérente', hue: 190 },
  { id: 'mecanique-analytique', nom: 'Mécanique analytique', hue: 40 },
  { id: 'electromagnetisme', nom: 'Électromagnétisme', hue: 150 },
  { id: 'anglais', nom: 'Anglais', hue: 335 },
  { id: 'informatique', nom: 'Informatique', hue: 95 },
]

export function courseName(courseId) {
  return COURSES.find((c) => c.id === courseId)?.nom ?? courseId
}

export function courseHue(courseId) {
  return COURSES.find((c) => c.id === courseId)?.hue ?? 210
}

/** Variables CSS d'accent pour une matière — à poser en `style` sur son conteneur. */
export function courseAccentStyle(courseId) {
  const hue = courseHue(courseId)
  return {
    '--course-accent': `oklch(0.78 0.13 ${hue})`,
    '--course-accent-soft': `oklch(0.78 0.13 ${hue} / 0.16)`,
    '--course-accent-border': `oklch(0.78 0.13 ${hue} / 0.5)`,
    '--course-accent-ink': `oklch(0.22 0.05 ${hue})`,
  }
}
