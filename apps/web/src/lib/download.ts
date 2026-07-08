export function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
}

export function downloadText(filename: string, text: string, type: string) {
    downloadBlob(filename, new Blob([text], { type }))
}
