import { createRootRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/layouts/app-shell'

export const Route = createRootRoute({
    component: AppShell,
})
