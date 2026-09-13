// Liste fixe des matières suivies (confirmée avec l'utilisateur — 7 cours).
export const COURSES = [
  { id: 'analyse-donnees', nom: 'Analyse de données' },
  { id: 'maths-physique', nom: 'Mathématiques pour la physique' },
  { id: 'optique-coherente', nom: 'Optique cohérente' },
  { id: 'mecanique-analytique', nom: 'Mécanique analytique' },
  { id: 'electromagnetisme', nom: 'Électromagnétisme' },
  { id: 'anglais', nom: 'Anglais' },
  { id: 'informatique', nom: 'Informatique' },
]

export function courseName(courseId) {
  return COURSES.find((c) => c.id === courseId)?.nom ?? courseId
}
