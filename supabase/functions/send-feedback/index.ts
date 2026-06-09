import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FEEDBACK_TO = 'edevcr25@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verificar sesion activa (cualquier profesor autenticado puede enviar feedback)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders })
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesion invalida' }), { status: 403, headers: corsHeaders })
    }

    const { type, message } = await req.json()
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Mensaje vacio' }), { status: 400, headers: corsHeaders })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado' }), { status: 500, headers: corsHeaders })
    }

    const typeLabels: Record<string, string> = {
      bug:        'Reporte de bug',
      sugerencia: 'Sugerencia de mejora',
      pregunta:   'Consulta',
    }
    const label   = typeLabels[type] ?? type
    const subject = `[TeachNest Feedback] ${label}`
    const html    = buildFeedbackHtml(label, message, user.email ?? 'desconocido')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TeachNest <noreply@teachnestcr.com>',
        to:   [FEEDBACK_TO],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message ?? 'Error al enviar con Resend')
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildFeedbackHtml(type: string, message: string, from: string): string {
  const safeMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f9fafb;margin:0;padding:0}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#1F2937,#374151);padding:24px 32px}
.header h1{color:#fff;margin:0;font-size:20px}.header p{color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px}
.body{padding:28px 32px;color:#374151;line-height:1.6}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:#FEF2F2;color:#DC2626;margin-bottom:16px}
.badge.sug{background:#ECFDF5;color:#059669}
.badge.preg{background:#EFF6FF;color:#2563EB}
.msg-box{background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:8px;padding:16px;font-size:14px;color:#1F2937;line-height:1.7}
.meta{margin-top:20px;font-size:12px;color:#9CA3AF}
</style></head><body><div class="wrap">
<div class="header"><h1>TeachNest Feedback</h1><p>Nuevo mensaje del panel del profesor</p></div>
<div class="body">
<span class="badge ${type === 'Sugerencia de mejora' ? 'sug' : type === 'Consulta' ? 'preg' : ''}">${type}</span>
<div class="msg-box">${safeMsg}</div>
<p class="meta">Enviado por: <strong>${from}</strong></p>
</div>
</div></body></html>`
}
