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
import { Input } from '@workspace/ui/components/input'

import { getPublicPayload } from './api'
import {
    CountyMap,
    type CountyMapSummary,
    type FocusMode,
    countyNameForFips,
} from './county-map'
import {
    REGIONAL_STATE_ABBRS,
    STATE_ABBR_TO_NAME,
    normalizeStateAbbr,
} from './us-map-data'

type ColorMode = 'cases' | 'diseases' | 'hosts'
type YearMode = 'year-cumulative' | 'year-exact'
type MonthMode = 'month-cumulative' | 'month-exact'

const MONTHS = [
    ['01', 'Jan'],
    ['02', 'Feb'],
    ['03', 'Mar'],
    ['04', 'Apr'],
    ['05', 'May'],
    ['06', 'Jun'],
    ['07', 'Jul'],
    ['08', 'Aug'],
    ['09', 'Sep'],
    ['10', 'Oct'],
    ['11', 'Nov'],
    ['12', 'Dec'],
] as const

const selectClass =
    'h-8 rounded-2xl border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'

export function PublicMapPage() {
    const [allRows, setAllRows] = useState<CountyMetric[]>([])
    const [pathogen, setPathogen] = useState('all')
    const [host, setHost] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedStates, setSelectedStates] = useState(REGIONAL_STATE_ABBRS)
    const [focusMode, setFocusMode] = useState<FocusMode>('selectedStates')
    const [colorMode, setColorMode] = useState<ColorMode>('cases')
    const [selectedFips, setSelectedFips] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [timeEnabled, setTimeEnabled] = useState(true)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(12)
    const [yearMode, setYearMode] = useState<YearMode>('year-cumulative')
    const [monthMode, setMonthMode] = useState<MonthMode>('month-cumulative')
    const [includeUnknownTime, setIncludeUnknownTime] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        let isMounted = true

        void getPublicPayload()
            .then(payload => {
                if (!isMounted) {
                    return
                }

                const rows = countyMetrics(payload.cases)
                const states = uniqueSorted(rows.map(row => row.state))
                setAllRows(rows)
                setSelectedStates(
                    uniqueSorted([...REGIONAL_STATE_ABBRS, ...states])
                )

                const years = validYears(rows)
                if (years.length) {
                    setSelectedYear(years[years.length - 1])
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

    const yearOptions = useMemo(() => validYears(allRows), [allRows])
    const minYear = yearOptions[0] ?? selectedYear
    const maxYear = yearOptions[yearOptions.length - 1] ?? selectedYear

    useEffect(() => {
        if (!isPlaying || !timeEnabled || !yearOptions.length) {
            return undefined
        }

        const timer = globalThis.setInterval(() => {
            setSelectedMonth(currentMonth => {
                if (currentMonth < 12) {
                    return currentMonth + 1
                }

                setSelectedYear(currentYear =>
                    currentYear >= maxYear ? minYear : currentYear + 1
                )
                return 1
            })
        }, 900)

        return () => globalThis.clearInterval(timer)
    }, [isPlaying, maxYear, minYear, timeEnabled, yearOptions.length])

    const pathogens = useMemo(
        () => uniqueSorted(allRows.map(row => row.pathogen)),
        [allRows]
    )
    const hosts = useMemo(
        () => uniqueSorted(allRows.map(row => row.host)),
        [allRows]
    )
    const availableStates = useMemo(
        () =>
            uniqueSorted([
                ...REGIONAL_STATE_ABBRS,
                ...allRows.map(row => row.state),
            ]),
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
                if (
                    selectedStates.length > 0 &&
                    !selectedStates.includes(row.state)
                ) {
                    return false
                }
                if (
                    !matchesTime(row, {
                        includeUnknownTime,
                        monthMode,
                        selectedMonth,
                        selectedYear,
                        timeEnabled,
                        yearMode,
                    })
                ) {
                    return false
                }
                if (search.trim()) {
                    const query = search.trim().toLowerCase()
                    const blob = [
                        row.pathogen,
                        row.host,
                        row.year,
                        row.month,
                        row.state,
                        row.county,
                        row.fips,
                    ]
                        .join(' ')
                        .toLowerCase()
                    if (!blob.includes(query)) {
                        return false
                    }
                }
                return true
            }),
        [
            allRows,
            host,
            includeUnknownTime,
            monthMode,
            pathogen,
            search,
            selectedMonth,
            selectedStates,
            selectedYear,
            timeEnabled,
            yearMode,
        ]
    )

    const totalDetections = rows.reduce(
        (sum, row) => sum + Math.max(0, row.positiveCount),
        0
    )
    const countyCount = new Set(rows.map(row => row.fips).filter(Boolean)).size
    const pathogenCount = new Set(rows.map(row => row.pathogen).filter(Boolean))
        .size
    const hostCount = new Set(rows.map(row => row.host).filter(Boolean)).size
    const countySummaries = useMemo(
        () => summarizeCounties(rows, colorMode),
        [colorMode, rows]
    )
    const maxValue = Math.max(
        1,
        ...Array.from(countySummaries.values()).map(row => row.displayValue)
    )
    const selectedCounty =
        selectedFips === null ? undefined : countySummaries.get(selectedFips)
    const selectedCountyName =
        selectedFips === null ? '' : countyNameForFips(selectedFips)
    const dataStates = uniqueSorted(
        rows.map(row => normalizeStateAbbr(row.state))
    )
    const colorLabel = colorModeLabel(colorMode)
    const timePhrase = describeTime(
        timeEnabled,
        selectedYear,
        selectedMonth,
        yearMode,
        monthMode
    )

    function resetToLatest() {
        if (yearOptions.length) {
            setSelectedYear(maxYear)
        }
        setSelectedMonth(12)
    }

    function clearFilters() {
        setPathogen('all')
        setHost('all')
        setSearch('')
        setSelectedStates(availableStates)
        setFocusMode('selectedStates')
        setColorMode('cases')
        setTimeEnabled(Boolean(yearOptions.length))
        setYearMode('year-cumulative')
        setMonthMode('month-cumulative')
        setIncludeUnknownTime(true)
        setIsPlaying(false)
        resetToLatest()
    }

    return (
        <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]'>
            <section className='space-y-4'>
                {error ? (
                    <p className='rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                        {error}
                    </p>
                ) : null}

                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    <MetricCard
                        label='Filtered detections'
                        value={totalDetections}
                    />
                    <MetricCard
                        label='Counties with data'
                        value={countyCount}
                    />
                    <MetricCard label='Pathogens' value={pathogenCount} />
                    <MetricCard label='Hosts' value={hostCount} />
                </div>

                <Card>
                    <CardHeader className='space-y-4'>
                        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                            <div>
                                <CardTitle className='font-heading text-2xl'>
                                    County map
                                </CardTitle>
                                <p className='mt-1 max-w-3xl text-sm text-muted-foreground'>
                                    Showing {totalDetections} filtered detection
                                    {totalDetections === 1
                                        ? ''
                                        : 's'} across {countyCount} mappable
                                    count
                                    {countyCount === 1 ? 'y' : 'ies'}{' '}
                                    {timePhrase}.
                                </p>
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={() => globalThis.print()}
                                >
                                    Print map
                                </Button>
                                <Badge variant='secondary'>
                                    Static public artifact
                                </Badge>
                            </div>
                        </div>

                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-medium'>State:</span>
                            <Button
                                type='button'
                                size='sm'
                                variant={
                                    selectedStates.length ===
                                    availableStates.length
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() =>
                                    setSelectedStates(availableStates)
                                }
                            >
                                All
                            </Button>
                            {availableStates.map(state => (
                                <Button
                                    key={state}
                                    type='button'
                                    size='sm'
                                    variant={
                                        selectedStates.includes(state)
                                            ? 'default'
                                            : 'outline'
                                    }
                                    title={
                                        STATE_ABBR_TO_NAME.get(state) ?? state
                                    }
                                    onClick={() =>
                                        setSelectedStates(current =>
                                            toggleValue(current, state)
                                        )
                                    }
                                >
                                    {state}
                                </Button>
                            ))}
                        </div>

                        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                            <ControlSelect
                                label='Pathogen'
                                value={pathogen}
                                onChange={setPathogen}
                                options={[
                                    ['all', 'All pathogens'],
                                    ...pathogens.map(
                                        value => [value, value] as const
                                    ),
                                ]}
                            />
                            <ControlSelect
                                label='Host'
                                value={host}
                                onChange={setHost}
                                options={[
                                    ['all', 'All hosts'],
                                    ...hosts.map(
                                        value => [value, value] as const
                                    ),
                                ]}
                            />
                            <ControlSelect
                                label='Map focus'
                                value={focusMode}
                                onChange={value =>
                                    setFocusMode(value as FocusMode)
                                }
                                options={[
                                    ['selectedStates', 'Selected states only'],
                                    ['filtered', 'Filtered/affected states'],
                                    ['all', 'All U.S. counties'],
                                ]}
                            />
                            <ControlSelect
                                label='County color value'
                                value={colorMode}
                                onChange={value =>
                                    setColorMode(value as ColorMode)
                                }
                                options={[
                                    ['cases', 'Number of detections'],
                                    ['diseases', 'Number of pathogens'],
                                    ['hosts', 'Number of hosts'],
                                ]}
                            />
                        </div>

                        <Input
                            value={search}
                            placeholder='Search pathogen, host, county, state, FIPS, year, or month'
                            onChange={event => setSearch(event.target.value)}
                        />
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <TimeControls
                            includeUnknownTime={includeUnknownTime}
                            isPlaying={isPlaying}
                            maxYear={maxYear}
                            minYear={minYear}
                            monthMode={monthMode}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            timeEnabled={timeEnabled}
                            yearMode={yearMode}
                            hasYears={yearOptions.length > 0}
                            onClearFilters={clearFilters}
                            onIncludeUnknownTimeChange={setIncludeUnknownTime}
                            onMonthModeChange={setMonthMode}
                            onPlayChange={setIsPlaying}
                            onResetLatest={resetToLatest}
                            onSelectedMonthChange={setSelectedMonth}
                            onSelectedYearChange={setSelectedYear}
                            onTimeEnabledChange={setTimeEnabled}
                            onYearModeChange={setYearMode}
                        />

                        <CountyMap
                            colorLabel={colorLabel}
                            dataStates={dataStates}
                            focusMode={focusMode}
                            maxValue={maxValue}
                            selectedFips={selectedFips}
                            selectedStates={selectedStates}
                            summaries={countySummaries}
                            onSelect={setSelectedFips}
                        />

                        <Legend colorLabel={colorLabel} maxValue={maxValue} />

                        {!isLoading && allRows.length === 0 ? (
                            <p className='rounded-xl border bg-muted/35 px-3 py-2 text-sm text-muted-foreground'>
                                No public data has been uploaded yet. Use the
                                admin Excel import page to load a workbook in
                                this browser.
                            </p>
                        ) : null}
                        {!isLoading &&
                        allRows.length > 0 &&
                        rows.length === 0 ? (
                            <p className='rounded-xl border bg-muted/35 px-3 py-2 text-sm text-muted-foreground'>
                                No public county records match the current
                                filters.
                            </p>
                        ) : null}
                        {isLoading ? (
                            <p className='text-sm text-muted-foreground'>
                                Loading public surveillance data...
                            </p>
                        ) : null}
                    </CardContent>
                </Card>

                <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]'>
                    <TopCountiesChart
                        colorLabel={colorLabel}
                        summaries={countySummaries}
                    />
                    <MonthlyCasesChart rows={rows} />
                </div>

                <PublicRecordsCard rows={rows} />
            </section>

            <aside className='space-y-4 xl:sticky xl:top-5 xl:max-h-[calc(100svh-2.5rem)] xl:overflow-y-auto'>
                <SelectedCountyCard
                    countyName={selectedCountyName}
                    fips={selectedFips}
                    summary={selectedCounty}
                    onClear={() => setSelectedFips(null)}
                />
                <SummaryCard rows={rows} summaries={countySummaries} />
            </aside>
        </div>
    )
}

function TimeControls({
    hasYears,
    includeUnknownTime,
    isPlaying,
    maxYear,
    minYear,
    monthMode,
    onClearFilters,
    onIncludeUnknownTimeChange,
    onMonthModeChange,
    onPlayChange,
    onResetLatest,
    onSelectedMonthChange,
    onSelectedYearChange,
    onTimeEnabledChange,
    onYearModeChange,
    selectedMonth,
    selectedYear,
    timeEnabled,
    yearMode,
}: {
    hasYears: boolean
    includeUnknownTime: boolean
    isPlaying: boolean
    maxYear: number
    minYear: number
    monthMode: MonthMode
    selectedMonth: number
    selectedYear: number
    timeEnabled: boolean
    yearMode: YearMode
    onClearFilters: () => void
    onIncludeUnknownTimeChange: (value: boolean) => void
    onMonthModeChange: (value: MonthMode) => void
    onPlayChange: (value: boolean) => void
    onResetLatest: () => void
    onSelectedMonthChange: (value: number) => void
    onSelectedYearChange: (value: number) => void
    onTimeEnabledChange: (value: boolean) => void
    onYearModeChange: (value: YearMode) => void
}) {
    return (
        <div className='space-y-3 rounded-xl border bg-muted/20 p-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <p className='text-sm font-medium'>Time sliders</p>
                    <p className='text-xs text-muted-foreground'>
                        {describeTime(
                            timeEnabled,
                            selectedYear,
                            selectedMonth,
                            yearMode,
                            monthMode
                        )}
                    </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={!hasYears}
                        onClick={() =>
                            onSelectedYearChange(
                                Math.max(minYear, selectedYear - 1)
                            )
                        }
                    >
                        Previous year
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={!hasYears}
                        onClick={() =>
                            onSelectedYearChange(
                                Math.min(maxYear, selectedYear + 1)
                            )
                        }
                    >
                        Next year
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={!hasYears}
                        onClick={onResetLatest}
                    >
                        Latest
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant={isPlaying ? 'default' : 'outline'}
                        disabled={!hasYears || !timeEnabled}
                        onClick={() => onPlayChange(!isPlaying)}
                    >
                        {isPlaying ? 'Pause' : 'Play'}
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={onClearFilters}
                    >
                        Clear filters
                    </Button>
                </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
                <RangeControl
                    disabled={!hasYears || !timeEnabled}
                    label='Year'
                    max={maxYear}
                    min={minYear}
                    value={selectedYear}
                    onChange={onSelectedYearChange}
                />
                <RangeControl
                    disabled={!timeEnabled}
                    label='Month'
                    max={12}
                    min={1}
                    value={selectedMonth}
                    valueLabel={monthName(
                        String(selectedMonth).padStart(2, '0')
                    )}
                    onChange={onSelectedMonthChange}
                />
            </div>

            <div className='flex flex-wrap gap-3 text-sm'>
                <CheckControl
                    checked={timeEnabled}
                    label='Use'
                    onChange={onTimeEnabledChange}
                />
                <CheckControl
                    checked={yearMode === 'year-cumulative'}
                    label='Cumulative year'
                    onChange={() => onYearModeChange('year-cumulative')}
                />
                <CheckControl
                    checked={yearMode === 'year-exact'}
                    label='Individual year'
                    onChange={() => onYearModeChange('year-exact')}
                />
                <CheckControl
                    checked={monthMode === 'month-cumulative'}
                    label='Cumulative month'
                    onChange={() => onMonthModeChange('month-cumulative')}
                />
                <CheckControl
                    checked={monthMode === 'month-exact'}
                    label='Individual month'
                    onChange={() => onMonthModeChange('month-exact')}
                />
                <CheckControl
                    checked={includeUnknownTime}
                    label='Include no-date cases'
                    onChange={onIncludeUnknownTimeChange}
                />
            </div>
        </div>
    )
}

function RangeControl({
    disabled,
    label,
    max,
    min,
    onChange,
    value,
    valueLabel,
}: {
    disabled?: boolean
    label: string
    max: number
    min: number
    value: number
    valueLabel?: string
    onChange: (value: number) => void
}) {
    return (
        <label className='space-y-2'>
            <span className='flex items-center justify-between gap-2 text-sm font-medium'>
                {label}
                <span className='text-muted-foreground'>
                    {valueLabel ?? value}
                </span>
            </span>
            <input
                className='w-full accent-primary disabled:opacity-50'
                disabled={disabled}
                type='range'
                min={min}
                max={max}
                value={value}
                onChange={event => onChange(Number(event.target.value))}
            />
        </label>
    )
}

function CheckControl({
    checked,
    label,
    onChange,
}: {
    checked: boolean
    label: string
    onChange: (value: boolean) => void
}) {
    return (
        <label className='inline-flex items-center gap-2'>
            <input
                type='checkbox'
                checked={checked}
                className='size-4 accent-primary'
                onChange={event => onChange(event.target.checked)}
            />
            {label}
        </label>
    )
}

function ControlSelect({
    label,
    onChange,
    options,
    value,
}: {
    label: string
    value: string
    options: ReadonlyArray<readonly [string, string]>
    onChange: (value: string) => void
}) {
    return (
        <label className='flex flex-col gap-1.5'>
            <span className='text-sm font-medium'>{label}</span>
            <select
                value={value}
                className={selectClass}
                onChange={event => onChange(event.target.value)}
            >
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>
                        {optionLabel}
                    </option>
                ))}
            </select>
        </label>
    )
}

function Legend({
    colorLabel,
    maxValue,
}: {
    colorLabel: string
    maxValue: number
}) {
    const steps =
        maxValue <= 1
            ? [1]
            : uniqueSortedNumbers([
                  1,
                  Math.ceil(maxValue / 3),
                  Math.ceil((maxValue * 2) / 3),
                  maxValue,
              ])

    return (
        <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
            <strong className='text-foreground'>{colorLabel}</strong>
            {steps.map(step => (
                <span key={step} className='inline-flex items-center gap-1.5'>
                    <span
                        className='size-3 rounded-sm ring-1 ring-border'
                        style={{ background: legendColor(step, maxValue) }}
                    />
                    {step}
                </span>
            ))}
            <span className='inline-flex items-center gap-1.5'>
                <span className='size-3 rounded-sm bg-muted ring-1 ring-border' />
                No filtered detections
            </span>
        </div>
    )
}

function TopCountiesChart({
    colorLabel,
    summaries,
}: {
    colorLabel: string
    summaries: Map<string, CountyMapSummary>
}) {
    const rows = Array.from(summaries.values())
        .sort(
            (a, b) =>
                b.displayValue - a.displayValue ||
                b.positiveCount - a.positiveCount ||
                a.county.localeCompare(b.county)
        )
        .slice(0, 10)
    const maxValue = Math.max(1, ...rows.map(row => row.displayValue))

    return (
        <Card>
            <CardHeader>
                <CardTitle>Top counties</CardTitle>
                <p className='text-sm text-muted-foreground'>
                    Ranked by {colorLabel.toLowerCase()} under current filters.
                </p>
            </CardHeader>
            <CardContent className='space-y-3'>
                {rows.length ? (
                    rows.map(row => (
                        <div key={row.fips} className='space-y-1.5'>
                            <div className='flex items-center justify-between gap-3 text-sm'>
                                <span className='truncate font-medium'>
                                    {row.county}, {row.state}
                                </span>
                                <span>{row.displayValue}</span>
                            </div>
                            <div className='h-2 overflow-hidden rounded-full bg-muted'>
                                <div
                                    className='h-full rounded-full bg-primary'
                                    style={{
                                        width: `${Math.max(
                                            4,
                                            (row.displayValue / maxValue) * 100
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))
                ) : (
                    <p className='text-sm text-muted-foreground'>
                        No county data to graph for the current filters.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

function MonthlyCasesChart({ rows }: { rows: CountyMetric[] }) {
    const years = validYears(rows)
    const points = years.flatMap(year =>
        MONTHS.map(([month]) => ({
            count: rows
                .filter(row => Number(row.year) === year && row.month === month)
                .reduce((sum, row) => sum + Math.max(0, row.positiveCount), 0),
            month,
            year,
        }))
    )
    const maxValue = Math.max(1, ...points.map(point => point.count))
    const chartWidth = 560
    const chartHeight = 260
    const padding = { bottom: 34, left: 36, right: 16, top: 18 }
    const innerWidth = chartWidth - padding.left - padding.right
    const innerHeight = chartHeight - padding.top - padding.bottom
    const monthX = (month: string) =>
        padding.left + ((Number(month) - 1) / 11) * innerWidth
    const valueY = (count: number) =>
        padding.top + innerHeight - (count / maxValue) * innerHeight

    return (
        <Card>
            <CardHeader>
                <CardTitle>Monthly case counts</CardTitle>
                <p className='text-sm text-muted-foreground'>
                    {rows.length} filtered public record
                    {rows.length === 1 ? '' : 's'}. Records without year/month
                    are not graphed.
                </p>
            </CardHeader>
            <CardContent>
                {years.length ? (
                    <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        role='img'
                        aria-label='Monthly case counts'
                        className='h-auto w-full rounded-xl border bg-background'
                    >
                        {[0, 0.5, 1].map(tick => {
                            const y = padding.top + innerHeight * tick
                            return (
                                <line
                                    key={tick}
                                    x1={padding.left}
                                    x2={chartWidth - padding.right}
                                    y1={y}
                                    y2={y}
                                    className='stroke-border'
                                />
                            )
                        })}
                        {MONTHS.map(([month, label]) => (
                            <text
                                key={month}
                                x={monthX(month)}
                                y={chartHeight - 12}
                                textAnchor='middle'
                                className='fill-muted-foreground text-[10px]'
                            >
                                {label}
                            </text>
                        ))}
                        {years.map((year, yearIndex) => {
                            const yearPoints = points.filter(
                                point => point.year === year
                            )
                            const d = yearPoints
                                .map((point, index) => {
                                    const command = index === 0 ? 'M' : 'L'
                                    return `${command}${monthX(point.month)},${valueY(point.count)}`
                                })
                                .join(' ')
                            return (
                                <g key={year}>
                                    <path
                                        d={d}
                                        fill='none'
                                        stroke={`var(--chart-${(yearIndex % 5) + 1})`}
                                        strokeWidth='2.4'
                                    />
                                    {yearPoints
                                        .filter(point => point.count > 0)
                                        .map(point => (
                                            <g key={`${year}-${point.month}`}>
                                                <circle
                                                    cx={monthX(point.month)}
                                                    cy={valueY(point.count)}
                                                    r='3.6'
                                                    stroke='var(--background)'
                                                    strokeWidth='1.2'
                                                    fill={`var(--chart-${(yearIndex % 5) + 1})`}
                                                />
                                                <text
                                                    x={monthX(point.month)}
                                                    y={Math.max(
                                                        12,
                                                        valueY(point.count) - 7
                                                    )}
                                                    textAnchor='middle'
                                                    className='fill-foreground text-[10px] font-bold'
                                                >
                                                    {point.count}
                                                </text>
                                            </g>
                                        ))}
                                </g>
                            )
                        })}
                    </svg>
                ) : (
                    <p className='rounded-xl border bg-muted/35 px-3 py-8 text-center text-sm text-muted-foreground'>
                        No month/year data to graph for the current filters.
                    </p>
                )}
                <div className='mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground'>
                    {years.map((year, index) => (
                        <span
                            key={year}
                            className='inline-flex items-center gap-1.5'
                        >
                            <span
                                className='h-0.5 w-5 rounded-full'
                                style={{
                                    background: `var(--chart-${(index % 5) + 1})`,
                                }}
                            />
                            {year}
                        </span>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

function SelectedCountyCard({
    countyName,
    fips,
    onClear,
    summary,
}: {
    countyName: string
    fips: string | null
    summary: CountyMapSummary | undefined
    onClear: () => void
}) {
    return (
        <Card>
            <CardHeader className='flex flex-row items-start justify-between gap-3'>
                <div>
                    <CardTitle>Selected county details</CardTitle>
                    <p className='text-sm text-muted-foreground'>
                        Click any county on the map to inspect current filters.
                    </p>
                </div>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={!fips}
                    onClick={onClear}
                >
                    Clear
                </Button>
            </CardHeader>
            <CardContent className='space-y-3'>
                {!fips ? (
                    <p className='text-sm text-muted-foreground'>
                        No county selected.
                    </p>
                ) : (
                    <>
                        <div className='flex items-center justify-between gap-2'>
                            <strong>
                                {summary?.county || countyName || 'Selected'}{' '}
                                County
                                {summary?.state ? `, ${summary.state}` : ''}
                            </strong>
                            <Badge>{fips}</Badge>
                        </div>
                        {summary ? (
                            <div className='space-y-2 text-sm'>
                                <p>
                                    <strong>{summary.positiveCount}</strong>{' '}
                                    filtered detection
                                    {summary.positiveCount === 1
                                        ? ''
                                        : 's'}{' '}
                                    across {summary.recordCount} public record
                                    {summary.recordCount === 1 ? '' : 's'}.
                                </p>
                                <DetailLine
                                    label='Pathogens'
                                    values={summary.diseases}
                                />
                                <DetailLine
                                    label='Hosts'
                                    values={summary.hosts}
                                />
                                <DetailLine
                                    label='Years'
                                    values={summary.years}
                                />
                                <DetailLine
                                    label='Months'
                                    values={summary.months}
                                />
                            </div>
                        ) : (
                            <p className='text-sm text-muted-foreground'>
                                No public records match the current filters in
                                this county.
                            </p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function SummaryCard({
    rows,
    summaries,
}: {
    rows: CountyMetric[]
    summaries: Map<string, CountyMapSummary>
}) {
    const topCounties = Array.from(summaries.values())
        .sort((a, b) => b.positiveCount - a.positiveCount)
        .slice(0, 8)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Filtered summary</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4 text-sm'>
                <p className='rounded-xl border bg-muted/35 px-3 py-2 text-muted-foreground'>
                    Filters currently return <strong>{rows.length}</strong>{' '}
                    public aggregate record{rows.length === 1 ? '' : 's'}.
                    Records without a valid FIPS remain in exports but cannot be
                    mapped.
                </p>
                <PillSection
                    label='Top counties'
                    values={topCounties.map(
                        county =>
                            `${county.county}, ${county.state}: ${county.positiveCount}`
                    )}
                />
                <PillSection
                    label='Pathogen counts'
                    values={countRows(rows, row => row.pathogen)}
                />
                <PillSection
                    label='Host counts'
                    values={countRows(rows, row => row.host)}
                />
                <PillSection
                    label='Month counts'
                    values={countRows(rows, row => monthName(row.month))}
                />
            </CardContent>
        </Card>
    )
}

function PublicRecordsCard({ rows }: { rows: CountyMetric[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Public records</CardTitle>
                <p className='text-sm text-muted-foreground'>
                    Sanitized aggregate rows currently feeding the public map.
                </p>
            </CardHeader>
            <CardContent>
                <div className='overflow-x-auto'>
                    <table className='w-full min-w-[720px] text-sm'>
                        <thead className='border-b text-left text-muted-foreground'>
                            <tr>
                                <th className='py-2 pr-3 font-medium'>
                                    Pathogen
                                </th>
                                <th className='py-2 pr-3 font-medium'>Host</th>
                                <th className='py-2 pr-3 font-medium'>Time</th>
                                <th className='py-2 pr-3 font-medium'>
                                    County
                                </th>
                                <th className='py-2 pr-3 text-right font-medium'>
                                    Detections
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length ? (
                                rows.slice(0, 80).map(row => (
                                    <tr
                                        key={`${row.fips}-${row.pathogen}-${row.host}-${row.year}-${row.month}`}
                                        className='border-b last:border-0'
                                    >
                                        <td className='py-2 pr-3 font-medium'>
                                            {row.pathogen}
                                        </td>
                                        <td className='py-2 pr-3'>
                                            {row.host}
                                        </td>
                                        <td className='py-2 pr-3'>
                                            {row.year || 'No year'}{' '}
                                            {row.month
                                                ? monthName(row.month)
                                                : ''}
                                        </td>
                                        <td className='py-2 pr-3'>
                                            {row.county}, {row.state}
                                            <span className='ml-2 text-muted-foreground'>
                                                {row.fips}
                                            </span>
                                        </td>
                                        <td className='py-2 pr-3 text-right'>
                                            {row.positiveCount}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className='py-8 text-center text-muted-foreground'
                                    >
                                        No public records match the current
                                        filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {rows.length > 80 ? (
                    <p className='mt-3 text-xs text-muted-foreground'>
                        Showing first 80 filtered rows to keep the public page
                        readable.
                    </p>
                ) : null}
            </CardContent>
        </Card>
    )
}

function DetailLine({
    label,
    values,
}: {
    label: string
    values: Map<string, number>
}) {
    return (
        <p>
            <strong>{label}:</strong> {formatCounts(values)}
        </p>
    )
}

function PillSection({ label, values }: { label: string; values: string[] }) {
    return (
        <section className='space-y-2'>
            <strong>{label}</strong>
            <div className='flex flex-wrap gap-2'>
                {values.length ? (
                    values.slice(0, 12).map(value => (
                        <Badge key={value} variant='secondary'>
                            {value}
                        </Badge>
                    ))
                ) : (
                    <span className='text-muted-foreground'>None</span>
                )}
            </div>
        </section>
    )
}

function summarizeCounties(rows: CountyMetric[], colorMode: ColorMode) {
    const summaries = new Map<string, CountyMapSummary>()

    for (const row of rows) {
        if (!row.fips) {
            continue
        }

        const current = summaries.get(row.fips)
        const diseases = new Map(current?.diseases)
        const hosts = new Map(current?.hosts)
        const years = new Map(current?.years)
        const months = new Map(current?.months)
        bump(diseases, row.pathogen || 'Unnamed pathogen', row.positiveCount)
        bump(hosts, row.host || '(host not entered)', row.positiveCount)
        bump(years, row.year || '(no year)', row.positiveCount)
        bump(months, monthName(row.month), row.positiveCount)

        const positiveCount =
            (current?.positiveCount ?? 0) + Math.max(0, row.positiveCount)
        const totalTestCount =
            current?.totalTestCount === undefined &&
            row.totalTestCount === undefined
                ? undefined
                : (current?.totalTestCount ?? 0) + (row.totalTestCount ?? 0)
        const displayValue =
            colorMode === 'diseases'
                ? diseases.size
                : colorMode === 'hosts'
                  ? hosts.size
                  : positiveCount

        summaries.set(row.fips, {
            county: row.county,
            diseases,
            displayValue,
            fips: row.fips,
            hosts,
            months,
            positiveCount,
            recordCount: (current?.recordCount ?? 0) + 1,
            state: row.state,
            totalTestCount,
            years,
        })
    }

    return summaries
}

function matchesTime(
    row: CountyMetric,
    settings: {
        includeUnknownTime: boolean
        monthMode: MonthMode
        selectedMonth: number
        selectedYear: number
        timeEnabled: boolean
        yearMode: YearMode
    }
) {
    if (!settings.timeEnabled) {
        return true
    }

    const year = Number(row.year)
    const month = Number(row.month)
    const hasValidYear = Number.isInteger(year) && year >= 1900 && year <= 2100
    const hasValidMonth = Number.isInteger(month) && month >= 1 && month <= 12

    if (!hasValidYear) {
        return settings.includeUnknownTime
    }

    if (settings.yearMode === 'year-exact' && year !== settings.selectedYear) {
        return false
    }
    if (
        settings.yearMode === 'year-cumulative' &&
        year > settings.selectedYear
    ) {
        return false
    }

    if (!hasValidMonth) {
        return settings.includeUnknownTime
    }

    if (settings.monthMode === 'month-exact') {
        return month === settings.selectedMonth
    }

    if (
        settings.yearMode === 'year-exact' ||
        (settings.yearMode === 'year-cumulative' &&
            year === settings.selectedYear)
    ) {
        return month <= settings.selectedMonth
    }

    return true
}

function describeTime(
    enabled: boolean,
    year: number,
    month: number,
    yearMode: YearMode,
    monthMode: MonthMode
) {
    if (!enabled) {
        return 'for all available dates'
    }

    const monthText = monthName(String(month).padStart(2, '0'))

    if (yearMode === 'year-exact' && monthMode === 'month-exact') {
        return `for ${monthText} ${year} only`
    }
    if (yearMode === 'year-exact') {
        return `from January through ${monthText} ${year}`
    }
    if (monthMode === 'month-exact') {
        return `for ${monthText} in years through ${year}`
    }
    return `through ${monthText} ${year}`
}

function colorModeLabel(mode: ColorMode) {
    if (mode === 'diseases') {
        return 'Number of pathogens'
    }
    if (mode === 'hosts') {
        return 'Number of hosts'
    }
    return 'Number of detections'
}

function monthName(month: string | undefined) {
    return MONTHS.find(([value]) => value === month)?.[1] ?? '(no month)'
}

function validYears(rows: CountyMetric[]) {
    return uniqueSortedNumbers(
        rows
            .map(row => Number(row.year))
            .filter(
                year => Number.isInteger(year) && year >= 1900 && year <= 2100
            )
    )
}

function uniqueSorted(values: string[]) {
    return Array.from(
        new Set(values.map(value => value.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))
}

function uniqueSortedNumbers(values: number[]) {
    return Array.from(new Set(values)).sort((a, b) => a - b)
}

function toggleValue(values: string[], value: string) {
    return values.includes(value)
        ? values.filter(current => current !== value)
        : uniqueSorted([...values, value])
}

function bump(map: Map<string, number>, key: string, amount = 1) {
    map.set(key, (map.get(key) ?? 0) + amount)
}

function formatCounts(map: Map<string, number>) {
    return (
        Array.from(map.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([key, value]) => `${key} (${value})`)
            .join('; ') || 'None'
    )
}

function countRows(
    rows: CountyMetric[],
    getValue: (row: CountyMetric) => string
) {
    const counts = new Map<string, number>()
    rows.forEach(row =>
        bump(counts, getValue(row) || 'Unknown', row.positiveCount)
    )
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, value]) => `${key}: ${value}`)
}

function legendColor(step: number, maxValue: number) {
    const intensity = Math.max(0.16, step / Math.max(1, maxValue))
    const primaryPercent = Math.round(18 + intensity * 74)
    return `color-mix(in oklch, var(--chart-2) ${primaryPercent}%, var(--background))`
}

function readError(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong.'
}
