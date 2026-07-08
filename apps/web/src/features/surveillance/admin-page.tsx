import { IS_PUBLIC_SITE_ONLY } from '@/config'
import { useEffect, useMemo, useRef, useState } from 'react'

import { downloadBlob, downloadText } from '@/lib/download'
import { rowsToXlsxBlob } from '@/lib/xlsx'

import {
    type PrivateCaseRecord,
    type PublicSurveillancePayload,
    normalizePrivateCaseRecord,
    publicPayload,
} from '@workspace/shared'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@workspace/ui/components/table'
import { Textarea } from '@workspace/ui/components/textarea'

import {
    clearAdminCases,
    clearStaticPublicPayload,
    createAdminCase,
    deleteAdminCase,
    getPublicCsvText,
    getPublicJsonText,
    getPublicPayload,
    listAdminCases,
    saveStaticPublicPayload,
} from './api'
import { parseCaseWorkbook } from './excel-import'

const XLSX_HEADERS = [
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

export function AdminPage() {
    return IS_PUBLIC_SITE_ONLY ? <StaticExcelAdmin /> : <ApiExcelAdmin />
}

function ApiExcelAdmin() {
    const [query, setQuery] = useState('')
    const [preview, setPreview] = useState('')
    const [records, setRecords] = useState<PrivateCaseRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isImporting, setIsImporting] = useState(false)
    const [error, setError] = useState('')
    const [importMessage, setImportMessage] = useState('')

    async function loadCases() {
        setIsLoading(true)
        setError('')
        try {
            const response = await listAdminCases()
            setRecords(response.records)
        } catch (nextError) {
            setError(readError(nextError))
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        let isMounted = true

        void listAdminCases()
            .then(response => {
                if (isMounted) {
                    setRecords(response.records)
                }
            })
            .catch(nextError => {
                if (isMounted) {
                    setError(readError(nextError))
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [])

    const rows = useFilteredRecords(records, query)

    async function handleImportExcel(file: File | undefined) {
        if (!file) {
            return
        }

        setIsImporting(true)
        setError('')
        setImportMessage('')

        try {
            const parsed = await parseCaseWorkbook(file)
            const failures: string[] = []
            let imported = 0

            setPreview(parsed.preview)

            for (const record of parsed.records) {
                try {
                    await createAdminCase(record.input)
                    imported += 1
                } catch (nextError) {
                    failures.push(
                        `Row ${record.rowNumber}: ${readError(nextError)}`
                    )
                }
            }

            await loadCases()
            setImportMessage(
                [
                    `Imported ${imported} of ${parsed.records.length} Excel rows.`,
                    ...parsed.warnings,
                    ...failures,
                ].join('\n')
            )

            if (failures.length > 0) {
                setError(
                    `Excel import finished with ${failures.length} row error${
                        failures.length === 1 ? '' : 's'
                    }.`
                )
            }
        } catch (nextError) {
            setError(readError(nextError))
        } finally {
            setIsImporting(false)
        }
    }

    async function handleDelete(id: string) {
        if (!globalThis.confirm('Delete this private case record?')) {
            return
        }

        setError('')
        try {
            await deleteAdminCase(id)
            setRecords(current => current.filter(record => record.id !== id))
        } catch (nextError) {
            setError(readError(nextError))
        }
    }

    async function handleClearAll() {
        if (!globalThis.confirm('Clear every private case record?')) {
            return
        }

        setError('')
        try {
            await clearAdminCases()
            setRecords([])
            setImportMessage('All imported records were cleared.')
        } catch (nextError) {
            setError(readError(nextError))
        }
    }

    return (
        <AdminLayout
            error={error}
            importMessage={importMessage}
            isImporting={isImporting}
            preview={preview}
            query={query}
            records={rows}
            isLoading={isLoading}
            recordCount={records.length}
            onClearAll={handleClearAll}
            onDelete={handleDelete}
            onImportExcel={handleImportExcel}
            onPreview={setPreview}
            onQueryChange={setQuery}
        />
    )
}

function StaticExcelAdmin() {
    const [payload, setPayload] = useState<PublicSurveillancePayload>()
    const [preview, setPreview] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const [error, setError] = useState('')
    const [importMessage, setImportMessage] = useState('')

    useEffect(() => {
        let isMounted = true
        void getPublicPayload()
            .then(nextPayload => {
                if (isMounted) {
                    setPayload(nextPayload)
                }
            })
            .catch(nextError => {
                if (isMounted) {
                    setError(readError(nextError))
                }
            })

        return () => {
            isMounted = false
        }
    }, [])

    async function handleImportExcel(file: File | undefined) {
        if (!file) {
            return
        }

        setIsImporting(true)
        setError('')
        setImportMessage('')

        try {
            const parsed = await parseCaseWorkbook(file)
            const records: PrivateCaseRecord[] = []
            const failures: string[] = []

            for (const record of parsed.records) {
                const normalized = normalizePrivateCaseRecord(record.input)
                if (normalized.ok) {
                    records.push(normalized.record)
                } else {
                    failures.push(
                        `Row ${record.rowNumber}: ${normalized.errors.join(' ')}`
                    )
                }
            }

            const nextPayload = publicPayload(records)
            saveStaticPublicPayload(nextPayload)
            setPayload(nextPayload)
            setPreview(parsed.preview)
            setImportMessage(
                [
                    `Loaded ${records.length} of ${parsed.records.length} Excel rows into this browser as sanitized public map data.`,
                    'No private row-level data was saved to GitHub Pages.',
                    ...parsed.warnings,
                    ...failures,
                ].join('\n')
            )

            if (failures.length > 0) {
                setError(
                    `Excel import finished with ${failures.length} row error${
                        failures.length === 1 ? '' : 's'
                    }.`
                )
            }
        } catch (nextError) {
            setError(readError(nextError))
        } finally {
            setIsImporting(false)
        }
    }

    function handleClearAll() {
        clearStaticPublicPayload()
        setPayload(undefined)
        setImportMessage('Local browser map data was cleared.')
    }

    return (
        <div className='space-y-5'>
            <Card>
                <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                    <div>
                        <CardTitle className='font-heading text-2xl'>
                            Admin Excel import
                        </CardTitle>
                        <p className='mt-1 max-w-3xl text-sm text-muted-foreground'>
                            Upload an Excel workbook to populate the public map
                            in this browser. The static GitHub Pages app does
                            not store private case rows or write back to GitHub.
                        </p>
                    </div>
                    <Badge variant='secondary'>Static browser mode</Badge>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <StatusMessage error={error} message={importMessage} />
                    <ImportControls
                        isImporting={isImporting}
                        onImportExcel={handleImportExcel}
                    />
                    <div className='flex flex-wrap gap-2'>
                        <Button variant='outline' onClick={handleJsonExport}>
                            Export JSON
                        </Button>
                        <Button variant='outline' onClick={handleCsvExport}>
                            Export CSV
                        </Button>
                        <Button variant='outline' onClick={handleXlsxExport}>
                            Export XLSX
                        </Button>
                        <Button variant='destructive' onClick={handleClearAll}>
                            Clear local data
                        </Button>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                        Current public records:{' '}
                        <strong>{payload?.recordCount ?? 0}</strong>
                    </p>
                    <Textarea
                        readOnly
                        value={preview}
                        placeholder='Upload an Excel file to preview detected columns and the first parsed rows.'
                        className='min-h-48 font-mono text-xs'
                    />
                </CardContent>
            </Card>
        </div>
    )
}

type AdminLayoutProps = {
    error: string
    importMessage: string
    isImporting: boolean
    isLoading: boolean
    preview: string
    query: string
    recordCount: number
    records: PrivateCaseRecord[]
    onClearAll: () => void
    onDelete: (id: string) => void
    onImportExcel: (file: File | undefined) => void
    onPreview: (preview: string) => void
    onQueryChange: (query: string) => void
}

function AdminLayout({
    error,
    importMessage,
    isImporting,
    isLoading,
    onClearAll,
    onDelete,
    onImportExcel,
    onPreview,
    onQueryChange,
    preview,
    query,
    recordCount,
    records,
}: AdminLayoutProps) {
    return (
        <div className='space-y-5'>
            <Card>
                <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                    <div>
                        <CardTitle className='font-heading text-2xl'>
                            Admin database
                        </CardTitle>
                        <p className='mt-1 max-w-3xl text-sm text-muted-foreground'>
                            Upload an Excel workbook to add private case rows to
                            the local SQLite database. Until a workbook is
                            imported, the map has no data.
                        </p>
                    </div>
                    <Badge variant='secondary'>Private data surface</Badge>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <StatusMessage error={error} message={importMessage} />
                    <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
                        <Input
                            aria-label='Search admin records'
                            className='max-w-xl'
                            placeholder='Search pathogen, host, county, FIPS, accession ID...'
                            value={query}
                            onChange={event =>
                                onQueryChange(event.target.value)
                            }
                        />
                        <div className='flex flex-wrap gap-2'>
                            <Button
                                variant='outline'
                                onClick={handleJsonExport}
                            >
                                Export JSON
                            </Button>
                            <Button variant='outline' onClick={handleCsvExport}>
                                Export CSV
                            </Button>
                            <Button
                                variant='outline'
                                onClick={handleXlsxExport}
                            >
                                Export XLSX
                            </Button>
                            <Button variant='destructive' onClick={onClearAll}>
                                Clear all
                            </Button>
                        </div>
                    </div>
                    <ImportControls
                        isImporting={isImporting}
                        onImportExcel={onImportExcel}
                    />
                    <p className='text-sm text-muted-foreground'>
                        Imported private records: <strong>{recordCount}</strong>
                    </p>
                    <CaseTable
                        isLoading={isLoading}
                        records={records}
                        onDelete={onDelete}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Import preview</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <Input
                        type='file'
                        accept='.json,.csv,.txt'
                        onChange={event =>
                            handlePreviewFile(
                                event.target.files?.[0],
                                onPreview
                            )
                        }
                    />
                    <Textarea
                        readOnly
                        value={preview}
                        placeholder='Upload an Excel workbook to preview detected columns and the first parsed rows. JSON/CSV/TXT files can still be previewed here for inspection.'
                        className='min-h-48 font-mono text-xs'
                    />
                </CardContent>
            </Card>
        </div>
    )
}

type ImportControlsProps = {
    isImporting: boolean
    onImportExcel: (file: File | undefined) => void
}

function ImportControls({ isImporting, onImportExcel }: ImportControlsProps) {
    const importInputRef = useRef<HTMLInputElement | null>(null)

    return (
        <div className='space-y-3 rounded-2xl border p-3'>
            <div className='flex flex-wrap gap-2'>
                <Button
                    type='button'
                    disabled={isImporting}
                    onClick={() => importInputRef.current?.click()}
                >
                    {isImporting ? 'Importing...' : 'Import Excel'}
                </Button>
                <Input
                    ref={importInputRef}
                    className='hidden'
                    type='file'
                    accept='.xlsx,.xlsm'
                    onChange={event => {
                        onImportExcel(event.target.files?.[0])
                        event.currentTarget.value = ''
                    }}
                />
            </div>
            <p className='text-sm text-muted-foreground'>
                Excel import reads the first worksheet. Recommended columns:
                Accession ID, Pathogen, Detection Date, Year, Month, Host, City,
                State, ZIP, County, County FIPS, Result, Total Tests, Raw
                Location, Notes.
            </p>
        </div>
    )
}

type CaseTableProps = {
    isLoading: boolean
    records: PrivateCaseRecord[]
    onDelete: (id: string) => void
}

function CaseTable({ isLoading, onDelete, records }: CaseTableProps) {
    return (
        <div className='overflow-hidden rounded-2xl border'>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Accession</TableHead>
                        <TableHead>Pathogen</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Private location</TableHead>
                        <TableHead>County FIPS</TableHead>
                        <TableHead>Tests</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={8}>Loading cases...</TableCell>
                        </TableRow>
                    ) : null}
                    {!isLoading && records.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8}>
                                No data yet. Import an Excel workbook to
                                populate the map.
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {records.map(row => (
                        <TableRow key={row.id}>
                            <TableCell className='font-mono text-xs'>
                                {row.accessionId || '-'}
                            </TableCell>
                            <TableCell className='font-medium'>
                                {row.pathogen}
                            </TableCell>
                            <TableCell>{row.host}</TableCell>
                            <TableCell>
                                {row.year}
                                {row.month ? `-${row.month}` : ''}
                            </TableCell>
                            <TableCell>
                                {[row.city, row.state, row.zip]
                                    .filter(Boolean)
                                    .join(', ') || '-'}
                            </TableCell>
                            <TableCell>
                                {row.county}{' '}
                                <span className='text-muted-foreground'>
                                    ({row.fips})
                                </span>
                            </TableCell>
                            <TableCell>
                                {row.result}; {row.testCount ?? 'unknown'} total
                            </TableCell>
                            <TableCell>
                                <Button
                                    size='sm'
                                    variant='destructive'
                                    onClick={() => onDelete(row.id)}
                                >
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function StatusMessage({ error, message }: { error: string; message: string }) {
    return (
        <>
            {error ? (
                <p className='rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                    {error}
                </p>
            ) : null}
            {message ? (
                <pre className='max-h-40 overflow-auto rounded-xl bg-muted/50 p-3 text-xs whitespace-pre-wrap'>
                    {message}
                </pre>
            ) : null}
        </>
    )
}

function useFilteredRecords(records: PrivateCaseRecord[], query: string) {
    return useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) {
            return records
        }

        return records.filter(row =>
            [
                row.accessionId,
                row.pathogen,
                row.host,
                row.city,
                row.state,
                row.zip,
                row.county,
                row.fips,
                row.notes,
            ]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery)
        )
    }, [query, records])
}

async function handlePreviewFile(
    file: File | undefined,
    onPreview: (preview: string) => void
) {
    if (!file) {
        return
    }
    const text = await file.text()
    onPreview(text.slice(0, 5000))
}

async function handleJsonExport() {
    downloadText(
        'public_cases.json',
        await getPublicJsonText(),
        'application/json'
    )
}

async function handleCsvExport() {
    downloadText('public_cases.csv', await getPublicCsvText(), 'text/csv')
}

async function handleXlsxExport() {
    const payload = await getPublicPayload()
    downloadBlob(
        'public_cases.xlsx',
        rowsToXlsxBlob('Public cases', XLSX_HEADERS, payload.cases)
    )
}

function readError(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong.'
}
