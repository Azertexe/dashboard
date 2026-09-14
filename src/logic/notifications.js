import { badgeUnits, needsAttention } from './badges.js'
import { courseName } from '../data/courses.js'

const NOTIFIED_KEY = 'l3-physique-notified'
const PERMISSION_KEY = 'l3-physique-notifications-enabled'

export function notificationsEnabled() {
  return localStorage.getItem(PERMISSION_KEY) === '1'
}

export function setNotificationsEnabled(on) {
  localStorage.setItem(PERMISSION_KEY, on ? '1' : '0')
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function loadNotified() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveNotified(map) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map))
}

/** Notifie (au plus une fois par jour et par badge) les chapitres orange/jaune
 * pas encore traités — seulement si l'utilisateur a activé les notifications
 * et que la permission navigateur est accordée. */
export function checkAndNotify(chapitres, now = Date.now()) {
  if (!notificationsSupported() || !notificationsEnabled()) return
  if (Notification.permission !== 'granted') return

  const today = new Date(now).toISOString().slice(0, 10)
  const notified = loadNotified()
  let changed = false

  for (const c of chapitres) {
    for (const side of ['cours', 'td']) {
      for (const unit of badgeUnits(c)) {
        if (!needsAttention(unit.target, side, now)) continue
        const key = `${c.id}:${unit.partieId ?? 'chapitre'}:${side}`
        if (notified[key] === today) continue
        const tag = side === 'td' ? 'TD' : 'Cours'
        const title = unit.label ? `${courseName(c.courseId)} — ${c.nom} — ${unit.label}` : `${courseName(c.courseId)} — ${c.nom}`
        new Notification(title, {
          body: `${tag} à réviser — ça prend du retard.`,
          tag: key,
        })
        notified[key] = today
        changed = true
      }
    }
  }

  if (changed) saveNotified(notified)
}
