import { describe, expect, it } from 'vitest'

import { publicPayload } from './exports'
import { aggregatePublicCases } from './metrics'
import { sanitizePublishedText } from './privacy'
import { sampleCases } from './sample-data'

describe('public exports', () => {
    it('omits private fields from public payload records', () => {
        const payload = publicPayload(sampleCases, '2026-07-07T00:00:00.000Z')

        expect(payload.recordCount).toBeGreaterThan(0)
        expect(JSON.stringify(payload)).not.toContain('OADDL-2026-0001')
        expect(JSON.stringify(payload)).not.toContain('Faxon')
        expect(JSON.stringify(payload)).not.toContain('73540')
    })

    it('aggregates rows by pathogen, host, time, and county', () => {
        const rows = aggregatePublicCases([sampleCases[0], sampleCases[0]])

        expect(rows).toHaveLength(1)
        expect(rows[0].positiveCount).toBe(2)
        expect(rows[0].totalTestCount).toBe(24)
    })

    it('sanitizes private location terms from notes', () => {
        expect(
            sanitizePublishedText('Seen near Faxon 73540', sampleCases)
        ).toBe('Seen near [private] [private]')
    })
})
