import oklahomaMap from './oklahoma-county-paths.json'

export type CountyPath = {
    fips: string
    name: string
    path: string
}

type OklahomaCountyMap = {
    source: string
    viewBox: string
    counties: CountyPath[]
}

const mapData = oklahomaMap as OklahomaCountyMap

export const OKLAHOMA_MAP_SOURCE = mapData.source
export const OKLAHOMA_MAP_VIEWBOX = mapData.viewBox
export const oklahomaCountyPaths = mapData.counties
