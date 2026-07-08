import { strFromU8, unzipSync } from 'fflate'

export type WorkbookRow = Record<string, string | number | boolean | undefined>

export async function xlsxFileToRows(file: File): Promise<WorkbookRow[]> {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const workbookPath = workbookEntryPath(entries)
    const workbook = parseXml(readEntry(entries, workbookPath))
    const sheetPath = firstWorksheetPath(entries, workbook, workbookPath)
    const sharedStrings = parseSharedStrings(entries)
    const worksheet = parseXml(readEntry(entries, sheetPath))
    const rows = Array.from(worksheet.getElementsByTagName('row'))

    if (rows.length === 0) {
        return []
    }

    const [headerRow, ...bodyRows] = rows
    const headers = cellsFromRow(headerRow, sharedStrings).map(value =>
        String(value ?? '').trim()
    )

    return bodyRows
        .map(row => {
            const values = cellsFromRow(row, sharedStrings)
            const record: WorkbookRow = {}
            headers.forEach((header, index) => {
                if (header) {
                    record[header] = values[index]
                }
            })
            return record
        })
        .filter(row =>
            Object.values(row).some(value => String(value ?? '').trim())
        )
}

function workbookEntryPath(entries: Record<string, Uint8Array>) {
    const rels = parseXml(readEntry(entries, '_rels/.rels'))
    const relationship = Array.from(
        rels.getElementsByTagName('Relationship')
    ).find(element => element.getAttribute('Type')?.endsWith('/officeDocument'))
    const target = relationship?.getAttribute('Target') ?? 'xl/workbook.xml'
    return normalizeEntryPath(target)
}

function firstWorksheetPath(
    entries: Record<string, Uint8Array>,
    workbook: Document,
    workbookPath: string
) {
    const firstSheet = workbook.getElementsByTagName('sheet')[0]
    const relationshipId =
        firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttribute('id')

    const workbookDirectory = workbookPath.split('/').slice(0, -1).join('/')
    const workbookRelsPath = `${workbookDirectory}/_rels/${workbookPath
        .split('/')
        .at(-1)}.rels`
    const rels = parseXml(readEntry(entries, workbookRelsPath))
    const relationship = Array.from(
        rels.getElementsByTagName('Relationship')
    ).find(element => element.getAttribute('Id') === relationshipId)
    const target =
        relationship?.getAttribute('Target') ?? 'worksheets/sheet1.xml'

    return normalizeEntryPath(`${workbookDirectory}/${target}`)
}

function parseSharedStrings(entries: Record<string, Uint8Array>) {
    const entry = entries['xl/sharedStrings.xml']
    if (!entry) {
        return []
    }

    const xml = parseXml(strFromU8(entry))
    return Array.from(xml.getElementsByTagName('si')).map(item =>
        Array.from(item.getElementsByTagName('t'))
            .map(text => text.textContent ?? '')
            .join('')
    )
}

function cellsFromRow(row: Element, sharedStrings: string[]) {
    const values: Array<string | number | boolean | undefined> = []

    for (const cell of Array.from(row.getElementsByTagName('c'))) {
        values[columnIndex(cell.getAttribute('r') ?? '')] = cellValue(
            cell,
            sharedStrings
        )
    }

    return values
}

function cellValue(
    cell: Element,
    sharedStrings: string[]
): string | number | boolean | undefined {
    const type = cell.getAttribute('t')
    if (type === 'inlineStr') {
        return Array.from(cell.getElementsByTagName('t'))
            .map(text => text.textContent ?? '')
            .join('')
    }

    const rawValue = cell.getElementsByTagName('v')[0]?.textContent ?? ''
    if (!rawValue) {
        return undefined
    }

    if (type === 's') {
        return sharedStrings[Number(rawValue)] ?? ''
    }
    if (type === 'b') {
        return rawValue === '1'
    }

    const numeric = Number(rawValue)
    return Number.isFinite(numeric) ? numeric : rawValue
}

function columnIndex(reference: string) {
    const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A'
    return (
        Array.from(letters).reduce(
            (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
            0
        ) - 1
    )
}

function readEntry(entries: Record<string, Uint8Array>, path: string) {
    const entry = entries[path]
    if (!entry) {
        throw new Error(`Workbook is missing ${path}.`)
    }
    return strFromU8(entry)
}

function parseXml(xml: string) {
    return new DOMParser().parseFromString(xml, 'application/xml')
}

function normalizeEntryPath(path: string) {
    const parts: string[] = []
    for (const part of path.replace(/^\/+/, '').split('/')) {
        if (!part || part === '.') {
            continue
        }
        if (part === '..') {
            parts.pop()
            continue
        }
        parts.push(part)
    }
    return parts.join('/')
}
