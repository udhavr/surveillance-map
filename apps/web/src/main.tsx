import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ThemeProvider } from '@/components/theme-provider.tsx'
import { ROUTER_BASE_PATH } from '@/config'

import '@workspace/ui/globals.css'

import { routeTree } from './routeTree.gen'

const router = createRouter({ basepath: ROUTER_BASE_PATH, routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <RouterProvider router={router} />
        </ThemeProvider>
    </StrictMode>
)
