import {
    IS_PUBLIC_SITE_ONLY,
    USE_STATIC_PUBLIC_DATA,
    publicAssetPath,
} from '@/config'

import type {
    CaseInput,
    PrivateCaseRecord,
    PublicCaseRecord,
    PublicSurveillancePayload,
} from '@workspace/shared'

const API_BASE_URL = (
    import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
).replace(/\/$/, '')

export async function listAdminCases() {
    assertAdminApiAvailable()
    return requestJson<{ source: 'sqlite'; records: PrivateCaseRecord[] }>(
        '/admin/cases'
    )
}

export async function createAdminCase(input: CaseInput) {
    assertAdminApiAvailable()
    return requestJson<{ record: PrivateCaseRecord }>('/admin/cases', {
        body: JSON.stringify(input),
        method: 'POST',
    })
}

export async function updateAdminCase(id: string, input: CaseInput) {
    assertAdminApiAvailable()
    return requestJson<{ record: PrivateCaseRecord }>(`/admin/cases/${id}`, {
        body: JSON.stringify(input),
        method: 'PUT',
    })
}

export async function deleteAdminCase(id: string) {
    assertAdminApiAvailable()
    return requestJson<{ ok: true }>(`/admin/cases/${id}`, {
        method: 'DELETE',
    })
}

export async function clearAdminCases() {
    assertAdminApiAvailable()
    return requestJson<{ records: PrivateCaseRecord[] }>('/admin/cases', {
        method: 'DELETE',
    })
}

export async function getPublicPayload() {
    if (USE_STATIC_PUBLIC_DATA) {
        return (
            readStoredStaticPublicPayload() ??
            (await requestStaticJson<PublicSurveillancePayload>(
                '/data/public_cases.json'
            ))
        )
    }

    return requestJson<PublicSurveillancePayload>('/public/cases.json')
}

export function saveStaticPublicPayload(payload: PublicSurveillancePayload) {
    globalThis.localStorage?.setItem(
        STATIC_PUBLIC_PAYLOAD_KEY,
        JSON.stringify(payload)
    )
}

export function clearStaticPublicPayload() {
    globalThis.localStorage?.removeItem(STATIC_PUBLIC_PAYLOAD_KEY)
}

const STATIC_PUBLIC_PAYLOAD_KEY = 'surveillance-map-public-payload-v1'

function readStoredStaticPublicPayload() {
    const stored = globalThis.localStorage?.getItem(STATIC_PUBLIC_PAYLOAD_KEY)
    if (!stored) {
        return undefined
    }

    try {
        return JSON.parse(stored) as PublicSurveillancePayload
    } catch {
        return undefined
    }
}

export async function getPublicJsonText() {
    if (USE_STATIC_PUBLIC_DATA) {
        return JSON.stringify(await getPublicPayload(), null, 2)
    }

    return requestText('/exports/public.json')
}

export async function getPublicCsvText() {
    if (USE_STATIC_PUBLIC_DATA) {
        return publicPayloadCsv(await getPublicPayload())
    }

    return requestText('/exports/public.csv')
}

function assertAdminApiAvailable() {
    if (IS_PUBLIC_SITE_ONLY) {
        throw new Error('Admin editing is disabled in the public static build.')
    }
}

async function requestStaticJson<T>(path: string): Promise<T> {
    const response = await fetch(publicAssetPath(path))

    if (!response.ok) {
        throw new Error(
            `Static data request failed with status ${response.status}.`
        )
    }

    return (await response.json()) as T
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'content-type': 'application/json',
            ...init?.headers,
        },
        ...init,
    })

    if (!response.ok) {
        throw new Error(await errorMessage(response))
    }

    return (await response.json()) as T
}

async function requestText(path: string) {
    const response = await fetch(`${API_BASE_URL}${path}`)

    if (!response.ok) {
        throw new Error(await errorMessage(response))
    }

    return response.text()
}

async function errorMessage(response: Response) {
    const body = await response.json().catch(() => undefined)
    if (
        body &&
        typeof body === 'object' &&
        'errors' in body &&
        Array.isArray(body.errors)
    ) {
        return body.errors.join(' ')
    }

    return `Request failed with status ${response.status}.`
}

function publicPayloadCsv(payload: PublicSurveillancePayload) {
    const fields = payload.fields as Array<keyof PublicCaseRecord>
    return [
        fields.join(','),
        ...payload.cases.map(row =>
            fields.map(field => csvCell(row[field])).join(',')
        ),
    ].join('\n')
}

function csvCell(value: unknown) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`
}
