import { serve } from '@hono/node-server'

import { createApp } from './app'
import { createCaseRepository } from './cases-db'

const repository = createCaseRepository()
const app = createApp(repository)

const port = Number(process.env.PORT ?? 8787)

serve(
    {
        fetch: app.fetch,
        port,
    },
    info => {
        console.log(
            `Surveillance map API listening on http://localhost:${info.port}`
        )
    }
)
