import { createFileRoute } from '@tanstack/react-router'

import { AdminPage } from '@/features/surveillance/admin-page'

export const Route = createFileRoute('/admin')({
    component: AdminPage,
})
