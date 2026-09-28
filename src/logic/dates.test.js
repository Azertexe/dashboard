import { describe, it, expect, afterEach } from 'vitest'
import { isSameLocalDay, addDaysIso, todayWithinSchoolYear } from './dates.js'

describe('isSameLocalDay', () => {
  it('deux instants le même jour civil sont considérés identiques', () => {
    const matin = new Date('2026-10-01T08:00:00').getTime()
    const soir = new Date('2026-10-01T23:00:00').getTime()
    expect(isSameLocalDay(matin, soir)).toBe(true)
  })

  it('deux instants de part et d\'autre de minuit sont des jours différents', () => {
    const veille = new Date('2026-10-01T23:59:00').getTime()
    const lendemain = new Date('2026-10-02T00:01:00').getTime()
    expect(isSameLocalDay(veille, lendemain)).toBe(false)
  })
})

// new Date(...).toISOString() convertit en UTC — dans un fuseau en avance
// sur UTC (ex. Europe/Paris), minuit local tombe encore la veille en UTC, ce
// qui décalait ces deux fonctions d'un jour en arrière (bug corrigé : elles
// passent maintenant par isoDateLocal plutôt que toISOString).
describe('todayWithinSchoolYear / addDaysIso (fuseau local, pas UTC)', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTz
  })

  it("todayWithinSchoolYear ne recule pas d'un jour juste après minuit dans un fuseau en avance sur UTC", () => {
    process.env.TZ = 'Europe/Paris'
    const justAfterMidnight = new Date('2026-09-27T00:30:00').getTime()
    expect(todayWithinSchoolYear(justAfterMidnight)).toBe('2026-09-27')
  })

  it("addDaysIso(iso, 0) rend exactement la même date, quel que soit le fuseau", () => {
    process.env.TZ = 'Europe/Paris'
    expect(addDaysIso('2026-09-27', 0)).toBe('2026-09-27')
  })

  it('addDaysIso ajoute bien le nombre de jours demandé dans un fuseau en avance sur UTC', () => {
    process.env.TZ = 'Europe/Paris'
    expect(addDaysIso('2026-09-27', 90)).toBe('2026-12-26')
  })
})
