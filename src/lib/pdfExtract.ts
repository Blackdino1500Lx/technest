// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

async function extractFromBuffer(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lineMap = new Map<number, string[]>()
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5])
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(item.str)
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    for (const y of sortedYs) {
      const lineText = lineMap.get(y)!.join(' ').trim()
      if (lineText) fullText += lineText + '\n'
    }
    fullText += '\n'
  }
  return fullText.trim()
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return extractFromBuffer(buffer)
}

export async function extractTextFromUrl(url: string): Promise<string> {
  const resp   = await fetch(url)
  const buffer = await resp.arrayBuffer()
  return extractFromBuffer(buffer)
}