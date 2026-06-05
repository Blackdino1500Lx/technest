import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL  = 'edevcr25@gmail.com'
const GRACE_DAYS   = 3

const ADDONS = [
  { id: 'branding',       label: '🎨 Branding' },
  { id: 'extra_students', label: '👥 +10 alumnos' },
  { id: 'reports',        label: '📄 Reportes' },
]

const DEFAULT_SUBJECT = '{nombre}, tu aula en TeachNest te está esperando'
const DEFAULT_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
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
<h2>Hola, {nombre}!</h2>
<p>Notamos que creaste tu cuenta en TeachNest pero todavia no agregaste alumnos. Te ayudamos a empezar.</p>
<div class="feature"><div class="icon">📄</div><p><strong>Crea practicas desde PDF con IA</strong> — subi el examen y extrae las preguntas en segundos.</p></div>
<div class="feature"><div class="icon">📖</div><p><strong>Asigna lecciones con video</strong> — los alumnos acceden con un simple PIN desde su celular.</p></div>
<div class="feature"><div class="icon">📊</div><p><strong>Revisa entregas facilmente</strong> — todo en un solo lugar, sin planillas.</p></div>
<div class="cta"><a href="https://teachnest.app">Activar mi aula ahora</a></div>
<p style="font-size:13px;color:#6b7280">Cualquier duda, respondé este correo y te ayudamos.</p>
</div>
<div class="footer">Recibiste este correo porque te registraste en TeachNest.<br>Si no queres recibirlos, respondé con "darme de baja".</div>
</div></body></html>`

interface Teacher {
  id: string; email: string; full_name: string | null
  school_name: string | null; plan: string
  add_ons: string[]; students_limit: number; created_at: string
}

type SaveState  = 'idle' | 'saving' | 'saved' | 'error'
type Tab        = 'teachers' | 'email'
type SendStatus = 'idle' | 'checking' | 'ready' | 'sending' | 'done' | 'error'

interface DryRunResult { email: string; name: string | null }
interface SendResult   { sent: number; failed: number; results: { email: string; ok: boolean; error?: string }[] }

function renewalInfo(createdAt: string) {
  const day = new Date(createdAt).getDate()
  const now  = new Date()
  let lastCut = new Date(now.getFullYear(), now.getMonth(), day)
  if (lastCut > now) lastCut = new Date(now.getFullYear(), now.getMonth() - 1, day)
  const nextCut = new Date(lastCut.getFullYear(), lastCut.getMonth() + 1, day)
  const daysSince = Math.floor((now.getTime() - lastCut.getTime()) / 86400000)
  const cutoffWithGrace = new Date(lastCut)
  cutoffWithGrace.setDate(cutoffWithGrace.getDate() + GRACE_DAYS)
  const overdue     = now > cutoffWithGrace
  const inGrace     = !overdue && daysSince > 0
  const daysOverdue = overdue ? Math.floor((now.getTime() - cutoffWithGrace.getTime()) / 86400000) : 0
  const daysLeft    = Math.ceil((nextCut.getTime() - now.getTime()) / 86400000)
  return { nextCutLabel: nextCut.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }),
    daysLeft, daysSince, daysOverdue, overdue, inGrace }
}

export default function AdminPanel() {
  const [authed,    setAuthed]    = useState<boolean | null>(null)
  const [tab,       setTab]       = useState<Tab>('teachers')
  const [teachers,  setTeachers]  = useState<Teacher[]>([])
  const [counts,    setCounts]    = useState<Record<string, number>>({})
  const [stats,     setStats]     = useState({ total: 0, active: 0, free: 0, students: 0 })
  const [saves,     setSaves]     = useState<Record<string, SaveState>>({})
  const [autoClosed, setAutoClosed] = useState<string[]>([])

  const [subject,      setSubject]      = useState(DEFAULT_SUBJECT)
  const [htmlBody,     setHtmlBody]     = useState(DEFAULT_HTML)
  const [templateSave, setTemplateSave] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [showPreview,  setShowPreview]  = useState(false)

  const [sendStatus,   setSendStatus]   = useState<SendStatus>('idle')
  const [dryRunList,   setDryRunList]   = useState<DryRunResult[]>([])
  const [sendResult,   setSendResult]   = useState<SendResult | null>(null)
  const [sendError,    setSendError]    = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === ADMIN_EMAIL) { setAuthed(true); loadData(); loadTemplate() }
      else setAuthed(false)
    })
  }, [])

  async function loadData() {
    const [{ data: tList }, { data: sList }] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('teacher_id'),
    ])
    let ts = (tList ?? []) as Teacher[]
    const cmap: Record<string, number> = {}
    for (const s of sList ?? []) cmap[s.teacher_id] = (cmap[s.teacher_id] ?? 0) + 1
    const toClose = ts.filter(t => t.plan === 'basic' && t.email !== ADMIN_EMAIL && renewalInfo(t.created_at).overdue)
    if (toClose.length > 0) {
      await Promise.all(toClose.map(t => supabase.from('teachers').update({ plan: 'free' }).eq('id', t.id)))
      ts = ts.map(t => toClose.find(c => c.id === t.id) ? { ...t, plan: 'free' } : t)
      setAutoClosed(toClose.map(t => t.email))
    }
    setTeachers(ts); setCounts(cmap)
    setStats({ total: ts.length, active: ts.filter(t => t.plan === 'basic').length,
      free: ts.filter(t => t.plan !== 'basic').length, students: (sList ?? []).length })
  }

  async function loadTemplate() {
    const { data } = await supabase.from('app_settings').select('key, value').in('key', ['email_subject', 'email_html'])
    if (!data) return
    const subRow  = data.find(r => r.key === 'email_subject')
    const htmlRow = data.find(r => r.key === 'email_html')
    if (subRow)  setSubject(subRow.value)
    if (htmlRow) setHtmlBody(htmlRow.value)
  }

  async function saveTemplate() {
    setTemplateSave('saving')
    const upserts = [
      { key: 'email_subject', value: subject,  updated_at: new Date().toISOString() },
      { key: 'email_html',    value: htmlBody, updated_at: new Date().toISOString() },
    ]
    const { error } = await supabase.from('app_settings').upsert(upserts, { onConflict: 'key' })
    setTemplateSave(error ? 'error' : 'saved')
    setTimeout(() => setTemplateSave('idle'), 2500)
  }

  async function callCampaign(dryRun: boolean) {
    setSendError('')
    setSendResult(null)
    setSendStatus(dryRun ? 'checking' : 'sending')
    try {
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: { dry_run: dryRun },
      })
      if (error) throw new Error(error.message)
      if (data.error) throw new Error(data.error)
      if (dryRun) {
        setDryRunList(data.recipients ?? [])
        setSendStatus('ready')
      } else {
        setSendResult(data)
        setSendStatus('done')
      }
    } catch (e: any) {
      setSendError(e.message)
      setSendStatus('error')
    }
  }

  async function toggleAccess(t: Teacher) {
    const newPlan = t.plan === 'basic' ? 'free' : 'basic'
    setSaveState(t.id, 'saving')
    const { error } = await supabase.from('teachers').update({ plan: newPlan }).eq('id', t.id)
    setSaveState(t.id, error ? 'error' : 'saved')
    if (!error) setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, plan: newPlan } : x))
  }

  async function toggleAddon(id: string, addonId: string, isOn: boolean) {
    setSaveState(id, 'saving')
    const t = teachers.find(t => t.id === id)!
    let addOns = [...(t.add_ons ?? [])]
    let limit  = t.students_limit ?? 30
    if (isOn) { addOns = addOns.filter(a => a !== addonId); if (addonId === 'extra_students') limit = Math.max(30, limit - 10) }
    else       { addOns = [...new Set([...addOns, addonId])]; if (addonId === 'extra_students') limit += 10 }
    const { error } = await supabase.from('teachers').update({ add_ons: addOns, students_limit: limit }).eq('id', t.id)
    setSaveState(id, error ? 'error' : 'saved')
    if (!error) setTeachers(prev => prev.map(t => t.id === id ? { ...t, add_ons: addOns, students_limit: limit } : t))
  }

  function setSaveState(id: string, state: SaveState) {
    setSaves(prev => ({ ...prev, [id]: state }))
    if (state === 'saved') setTimeout(() => setSaves(prev => ({ ...prev, [id]: 'idle' })), 2000)
  }

  function resetSend() { setSendStatus('idle'); setDryRunList([]); setSendResult(null); setSendError('') }

  if (authed === null) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner"/>
    </div>
  )

  if (!authed) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:'1rem' }}>
      <div style={{ fontSize:'2.5rem' }}>🔒</div>
      <p style={{ color:'#6B7280' }}>Acceso restringido</p>
      <a href="/" style={{ color:'var(--coral)', fontSize:'.9rem' }}>← Volver al inicio</a>
    </div>
  )

  const previewHtml = htmlBody.replace(/\{nombre\}/g, 'María')

  return (
    <div className="admin-root">
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">🛡️</span>
          <div><h1>TeachNest Admin</h1><span>{ADMIN_EMAIL}</span></div>
        </div>
        <div style={{ display:'flex', gap:'.75rem' }}>
          <button className="btn btn-sm btn-outline" onClick={() => { loadData(); loadTemplate() }}>↻ Actualizar</button>
          <a href="/" className="btn btn-sm btn-outline">← Salir</a>
        </div>
      </header>

      <div className="admin-body">
        {autoClosed.length > 0 && (
          <div className="admin-alert">
            ⚠️ Se cerró el acceso automáticamente a {autoClosed.length} academia(s): {autoClosed.join(', ')}
          </div>
        )}

        <div className="admin-stats">
          {([['Total academias', stats.total], ['Planes activos', stats.active], ['Sin pago', stats.free], ['Alumnos totales', stats.students]] as [string,number][]).map(([l, n]) => (
            <div key={l} className="admin-stat">
              <div className="admin-stat-n">{n}</div>
              <div className="admin-stat-l">{l}</div>
            </div>
          ))}
        </div>

        <div className="admin-tabs">
          <button className={tab === 'teachers' ? 'active' : ''} onClick={() => setTab('teachers')}>👥 Academias</button>
          <button className={tab === 'email'    ? 'active' : ''} onClick={() => setTab('email')}>✉️ Campaña de correo</button>
        </div>

        {/* ── Tab Teachers ── */}
        {tab === 'teachers' && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr>
                <th>Nombre / Email</th><th>Institución</th><th>Acceso</th>
                <th>Corte</th><th>Add-ons</th><th>Alumnos</th><th>Estado</th>
              </tr></thead>
              <tbody>
                {teachers.map(t => {
                  const addOns = t.add_ons ?? []
                  const save   = saves[t.id] ?? 'idle'
                  const ri     = renewalInfo(t.created_at)
                  const isOpen = t.plan === 'basic'
                  return (
                    <tr key={t.id}>
                      <td><strong>{t.full_name ?? '—'}</strong><br/><span className="admin-muted">{t.email}</span></td>
                      <td>{t.school_name ?? '—'}</td>
                      <td>
                        <button className={`admin-access-btn ${isOpen ? 'access-open' : 'access-closed'}`} onClick={() => toggleAccess(t)}>
                          {isOpen ? '🔓 Activo' : '🔒 Cerrado'}
                        </button>
                      </td>
                      <td>
                        {isOpen ? (
                          <div className="admin-renewal">
                            <span className="renewal-date">📅 {ri.nextCutLabel}</span>
                            {ri.inGrace
                              ? <span className="renewal-grace">⚠ Gracia ({GRACE_DAYS - ri.daysSince}d)</span>
                              : <span className="renewal-ok">{ri.daysLeft}d</span>}
                          </div>
                        ) : ri.overdue
                          ? <span className="renewal-overdue">Venció {ri.daysOverdue}d atrás</span>
                          : <span className="admin-muted">—</span>}
                      </td>
                      <td>
                        <div className="admin-addons">
                          {ADDONS.map(a => {
                            const on = addOns.includes(a.id)
                            return <button key={a.id} className={`admin-addon-btn ${on ? 'addon-on' : 'addon-off'}`} onClick={() => toggleAddon(t.id, a.id, on)}>{a.label}</button>
                          })}
                        </div>
                      </td>
                      <td className="admin-count">{counts[t.id] ?? 0} / {t.students_limit ?? 30}</td>
                      <td>
                        {save === 'saving' && <span className="admin-saving">Guardando…</span>}
                        {save === 'saved'  && <span className="admin-saved">✓</span>}
                        {save === 'error'  && <span className="admin-error">⚠</span>}
                      </td>
                    </tr>
                  )
                })}
                {teachers.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'#6B7280', padding:'2rem' }}>Sin academias registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab Email ── */}
        {tab === 'email' && (
          <div className="admin-email-editor">
            <div className="admin-email-note">
              Usá <code>{'{nombre}'}</code> para el primer nombre del docente. La plantilla se guarda en Supabase y la usa la campaña automáticamente.
            </div>

            <label className="admin-field-label">Asunto</label>
            <input className="admin-input" value={subject} onChange={e => setSubject(e.target.value)} />

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'1rem 0 .4rem' }}>
              <label className="admin-field-label" style={{ margin:0 }}>Cuerpo HTML</label>
              <button className="btn btn-sm btn-outline" onClick={() => setShowPreview(p => !p)}>
                {showPreview ? '⌨️ Editar' : '👁 Vista previa'}
              </button>
            </div>

            {showPreview
              ? <div className="admin-preview-wrap"><iframe srcDoc={previewHtml} title="preview" className="admin-preview-iframe" sandbox="allow-same-origin"/></div>
              : <textarea className="admin-textarea" rows={18} value={htmlBody} onChange={e => setHtmlBody(e.target.value)} spellCheck={false}/>
            }

            <div className="admin-email-actions">
              <button className="btn btn-primary" onClick={saveTemplate} disabled={templateSave === 'saving'}>
                {templateSave === 'saving' ? 'Guardando…' : '💾 Guardar plantilla'}
              </button>
              {templateSave === 'saved' && <span className="admin-saved">✓ Guardado</span>}
              {templateSave === 'error' && <span className="admin-error">⚠ Error</span>}
            </div>

            {/* ── Sección de envío ── */}
            <div className="admin-campaign-box">
              <h3 className="admin-campaign-title">📬 Enviar campaña de reactivación</h3>
              <p className="admin-campaign-desc">
                Envía la plantilla guardada a todos los docentes con plan <strong>free</strong> que llevan más de {3} días sin agregar alumnos.
              </p>

              {sendStatus === 'idle' && (
                <button className="btn btn-outline admin-campaign-check-btn" onClick={() => callCampaign(true)}>
                  🔍 Ver destinatarios
                </button>
              )}

              {sendStatus === 'checking' && (
                <div className="admin-campaign-loading"><div className="spinner sm"/> Buscando cuentas inactivas…</div>
              )}

              {sendStatus === 'ready' && (
                <div className="admin-campaign-ready">
                  {dryRunList.length === 0
                    ? <p className="admin-campaign-empty">✅ No hay cuentas inactivas en este momento.</p>
                    : <>
                        <p className="admin-campaign-count">Se enviará a <strong>{dryRunList.length}</strong> docente(s):</p>
                        <ul className="admin-campaign-list">
                          {dryRunList.map(r => (
                            <li key={r.email}><span className="admin-campaign-name">{r.name ?? '—'}</span><span className="admin-muted">{r.email}</span></li>
                          ))}
                        </ul>
                        <div style={{ display:'flex', gap:'.75rem', marginTop:'1rem' }}>
                          <button className="btn btn-primary" onClick={() => callCampaign(false)}>
                            🚀 Enviar ahora
                          </button>
                          <button className="btn btn-outline" onClick={resetSend}>Cancelar</button>
                        </div>
                      </>
                  }
                </div>
              )}

              {sendStatus === 'sending' && (
                <div className="admin-campaign-loading"><div className="spinner sm"/> Enviando correos…</div>
              )}

              {sendStatus === 'done' && sendResult && (
                <div className="admin-campaign-done">
                  <div className="admin-campaign-summary">
                    <span className="campaign-ok">✅ {sendResult.sent} enviados</span>
                    {sendResult.failed > 0 && <span className="campaign-fail">⚠ {sendResult.failed} fallidos</span>}
                  </div>
                  {sendResult.results.filter(r => !r.ok).map(r => (
                    <div key={r.email} className="admin-error" style={{ marginTop:'.35rem', fontSize:'.8rem' }}>
                      {r.email}: {r.error}
                    </div>
                  ))}
                  <button className="btn btn-outline" style={{ marginTop:'1rem' }} onClick={resetSend}>Nueva campaña</button>
                </div>
              )}

              {sendStatus === 'error' && (
                <div className="admin-campaign-error">
                  <span className="admin-error">⚠ {sendError}</span>
                  <button className="btn btn-outline" style={{ marginTop:'.75rem' }} onClick={resetSend}>Reintentar</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
