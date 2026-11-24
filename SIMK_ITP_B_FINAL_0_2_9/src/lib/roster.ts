import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'
import type { RosterDraft } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { parseRosterRows } from './roster-parser.mjs'
import { parseRosterRows } from './roster-parser.mjs'

function positionedTextToLines(items: unknown[]): string {
  const positionedItems = items
    .filter((item): item is { str: string; transform: number[]; width: number } => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return typeof candidate.str === 'string'
        && candidate.str.trim().length > 0
        && Array.isArray(candidate.transform)
        && candidate.transform.length >= 6
        && typeof candidate.width === 'number'
    })
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5], width: item.width }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: Array<{ y: number; items: typeof positionedItems }> = []
  for (const item of positionedItems) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) < 2.5)
    if (!line) { line = { y: item.y, items: [] }; lines.push(line) }
    line.items.push(item)
  }

  return lines.sort((a, b) => b.y - a.y).map((line) => {
    const ordered = line.items.sort((a, b) => a.x - b.x)
    let output = ''
    let rightEdge = Number.NEGATIVE_INFINITY
    for (const item of ordered) {
      const gap = item.x - rightEdge
      output += output ? (gap > 14 ? ' | ' : ' ') : ''
      output += item.text
      rightEdge = Math.max(rightEdge, item.x + item.width)
    }
    return output
  }).join('\n')
}

/**
 * Reads each PDF page separately. Pages without selectable text are OCR'd individually,
 * so mixed PDFs (some text pages and some scanned pages) retain both sources.
 * The returned values are candidate data only and must be reviewed by an Admin.
 */
export async function extractPdf(file: File, onProgress: (label: string) => void) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pageTexts: string[] = []
  const scanPages: number[] = []

  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      onProgress(`Membaca halaman ${pageNo} dari ${pdf.numPages}…`)
      const page = await pdf.getPage(pageNo)
      const content = await page.getTextContent()
      const pageText = positionedTextToLines(content.items as unknown[])
      pageTexts.push(pageText)
      if (pageText.replace(/\s/g, '').length < 24) scanPages.push(pageNo)
      page.cleanup()
    }

    let usedOcr = false
    if (scanPages.length > 0) {
      usedOcr = true
      onProgress(`Menyiapkan OCR untuk ${scanPages.length} halaman hasil scan…`)
      const worker = await createWorker(['ind', 'eng'])
      try {
        for (const pageNo of scanPages) {
          onProgress(`OCR halaman ${pageNo} dari ${pdf.numPages}…`)
          const page = await pdf.getPage(pageNo)
          const viewport = page.getViewport({ scale: 1.55 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            page.cleanup()
            continue
          }
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: context, canvas, viewport }).promise
          const result = await worker.recognize(canvas)
          pageTexts[pageNo - 1] = result.data.text
          page.cleanup()
          canvas.width = 0
          canvas.height = 0
        }
      } finally {
        await worker.terminate()
      }
    }

    const text = pageTexts.join('\n')
    return { text, rows: parseRosterRows(text), pages: pdf.numPages, usedOcr }
  } finally {
    await pdf.destroy()
  }
}

export async function extractAttendanceImage(file: File, onProgress: (label: string) => void) {
  onProgress('Menyiapkan OCR foto lembar presensi…')
  const worker = await createWorker(['ind', 'eng'])
  try {
    onProgress('Membaca teks dari foto…')
    const result = await worker.recognize(file)
    return result.data.text
  } finally {
    await worker.terminate()
  }
}

export async function extractRosterImage(file: File, onProgress: (label: string) => void) {
  onProgress('Menjalankan OCR Bahasa Indonesia pada gambar roster…')
  const worker = await createWorker(['ind', 'eng'])
  try {
    const result = await worker.recognize(file)
    const text = result.data.text
    return { text, rows: parseRosterRows(text), pages: 1, usedOcr: true }
  } finally {
    await worker.terminate()
  }
}

export type { RosterDraft }
