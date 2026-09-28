/** Ajoute https:// si l'utilisateur a tapé une URL sans schéma — pour ne
 * pas exiger de taper "https://" à chaque lien de ressource. */
export function normalizeUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
