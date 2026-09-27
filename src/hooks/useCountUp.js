import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Anime un nombre entier de sa dernière valeur affichée vers `target`
 * (y compris 0 → target au montage) — purement visuel, jamais utilisé pour
 * un calcul (seul le state renvoyé change, la valeur réelle reste `target`).
 * Sous prefers-reduced-motion, `target` est renvoyé tel quel sans jamais
 * passer par un setState (donc rien à synchroniser depuis un effet). */
export function useCountUp(target, durationMs = 700) {
  const [reduced] = useState(prefersReducedMotion)
  const [value, setValue] = useState(0)
  const valueRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (reduced) return undefined
    cancelAnimationFrame(rafRef.current)
    const from = valueRef.current
    if (from === target) return undefined
    const start = performance.now()
    const tick = (t) => {
      const progress = Math.min((t - start) / durationMs, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      const next = Math.round(from + (target - from) * eased)
      valueRef.current = next
      setValue(next)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, durationMs, reduced])

  return reduced ? target : value
}
