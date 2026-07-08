import { toPublicCase } from './privacy'
import type { CountyMetric, PrivateCaseRecord, PublicCaseRecord } from './types'

type AggregateKey = {
    pathogen: string
    host: string
    year: string
    month?: string
    state: string
    county: string
    fips: string
}

export function aggregatePublicCases(
    records: PrivateCaseRecord[]
): PublicCaseRecord[] {
    const aggregates = new Map<string, PublicCaseRecord>()

    for (const privateRecord of records) {
        const publicRecord = toPublicCase(privateRecord)
        const key = aggregateKey(publicRecord)
        const current = aggregates.get(key)

        if (!current) {
            aggregates.set(key, { ...publicRecord })
            continue
        }

        const totalTestCount =
            current.totalTestCount === undefined &&
            publicRecord.totalTestCount === undefined
                ? undefined
                : (current.totalTestCount ?? 0) +
                  (publicRecord.totalTestCount ?? 0)

        aggregates.set(key, {
            ...current,
            positiveCount: current.positiveCount + publicRecord.positiveCount,
            totalTestCount,
            positivityRate:
                totalTestCount && totalTestCount > 0
                    ? (current.positiveCount + publicRecord.positiveCount) /
                      totalTestCount
                    : undefined,
        })
    }

    return Array.from(aggregates.values()).sort((a, b) =>
        aggregateKey(a).localeCompare(aggregateKey(b))
    )
}

export function countyMetrics(records: PublicCaseRecord[]): CountyMetric[] {
    return records.map(record => {
        const hasRate = typeof record.positivityRate === 'number'
        return {
            ...record,
            metricLabel: hasRate ? 'positivityRate' : 'detections',
            displayValue: hasRate
                ? (record.positivityRate ?? 0)
                : record.positiveCount,
        }
    })
}

function aggregateKey(record: AggregateKey) {
    return [
        record.pathogen,
        record.host,
        record.year,
        record.month ?? '',
        record.state,
        record.county,
        record.fips,
    ].join('|')
}
