/**
 * rateLimiter.ts — Protección contra brute-force de PIN
 *
 * In-memory (sessionStorage). Los intentos fallidos se acumulan
 * por teacherId+pin para evitar enumeración, no por alumno.
 * Si hay 5 fallos en 5 minutos → bloqueo de 15 minutos.
 */

const MAX_ATTEMPTS   = 5
const WINDOW_MS      = 5  * 60 * 1000  // 5 minutos
const LOCKOUT_MS     = 15 * 60 * 1000  // 15 minutos

interface BucketData {
  count:     number
  windowStart: number
  lockedUntil: number
}

function key(teacherId: string): string {
  return `ratelimit_pin_${teacherId}`
}

function getBucket(teacherId: string): BucketData {
  try {
    const raw = sessionStorage.getItem(key(teacherId))
    if (raw) return JSON.parse(raw) as BucketData
  } catch {}
  return { count: 0, windowStart: Date.now(), lockedUntil: 0 }
}

function saveBucket(teacherId: string, bucket: BucketData): void {
  try { sessionStorage.setItem(key(teacherId), JSON.stringify(bucket)) } catch {}
}

/** Llama esto ANTES de intentar el login con PIN.
 *  Lanza un error descriptivo si el usuario está bloqueado.
 */
export function checkPinAllowed(teacherId: string): void {
  const bucket = getBucket(teacherId)
  const now = Date.now()

  if (bucket.lockedUntil > now) {
    const mins = Math.ceil((bucket.lockedUntil - now) / 60000)
    throw new Error(`Demasiados intentos fallidos. Intentá de nuevo en ${mins} minuto${mins !== 1 ? 's' : ''}.`)
  }

  // Resetear ventana si ya expiró
  if (now - bucket.windowStart > WINDOW_MS) {
    saveBucket(teacherId, { count: 0, windowStart: now, lockedUntil: 0 })
  }
}

/** Llama esto cuando el PIN es INCORRECTO */
export function recordPinFailure(teacherId: string): void {
  const bucket = getBucket(teacherId)
  const now = Date.now()

  // Resetear ventana si expiró
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.count = 0
    bucket.windowStart = now
  }

  bucket.count += 1

  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.lockedUntil = now + LOCKOUT_MS
    bucket.count = 0
    bucket.windowStart = now
  }

  saveBucket(teacherId, bucket)
}

/** Llama esto cuando el PIN es CORRECTO — limpia los intentos */
export function recordPinSuccess(teacherId: string): void {
  try { sessionStorage.removeItem(key(teacherId)) } catch {}
}

/** Retorna cuántos intentos quedan antes del bloqueo (o null si no aplica) */
export function getPinAttemptsLeft(teacherId: string): number | null {
  const bucket = getBucket(teacherId)
  const now = Date.now()
  if (bucket.lockedUntil > now) return 0
  if (now - bucket.windowStart > WINDOW_MS) return null
  const left = MAX_ATTEMPTS - bucket.count
  return left > 0 ? left : 0
}
