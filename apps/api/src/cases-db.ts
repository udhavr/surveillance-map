import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import {
    type CaseInput,
    type Month,
    type PrivateCaseRecord,
    normalizePrivateCaseRecord,
} from '@workspace/shared'

export type CaseRepository = {
    close: () => void
    clear: () => void
    create: (
        input: CaseInput
    ) =>
        | { ok: true; record: PrivateCaseRecord }
        | { ok: false; errors: string[] }
    delete: (id: string) => boolean
    list: () => PrivateCaseRecord[]
    update: (
        id: string,
        input: CaseInput
    ) =>
        | { ok: true; record: PrivateCaseRecord }
        | { ok: false; errors: string[] }
        | { ok: false; notFound: true }
}

type CaseRow = {
    id: string
    accessionId: string | null
    pathogen: string
    detectionDate: string | null
    year: string
    month: Month | null
    host: string
    city: string | null
    state: string
    zip: string | null
    county: string
    fips: string
    rawLocation: string | null
    notes: string | null
    result: PrivateCaseRecord['result']
    testCount: number | null
    createdAt: string
    updatedAt: string
}

const DEFAULT_DATABASE_PATH = fileURLToPath(
    new URL('../../../data/surveillance-map.sqlite', import.meta.url)
)

const CASE_COLUMNS = [
    'id',
    'accessionId',
    'pathogen',
    'detectionDate',
    'year',
    'month',
    'host',
    'city',
    'state',
    'zip',
    'county',
    'fips',
    'rawLocation',
    'notes',
    'result',
    'testCount',
    'createdAt',
    'updatedAt',
] as const

export function createCaseRepository(
    databasePath = process.env.SQLITE_DATABASE_PATH ?? DEFAULT_DATABASE_PATH
): CaseRepository {
    if (databasePath !== ':memory:') {
        mkdirSync(dirname(databasePath), { recursive: true })
    }

    const db = new DatabaseSync(databasePath)
    db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            accessionId TEXT,
            pathogen TEXT NOT NULL,
            detectionDate TEXT,
            year TEXT NOT NULL,
            month TEXT,
            host TEXT NOT NULL,
            city TEXT,
            state TEXT NOT NULL,
            zip TEXT,
            county TEXT NOT NULL,
            fips TEXT NOT NULL,
            rawLocation TEXT,
            notes TEXT,
            result TEXT NOT NULL CHECK (result IN ('positive', 'negative', 'suspect')),
            testCount INTEGER,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS cases_public_lookup_idx
            ON cases (fips, pathogen, host, year, month);
    `)

    const repository: CaseRepository = {
        close() {
            db.close()
        },
        clear() {
            db.prepare('DELETE FROM cases').run()
        },
        create(input: CaseInput) {
            const now = new Date().toISOString()
            const normalized = normalizePrivateCaseRecord({
                ...input,
                createdAt: input.createdAt ?? now,
                updatedAt: now,
            })
            if (!normalized.ok) {
                return normalized
            }

            insertRecord(db, normalized.record)
            return normalized
        },
        delete(id: string) {
            const result = db.prepare('DELETE FROM cases WHERE id = ?').run(id)
            return result.changes > 0
        },
        list() {
            return db
                .prepare(
                    `SELECT ${CASE_COLUMNS.join(', ')}
                     FROM cases
                     ORDER BY year DESC, month DESC, county ASC, pathogen ASC`
                )
                .all()
                .map(row => rowToCase(row as CaseRow))
        },
        update(id: string, input: CaseInput) {
            const existing = db
                .prepare(
                    `SELECT ${CASE_COLUMNS.join(', ')} FROM cases WHERE id = ?`
                )
                .get(id) as CaseRow | undefined
            if (!existing) {
                return { ok: false as const, notFound: true as const }
            }

            const current = rowToCase(existing)
            const normalized = normalizePrivateCaseRecord({
                ...current,
                ...input,
                id,
                createdAt: current.createdAt,
                updatedAt: new Date().toISOString(),
            })
            if (!normalized.ok) {
                return normalized
            }

            updateRecord(db, normalized.record)
            return normalized
        },
    }

    return repository
}

function insertRecord(db: DatabaseSync, record: PrivateCaseRecord) {
    db.prepare(
        `INSERT INTO cases (${CASE_COLUMNS.join(', ')})
         VALUES (${CASE_COLUMNS.map(() => '?').join(', ')})`
    ).run(...recordValues(record))
}

function updateRecord(db: DatabaseSync, record: PrivateCaseRecord) {
    const assignments = CASE_COLUMNS.filter(column => column !== 'id')
        .map(column => `${column} = ?`)
        .join(', ')

    db.prepare(`UPDATE cases SET ${assignments} WHERE id = ?`).run(
        ...recordValues(record).slice(1),
        record.id
    )
}

function recordValues(record: PrivateCaseRecord) {
    return CASE_COLUMNS.map(column => record[column] ?? null)
}

function rowToCase(row: CaseRow): PrivateCaseRecord {
    const record: PrivateCaseRecord = {
        id: row.id,
        pathogen: row.pathogen,
        year: row.year,
        host: row.host,
        state: row.state,
        county: row.county,
        fips: row.fips,
        result: row.result,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }

    assignOptional(record, 'accessionId', row.accessionId)
    assignOptional(record, 'detectionDate', row.detectionDate)
    assignOptional(record, 'month', row.month)
    assignOptional(record, 'city', row.city)
    assignOptional(record, 'zip', row.zip)
    assignOptional(record, 'rawLocation', row.rawLocation)
    assignOptional(record, 'notes', row.notes)
    if (row.testCount !== null) {
        record.testCount = row.testCount
    }

    return record
}

function assignOptional<T extends keyof PrivateCaseRecord>(
    record: PrivateCaseRecord,
    key: T,
    value: PrivateCaseRecord[T] | null
) {
    if (value !== null) {
        record[key] = value as PrivateCaseRecord[T]
    }
}
