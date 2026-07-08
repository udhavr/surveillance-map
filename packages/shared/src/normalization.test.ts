import { describe, expect, it } from 'vitest'

import {
    normalizeFips,
    normalizeMonth,
    normalizePrivateCaseRecord,
    normalizeZip,
} from './normalization'

describe('case normalization', () => {
    it('normalizes county, date, zip, fips, and result fields', () => {
        const result = normalizePrivateCaseRecord(
            {
                pathogen: ' rabies virus ',
                detectionDate: '2026-02-13',
                host: 'wildlife',
                city: 'stillwater',
                state: 'ok',
                zip: '740740000',
                county: 'payne',
                fips: '119',
                result: 'POSITIVE' as 'positive',
                testCount: '4' as unknown as number,
            },
            'case-1'
        )

        expect(result).toEqual({
            ok: true,
            record: {
                id: 'case-1',
                pathogen: 'rabies virus',
                detectionDate: '2026-02-13',
                year: '2026',
                month: '02',
                host: 'Wildlife',
                city: 'Stillwater',
                state: 'OK',
                zip: '74074-0000',
                county: 'Payne',
                fips: '00119',
                result: 'positive',
                testCount: 4,
            },
        })
    })

    it('reports readable validation errors for required fields', () => {
        const result = normalizePrivateCaseRecord({
            fips: 'abc',
            result: 'unknown' as 'positive',
        })

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.errors).toContain('Pathogen is required.')
            expect(result.errors).toContain('County FIPS must be 5 digits.')
            expect(result.errors).toContain(
                'Result must be positive, negative, or suspect.'
            )
        }
    })

    it('normalizes primitive location fields', () => {
        expect(normalizeMonth('2026-9-01')).toBe('09')
        expect(normalizeFips('OK-40119')).toBe('40119')
        expect(normalizeZip('74074-1234')).toBe('74074-1234')
    })
})
