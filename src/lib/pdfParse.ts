export interface ParsedQuestion {
  num:     number
  text:    string
  options: string[]
}

const SKIP_PATTERNS = [
  /^Práctica de Matemáticas/,
  /^Matemáticas (Sétimo|Octavo|Noveno|Bachillerato)/,
  /^Matemática Bachillerato/,
  /^SELECCIÓN ÚNICA/,
  /^\d+ ÍTEMS$/,
  /^ÍTEMS$/,
  /^MINISTERIO/,
  /^DIRECCIÓN/,
  /^DEPARTAMENTO/,
  /^Recomendaciones/,
  /^Tercer Ciclo/,
  /^General Básica/,
  /^Convenio MEP/,
  /^Convocatoria/,
  /^BxM$/,
  /^_{5,}/,
  /^\d+$/,
]

export function parseQuestionsFromText(rawText: string): ParsedQuestion[] {
  const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const lines    = allLines.filter(l => !SKIP_PATTERNS.some(p => p.test(l)))

  const questions: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null
  let inOptions = false

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Format 1: "1)" or "1) texto"  — 7°, 8°, 9°
    // Format 2: "9. ¿Cuál..."       — Bachillerato
    const qParen = /^(\d+)\s*\)\s*(.*)/.exec(line)
    const qDot   = /^(\d+)\.\s+(.+)/.exec(line)

    const isQParen = qParen && !/^[A-D]\s*\)/.test(line)
    const isQDot   = qDot && !/^[A-D]\./.test(line) && parseInt(qDot[1]) <= 100

    const qMatch = isQParen ? qParen : isQDot ? qDot : null

    if (qMatch) {
      if (current && current.options.length >= 3) questions.push(current)
      current   = { num: parseInt(qMatch[1]), text: qMatch[2].trim(), options: [] }
      inOptions = false
      i++
      continue
    }

    if (!current) { i++; continue }

    // Options: "A) texto" or "A) " alone (both . and ) separators)
    const optMatch = /^([A-D])[.)]\s*(.*)/.exec(line)
    if (optMatch) {
      inOptions = true
      const val: string[] = optMatch[2] ? [optMatch[2]] : []
      let j = i + 1
      while (j < lines.length && !/^[A-D][.)]\s*|^\d+[.)]\s/.test(lines[j])) {
        val.push(lines[j])
        j++
      }
      current.options.push(val.join(' ').trim())
      i = j
      continue
    }

    if (!inOptions) {
      current.text += (current.text ? ' ' : '') + line
    }
    i++
  }

  if (current && current.options.length >= 3) questions.push(current)
  return questions
}