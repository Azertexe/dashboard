export function daysBetween(now, iso) {
  const target = new Date(iso + 'T00:00:00')
  return Math.ceil((target.getTime() - now) / 86_400_000)
}

export function isoDatePlusDays(now, days) {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Le prochain partiel : le plus proche à venir, sinon le plus proche passé. */
export function nextExam(exams, now) {
  if (!exams.length) return null
  const sorted = [...exams].sort((a, b) => new Date(a.date) - new Date(b.date))
  return sorted.find((e) => daysBetween(now, e.date) >= 0) ?? sorted[sorted.length - 1]
}
