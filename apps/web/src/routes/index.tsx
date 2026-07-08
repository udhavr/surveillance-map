import { createFileRoute } from '@tanstack/react-router'

import { PublicMapPage } from '@/features/surveillance/public-map-page'

export const Route = createFileRoute('/')({
    component: PublicMapPage,
})
