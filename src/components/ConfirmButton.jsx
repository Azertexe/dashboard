import { useEffect, useState } from 'react'

const CONFIRM_TIMEOUT_MS = 4000

/** Bouton de suppression à confirmation en deux temps, en remplacement de
 * window.confirm() — pas fiable partout (silencieux ou bloqué en PWA sur
 * iOS, cf. #48 où ça avait déjà cassé la suppression des devoirs). Premier
 * clic bascule le bouton en état "à confirmer" pendant quelques secondes ;
 * un second clic dans ce délai déclenche onConfirm. Sans second clic, le
 * bouton revient tout seul à son état normal — rien à annuler explicitement. */
export default function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  className,
  confirmClassName,
  tag: Tag = 'div',
  title,
  confirmTitle,
}) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [confirming])

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirming) {
      setConfirming(false)
      onConfirm()
    } else {
      setConfirming(true)
    }
  }

  const activeTitle = confirming ? (confirmTitle ?? title) : title

  return (
    <Tag
      className={confirming ? confirmClassName : className}
      onClick={handleClick}
      title={activeTitle}
      aria-label={activeTitle}
    >
      {confirming ? confirmLabel : label}
    </Tag>
  )
}
