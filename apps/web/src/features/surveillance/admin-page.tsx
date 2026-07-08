import { IS_PUBLIC_SITE_ONLY } from '@/config'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { downloadBlob, downloadText } from '@/lib/download'
import { rowsToXlsxBlob } from '@/lib/xlsx'

import { normalizeMonth } from '@workspace/shared'
import type {
    CaseInput,
    CaseResult,
    PrivateCaseRecord,
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
    createAdminCase,
    deleteAdminCase,
    getPublicCsvText,
    getPublicJsonText,
    getPublicPayload,
    listAdminCases,
    resetAdminCases,
    updateAdminCase,
} from './api'
import { parseCaseWorkbook } from './excel-import'

type CaseForm = {
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
    result: CaseResult
    testCount: string
}

const EMPTY_FORM: CaseForm = {
    accessionId: '',
    pathogen: '',
    detectionDate: '',
    year: '',
    month: '',
    host: '',
    city: '',
    state: 'OK',
    zip: '',
    county: '',
    fips: '',
    rawLocation: '',
    notes: '',
    result: 'positive',
    testCount: '',
}

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
    return IS_PUBLIC_SITE_ONLY ? <StaticAdminDisabled /> : <AdminEditor />
}

function AdminEditor() {
    const [query, setQuery] = useState('')
    const [preview, setPreview] = useState('')
    const [records, setRecords] = useState<PrivateCaseRecord[]>([])
    const [form, setForm] = useState<CaseForm>(EMPTY_FORM)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isImporting, setIsImporting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [importMessage, setImportMessage] = useState('')
    const importInputRef = useRef<HTMLInputElement | null>(null)

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

    const rows = useMemo(() => {
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

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsSaving(true)
        setError('')

        try {
            if (editingId) {
                await updateAdminCase(editingId, formToInput(form))
            } else {
                await createAdminCase(formToInput(form))
            }
            resetForm()
            await loadCases()
        } catch (nextError) {
            setError(readError(nextError))
        } finally {
            setIsSaving(false)
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
            if (editingId === id) {
                resetForm()
            }
        } catch (nextError) {
            setError(readError(nextError))
        }
    }

    async function handleResetSamples() {
        if (
            !globalThis.confirm(
                'Reset the SQLite database to the starter sample records?'
            )
        ) {
            return
        }

        setError('')
        try {
            const response = await resetAdminCases()
            setRecords(response.records)
            resetForm()
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
            resetForm()
        } catch (nextError) {
            setError(readError(nextError))
        }
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

    async function handlePreviewFile(file: File | undefined) {
        if (!file) {
            return
        }
        const text = await file.text()
        setPreview(text.slice(0, 5000))
    }

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
            if (importInputRef.current) {
                importInputRef.current.value = ''
            }
        }
    }

    return (
        <div className='space-y-5'>
            <Card>
                <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                    <div>
                        <CardTitle className='font-heading text-2xl'>
                            Admin database
                        </CardTitle>
                        <p className='mt-1 max-w-3xl text-sm text-muted-foreground'>
                            Private case rows are stored in local SQLite through
                            the API. The public map and export buttons use
                            sanitized county-level data only.
                        </p>
                    </div>
                    <Badge variant='secondary'>Private data surface</Badge>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {error ? (
                        <p className='rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                            {error}
                        </p>
                    ) : null}

                    <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
                        <Input
                            aria-label='Search admin records'
                            className='max-w-xl'
                            placeholder='Search pathogen, host, county, FIPS, accession ID...'
                            value={query}
                            onChange={event => setQuery(event.target.value)}
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
                            <Button
                                variant='outline'
                                onClick={handleResetSamples}
                            >
                                Reset samples
                            </Button>
                            <Button
                                variant='destructive'
                                onClick={handleClearAll}
                            >
                                Clear all
                            </Button>
                        </div>
                    </div>

                    <form
                        className='grid gap-3 rounded-2xl border p-3'
                        onSubmit={handleSubmit}
                    >
                        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                            <Field
                                label='Accession ID'
                                value={form.accessionId}
                                onChange={value =>
                                    updateForm('accessionId', value)
                                }
                            />
                            <Field
                                required
                                label='Pathogen'
                                value={form.pathogen}
                                onChange={value =>
                                    updateForm('pathogen', value)
                                }
                            />
                            <Field
                                label='Detection date'
                                type='date'
                                value={form.detectionDate}
                                onChange={value =>
                                    updateForm('detectionDate', value)
                                }
                            />
                            <Field
                                required
                                label='Year'
                                value={form.year}
                                onChange={value => updateForm('year', value)}
                            />
                            <Field
                                label='Month'
                                placeholder='01-12'
                                value={form.month}
                                onChange={value => updateForm('month', value)}
                            />
                            <Field
                                required
                                label='Host'
                                value={form.host}
                                onChange={value => updateForm('host', value)}
                            />
                            <Field
                                label='City'
                                value={form.city}
                                onChange={value => updateForm('city', value)}
                            />
                            <Field
                                required
                                label='State'
                                value={form.state}
                                onChange={value => updateForm('state', value)}
                            />
                            <Field
                                label='ZIP'
                                value={form.zip}
                                onChange={value => updateForm('zip', value)}
                            />
                            <Field
                                required
                                label='County'
                                value={form.county}
                                onChange={value => updateForm('county', value)}
                            />
                            <Field
                                required
                                label='County FIPS'
                                value={form.fips}
                                onChange={value => updateForm('fips', value)}
                            />
                            <Field
                                label='Total tests'
                                min='0'
                                type='number'
                                value={form.testCount}
                                onChange={value =>
                                    updateForm('testCount', value)
                                }
                            />
                        </div>

                        <div className='grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]'>
                            <label className='space-y-1 text-sm font-medium'>
                                <span>Result</span>
                                <select
                                    className='h-8 w-full rounded-2xl bg-input/50 px-2.5 text-sm ring-ring/30 outline-none focus-visible:ring-3'
                                    value={form.result}
                                    onChange={event =>
                                        updateForm('result', event.target.value)
                                    }
                                >
                                    <option value='positive'>Positive</option>
                                    <option value='negative'>Negative</option>
                                    <option value='suspect'>Suspect</option>
                                </select>
                            </label>
                            <Field
                                label='Raw location'
                                value={form.rawLocation}
                                onChange={value =>
                                    updateForm('rawLocation', value)
                                }
                            />
                            <Field
                                label='Notes'
                                value={form.notes}
                                onChange={value => updateForm('notes', value)}
                            />
                        </div>

                        <div className='flex flex-wrap gap-2'>
                            <Button type='submit' disabled={isSaving}>
                                {editingId ? 'Update case' : 'Create case'}
                            </Button>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={resetForm}
                            >
                                Clear form
                            </Button>
                        </div>
                    </form>

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
                                        <TableCell colSpan={8}>
                                            Loading cases...
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {!isLoading && rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8}>
                                            No case records found.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {rows.map(row => (
                                    <TableRow key={row.id}>
                                        <TableCell className='font-mono text-xs'>
                                            {row.accessionId || '—'}
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
                                                .join(', ') || '—'}
                                        </TableCell>
                                        <TableCell>
                                            {row.county}{' '}
                                            <span className='text-muted-foreground'>
                                                ({row.fips})
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {row.result};{' '}
                                            {row.testCount ?? 'unknown'} total
                                        </TableCell>
                                        <TableCell>
                                            <div className='flex gap-2'>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    onClick={() => editRow(row)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size='sm'
                                                    variant='destructive'
                                                    onClick={() =>
                                                        handleDelete(row.id)
                                                    }
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Import data</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
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
                            onChange={event =>
                                handleImportExcel(event.target.files?.[0])
                            }
                        />
                    </div>
                    <p className='text-sm text-muted-foreground'>
                        Excel import reads the first worksheet. Recommended
                        columns: Accession ID, Pathogen, Detection Date, Year,
                        Month, Host, City, State, ZIP, County, County FIPS,
                        Result, Total Tests, Raw Location, Notes.
                    </p>
                    {importMessage ? (
                        <pre className='max-h-40 overflow-auto rounded-xl bg-muted/50 p-3 text-xs whitespace-pre-wrap'>
                            {importMessage}
                        </pre>
                    ) : null}
                    <Input
                        type='file'
                        accept='.json,.csv,.txt'
                        onChange={event =>
                            handlePreviewFile(event.target.files?.[0])
                        }
                    />
                    <Textarea
                        readOnly
                        value={preview}
                        placeholder='Choose a JSON or CSV export to preview its first 5,000 characters before import validation.'
                        className='min-h-48 font-mono text-xs'
                    />
                </CardContent>
            </Card>
        </div>
    )

    function editRow(row: PrivateCaseRecord) {
        setEditingId(row.id)
        setForm(recordToForm(row))
    }

    function resetForm() {
        setEditingId(null)
        setForm(EMPTY_FORM)
    }

    function updateForm(key: keyof CaseForm, value: string) {
        setForm(current => ({
            ...current,
            [key]: value,
        }))
    }
}

function StaticAdminDisabled() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin disabled</CardTitle>
            </CardHeader>
            <CardContent>
                <p className='text-sm text-muted-foreground'>
                    This public static build only includes the county map and
                    sanitized public data. Use the local or university hosted
                    admin app to import and edit private records.
                </p>
            </CardContent>
        </Card>
    )
}

type FieldProps = {
    label: string
    value: string
    onChange: (value: string) => void
    min?: string
    placeholder?: string
    required?: boolean
    type?: string
}

function Field({
    label,
    min,
    onChange,
    placeholder,
    required,
    type = 'text',
    value,
}: FieldProps) {
    return (
        <label className='space-y-1 text-sm font-medium'>
            <span>
                {label}
                {required ? <span className='text-destructive'> *</span> : null}
            </span>
            <Input
                min={min}
                placeholder={placeholder}
                required={required}
                type={type}
                value={value}
                onChange={event => onChange(event.target.value)}
            />
        </label>
    )
}

function recordToForm(record: PrivateCaseRecord): CaseForm {
    return {
        accessionId: record.accessionId ?? '',
        pathogen: record.pathogen,
        detectionDate: record.detectionDate ?? '',
        year: record.year,
        month: record.month ?? '',
        host: record.host,
        city: record.city ?? '',
        state: record.state,
        zip: record.zip ?? '',
        county: record.county,
        fips: record.fips,
        rawLocation: record.rawLocation ?? '',
        notes: record.notes ?? '',
        result: record.result,
        testCount: record.testCount?.toString() ?? '',
    }
}

function formToInput(form: CaseForm): CaseInput {
    return {
        accessionId: form.accessionId,
        pathogen: form.pathogen,
        detectionDate: form.detectionDate,
        year: form.year,
        month: normalizeMonth(form.month),
        host: form.host,
        city: form.city,
        state: form.state,
        zip: form.zip,
        county: form.county,
        fips: form.fips,
        rawLocation: form.rawLocation,
        notes: form.notes,
        result: form.result,
        testCount: form.testCount ? Number(form.testCount) : undefined,
    }
}

function readError(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong.'
}
