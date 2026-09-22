import { normalizeState, reducer } from '../../src/state/reducer.js'
import { computeDigest } from './tools.js'
import { sendWebPush } from './webpush.js'
import { fetchState, writeState } from './firestore.js'

function formatDigestText(digest) {
  const lines = []
  if (digest.enRetard.length) {
    lines.push(`${digest.enRetard.length} badge(s) en retard :`)
    for (const c of digest.enRetard.slice(0, 5)) lines.push(`- ${c.matiere} — ${c.nom}`)
  }
  if (digest.devoirsProches.length) {
    lines.push(`${digest.devoirsProches.length} devoir(s) cette semaine :`)
    for (const d of digest.devoirsProches.slice(0, 5)) {
      lines.push(`- ${d.nom} (J${d.joursRestants >= 0 ? '-' : '+'}${Math.abs(d.joursRestants)})`)
    }
  }
  if (digest.partielsProches.length) {
    lines.push(`${digest.partielsProches.length} partiel(s) à venir :`)
    for (const e of digest.partielsProches.slice(0, 5)) lines.push(`- ${e.matiere} (J-${e.joursRestants})`)
  }
  return lines.join('\n')
}

/** Déclenché par le même Cron Trigger que la sauvegarde (voir index.js) —
 * envoie au plus une notification push par jour, uniquement s'il y a
 * vraiment quelque chose à signaler (jamais un push "rien à faire"). No-op
 * silencieux si VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY_JWK ne sont pas
 * configurés (fonctionnalité désactivée par défaut). */
export async function sendDigestPushIfDue(env) {
  if (!env.VAPID_PRIVATE_KEY_JWK) return { skipped: true, reason: 'not-configured' }

  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  const today = new Date().toISOString().slice(0, 10)
  if (state.lastPushSentDate === today) return { skipped: true, reason: 'already-sent-today' }
  if (state.pushSubscriptions.length === 0) return { skipped: true, reason: 'no-subscriptions' }

  const digest = computeDigest(state, Date.now())
  const hasSomethingToReport = digest.enRetard.length || digest.devoirsProches.length || digest.partielsProches.length
  if (!hasSomethingToReport) return { skipped: true, reason: 'nothing-urgent' }

  const text = `L3 Physique\n${formatDigestText(digest)}`
  const results = await Promise.allSettled(state.pushSubscriptions.map((sub) => sendWebPush(sub, text, env)))

  // Un envoi qui échoue en 404/410 veut dire que la subscription n'est plus
  // valide côté navigateur (désabonné, ou expirée par le service de push) —
  // on la retire pour ne pas continuer à essayer dans le vide indéfiniment.
  const deadEndpoints = state.pushSubscriptions
    .filter((_, i) => results[i].status === 'rejected' && /\b(404|410)\b/.test(results[i].reason?.message ?? ''))
    .map((s) => s.endpoint)

  // Relit l'état distant juste avant d'écrire (même filet que tools.js) —
  // la fenêtre entre notre première lecture et maintenant est plus longue
  // que d'habitude (un envoi par appareil abonné entre les deux), donc ce
  // re-fetch compte double ici : on rebase sur le plus frais possible avant
  // de poser nos deux seuls changements (date d'envoi, abonnements morts).
  const fresh = normalizeState((await fetchState()) ?? state)
  let next = { ...fresh, lastPushSentDate: today }
  for (const endpoint of deadEndpoints) next = reducer(next, { type: 'UNSUBSCRIBE_PUSH', endpoint })
  await writeState(next)

  return {
    skipped: false,
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    removed: deadEndpoints.length,
  }
}
