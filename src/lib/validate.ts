/**
 * validate.ts — Validación y sanitización de inputs
 *
 * Centraliza todas las reglas de validación antes de que los datos
 * lleguen a Supabase. No reemplaza RLS, lo complementa.
 */

import type { Subject, Grade, Level } from './types'

// ── Constantes ───────────────────────────────────────────────────────
const ALLOWED_SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés', 'Informática']
const ALLOWED_GRADES:   Grade[]   = ['7° Grado','8° Grado','9° Grado','10° Grado','11° Grado','Universitario','Adulto','Técnico']
const ALLOWED_LEVELS:   Level[]   = ['Básico','Intermedio','Avanzado']

const ALLOWED_DOC_EXTENSIONS  = ['pdf','doc','docx','ppt','pptx','txt']
const ALLOWED_IMAGE_EXTENSIONS = ['jpg','jpeg','png','webp','gif']
const ALLOWED_EXTENSIONS       = [...ALLOWED_DOC_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS, 'zip']
const MAX_FILE_SIZE_MB         = 20

// Extensiones que NUNCA se deben aceptar
const DANGEROUS_EXTENSIONS = ['exe','bat','cmd','sh','ps1','msi','vbs','js','ts','php','py','rb','jar','apk']

// ── Clase de error de validación ─────────────────────────────────────
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function fail(msg: string): never { throw new ValidationError(msg) }

// ── Primitivos ───────────────────────────────────────────────────────

/** Texto genérico: no vacío, sin caracteres nulos, longitud máxima */
export function validateText(value: string, label: string, maxLen = 500): string {
  const v = value.trim()
  if (!v)                 fail(`${label} no puede estar vacío.`)
  if (v.length > maxLen)  fail(`${label} no puede superar ${maxLen} caracteres.`)
  if (/\0/.test(v))       fail(`${label} contiene caracteres inválidos.`)
  return v
}

/** Título: máx 200 caracteres */
export function validateTitle(title: string): string {
  return validateText(title, 'El título', 200)
}

/** Descripción/contenido: máx 5000 caracteres */
export function validateContent(content: string): string {
  return validateText(content, 'El contenido', 5000)
}

/** PIN: solo dígitos, 4-6 caracteres */
export function validatePin(pin: string): string {
  const v = pin.trim()
  if (!/^\d{4,6}$/.test(v)) fail('El PIN debe tener entre 4 y 6 dígitos numéricos.')
  return v
}

/** Nombre de persona: letras, espacios, tildes, guiones */
export function validateName(value: string, label: string): string {
  const v = validateText(value, label, 80)
  if (!/^[\p{L}\s'\-\.]+$/u.test(v)) fail(`${label} contiene caracteres no permitidos.`)
  return v
}

/** Email básico */
export function validateEmail(email: string): string {
  const v = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('El correo electrónico no es válido.')
  return v
}

/** Contraseña: mínimo 8 caracteres, al menos 1 número */
export function validatePassword(pw: string): void {
  if (pw.length < 8)      fail('La contraseña debe tener al menos 8 caracteres.')
  if (!/\d/.test(pw))     fail('La contraseña debe contener al menos un número.')
  if (!/[a-zA-Z]/.test(pw)) fail('La contraseña debe contener al menos una letra.')
}

/** Materia — debe ser una de las permitidas */
export function validateSubject(subject: string): Subject {
  if (!ALLOWED_SUBJECTS.includes(subject as Subject))
    fail(`Materia inválida: "${subject}".`)
  return subject as Subject
}

/** Grado */
export function validateGrade(grade: string): Grade {
  if (!ALLOWED_GRADES.includes(grade as Grade))
    fail(`Grado inválido: "${grade}".`)
  return grade as Grade
}

/** Nivel */
export function validateLevel(level: string): Level {
  if (!ALLOWED_LEVELS.includes(level as Level))
    fail(`Nivel inválido: "${level}".`)
  return level as Level
}

/** UUID v4 */
export function validateUUID(id: string, label = 'ID'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    fail(`${label} tiene un formato inválido.`)
  return id
}

/** Fecha ISO (YYYY-MM-DD) */
export function validateDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('La fecha no tiene el formato correcto (YYYY-MM-DD).')
  const d = new Date(date)
  if (isNaN(d.getTime())) fail('La fecha no es válida.')
  return date
}

// ── URLs ─────────────────────────────────────────────────────────────

/** Sanitiza una URL: bloquea javascript:, data:, vbscript: y similares */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const v = url.trim()
  // Bloquea protocolos peligrosos
  if (/^(javascript|data|vbscript|blob):/i.test(v)) {
    console.warn('[Security] URL con protocolo peligroso bloqueada:', v.slice(0, 60))
    return undefined
  }
  // Debe empezar con https:// o http://
  if (!/^https?:\/\//i.test(v)) return undefined
  return v
}

/** Valida URL de YouTube y retorna el ID del video */
export function validateYoutubeUrl(url: string): string {
  const v = sanitizeUrl(url)
  if (!v) fail('La URL de YouTube no es válida.')
  const m = v.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  if (!m) fail('La URL de YouTube no es válida. Usá el formato https://www.youtube.com/watch?v=...')
  return v
}

/** Valida que una URL sea de Supabase Storage (para fileUrl) */
export function validateStorageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const v = sanitizeUrl(url)
  if (!v) return undefined
  // Acepta solo URLs de Supabase storage o supabase.co
  if (!v.includes('supabase.co') && !v.includes('supabase.in')) {
    console.warn('[Security] URL de storage no reconocida bloqueada:', v.slice(0, 60))
    return undefined
  }
  return v
}

// ── Archivos ─────────────────────────────────────────────────────────

export interface FileValidationOptions {
  allowedExtensions?: string[]
  maxSizeMB?: number
  imagesOnly?: boolean
}

/** Valida un archivo antes de subirlo */
export function validateFile(file: File, opts: FileValidationOptions = {}): void {
  const {
    allowedExtensions = ALLOWED_EXTENSIONS,
    maxSizeMB = MAX_FILE_SIZE_MB,
    imagesOnly = false,
  } = opts

  // Extensión
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ext) fail('El archivo no tiene extensión.')

  if (DANGEROUS_EXTENSIONS.includes(ext))
    fail(`Archivos .${ext} no están permitidos por razones de seguridad.`)

  const allowed = imagesOnly ? ALLOWED_IMAGE_EXTENSIONS : allowedExtensions
  if (!allowed.includes(ext))
    fail(`Tipo de archivo no permitido (.${ext}). Permitidos: ${allowed.join(', ')}.`)

  // Tamaño
  if (file.size > maxSizeMB * 1024 * 1024)
    fail(`El archivo supera el límite de ${maxSizeMB} MB.`)

  if (file.size === 0)
    fail('El archivo está vacío.')
}

/** Valida un archivo de imagen específicamente */
export function validateImageFile(file: File): void {
  validateFile(file, { imagesOnly: true, maxSizeMB: 5 })
}

/** Valida un archivo de documento (PDF, Word, PPT) */
export function validateDocFile(file: File): void {
  validateFile(file, { allowedExtensions: ALLOWED_DOC_EXTENSIONS, maxSizeMB: MAX_FILE_SIZE_MB })
}

/** Valida un archivo ZIP */
export function validateZipFile(file: File): void {
  validateFile(file, { allowedExtensions: ['zip'], maxSizeMB: MAX_FILE_SIZE_MB })
}

// ── Preguntas ────────────────────────────────────────────────────────
export function validateQuestion(q: { text: string; type: string; points: number; options?: string[] }): void {
  validateText(q.text, 'El enunciado de la pregunta', 1000)
  if (!['open','multiple'].includes(q.type)) fail('Tipo de pregunta inválido.')
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > 100)
    fail('El puntaje debe ser un número entero entre 1 y 100.')
  if (q.type === 'multiple') {
    if (!Array.isArray(q.options) || q.options.length < 2)
      fail('Las preguntas de opción múltiple necesitan al menos 2 opciones.')
    q.options.forEach((opt, i) => {
      if (opt.trim().length === 0) fail(`La opción ${String.fromCharCode(65+i)} no puede estar vacía.`)
      if (opt.length > 500) fail(`La opción ${String.fromCharCode(65+i)} es demasiado larga.`)
    })
  }
}
