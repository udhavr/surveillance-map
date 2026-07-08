import { aggregatePublicCases } from './metrics'
import { PUBLIC_PRIVACY_NOTICE } from './privacy'
import type {
    PrivateCaseRecord,
    PublicCaseRecord,
    PublicSurveillancePayload,
} from './types'

const PUBLIC_FIELDS: Array<keyof PublicCaseRecord> = [
    'pathogen',
    'host',
    'year',
    'month',
    'state',
    'county',
    'fips',
    'positiveCount',
    'totalTestCount',
    'positivityRate',
]

export function publicPayload(
    records: PrivateCaseRecord[],
    generatedAt = new Date().toISOString()
): PublicSurveillancePayload {
    const cases = aggregatePublicCases(records)

    return {
        schema: 'surveillance-map-public-cases-v1',
        generatedAt,
        privacy: PUBLIC_PRIVACY_NOTICE,
        fields: PUBLIC_FIELDS,
        recordCount: cases.length,
        cases,
    }
}

export function publicCsv(records: PrivateCaseRecord[]) {
    const rows = publicPayload(records).cases
    return [
        PUBLIC_FIELDS.join(','),
        ...rows.map(row =>
            PUBLIC_FIELDS.map(field => csvCell(row[field])).join(',')
        ),
    ].join('\n')
}

export function publicJson(records: PrivateCaseRecord[]) {
    return JSON.stringify(publicPayload(records), null, 2)
}

function csvCell(value: unknown) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`
}
