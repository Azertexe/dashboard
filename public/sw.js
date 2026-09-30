// Service worker minimal : cache réseau-d'abord pour permettre un usage
// hors-ligne basique (l'app reste consultable, les données restent en
// localStorage côté page). Pas de précache figé — les noms de fichiers
// changent à chaque build Vite, donc on met en cache au fil de l'eau.
const CACHE_NAME = 'l3-physique-v1'
const SCOPE = '/dashboard/'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Notification push (rappels envoyés par mcp-server/, optionnel — voir
// src/logic/push.js). Le payload est du texte brut (titre + corps), pas du
// JSON, pour rester simple des deux côtés. Toujours affichée, que l'onglet
// du site soit ouvert ou non (c'est justement l'intérêt du push par rapport
// aux notifications navigateur, qui elles requièrent l'onglet ouvert) —
// showNotification() est appelé sans condition sur l'état de la page.
//
// Pas de `tag` fixe partagé entre tous les envois : plusieurs rappels de
// nature différente peuvent arriver rapprochés (ex. un par badge à 7h) et
// doivent tous rester visibles plutôt que de se remplacer silencieusement
// les uns les autres (comportement par défaut d'un `tag` identique sans
// `renotify: true`).
self.addEventListener('push', (event) => {
  const text = event.data?.text() ?? 'Il y a du nouveau sur ton suivi de révisions.'
  const [title, ...rest] = text.split('\n')
  event.waitUntil(
    self.registration.showNotification(title || 'L3 Physique', {
      body: rest.join('\n') || text,
      icon: `${SCOPE}icons/icon-192.png`,
      badge: `${SCOPE}icons/icon-192.png`,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(SCOPE))
      if (existing) return existing.focus()
      return self.clients.openWindow(SCOPE)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request)
        if (response && response.ok) cache.put(request, response.clone())
        return response
      } catch {
        const cached = await cache.match(request, { ignoreSearch: true })
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await cache.match(SCOPE)
          if (shell) return shell
        }
        return Response.error()
      }
    }),
  )
})
