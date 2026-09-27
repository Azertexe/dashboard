import { describe, it, expect } from 'vitest'
import { isSameLocalDay } from './dates.js'

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
