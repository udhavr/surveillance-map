import { useMemo } from 'react'

import { OKLAHOMA_MAP_VIEWBOX, oklahomaCountyPaths } from './data'

export type CountyMapSummary = {
    county: string
    displayValue: number
    fips: string
    positiveCount: number
    recordCount: number
    state: string
    totalTestCount?: number
}

type CountyMapProps = {
    maxValue: number
    selectedFips: string | null
    summaries: Map<string, CountyMapSummary>
    onSelect: (fips: string) => void
}

export function CountyMap({
    maxValue,
    onSelect,
    selectedFips,
    summaries,
}: CountyMapProps) {
    const countyTitles = useMemo(
        () =>
            new Map(
                oklahomaCountyPaths.map(county => [
                    county.fips,
                    countyTitle(county.name, summaries.get(county.fips)),
                ])
            ),
        [summaries]
    )

    return (
        <svg
            viewBox={OKLAHOMA_MAP_VIEWBOX}
            role='img'
            aria-label='Oklahoma county-level pathogen detections'
            className='aspect-[12/6.5] h-auto w-full rounded-xl bg-background'
        >
            <rect
                x='0'
                y='0'
                width='960'
                height='520'
                rx='16'
                className='fill-background'
            />
            {oklahomaCountyPaths.map(county => {
                const summary = summaries.get(county.fips)
                const isSelected = selectedFips === county.fips
                return (
                    <path
                        key={county.fips}
                        d={county.path}
                        role='button'
                        tabIndex={0}
                        aria-label={countyTitles.get(county.fips)}
                        className='cursor-pointer transition-[opacity,stroke-width] duration-150 outline-none focus-visible:stroke-ring'
                        fill={countyFill(summary, maxValue)}
                        stroke={
                            isSelected ? 'var(--foreground)' : 'var(--border)'
                        }
                        strokeWidth={isSelected ? 2.2 : 0.9}
                        opacity={summary ? 1 : 0.72}
                        onClick={() => onSelect(county.fips)}
                        onFocus={() => onSelect(county.fips)}
                        onMouseEnter={() => onSelect(county.fips)}
                    >
                        <title>{countyTitles.get(county.fips)}</title>
                    </path>
                )
            })}
        </svg>
    )
}

function countyFill(summary: CountyMapSummary | undefined, maxValue: number) {
    if (!summary) {
        return 'var(--muted)'
    }

    const intensity = Math.max(
        0.2,
        summary.displayValue / Math.max(1, maxValue)
    )
    const primaryPercent = Math.round(22 + intensity * 68)
    return `color-mix(in oklch, var(--primary) ${primaryPercent}%, var(--background))`
}

function countyTitle(
    countyName: string,
    summary: CountyMapSummary | undefined
) {
    if (!summary) {
        return `${countyName} County: no filtered detections`
    }

    return `${countyName} County: ${summary.positiveCount} positive detections across ${summary.recordCount} public record${summary.recordCount === 1 ? '' : 's'}`
}
