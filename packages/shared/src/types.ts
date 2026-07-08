export type Month =
    | '01'
    | '02'
    | '03'
    | '04'
    | '05'
    | '06'
    | '07'
    | '08'
    | '09'
    | '10'
    | '11'
    | '12'

export type PrivateCaseRecord = {
    id: string
    accessionId?: string
    pathogen: string
    detectionDate?: string
    year: string
    month?: Month
    host: string
    city?: string
    state: string
    zip?: string
    county: string
    fips: string
    rawLocation?: string
    notes?: string
    result: 'positive' | 'negative' | 'suspect'
    testCount?: number
    createdAt?: string
    updatedAt?: string
}

export type CaseResult = PrivateCaseRecord['result']

export type PublicCaseRecord = {
    pathogen: string
    host: string
    year: string
    month?: Month
    state: string
    county: string
    fips: string
    positiveCount: number
    totalTestCount?: number
    positivityRate?: number
}

export type CountyMetric = PublicCaseRecord & {
    metricLabel: 'detections' | 'positivityRate'
    displayValue: number
}

export type PublicSurveillancePayload = {
    schema: 'surveillance-map-public-cases-v1'
    generatedAt: string
    privacy: string
    fields: Array<keyof PublicCaseRecord>
    recordCount: number
    cases: PublicCaseRecord[]
}

export type ExportFormat = 'csv' | 'json'
