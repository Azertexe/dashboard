export function daysBetween(now, iso) {
  const target = new Date(iso + 'T00:00:00')
  return Math.ceil((target.getTime() - now) / 86_400_000)
}

// L'app ne suit qu'une année scolaire à la fois (2026-2027) — ça évite de
// gérer un calendrier illimité pour un simple champ date de devoir/partiel.
export const SCHOOL_YEAR_START = '2026-08-01'
export const SCHOOL_YEAR_END = '2027-07-31'

// Origine fixe de la jauge d'accueil (rentrée) — indépendante de "aujourd'hui",
// pour que le repère du jour avance visiblement le long de l'année plutôt que
// de toujours rester au tout début.
export const GAUGE_START = '2026-09-01'

/** Nombre de jours (peut être négatif) entre deux dates ISO. */
export function isoDaysBetween(fromIso, toIso) {
  const from = new Date(fromIso + 'T00:00:00').getTime()
  const to = new Date(toIso + 'T00:00:00').getTime()
  return Math.round((to - from) / 86_400_000)
}

/** Ajoute (ou retire, si négatif) des jours à une date ISO. */
export function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Date du jour (ou la borne la plus proche) au format ISO, pour ouvrir le
 * calendrier d'ajout d'un devoir/partiel sur une date déjà valide. */
export function todayWithinSchoolYear(now) {
  const today = new Date(now).toISOString().slice(0, 10)
  if (today < SCHOOL_YEAR_START) return SCHOOL_YEAR_START
  if (today > SCHOOL_YEAR_END) return SCHOOL_YEAR_END
  return today
}

/** Le prochain partiel : le plus proche à venir, sinon le plus proche passé. */
export function nextExam(exams, now) {
  if (!exams.length) return null
  const sorted = [...exams].sort((a, b) => new Date(a.date) - new Date(b.date))
  return sorted.find((e) => daysBetween(now, e.date) >= 0) ?? sorted[sorted.length - 1]
}

/** Couleur d'urgence pour un délai en jours (devoirs/partiels) — partagée par
 * DevoirsCard et DevoirsScreen. */
export function deadlineStyle(j) {
  if (j <= 3) return { color: 'oklch(0.75 0.16 25)' }
  if (j <= 7) return { color: 'oklch(0.82 0.14 55)' }
  return { color: 'var(--text-dim)' }
}
