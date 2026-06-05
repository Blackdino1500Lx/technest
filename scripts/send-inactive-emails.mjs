import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Auto-cargar .env
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (k && !(k in process.env)) process.env[k] = v
  }
}

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GMAIL_USER           = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD   = process.env.GMAIL_APP_PASSWORD
const DRY_RUN              = process.argv.includes('--dry-run')
const MIN_AGE_DAYS         = 3

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('ERROR: Faltan variables en el archivo .env')
  console.error('Necesitas: SUPABASE_URL, SUPABASE_SERVICE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, '') },
})

// Plantilla por defecto (se sobreescribe si hay una guardada en Supabase)
let EMAIL_SUBJECT = '{nombre}, tu aula en TeachNest te está esperando'
let EMAIL_HTML    = null  // null = usar buildDefaultHtml()

async function loadTemplate() {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['email_subject', 'email_html'])
  if (!data || data.length === 0) { console.log('  (usando plantilla por defecto)'); return }
  const sub  = data.find(r => r.key === 'email_subject')
  const html = data.find(r => r.key === 'email_html')
  if (sub)  { EMAIL_SUBJECT = sub.value;  console.log('  Asunto cargado desde Supabase') }
  if (html) { EMAIL_HTML    = html.value; console.log('  HTML cargado desde Supabase') }
}

function buildDefaultHtml(name) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f9fafb;margin:0;padding:0}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#e85d3f,#f97316);padding:32px;text-align:center}
.header h1{color:#fff;margin:0;font-size:28px}.header p{color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px}
.body{padding:32px;color:#374151;line-height:1.6}.body h2{margin-top:0;color:#111827}
.feature{display:flex;gap:12px;margin:16px 0;padding:14px;background:#f9fafb;border-radius:8px}
.feature .icon{font-size:24px;flex-shrink:0}.feature p{margin:0;font-size:14px}
.cta{text-align:center;margin:28px 0}
.cta a{background:#e85d3f;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block}
.footer{background:#f3f4f6;padding:20px 32px;font-size:12px;color:#9ca3af;text-align:center}
</style></head><body><div class="wrap">
<div class="header"><h1>TeachNest</h1><p>Tu plataforma educativa</p></div>
<div class="body">
<h2>Hola, ${name}!</h2>
<p>Notamos que creaste tu cuenta en TeachNest pero todavia no agregaste alumnos. Te ayudamos a empezar.</p>
<div class="feature"><div class="icon">📄</div><p><strong>Crea practicas desde PDF con IA</strong> — subi el examen y extrae las preguntas en segundos.</p></div>
<div class="feature"><div class="icon">📖</div><p><strong>Asigna lecciones con video</strong> — los alumnos acceden con un simple PIN desde su celular.</p></div>
<div class="feature"><div class="icon">📊</div><p><strong>Revisa entregas facilmente</strong> — todo en un solo lugar, sin planillas.</p></div>
<div class="cta"><a href="https://teachnest.app">Activar mi aula ahora</a></div>
<p style="font-size:13px;color:#6b7280">Cualquier duda, respondé este correo y te ayudamos.</p>
</div>
<div class="footer">Recibiste este correo porque te registraste en TeachNest.<br>Si no queres recibirlos, respondé con "darme de baja".</div>
</div></body></html>`
}

function buildEmail(teacher) {
  const name = teacher.full_name?.split(' ')[0] || 'Docente'
  const subject = EMAIL_SUBJECT.replace(/\{nombre\}/g, name)
  const html = EMAIL_HTML
    ? EMAIL_HTML.replace(/\{nombre\}/g, name)
    : buildDefaultHtml(name)
  const text = `Hola ${name}!\n\nNotamos que creaste tu cuenta en TeachNest pero todavia no agregaste alumnos.\n\nEntra a https://teachnest.app para activar tu aula.\n\nTeachNest`
  return { subject, html, text }
}

async function getInactiveTeachers() {
  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, email, full_name, school_name, created_at')
    .eq('plan', 'free')
  if (error) throw new Error('Error consultando teachers: ' + error.message)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - MIN_AGE_DAYS)
  const old = teachers.filter(t => new Date(t.created_at) <= cutoff)

  const inactive = []
  for (const t of old) {
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', t.id)
    if ((count ?? 0) === 0) inactive.push(t)
  }
  return inactive
}

async function main() {
  console.log('\nTeachNest - Campana de reactivacion')
  console.log('Modo: ' + (DRY_RUN ? 'DRY RUN (no envia)' : 'ENVIO REAL') + '\n')

  console.log('Cargando plantilla...')
  await loadTemplate()

  console.log('Buscando cuentas inactivas...')
  const teachers = await getInactiveTeachers()

  if (teachers.length === 0) {
    console.log('No hay cuentas inactivas que cumplan los criterios.')
    return
  }

  console.log(teachers.length + ' cuenta(s) inactiva(s):\n')
  teachers.forEach((t, i) => {
    console.log('  ' + (i+1) + '. ' + t.email + ' - ' + (t.full_name || '(sin nombre)') + ' - creada: ' + t.created_at.slice(0, 10))
  })

  if (DRY_RUN) {
    console.log('\nQuitá --dry-run para enviar de verdad.')
    return
  }

  console.log('\nEnviando correos...\n')
  let ok = 0, fail = 0
  for (const teacher of teachers) {
    const { subject, html, text } = buildEmail(teacher)
    try {
      await transporter.sendMail({
        from: '"TeachNest" <' + GMAIL_USER + '>',
        to: teacher.email,
        subject,
        text,
        html,
      })
      console.log('  OK: ' + teacher.email)
      ok++
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.error('  FALLO: ' + teacher.email + ': ' + e.message)
      fail++
    }
  }
  console.log('\nEnviados: ' + ok + (fail > 0 ? '  Fallidos: ' + fail : ''))
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
