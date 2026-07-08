import { clean } from './normalization'
import type { PrivateCaseRecord, PublicCaseRecord } from './types'

const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/g

export const PUBLIC_PRIVACY_NOTICE =
    'Public website data only. Accession IDs, city, ZIP, raw location, exact detection date, and notes are intentionally omitted.'

export function sanitizePublishedText(
    value: unknown,
    records: PrivateCaseRecord[]
) {
    let text = clean(value)
    if (!text) {
        return ''
    }

    const privateTerms = records
        .flatMap(record => [record.city, record.zip])
        .map(clean)
        .filter(term => term.length >= 3)
        .sort((a, b) => b.length - a.length)

    for (const term of privateTerms) {
        text = text.replaceAll(
            new RegExp(escapeRegExp(term), 'gi'),
            '[private]'
        )
    }

    return text.replaceAll(ZIP_PATTERN, '[ZIP removed]')
}

export function toPublicCase(record: PrivateCaseRecord): PublicCaseRecord {
    return {
        pathogen: record.pathogen,
        host: record.host,
        year: record.year,
        month: record.month,
        state: record.state,
        county: record.county,
        fips: record.fips,
        positiveCount: record.result === 'positive' ? 1 : 0,
        totalTestCount: record.testCount,
        positivityRate:
            record.testCount &&
            record.testCount > 0 &&
            record.result === 'positive'
                ? 1 / record.testCount
                : undefined,
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
