import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL  = 'edevcr25@gmail.com'
const MIN_AGE_DAYS = 3

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verificar que es el admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (user?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 })
    }

    const { dry_run } = await req.json().catch(() => ({ dry_run: false }))
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado en Supabase Secrets' }), { status: 500 })
    }

    // Cliente admin (service_role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Cargar plantilla
    let subject = '{nombre}, tu aula en TeachNest te está esperando'
    let htmlTemplate: string | null = null
    const { data: settings } = await supabase
      .from('app_settings').select('key, value').in('key', ['email_subject', 'email_html'])
    if (settings) {
      const sub  = settings.find(r => r.key === 'email_subject')
      const html = settings.find(r => r.key === 'email_html')
      if (sub)  subject      = sub.value
      if (html) htmlTemplate = html.value
    }

    // Buscar cuentas inactivas
    const { data: teachers, error: tErr } = await supabase
      .from('teachers').select('id, email, full_name, created_at').eq('plan', 'free')
    if (tErr) throw new Error(tErr.message)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - MIN_AGE_DAYS)
    const old = (teachers ?? []).filter(t => new Date(t.created_at) <= cutoff)

    const inactive = []
    for (const t of old) {
      const { count } = await supabase.from('students')
        .select('id', { count: 'exact', head: true }).eq('teacher_id', t.id)
      if ((count ?? 0) === 0) inactive.push(t)
    }

    if (inactive.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, recipients: [], message: 'No hay cuentas inactivas' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        recipients: inactive.map(t => ({ email: t.email, name: t.full_name })),
        count: inactive.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Enviar
    let sent = 0, failed = 0
    const results: { email: string; ok: boolean; error?: string }[] = []

    for (const teacher of inactive) {
      const name = teacher.full_name?.split(' ')[0] || 'Docente'
      const sub  = subject.replace(/\{nombre\}/g, name)
      const html = htmlTemplate
        ? htmlTemplate.replace(/\{nombre\}/g, name)
        : buildDefaultHtml(name)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'TeachNest <noreply@teachnest.app>',
          to: [teacher.email],
          subject: sub,
          html,
        }),
      })

      if (res.ok) { sent++; results.push({ email: teacher.email, ok: true }) }
      else {
        const err = await res.json().catch(() => ({}))
        failed++
        results.push({ email: teacher.email, ok: false, error: err.message ?? 'Error desconocido' })
      }

      await new Promise(r => setTimeout(r, 300))
    }

    return new Response(JSON.stringify({ sent, failed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildDefaultHtml(name: string): string {
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
<p>Notamos que creaste tu cuenta en TeachNest pero todavia no agregaste alumnos.</p>
<div class="feature"><div class="icon">📄</div><p><strong>Crea practicas desde PDF con IA</strong></p></div>
<div class="feature"><div class="icon">📖</div><p><strong>Asigna lecciones con video</strong></p></div>
<div class="feature"><div class="icon">📊</div><p><strong>Revisa entregas facilmente</strong></p></div>
<div class="cta"><a href="https://teachnest.app">Activar mi aula ahora</a></div>
</div>
<div class="footer">Recibiste este correo porque te registraste en TeachNest.</div>
</div></body></html>`
}
