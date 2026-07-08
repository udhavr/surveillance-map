import { useEffect, useMemo, useState } from 'react'

import { MetricCard } from '@/components/interfaces/metric-card'

import { type CountyMetric, countyMetrics } from '@workspace/shared'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'

import { getPublicPayload } from './api'
import { CountyMap, type CountyMapSummary } from './county-map'
import { oklahomaCountyPaths } from './data'

export function PublicMapPage() {
    const [allRows, setAllRows] = useState<CountyMetric[]>([])
    const [pathogen, setPathogen] = useState('all')
    const [host, setHost] = useState('all')
    const [selectedFips, setSelectedFips] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        void getPublicPayload()
            .then(payload => {
                if (isMounted) {
                    setAllRows(countyMetrics(payload.cases))
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

    const pathogens = useMemo(
        () => Array.from(new Set(allRows.map(row => row.pathogen))).sort(),
        [allRows]
    )
    const hosts = useMemo(
        () => Array.from(new Set(allRows.map(row => row.host))).sort(),
        [allRows]
    )

    const rows = useMemo(
        () =>
            allRows.filter(row => {
                if (pathogen !== 'all' && row.pathogen !== pathogen) {
                    return false
                }
                if (host !== 'all' && row.host !== host) {
                    return false
                }
                return true
            }),
        [allRows, host, pathogen]
    )

    const totalDetections = rows.reduce(
        (sum, row) => sum + row.positiveCount,
        0
    )
    const counties = new Set(rows.map(row => row.fips)).size
    const countySummaries = useMemo(() => summarizeCounties(rows), [rows])
    const maxValue = Math.max(
        1,
        ...Array.from(countySummaries.values()).map(row => row.displayValue)
    )
    const selectedCounty =
        selectedFips === null ? undefined : countySummaries.get(selectedFips)
    const selectedCountyName =
        selectedFips === null
            ? undefined
            : oklahomaCountyPaths.find(county => county.fips === selectedFips)
                  ?.name

    return (
        <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]'>
            <section className='space-y-4'>
                {error ? (
                    <p className='rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                        {error}
                    </p>
                ) : null}

                <div className='grid gap-3 sm:grid-cols-3'>
                    <MetricCard
                        label='Detections shown'
                        value={totalDetections}
                    />
                    <MetricCard label='Counties shown' value={counties} />
                    <MetricCard label='Public records' value={rows.length} />
                </div>

                <Card>
                    <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                        <div>
                            <CardTitle className='font-heading text-2xl'>
                                Public county map
                            </CardTitle>
                            <p className='mt-1 max-w-2xl text-sm text-muted-foreground'>
                                This static view reads sanitized county-level
                                data only. It should be labeled as detections
                                unless denominator data are available for every
                                county, pathogen, host, and time period.
                            </p>
                        </div>
                        <Badge variant='secondary'>
                            Static public artifact
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <div className='rounded-2xl border bg-muted/25 p-3'>
                            <CountyMap
                                maxValue={maxValue}
                                selectedFips={selectedFips}
                                summaries={countySummaries}
                                onSelect={setSelectedFips}
                            />
                        </div>
                        <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
                            <span className='inline-flex items-center gap-1.5'>
                                <span className='size-3 rounded-sm bg-muted ring-1 ring-border' />
                                No filtered detections
                            </span>
                            <span className='inline-flex items-center gap-1.5'>
                                <span className='size-3 rounded-sm bg-primary/35 ring-1 ring-border' />
                                Lower detections
                            </span>
                            <span className='inline-flex items-center gap-1.5'>
                                <span className='size-3 rounded-sm bg-primary ring-1 ring-border' />
                                Higher detections
                            </span>
                            <span>{oklahomaCountyPaths.length} counties</span>
                        </div>
                        {isLoading ? (
                            <p className='mt-3 text-sm text-muted-foreground'>
                                Loading public surveillance data...
                            </p>
                        ) : null}
                        {!isLoading && rows.length === 0 ? (
                            <p className='mt-3 text-sm text-muted-foreground'>
                                No public county records match the current
                                filters.
                            </p>
                        ) : null}
                    </CardContent>
                </Card>
            </section>

            <aside className='space-y-4'>
                <Card>
                    <CardHeader>
                        <CardTitle>Filters</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <FilterGroup
                            label='Pathogen'
                            value={pathogen}
                            values={['all', ...pathogens]}
                            onChange={setPathogen}
                        />
                        <FilterGroup
                            label='Host'
                            value={host}
                            values={['all', ...hosts]}
                            onChange={setHost}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Selected county</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        <div className='space-y-1'>
                            <div className='flex items-center justify-between gap-2'>
                                <strong>
                                    {selectedCountyName
                                        ? `${selectedCountyName} County`
                                        : 'No county selected'}
                                </strong>
                                {selectedFips ? (
                                    <Badge>{selectedFips}</Badge>
                                ) : null}
                            </div>
                            <p className='text-sm text-muted-foreground'>
                                {selectedCounty
                                    ? `${selectedCounty.positiveCount} positive detection${selectedCounty.positiveCount === 1 ? '' : 's'} across ${selectedCounty.recordCount} public record${selectedCounty.recordCount === 1 ? '' : 's'}.`
                                    : selectedCountyName
                                      ? 'No public records match the current filters for this county.'
                                      : 'Select a county on the map to inspect its filtered public records.'}
                            </p>
                        </div>
                        <Separator />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>County details</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {rows.map(row => (
                            <div
                                key={`${row.fips}-${row.pathogen}-${row.host}`}
                                className='space-y-1'
                            >
                                <div className='flex items-center justify-between gap-2'>
                                    <strong>
                                        {row.county}, {row.state}
                                    </strong>
                                    <Badge>{row.fips}</Badge>
                                </div>
                                <p className='text-sm text-muted-foreground'>
                                    {row.pathogen} in {row.host}:{' '}
                                    {row.positiveCount} positive test
                                    {row.positiveCount === 1 ? '' : 's'}
                                    {row.totalTestCount
                                        ? ` from ${row.totalTestCount} total tests`
                                        : ''}
                                    .
                                </p>
                                <Separator />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </aside>
        </div>
    )
}

function summarizeCounties(rows: CountyMetric[]) {
    const summaries = new Map<string, CountyMapSummary>()

    for (const row of rows) {
        const current = summaries.get(row.fips)
        summaries.set(row.fips, {
            county: row.county,
            displayValue:
                (current?.displayValue ?? 0) + Math.max(0, row.positiveCount),
            fips: row.fips,
            positiveCount:
                (current?.positiveCount ?? 0) + Math.max(0, row.positiveCount),
            recordCount: (current?.recordCount ?? 0) + 1,
            state: row.state,
            totalTestCount:
                current?.totalTestCount === undefined &&
                row.totalTestCount === undefined
                    ? undefined
                    : (current?.totalTestCount ?? 0) +
                      (row.totalTestCount ?? 0),
        })
    }

    return summaries
}

type FilterGroupProps = {
    label: string
    value: string
    values: string[]
    onChange: (value: string) => void
}

function FilterGroup({ label, value, values, onChange }: FilterGroupProps) {
    return (
        <div className='space-y-2'>
            <p className='text-sm font-medium'>{label}</p>
            <div className='flex flex-wrap gap-2'>
                {values.map(nextValue => (
                    <Button
                        key={nextValue}
                        size='sm'
                        variant={value === nextValue ? 'default' : 'outline'}
                        onClick={() => onChange(nextValue)}
                    >
                        {nextValue === 'all' ? 'All' : nextValue}
                    </Button>
                ))}
            </div>
        </div>
    )
}

function readError(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong.'
}
