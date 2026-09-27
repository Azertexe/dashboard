import { useEffect, useMemo, useState } from 'react'
import { BACKGROUND_PHOTOS } from '../data/backgroundPhotos.js'

const ROTATE_MS = 8000

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Fond photo qui défile par fondu enchaîné, propre à chaque thème (cf.
 * data/backgroundPhotos.js) — un thème sans photo ne rend rien, laissant
 * voir la texture rayée habituelle (body, global.css). Deux calques
 * superposés (layerA/layerB) alternent lequel est au-dessus : la transition
 * CSS sur `opacity` suffit pour le fondu, et seules les deux photos
 * affichées à un instant donné sont montées (pas toute la collection à la
 * fois). Sous prefers-reduced-motion, le défilement est simplement arrêté
 * (la première photo du thème reste affichée, sans fondu). Remonté à chaque
 * changement de thème par App.jsx (`key={theme}`) plutôt que de resynchroniser
 * son state via un effet — l'état initial part donc toujours propre. */
export default function BackgroundSlideshow({ theme }) {
  const photos = useMemo(() => BACKGROUND_PHOTOS[theme] ?? [], [theme])
  const [reduced] = useState(prefersReducedMotion)
  const [state, setState] = useState(() => ({ layerA: 0, layerB: null, topIsA: true }))

  useEffect(() => {
    if (photos.length < 2 || reduced) return undefined
    const id = setInterval(() => {
      setState((s) => {
        const currentTop = s.topIsA ? s.layerA : s.layerB
        const next = (currentTop + 1) % photos.length
        return s.topIsA
          ? { layerA: s.layerA, layerB: next, topIsA: false }
          : { layerA: next, layerB: s.layerB, topIsA: true }
      })
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [photos, theme, reduced])

  if (photos.length === 0) return null

  const base = import.meta.env.BASE_URL
  const { layerA, layerB, topIsA } = state

  return (
    <div className="bg-slideshow" aria-hidden="true">
      <div
        className="bg-slideshow-layer"
        style={{ backgroundImage: `url(${base}${photos[layerA]})`, opacity: topIsA ? 1 : 0 }}
      />
      {layerB !== null && (
        <div
          className="bg-slideshow-layer"
          style={{ backgroundImage: `url(${base}${photos[layerB]})`, opacity: topIsA ? 0 : 1 }}
        />
      )}
    </div>
  )
}
