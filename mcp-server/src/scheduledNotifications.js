import { normalizeState, reducer } from '../../src/state/reducer.js'
import { needsAttention, activeSinceTimestamp } from '../../src/logic/badges.js'
import { courseName } from '../../src/data/courses.js'
import { sendWebPush } from './webpush.js'
import { fetchState, writeState } from './firestore.js'

// Les 3 rappels ci-dessous partagent tous le même déclencheur horaire (cron
// "0 * * * *", cf. index.js) — c'est CETTE fonction qui décide, à chaque
// tic, ce qu'il y a (ou non) à envoyer, en fonction de l'heure locale
// Europe/Paris. Un Worker Cloudflare tourne toujours en UTC (pas de fuseau
// système réglable) : Intl.DateTimeFormat avec timeZone est le seul moyen
// fiable d'obtenir l'heure/le jour civil français (et ça gère l'heure d'été
// tout seul, contrairement à un simple décalage figé +1/+2).
function parisParts(now) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  // formatToParts rend "24" à minuit pile plutôt que "00" avec hour12:false —
  // Number('24') → 24, à ramener à 0 pour rester dans [0,23].
  const hour = Number(parts.hour) % 24
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour }
}

const OVERDUE_HOUR_START = 8
const OVERDUE_HOUR_END = 22 // inclus
const MORNING_HOUR = 7
const EVENING_HOUR = 18

// Chapitres avec un badge orange/jaune ACTIF non validé (cf. needsAttention,
// mêmes seuils que l'Agenda de l'app) — le rouge n'y figure jamais : c'est le
// point de départ normal du cycle, pas un retard (cf. badges.js).
function overdueChapitres(state, now) {
  const out = []
  for (const c of state.chapitres) {
    if (needsAttention(c, c.side, now)) out.push(c)
  }
  return out
}

// Chapitres dont LE BADGE (Cours ou TD, indépendamment) vient d'atteindre sa
// couleur active précisément aujourd'hui (jour civil Europe/Paris) — cf.
// activeSinceTimestamp. Ré-exécuté tel quel à 7h (annonce) et à 18h (ce qui
// est encore là = pas encore validé, cf. le commentaire d'activeSinceTimestamp
// dans badges.js : valider re-décale l'ancre, donc un badge déjà coché sort
// tout seul de cette liste sans suivi séparé).
function dueTodayEntries(state, todayDate, now) {
  const out = []
  for (const c of state.chapitres) {
    const ts = activeSinceTimestamp(c, c.side, now)
    if (ts == null) continue
    if (parisParts(ts).date !== todayDate) continue
    out.push(c)
  }
  return out
}

async function pushToAll(state, text, env) {
  if (state.pushSubscriptions.length === 0) return { sent: 0, failed: 0, deadEndpoints: [] }
  const results = await Promise.allSettled(state.pushSubscriptions.map((sub) => sendWebPush(sub, text, env)))
  const deadEndpoints = state.pushSubscriptions
    .filter((_, i) => results[i].status === 'rejected' && /\b(404|410)\b/.test(results[i].reason?.message ?? ''))
    .map((s) => s.endpoint)
  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    deadEndpoints,
  }
}

// Relit l'état le plus frais juste avant d'écrire (même filet que
// digestPush.js/tools.js) et pose UNIQUEMENT le(s) champ(s) anti-doublon
// concerné(s) + le nettoyage des abonnements morts — jamais le reste, pour
// ne jamais écraser un changement fait ailleurs entre-temps.
async function markSent(patch, deadEndpoints) {
  const fresh = normalizeState((await fetchState()) ?? {})
  let next = { ...fresh, ...patch }
  for (const endpoint of deadEndpoints) next = reducer(next, { type: 'UNSUBSCRIBE_PUSH', endpoint })
  await writeState(next)
}

/** Rappel groupé "N badge(s) en retard", au plus une fois par créneau
 * horaire, entre 8h et 22h (heure de Paris) — jamais la nuit. */
export async function sendOverdueReminderIfDue(env, now = Date.now()) {
  if (!env.VAPID_PRIVATE_KEY_JWK) return { skipped: true, reason: 'not-configured' }
  const { date, hour } = parisParts(now)
  if (hour < OVERDUE_HOUR_START || hour > OVERDUE_HOUR_END) return { skipped: true, reason: 'outside-hours' }

  const slot = `${date}T${String(hour).padStart(2, '0')}`
  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  if (state.lastOverdueNotifSlot === slot) return { skipped: true, reason: 'already-sent-this-slot' }
  if (state.pushSubscriptions.length === 0) return { skipped: true, reason: 'no-subscriptions' }

  const overdue = overdueChapitres(state, now)
  if (overdue.length === 0) return { skipped: true, reason: 'nothing-overdue' }

  const lines = overdue.slice(0, 8).map((c) => `- ${courseName(c.courseId)} — ${c.nom} (${c.side === 'td' ? 'TD' : 'Cours'})`)
  const text = `L3 Physique\n${overdue.length} badge(s) en retard :\n${lines.join('\n')}`
  const { sent, failed, deadEndpoints } = await pushToAll(state, text, env)
  await markSent({ lastOverdueNotifSlot: slot }, deadEndpoints)
  return { skipped: false, sent, failed, removed: deadEndpoints.length, count: overdue.length }
}

/** 7h (Paris) : une notification par badge devenu actif aujourd'hui. */
export async function sendMorningDueTodayIfDue(env, now = Date.now()) {
  if (!env.VAPID_PRIVATE_KEY_JWK) return { skipped: true, reason: 'not-configured' }
  const { date, hour } = parisParts(now)
  if (hour !== MORNING_HOUR) return { skipped: true, reason: 'not-morning-hour' }

  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  if (state.lastMorningNotifDate === date) return { skipped: true, reason: 'already-sent-today' }
  if (state.pushSubscriptions.length === 0) return { skipped: true, reason: 'no-subscriptions' }

  const due = dueTodayEntries(state, date, now)
  if (due.length === 0) {
    await markSent({ lastMorningNotifDate: date }, [])
    return { skipped: false, sent: 0, failed: 0, removed: 0, count: 0 }
  }

  let sent = 0
  let failed = 0
  const deadEndpoints = new Set()
  for (const c of due) {
    const text = `L3 Physique\n${courseName(c.courseId)} — ${c.nom} (${c.side === 'td' ? 'TD' : 'Cours'})\nÀ réviser aujourd'hui.`
    const r = await pushToAll(state, text, env)
    sent += r.sent
    failed += r.failed
    for (const e of r.deadEndpoints) deadEndpoints.add(e)
  }
  await markSent({ lastMorningNotifDate: date }, [...deadEndpoints])
  return { skipped: false, sent, failed, removed: deadEndpoints.size, count: due.length }
}

/** 18h (Paris) : rappel pour chaque badge du jour encore pas validé — la
 * même liste que le matin, recalculée (un badge déjà coché en est
 * naturellement sorti, cf. activeSinceTimestamp). */
export async function sendEveningDueTodayIfDue(env, now = Date.now()) {
  if (!env.VAPID_PRIVATE_KEY_JWK) return { skipped: true, reason: 'not-configured' }
  const { date, hour } = parisParts(now)
  if (hour !== EVENING_HOUR) return { skipped: true, reason: 'not-evening-hour' }

  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  if (state.lastEveningNotifDate === date) return { skipped: true, reason: 'already-sent-today' }
  if (state.pushSubscriptions.length === 0) return { skipped: true, reason: 'no-subscriptions' }

  const stillDue = dueTodayEntries(state, date, now)
  if (stillDue.length === 0) {
    await markSent({ lastEveningNotifDate: date }, [])
    return { skipped: false, sent: 0, failed: 0, removed: 0, count: 0 }
  }

  let sent = 0
  let failed = 0
  const deadEndpoints = new Set()
  for (const c of stillDue) {
    const text = `L3 Physique\n${courseName(c.courseId)} — ${c.nom} (${c.side === 'td' ? 'TD' : 'Cours'})\nToujours pas validé aujourd'hui.`
    const r = await pushToAll(state, text, env)
    sent += r.sent
    failed += r.failed
    for (const e of r.deadEndpoints) deadEndpoints.add(e)
  }
  await markSent({ lastEveningNotifDate: date }, [...deadEndpoints])
  return { skipped: false, sent, failed, removed: deadEndpoints.size, count: stillDue.length }
}

/** Point d'entrée unique appelé par le cron horaire (index.js) — les 3
 * rappels sont indépendants (une heure ne déclenche jamais plus d'un des
 * trois, cf. leurs gardes d'heure respectives) mais on les exécute tous les
 * trois à chaque tic par simplicité ; chacun sort tout de suite si ce n'est
 * pas son heure. */
export async function runHourlyNotifications(env, now = Date.now()) {
  const [overdue, morning, evening] = await Promise.allSettled([
    sendOverdueReminderIfDue(env, now),
    sendMorningDueTodayIfDue(env, now),
    sendEveningDueTodayIfDue(env, now),
  ])
  return { overdue, morning, evening }
}
