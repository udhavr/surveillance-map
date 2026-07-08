import { describe, expect, it } from 'vitest'

import { OKLAHOMA_MAP_VIEWBOX, oklahomaCountyPaths } from './data'

describe('surveillance app data', () => {
    it('keeps real Oklahoma county paths keyed by normalized FIPS codes', () => {
        expect(OKLAHOMA_MAP_VIEWBOX).toBe('0 0 960 520')
        expect(oklahomaCountyPaths).toHaveLength(77)
        expect(
            oklahomaCountyPaths.find(county => county.fips === '40119')
        ).toEqual(
            expect.objectContaining({
                fips: '40119',
                name: 'Payne',
                path: expect.stringMatching(/^M/),
            })
        )
    })
})
