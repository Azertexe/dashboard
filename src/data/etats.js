export const ETATS = [
  { id: 'pas_commence', label: 'Pas commencé' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'fragile', label: 'Compris mais fragile' },
  { id: 'solide', label: 'Solide' },
]

export function etatLabel(etatId) {
  return ETATS.find((e) => e.id === etatId)?.label ?? etatId
}
