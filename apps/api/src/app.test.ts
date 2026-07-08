import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createApp } from './app'
import { type CaseRepository, createCaseRepository } from './cases-db'

let repository: CaseRepository | undefined
let tempDirectory: string | undefined

afterEach(() => {
    repository?.close()
    repository = undefined
    if (tempDirectory) {
        rmSync(tempDirectory, { force: true, recursive: true })
        tempDirectory = undefined
    }
})

describe('case API', () => {
    it('starts empty until records are imported or created', async () => {
        const app = testApp()

        const response = await app.request('/admin/cases')
        expect(response.status).toBe(200)
        expect(
            ((await response.json()) as { records: unknown[] }).records
        ).toEqual([])
    })

    it('supports admin CRUD operations against SQLite', async () => {
        const app = testApp()

        const created = await app.request('/admin/cases', {
            body: JSON.stringify({
                pathogen: 'Rabies virus',
                detectionDate: '2026-04-10',
                host: 'wildlife',
                state: 'ok',
                county: 'payne',
                fips: '40119',
                result: 'positive',
                testCount: 2,
            }),
            method: 'POST',
        })
        expect(created.status).toBe(201)
        const createdBody = (await created.json()) as {
            record: { id: string; month: string; county: string }
        }
        expect(createdBody.record.month).toBe('04')
        expect(createdBody.record.county).toBe('Payne')

        const updated = await app.request(
            `/admin/cases/${createdBody.record.id}`,
            {
                body: JSON.stringify({
                    result: 'negative',
                    testCount: 3,
                }),
                method: 'PUT',
            }
        )
        expect(updated.status).toBe(200)

        const deleted = await app.request(
            `/admin/cases/${createdBody.record.id}`,
            { method: 'DELETE' }
        )
        expect(deleted.status).toBe(200)
    })

    it('can clear imported data', async () => {
        const app = testApp()

        await app.request('/admin/cases', {
            body: JSON.stringify({
                pathogen: 'Rabies virus',
                year: '2026',
                host: 'wildlife',
                state: 'ok',
                county: 'payne',
                fips: '40119',
                result: 'positive',
            }),
            method: 'POST',
        })

        const cleared = await app.request('/admin/cases', { method: 'DELETE' })
        expect(cleared.status).toBe(200)
        expect(
            ((await cleared.json()) as { records: unknown[] }).records
        ).toEqual([])
    })

    it('keeps private fields out of the public payload', async () => {
        const app = testApp()
        await app.request('/admin/cases', {
            body: JSON.stringify({
                accessionId: 'PRIVATE-ACCESSION',
                pathogen: 'Rabies virus',
                detectionDate: '2026-04-10',
                host: 'wildlife',
                city: 'Stillwater',
                state: 'ok',
                zip: '74074',
                county: 'payne',
                fips: '40119',
                rawLocation: 'Stillwater, OK 74074',
                result: 'positive',
                testCount: 2,
            }),
            method: 'POST',
        })

        const response = await app.request('/public/cases.json')
        const text = await response.text()

        expect(response.status).toBe(200)
        expect(text).toContain('Payne')
        expect(text).not.toContain('PRIVATE-ACCESSION')
        expect(text).not.toContain('Stillwater')
        expect(text).not.toContain('74074')
    })
})

function testApp() {
    tempDirectory = mkdtempSync(join(tmpdir(), 'surveillance-map-api-'))
    repository = createCaseRepository(join(tempDirectory, 'test.sqlite'))
    return createApp(repository)
}
