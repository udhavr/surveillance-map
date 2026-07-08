export const IS_PUBLIC_SITE_ONLY =
    import.meta.env.VITE_PUBLIC_SITE_ONLY === 'true'

export const USE_STATIC_PUBLIC_DATA =
    import.meta.env.VITE_STATIC_PUBLIC_DATA === 'true'

export const ROUTER_BASE_PATH =
    import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export function publicAssetPath(path: string) {
    return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
