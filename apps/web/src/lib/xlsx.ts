import { strToU8, zipSync } from 'fflate'

export type XlsxRow = Record<string, string | number | undefined>

export function rowsToXlsxBlob(
    sheetName: string,
    headers: string[],
    rows: XlsxRow[]
) {
    const worksheet = worksheetXml(headers, rows)
    const workbook = workbookXml(sheetName)

    const zipped = zipSync({
        '[Content_Types].xml': strToU8(contentTypesXml()),
        '_rels/.rels': strToU8(rootRelsXml()),
        'xl/workbook.xml': strToU8(workbook),
        'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml()),
        'xl/worksheets/sheet1.xml': strToU8(worksheet),
    })

    return new Blob([zipped as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
}

function worksheetXml(headers: string[], rows: XlsxRow[]) {
    const allRows = [
        headers,
        ...rows.map(row => headers.map(header => row[header])),
    ]
    const body = allRows
        .map((row, rowIndex) => {
            const cells = row
                .map((value, columnIndex) =>
                    cellXml(columnName(columnIndex + 1), rowIndex + 1, value)
                )
                .join('')
            return `<row r="${rowIndex + 1}">${cells}</row>`
        })
        .join('')

    return xml(`\
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${body}</sheetData>
</worksheet>`)
}

function cellXml(column: string, row: number, value: unknown) {
    const reference = `${column}${row}`
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${reference}"><v>${value}</v></c>`
    }

    return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
}

function columnName(index: number) {
    let name = ''
    let cursor = index
    while (cursor > 0) {
        const remainder = (cursor - 1) % 26
        name = String.fromCharCode(65 + remainder) + name
        cursor = Math.floor((cursor - 1) / 26)
    }
    return name
}

function contentTypesXml() {
    return xml(`\
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`)
}

function rootRelsXml() {
    return xml(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)
}

function workbookXml(sheetName: string) {
    return xml(`\
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`)
}

function workbookRelsXml() {
    return xml(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`)
}

function xml(value: string) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${value}`
}

function escapeXml(value: unknown) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
}
