import { DatabaseIcon, MapTrifoldIcon } from '@phosphor-icons/react'
import { Link, Outlet } from '@tanstack/react-router'

import { Toaster } from '@workspace/ui/components/sonner'
import { TooltipProvider } from '@workspace/ui/components/tooltip'

export function AppShell() {
    return (
        <TooltipProvider>
            <div className='min-h-svh bg-background text-foreground'>
                <header className='border-b bg-card/80 backdrop-blur'>
                    <div className='mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3'>
                        <div>
                            <p className='text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase'>
                                Veterinary surveillance
                            </p>
                            <h1 className='font-heading text-2xl font-semibold'>
                                County pathogen map
                            </h1>
                        </div>
                        <nav className='flex items-center gap-2'>
                            <Link
                                to='/'
                                className='inline-flex h-8 items-center gap-1.5 rounded-2xl px-3 text-sm font-medium hover:bg-muted'
                            >
                                <MapTrifoldIcon />
                                Public map
                            </Link>
                            <Link
                                to='/admin'
                                className='inline-flex h-8 items-center gap-1.5 rounded-2xl border px-3 text-sm font-medium hover:bg-muted'
                            >
                                <DatabaseIcon />
                                Admin data
                            </Link>
                        </nav>
                    </div>
                </header>
                <main className='mx-auto max-w-7xl px-4 py-5'>
                    <Outlet />
                </main>
                <Toaster />
            </div>
        </TooltipProvider>
    )
}
