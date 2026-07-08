import { type WorkbookRow, xlsxFileToRows } from '@/lib/xlsx-read'

import type { CaseInput } from '@workspace/shared'
import { normalizeMonth, normalizeResult } from '@workspace/shared'

type ParsedCaseImport = {
    records: Array<{
        rowNumber: number
        input: CaseInput
    }>
    preview: string
    warnings: string[]
}

const FIELD_ALIASES = {
    id: ['id', 'caseid', 'recordid'],
    accessionId: ['accessionid', 'accession', 'accessionnumber', 'sampleid'],
    pathogen: ['pathogen', 'disease', 'diseasename', 'agent', 'organism'],
    detectionDate: [
        'detectiondate',
        'dateofdetection',
        'date',
        'sampledate',
        'collectiondate',
    ],
    year: ['year'],
    month: ['month'],
    host: ['host', 'animalhostaffected', 'species', 'animal', 'animaltype'],
    city: ['city', 'town'],
    state: ['state', 'stateabbr', 'stateabbreviation'],
    zip: ['zip', 'zipcode', 'postalcode'],
    county: ['county', 'countyname'],
    fips: ['fips', 'countyfips', 'fipscode', 'countyfipscode'],
    rawLocation: ['rawlocation', 'location', 'address'],
    notes: ['notes', 'note', 'comments', 'comment'],
    result: ['result', 'status', 'testresult'],
    testCount: ['testcount', 'totaltests', 'tests', 'totaltestcount'],
} satisfies Record<keyof CaseImportFields, string[]>

type CaseImportFields = {
    id: string
    accessionId: string
    pathogen: string
    detectionDate: string
    year: string
    month: string
    host: string
    city: string
    state: string
    zip: string
    county: string
    fips: string
    rawLocation: string
    notes: string
    result: string
    testCount: string
}

export async function parseCaseWorkbook(file: File): Promise<ParsedCaseImport> {
    const rows = await xlsxFileToRows(file)
    if (rows.length === 0) {
        throw new Error('The workbook did not contain any data rows.')
    }

    const headers = Object.keys(rows[0] ?? {})
    const warnings: string[] = []
    const records = rows.map((row, index) => {
        const rowNumber = index + 2
        const input = rowToCaseInput(row, rowNumber, warnings)
        return { rowNumber, input }
    })

    return {
        records,
        preview: [
            `Workbook: ${file.name}`,
            `Detected columns: ${headers.join(', ') || 'none'}`,
            `Rows ready to import: ${records.length}`,
            '',
            JSON.stringify(
                records.slice(0, 5).map(record => record.input),
                null,
                2
            ),
        ].join('\n'),
        warnings,
    }
}

function rowToCaseInput(
    row: WorkbookRow,
    rowNumber: number,
    warnings: string[]
): CaseInput {
    const resultText = text(readField(row, 'result'))
    const result = resultText ? normalizeResult(resultText) : 'positive'
    if (resultText && !result) {
        warnings.push(
            `Row ${rowNumber}: result "${resultText}" is not positive, negative, or suspect.`
        )
    }

    return {
        id: text(readField(row, 'id')),
        accessionId: text(readField(row, 'accessionId')),
        pathogen: text(readField(row, 'pathogen')),
        detectionDate: dateText(readField(row, 'detectionDate')),
        year: text(readField(row, 'year')),
        month: normalizeMonth(readField(row, 'month')),
        host: text(readField(row, 'host')),
        city: text(readField(row, 'city')),
        state: text(readField(row, 'state')),
        zip: text(readField(row, 'zip')),
        county: text(readField(row, 'county')),
        fips: text(readField(row, 'fips')),
        rawLocation: text(readField(row, 'rawLocation')),
        notes: text(readField(row, 'notes')),
        result,
        testCount: numberValue(readField(row, 'testCount')),
    }
}

function readField(row: WorkbookRow, field: keyof CaseImportFields) {
    const aliases = FIELD_ALIASES[field]
    const entry = Object.entries(row).find(([header]) =>
        aliases.includes(normalizeHeader(header))
    )
    return entry?.[1]
}

function normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function text(value: unknown) {
    return String(value ?? '').trim()
}

function numberValue(value: unknown) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
}

function dateText(value: unknown) {
    if (typeof value === 'number' && value > 1) {
        return excelDateSerialToIso(value)
    }

    return text(value)
}

function excelDateSerialToIso(value: number) {
    const date = new Date(Date.UTC(1899, 11, 30 + Math.trunc(value)))
    return date.toISOString().slice(0, 10)
}
