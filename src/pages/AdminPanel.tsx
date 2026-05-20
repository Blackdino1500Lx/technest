// src/pages/AdminPanel.tsx  — ruta /admin, solo accesible con el email de admin
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'salgueragonzaleze4@gmail.com'

const ADDONS = [
  { id: 'branding',       label: '🎨 Branding' },
  { id: 'extra_students', label: '👥 +10 alumnos' },
  { id: 'reports',        label: '📄 Reportes' },
]

interface Teacher {
  id: string; email: string; full_name: string | null
  school_name: string | null; plan: string
  add_ons: string[]; students_limit: number
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function AdminPanel() {
  const [authed,   setAuthed]   = useState<boolean | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [counts,   setCounts]   = useState<Record<string, number>>({})
  const [stats,    setStats]    = useState({ total: 0, active: 0, free: 0, students: 0 })
  const [saves,    setSaves]    = useState<Record<string, SaveState>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === ADMIN_EMAIL) { setAuthed(true); loadData() }
      else setAuthed(false)
    })
  }, [])

  async function loadData() {
    const [{ data: tList }, { data: sList }] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('teacher_id'),
    ])
    const ts = (tList ?? []) as Teacher[]
    const cmap: Record<string, number> = {}
    for (const s of sList ?? []) cmap[s.teacher_id] = (cmap[s.teacher_id] ?? 0) + 1
    setTeachers(ts); setCounts(cmap)
    setStats({ total: ts.length, active: ts.filter(t => t.plan === 'basic').length,
      free: ts.filter(t => t.plan !== 'basic').length, students: (sList ?? []).length })
  }

  async function setPlan(id: string, plan: string) {
    setSaveState(id, 'saving')
    const { error } = await supabase.from('teachers').update({ plan }).eq('id', id)
    setSaveState(id, error ? 'error' : 'saved')
    if (!error) setTeachers(prev => prev.map(t => t.id === id ? { ...t, plan } : t))
  }

  async function toggleAddon(id: string, addonId: string, isOn: boolean) {
    setSaveState(id, 'saving')
    const t = teachers.find(t => t.id === id)!
    let addOns = [...(t.add_ons ?? [])]
    let limit = t.students_limit ?? 30
    if (isOn) { addOns = addOns.filter(a => a !== addonId); if (addonId === 'extra_students') limit = Math.max(30, limit - 10) }
    else       { addOns = [...new Set([...addOns, addonId])]; if (addonId === 'extra_students') limit += 10 }
    const { error } = await supabase.from('teachers').update({ add_ons: addOns, students_limit: limit }).eq('id', id)
    setSaveState(id, error ? 'error' : 'saved')
    if (!error) setTeachers(prev => prev.map(t => t.id === id ? { ...t, add_ons: addOns, students_limit: limit } : t))
  }

  function setSaveState(id: string, state: SaveState) {
    setSaves(prev => ({ ...prev, [id]: state }))
    if (state === 'saved') setTimeout(() => setSaves(prev => ({ ...prev, [id]: 'idle' })), 2000)
  }

  if (authed === null) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><div className="spinner"/></div>

  if (!authed) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:'1rem' }}>
      <div style={{ fontSize:'2.5rem' }}>🔒</div>
      <p style={{ color:'#6B7280' }}>Acceso restringido</p>
      <a href="/" style={{ color:'var(--coral)', fontSize:'.9rem' }}>← Volver al inicio</a>
    </div>
  )

  return (
    <div className="admin-root">
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">🛡️</span>
          <div><h1>TeachNest Admin</h1><span>{ADMIN_EMAIL}</span></div>
        </div>
        <div style={{ display:'flex', gap:'.75rem' }}>
          <button className="btn btn-sm btn-outline" onClick={loadData}>↻ Actualizar</button>
          <a href="/" className="btn btn-sm btn-outline">← Salir</a>
        </div>
      </header>

      <div className="admin-body">
        <div className="admin-stats">
          {[['Total academias', stats.total, ''], ['Planes activos', stats.active, 'color:var(--coral)'],
            ['Pendientes de pago', stats.free, ''], ['Alumnos totales', stats.students, '']].map(([l, n, s]) => (
            <div key={String(l)} className="admin-stat">
              <div className="admin-stat-n" style={{ [s ? 'color' : '']: s ? 'var(--coral)' : '' }}>{String(n)}</div>
              <div className="admin-stat-l">{String(l)}</div>
            </div>
          ))}
        </div>

        <h2 className="admin-section-title">Academias registradas</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Nombre / Email</th><th>Institución</th><th>Plan</th>
              <th>Add-ons</th><th>Alumnos</th><th>Estado</th>
            </tr></thead>
            <tbody>
              {teachers.map(t => {
                const addOns = t.add_ons ?? []
                const save = saves[t.id] ?? 'idle'
                return (
                  <tr key={t.id}>
                    <td><strong>{t.full_name ?? '—'}</strong><br/><span className="admin-muted">{t.email}</span></td>
                    <td>{t.school_name ?? '—'}</td>
                    <td>
                      <select className="admin-plan-sel" value={t.plan} onChange={e => setPlan(t.id, e.target.value)}>
                        <option value="free">🔒 Free</option>
                        <option value="basic">✅ Basic</option>
                      </select>
                    </td>
                    <td>
                      <div className="admin-addons">
                        {ADDONS.map(a => {
                          const on = addOns.includes(a.id)
                          return <button key={a.id} className={`admin-addon-btn ${on ? 'addon-on' : 'addon-off'}`}
                            onClick={() => toggleAddon(t.id, a.id, on)}>{a.label}</button>
                        })}
                      </div>
                    </td>
                    <td className="admin-count">{counts[t.id] ?? 0} / {t.students_limit ?? 30}</td>
                    <td>
                      {save === 'saving' && <span className="admin-saving">Guardando…</span>}
                      {save === 'saved'  && <span className="admin-saved">✓ Guardado</span>}
                      {save === 'error'  && <span className="admin-error">⚠ Error</span>}
                    </td>
                  </tr>
                )
              })}
              {teachers.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'#6B7280', padding:'2rem' }}>Sin academias registradas</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
