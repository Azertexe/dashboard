import { useEffect, useState } from 'react'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Valeur qui part de 0 puis rejoint `target` juste après le montage (pour
 * qu'une barre de progression se remplisse visiblement au lieu d'apparaître
 * déjà pleine) — les changements suivants de `target` vont directement à leur
 * valeur, la transition CSS existante sur `width` suffit à les animer. La
 * valeur affichée est dérivée du seul flag "monté", jamais recopiée dans un
 * state à part, pour ne rien avoir à synchroniser depuis un effet. */
export function useMountGrow(target) {
  const [reduced] = useState(prefersReducedMotion)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (reduced || mounted) return undefined
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [reduced, mounted])

  if (reduced) return target
  return mounted ? target : 0
}
