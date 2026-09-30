import { normalizeState } from '../../src/state/reducer.js'
import { sendWebPush } from './webpush.js'
import { fetchState } from './firestore.js'

/** Déclenché par le bouton "Vérifier les notifications" (Réglages, côté
 * app) — envoie immédiatement une notification de test à tous les
 * appareils abonnés, sans dédoublonnage ni condition (contrairement aux
 * rappels automatiques) puisque c'est justement un test à la demande. */
export async function sendTestPush(env) {
  if (!env.VAPID_PRIVATE_KEY_JWK) return { skipped: true, reason: 'not-configured' }

  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  if (state.pushSubscriptions.length === 0) return { skipped: true, reason: 'no-subscriptions' }

  const text = 'L3 Physique\nTest réussi — les notifications push fonctionnent sur cet appareil.'
  const results = await Promise.allSettled(state.pushSubscriptions.map((sub) => sendWebPush(sub, text, env)))

  return {
    skipped: false,
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  }
}
