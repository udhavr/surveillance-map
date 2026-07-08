import { MinusIcon, PlusIcon, RewindIcon } from '@phosphor-icons/react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import type {
    Feature,
    FeatureCollection,
    GeoJsonProperties,
    Geometry,
} from 'geojson'
import { useMemo, useState } from 'react'
import { feature } from 'topojson-client'
import usAtlas from 'us-atlas/counties-10m.json'

import { Button } from '@workspace/ui/components/button'

import {
    REGIONAL_STATE_ABBRS,
    STATE_ABBR_TO_FIPS,
    fipsStateAbbr,
} from './us-map-data'

export type CountyMapSummary = {
    county: string
    diseases: Map<string, number>
    displayValue: number
    fips: string
    hosts: Map<string, number>
    months: Map<string, number>
    positiveCount: number
    recordCount: number
    state: string
    totalTestCount?: number
    years: Map<string, number>
}

export type FocusMode = 'filtered' | 'all' | 'selectedStates'

type CountyMapProps = {
    colorLabel: string
    dataStates: string[]
    focusMode: FocusMode
    maxValue: number
    selectedFips: string | null
    selectedStates: string[]
    summaries: Map<string, CountyMapSummary>
    onSelect: (fips: string) => void
}

type CountyFeature = Feature<Geometry, GeoJsonProperties> & {
    id: number | string
}

type StateFeature = Feature<Geometry, GeoJsonProperties> & {
    id: number | string
}

const MAP_WIDTH = 960
const MAP_HEIGHT = 560

const { counties, states } = loadMapFeatures()

export function countyNameForFips(fips: string) {
    const county = counties.find(
        candidate => String(candidate.id).padStart(5, '0') === fips
    )
    return String(county?.properties?.name ?? '')
}

export function CountyMap({
    colorLabel,
    dataStates,
    focusMode,
    maxValue,
    onSelect,
    selectedFips,
    selectedStates,
    summaries,
}: CountyMapProps) {
    const [zoom, setZoom] = useState(1)

    const shownStateSet = useMemo(
        () => visibleStateFips(focusMode, selectedStates, dataStates),
        [dataStates, focusMode, selectedStates]
    )

    const shownCounties = useMemo(() => {
        if (focusMode === 'all') {
            return counties
        }

        return counties.filter(county =>
            shownStateSet.has(String(county.id).padStart(5, '0').slice(0, 2))
        )
    }, [focusMode, shownStateSet])

    const shownStates = useMemo(
        () =>
            states.filter(state =>
                shownStateSet.has(String(state.id).padStart(2, '0'))
            ),
        [shownStateSet]
    )

    const paths = useMemo(() => {
        const fitFeatures = shownCounties.length ? shownCounties : counties
        const projection = geoAlbersUsa().fitExtent(
            [
                [18, 18],
                [MAP_WIDTH - 18, MAP_HEIGHT - 18],
            ],
            {
                type: 'FeatureCollection',
                features: fitFeatures,
            } satisfies FeatureCollection
        )
        const path = geoPath(projection)

        return {
            counties: shownCounties.map(county => ({
                county,
                d: path(county) ?? '',
                fips: String(county.id).padStart(5, '0'),
            })),
            states: shownStates.map(state => ({
                d: path(state) ?? '',
                fips: String(state.id).padStart(2, '0'),
            })),
        }
    }, [shownCounties, shownStates])

    const transform = `translate(${(MAP_WIDTH * (1 - zoom)) / 2} ${(MAP_HEIGHT * (1 - zoom)) / 2}) scale(${zoom})`

    return (
        <div className='relative overflow-hidden rounded-xl border bg-background'>
            <div className='absolute top-3 right-3 z-10 flex gap-1 rounded-2xl border bg-card/85 p-1 shadow-sm backdrop-blur'>
                <Button
                    type='button'
                    size='icon-sm'
                    variant='ghost'
                    aria-label='Zoom in'
                    onClick={() =>
                        setZoom(current => Math.min(4, current * 1.3))
                    }
                >
                    <PlusIcon />
                </Button>
                <Button
                    type='button'
                    size='icon-sm'
                    variant='ghost'
                    aria-label='Zoom out'
                    onClick={() =>
                        setZoom(current => Math.max(1, current / 1.3))
                    }
                >
                    <MinusIcon />
                </Button>
                <Button
                    type='button'
                    size='icon-sm'
                    variant='ghost'
                    aria-label='Reset map zoom'
                    onClick={() => setZoom(1)}
                >
                    <RewindIcon />
                </Button>
            </div>
            <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                role='img'
                aria-label='County-level pathogen detections'
                className='aspect-[12/7] h-auto w-full bg-background'
            >
                <rect
                    x='0'
                    y='0'
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    className='fill-background'
                />
                <g transform={transform}>
                    {paths.counties.map(({ county, d, fips }) => {
                        const summary = summaries.get(fips)
                        const isSelected = selectedFips === fips
                        return (
                            <path
                                key={fips}
                                d={d}
                                role='button'
                                tabIndex={0}
                                aria-label={countyTitle(
                                    county,
                                    fips,
                                    colorLabel,
                                    summary
                                )}
                                className='cursor-pointer transition-[opacity,stroke-width] duration-150 outline-none focus-visible:stroke-ring'
                                fill={countyFill(summary, maxValue)}
                                stroke={
                                    isSelected
                                        ? 'var(--foreground)'
                                        : 'var(--border)'
                                }
                                strokeWidth={isSelected ? 2.2 : 0.75}
                                opacity={summary ? 1 : 0.7}
                                onClick={() => onSelect(fips)}
                                onFocus={() => onSelect(fips)}
                            >
                                <title>
                                    {countyTitle(
                                        county,
                                        fips,
                                        colorLabel,
                                        summary
                                    )}
                                </title>
                            </path>
                        )
                    })}
                    {paths.states.map(state => (
                        <path
                            key={state.fips}
                            d={state.d}
                            className='pointer-events-none fill-none stroke-foreground/45'
                            strokeWidth={1.4}
                        />
                    ))}
                </g>
            </svg>
        </div>
    )
}

function countyFill(summary: CountyMapSummary | undefined, maxValue: number) {
    if (!summary) {
        return 'var(--muted)'
    }

    const intensity = Math.max(
        0.16,
        summary.displayValue / Math.max(1, maxValue)
    )
    const primaryPercent = Math.round(18 + intensity * 74)
    return `color-mix(in oklch, var(--chart-2) ${primaryPercent}%, var(--background))`
}

function countyTitle(
    county: CountyFeature,
    fips: string,
    colorLabel: string,
    summary: CountyMapSummary | undefined
) {
    const countyName = String(county.properties?.name ?? 'Unknown')
    const state = fipsStateAbbr(fips)

    if (!summary) {
        return `${countyName} County, ${state}: no filtered detections`
    }

    return `${countyName} County, ${state}: ${summary.positiveCount} detection${summary.positiveCount === 1 ? '' : 's'}; ${colorLabel}: ${summary.displayValue}`
}

function visibleStateFips(
    focusMode: FocusMode,
    selectedStates: string[],
    dataStates: string[]
) {
    if (focusMode === 'all') {
        return new Set(states.map(state => String(state.id).padStart(2, '0')))
    }

    const stateAbbrs =
        focusMode === 'selectedStates'
            ? selectedStates
            : Array.from(
                  new Set([
                      ...dataStates,
                      ...selectedStates,
                      ...REGIONAL_STATE_ABBRS,
                  ])
              )

    const stateFips = stateAbbrs
        .map(state => STATE_ABBR_TO_FIPS.get(state))
        .filter((state): state is string => Boolean(state))

    return new Set(
        stateFips.length
            ? stateFips
            : REGIONAL_STATE_ABBRS.map(state =>
                  STATE_ABBR_TO_FIPS.get(state)
              ).filter((state): state is string => Boolean(state))
    )
}

function loadMapFeatures() {
    const topology = usAtlas as unknown as Parameters<typeof feature>[0]
    const objects = (
        topology as unknown as {
            objects: {
                counties: Parameters<typeof feature>[1]
                states: Parameters<typeof feature>[1]
            }
        }
    ).objects
    const countyCollection = feature(
        topology,
        objects.counties
    ) as unknown as FeatureCollection<Geometry, GeoJsonProperties>
    const stateCollection = feature(
        topology,
        objects.states
    ) as unknown as FeatureCollection<Geometry, GeoJsonProperties>

    return {
        counties: countyCollection.features as CountyFeature[],
        states: stateCollection.features as StateFeature[],
    }
}
