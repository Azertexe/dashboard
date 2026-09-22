// Clé publique VAPID du serveur MCP (mcp-server/) — pas un secret (comme la
// config Firebase : elle ne sert qu'à vérifier que les push viennent bien de
// ce serveur, la clé privée correspondante reste côté serveur, en secret
// Cloudflare). Générée une seule fois pour ce projet.
export const VAPID_PUBLIC_KEY = 'BIp7O-NSO3PZsDXfJYh4o_vrDd9DlDxgt7hZjUKQzuLpDvCuJt7mLHYlGNd2MNtbxRHilWOKJhUAnaxJ6DDFYLw'

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

/** iOS n'autorise les notifications push que pour une PWA "ajoutée à l'écran
 * d'accueil" (mode standalone) — pas dans un onglet Safari normal. Sur
 * d'autres plateformes, cette contrainte n'existe pas. */
export function pushRequiresInstall() {
  if (typeof window === 'undefined') return false
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  return isIOS && !isStandalone
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** Abonne cet appareil aux notifications push et renvoie la subscription
 * (à stocker via SUBSCRIBE_PUSH) — null si non supporté ou permission refusée. */
export async function subscribeToPush() {
  if (!pushSupported()) return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  return subscription.toJSON()
}

/** Désabonne cet appareil (navigateur) — à appeler avant UNSUBSCRIBE_PUSH. */
export async function unsubscribeFromPush() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  await subscription?.unsubscribe()
}
