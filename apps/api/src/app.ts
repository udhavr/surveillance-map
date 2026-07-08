import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { publicCsv, publicJson, publicPayload } from '@workspace/shared'

import type { CaseRepository } from './cases-db'

export function createApp(cases: CaseRepository) {
    const app = new Hono()

    app.use('*', cors())

    app.get('/health', context =>
        context.json({
            ok: true,
            service: 'surveillance-map-api',
        })
    )

    app.get('/admin/cases', context =>
        context.json({
            source: 'sqlite',
            records: cases.list(),
        })
    )

    app.post('/admin/cases', async context => {
        const body = await readJson(context.req)
        const result = cases.create(body)

        if (!result.ok) {
            return context.json({ errors: result.errors }, 400)
        }

        return context.json({ record: result.record }, 201)
    })

    app.delete('/admin/cases', context => {
        cases.clear()
        return context.json({ records: [] })
    })

    app.post('/admin/cases/reset', context =>
        context.json({
            source: 'sqlite',
            records: cases.reset(),
        })
    )

    app.put('/admin/cases/:id', async context => {
        const body = await readJson(context.req)
        const result = cases.update(context.req.param('id'), body)

        if (!result.ok) {
            if ('notFound' in result) {
                return context.json({ errors: ['Case not found.'] }, 404)
            }
            return context.json({ errors: result.errors }, 400)
        }

        return context.json({ record: result.record })
    })

    app.delete('/admin/cases/:id', context => {
        const deleted = cases.delete(context.req.param('id'))
        if (!deleted) {
            return context.json({ errors: ['Case not found.'] }, 404)
        }
        return context.json({ ok: true })
    })

    app.get('/public/cases.json', context =>
        context.json(publicPayload(cases.list()))
    )

    app.get('/exports/public.json', context =>
        context.body(publicJson(cases.list()), 200, {
            'content-type': 'application/json; charset=utf-8',
        })
    )

    app.get('/exports/public.csv', context =>
        context.body(publicCsv(cases.list()), 200, {
            'content-disposition': 'attachment; filename=public_cases.csv',
            'content-type': 'text/csv; charset=utf-8',
        })
    )

    return app
}

async function readJson(request: {
    json: () => Promise<unknown>
}): Promise<Record<string, unknown>> {
    const body = await request.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {}
    }
    return body as Record<string, unknown>
}
