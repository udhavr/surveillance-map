import type { CaseResult, Month, PrivateCaseRecord } from './types'

const MONTH_PATTERN = /^(0[1-9]|1[0-2])$/
const CASE_RESULTS = new Set<CaseResult>(['positive', 'negative', 'suspect'])

export function clean(value: unknown) {
    return String(value ?? '').trim()
}

export function normalizeFips(value: unknown) {
    const digits = clean(value).replace(/\D/g, '')
    return digits ? digits.padStart(5, '0').slice(-5) : ''
}

export function normalizeMonth(value: unknown): Month | undefined {
    const text = clean(value)
    if (!text) {
        return undefined
    }

    const digits =
        text.match(/^\d{4}-(\d{1,2})/)?.[1] ?? text.match(/\d{1,2}/)?.[0]
    if (!digits) {
        return undefined
    }

    const month = digits.padStart(2, '0')
    return MONTH_PATTERN.test(month) ? (month as Month) : undefined
}

export function normalizeZip(value: unknown) {
    const text = clean(value)
    const match = text.match(/\d{5}(?:-?\d{4})?/)
    if (!match) {
        return ''
    }

    const digits = match[0].replace(/\D/g, '')
    return digits.length > 5
        ? `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
        : digits
}

export function normalizeState(value: unknown) {
    return clean(value).toUpperCase()
}

export function normalizeResult(value: unknown): CaseResult | undefined {
    const result = clean(value).toLowerCase()
    return CASE_RESULTS.has(result as CaseResult)
        ? (result as CaseResult)
        : undefined
}

export function getRecordYear(dateOrYear: unknown) {
    const text = clean(dateOrYear)
    const year = text.match(/\b(19|20|21)\d{2}\b/)?.[0]
    return year ?? ''
}

export function titleCase(value: unknown) {
    return clean(value)
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(
            /\bMc([a-z])/g,
            (_match, char: string) => `Mc${char.toUpperCase()}`
        )
}

export type CaseInput = Partial<PrivateCaseRecord> & {
    id?: string
}

export type CaseValidationResult =
    | {
          ok: true
          record: PrivateCaseRecord
      }
    | {
          ok: false
          errors: string[]
      }

export function normalizePrivateCaseRecord(
    input: CaseInput,
    fallbackId = cryptoRandomId()
): CaseValidationResult {
    const detectionDate = clean(input.detectionDate)
    const year = getRecordYear(detectionDate) || getRecordYear(input.year)
    const month = normalizeMonth(detectionDate) ?? normalizeMonth(input.month)
    const result = normalizeResult(input.result)
    const testCount = normalizeTestCount(input.testCount)

    const record: PrivateCaseRecord = {
        id: clean(input.id) || fallbackId,
        pathogen: clean(input.pathogen),
        year,
        host: titleCase(input.host),
        state: normalizeState(input.state),
        county: titleCase(input.county),
        fips: normalizeFips(input.fips),
        result: result ?? 'positive',
    }

    assignOptional(record, 'accessionId', clean(input.accessionId))
    assignOptional(record, 'detectionDate', detectionDate)
    if (month) {
        record.month = month
    }
    assignOptional(record, 'city', titleCase(input.city))
    assignOptional(record, 'zip', normalizeZip(input.zip))
    assignOptional(record, 'rawLocation', clean(input.rawLocation))
    assignOptional(record, 'notes', clean(input.notes))
    if (testCount !== undefined) {
        record.testCount = testCount
    }
    assignOptional(record, 'createdAt', clean(input.createdAt))
    assignOptional(record, 'updatedAt', clean(input.updatedAt))

    const errors = validatePrivateCaseRecord(record, input.result)
    return errors.length ? { ok: false, errors } : { ok: true, record }
}

export function validatePrivateCaseRecord(
    record: PrivateCaseRecord,
    rawResult: unknown = record.result
) {
    const errors: string[] = []
    if (!clean(record.pathogen)) {
        errors.push('Pathogen is required.')
    }
    if (!getRecordYear(record.year)) {
        errors.push('Year is required.')
    }
    if (!clean(record.host)) {
        errors.push('Host is required.')
    }
    if (!clean(record.state)) {
        errors.push('State is required.')
    }
    if (!clean(record.county)) {
        errors.push('County is required.')
    }
    if (normalizeFips(record.fips).length !== 5) {
        errors.push('County FIPS must be 5 digits.')
    }
    if (!normalizeResult(rawResult)) {
        errors.push('Result must be positive, negative, or suspect.')
    }
    if (record.testCount !== undefined && record.testCount < 0) {
        errors.push('Test count cannot be negative.')
    }
    return errors
}

export function cryptoRandomId() {
    const random = globalThis.crypto?.randomUUID?.()
    if (random) {
        return random
    }
    return `case-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function assignOptional<T extends keyof PrivateCaseRecord>(
    record: PrivateCaseRecord,
    key: T,
    value: PrivateCaseRecord[T] | ''
) {
    if (value !== '') {
        record[key] = value as PrivateCaseRecord[T]
    }
}

function normalizeTestCount(value: unknown) {
    const text = clean(value)
    if (!text) {
        return undefined
    }

    const count = Number(text)
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : undefined
}
