import { useState, useEffect } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { applyTheme } from '../lib/theme'
import type { TeacherProfile, Student, Lesson, Practice, Submission, Grade, Level, Subject } from '../lib/types'
import { LogOut, Users, BookOpen, FileText, ClipboardList, Settings, Plus, Trash2, Check, X, ChevronDown, ChevronUp, Pencil, Library, LifeBuoy } from 'lucide-react'
import CreatePracticeModal from './CreatePracticeModal'
import LibraryTab from './LibraryTab'
import LessonsTab from './LessonsTab'
import { supabase } from '../lib/supabase'

// ── Sandbox answer viewer ────────────────────────────────────────
function parseSandboxVal(v: string | number | undefined): { html: string; css: string; js: string } | null {
  if (typeof v !== 'string') return null
  try {
    const p = JSON.parse(v)
    if (p && typeof p === 'object' && ('html' in p || 'css' in p || 'js' in p))
      return { html: p.html ?? '', css: p.css ?? '', js: p.js ?? '' }
  } catch { /* not JSON */ }
  return null
}

function buildPreview(c: { html: string; css: string; js: string }): string {
  const safeJs = c.js.replace(/<\/script>/gi, '<\/script>')
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>${c.css}</style></head><body>${c.html}<script>${safeJs}<\/script></body></html>`
}

function SandboxAnswerView({ value }: { value: string | number | undefined }) {
  const [tab, setTab] = useState<'html' | 'css' | 'js'>('html')
  const [preview, setPreview] = useState(false)
  const code = parseSandboxVal(value)
  if (!code) return <em style={{ color: 'var(--muted)' }}>Sin respuesta</em>
  const tabs: Array<{ id: 'html' | 'css' | 'js'; label: string }> = [
    { id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' }, { id: 'js', label: 'JS' },
  ]
  return (
    <div style={{ marginTop: 6, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border,#E5E0D8)' }}>
      <div style={{ display: 'flex', background: '#1F2937', padding: '4px 8px', gap: 4, alignItems: 'center' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setPreview(false) }}
            style={{ padding: '2px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600,
              background: !preview && tab === t.id ? '#374151' : 'transparent',
              color: !preview && tab === t.id ? '#fff' : '#9CA3AF' }}>
            {t.label}
          </button>
        ))}
        <button onClick={() => setPreview(true)}
          style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
            fontSize: '.78rem', fontWeight: 600,
            background: preview ? '#1E9E8E' : 'transparent', color: preview ? '#fff' : '#9CA3AF' }}>
          ▶ Vista previa
        </button>
      </div>
      {preview
        ? <iframe srcDoc={buildPreview(code)} sandbox=allow-scripts title=preview
            style={{ width: '100%', height: 180, border: 'none', background: '#fff' }}/>
        : <pre style={{ margin: 0, padding: '10px 12px', background: '#111827', color: '#E5E7EB',
            fontSize: '.78rem', overflowX: 'auto', minHeight: 60, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {code[tab] || <em style={{ color: '#6B7280' }}>Vacío</em>}
          </pre>
      }
    </div>
  )
}

interface Props {
  profile: TeacherProfile
  onProfileUpdate: (p: TeacherProfile) => void
  onSignOut: () => void
}

type Tab = 'students' | 'library' | 'lessons' | 'practices' | 'reviews' | 'settings' | 'resources'
const GRADES: Grade[] = ['7° Grado','8° Grado','9° Grado','10° Grado','11° Grado','Universitario','Adulto','Técnico']
const LEVELS: Level[] = ['Básico','Intermedio','Avanzado']
const SUBJECTS: Subject[] = ['Matemáticas','Español','Ciencias','Estudios Sociales','Inglés','Informática']
const uid = () => Math.random().toString(36).slice(2, 10)

export default function TeacherPortal({ profile, onProfileUpdate, onSignOut }: Props) {
  const [tab, setTab]             = useState<Tab>('students')
  const [students, setStudents]   = useState<Student[]>([])
  const [lessons, setLessons]     = useState<Lesson[]>([])
  const [practices, setPractices] = useState<Practice[]>([])
  const [subs, setSubs]           = useState<Submission[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [ss, ls, ps, su] = await Promise.all([
        db.students.getAll(), db.lessons.getAll(),
        db.practices.getAll(), db.submissions.getAll(),
      ])
      setStudents(ss); setLessons(ls); setPractices(ps); setSubs(su)
    } finally { setLoading(false) }
  }

  const pendingCount = subs.filter(s => !s.reviewed).length

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="sidebar-topbar">
          <div className="sidebar-logo">{profile.logoText}</div>
        </div>
        <nav className="sidebar-nav">
          {([
            ['students',  'Alumnos',    <Users size={20}/>],
            ['library',   'Biblioteca', <Library size={20}/>],
            ['lessons',   'Lecciones',  <BookOpen size={20}/>],
            ['practices', 'Prácticas',  <FileText size={20}/>],
            ['reviews',   'Revisiones', <ClipboardList size={20}/>],
            ['settings',  'Ajustes',    <Settings size={20}/>],
            ['resources', 'Recursos',   <LifeBuoy size={20}/>],
          ] as [Tab, string, React.ReactNode][]).map(([t, label, icon]) => (
            <button key={t} className={`sidebar-item ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {icon} <span className="sidebar-label">{label}</span>
              {t === 'reviews' && pendingCount > 0 && <span className="badge">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <button className="sidebar-signout" onClick={onSignOut}><LogOut size={16}/> <span>Salir</span></button>
      </aside>

      <main className="portal-main">
        {loading ? <div className="portal-loading"><div className="spinner"/></div> : (
          <>
            {tab === 'students'  && <StudentsTab  students={students}  onReload={loadAll} profile={profile}/>}
            {tab === 'library'   && <LibraryTab   lessons={lessons} students={students} onReload={loadAll}/>}
            {tab === 'lessons'   && <LessonsTab   lessons={lessons}    students={students} onReload={loadAll}/>}
            {tab === 'practices' && <PracticesTab practices={practices} students={students} onReload={loadAll}/>}
            {tab === 'reviews'   && <ReviewsTab   subs={subs} students={students} practices={practices} onReload={loadAll}/>}
            {tab === 'settings'  && <SettingsTab  profile={profile} onProfileUpdate={onProfileUpdate}/>}
            {tab === 'resources' && <ResourcesTab profile={profile}/>}
          </>
        )}
      </main>

      <WhatsNewBanner/>
    </div>
  )
}

// ── STUDENTS TAB ─────────────────────────────────────────────────────
function StudentsTab({ students, onReload, profile }: { students: Student[]; onReload: () => void; profile: TeacherProfile }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string|null>(null)
  const [fn, setFn]   = useState(''); const [ln, setLn] = useState('')
  const [grade, setGrade] = useState<Grade>('10° Grado')
  const [level, setLevel] = useState<Level>('Básico')
  const [pin, setPin]     = useState(() => Math.floor(1000+Math.random()*9000).toString())
  const [saving, setSaving] = useState(false)
  const genPin = () => Math.floor(1000+Math.random()*9000).toString()

  const openNew = () => { setEditId(null); setFn(''); setLn(''); setGrade('10° Grado'); setLevel('Básico'); setPin(genPin()); setShowForm(true) }
  const openEdit = (s: Student) => { setEditId(s.id); setFn(s.firstName); setLn(s.lastName); setGrade(s.grade); setLevel(s.level); setPin(s.pin); setShowForm(true) }
  const cancel = () => { setShowForm(false); setEditId(null) }

  const save = async () => {
    if (!fn.trim() || !ln.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await db.students.update({ id: editId, firstName: fn, lastName: ln, grade, level, pin })
      } else {
        await db.students.add({ firstName: fn, lastName: ln, grade, level, pin })
      }
      cancel(); onReload()
    } finally { setSaving(false) }
  }

  const atLimit = students.length >= profile.studentsLimit

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Alumnos ({students.length}/{profile.studentsLimit})</h2>
        <button className="btn-primary" onClick={openNew} disabled={atLimit && !editId}>
          <Plus size={14}/> Nuevo alumno
        </button>
      </div>
      {atLimit && !editId && <div className="limit-warning">Alcanzaste el límite de alumnos. Mejorá tu plan para agregar más.</div>}

      {showForm && (
        <div className="form-card">
          <h3>{editId ? 'Editar alumno' : 'Nuevo alumno'}</h3>
          <div className="form-row">
            <div className="field"><label>Nombre</label><input value={fn} onChange={e => setFn(e.target.value)}/></div>
            <div className="field"><label>Apellido</label><input value={ln} onChange={e => setLn(e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Grado</label>
              <select value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field"><label>Nivel</label>
              <select value={level} onChange={e => setLevel(e.target.value as Level)}>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="field"><label>PIN</label>
              <div className="pin-row">
                <input value={pin} onChange={e => setPin(e.target.value)} maxLength={6}/>
                <button className="btn-ghost" onClick={() => setPin(genPin())}>↻</button>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={cancel}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="list">
        {students.length === 0 ? <p className="empty-msg">Aún no hay alumnos registrados.</p> :
          students.map(s => (
            <div key={s.id} className="list-row">
              <div className="avatar">{s.firstName[0]}{s.lastName[0]}</div>
              <div className="list-info">
                <strong>{s.firstName} {s.lastName}</strong>
                <span>{s.grade} · {s.level}</span>
              </div>
              <span className="pin-display">🔒 PIN: {s.pin}</span>
              <button className="icon-btn" onClick={() => openEdit(s)}><Pencil size={14}/></button>
              <button className="icon-btn danger" onClick={async () => { await db.students.delete(s.id); onReload() }}><Trash2 size={14}/></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}


// ── PRACTICES TAB ────────────────────────────────────────────────────
function PracticesTab({ practices, students, onReload }: { practices: Practice[]; students: Student[]; onReload: () => void }) {
  const [showForm, setShowForm]         = useState(false)
  const [editPractice, setEditPractice]   = useState<Practice|null>(null)
  const [pdfModal, setPdfModal]           = useState<File|null>(null)
  const [title, setTitle]           = useState('')
  const [subject, setSubject]       = useState<Subject>('Matemáticas')
  const [desc, setDesc]             = useState('')
  const [questions, setQuestions]   = useState<any[]>([])
  const [assigned, setAssigned]     = useState<string[]>([])
  const [dueDate, setDueDate]       = useState('')
  const [pdfFile, setPdfFile]         = useState<File|null>(null)
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState('')
  const [saving, setSaving]           = useState(false)

  const openNew = () => {
    setEditPractice(null); setTitle(''); setSubject('Matemáticas')
    setDesc(''); setQuestions([]); setAssigned([]); setDueDate(''); setPdfFile(null); setGenError(''); setShowForm(true)
  }
  const openEdit = (p: Practice) => {
    setEditPractice(p); setTitle(p.title); setSubject(p.subject)
    setDesc(p.description); setQuestions(p.questions.map(q => ({...q}))); setAssigned(p.assignedTo)
    setDueDate(p.dueDate ?? ''); setPdfFile(null); setGenError(''); setShowForm(true)
  }
  const cancel = () => { setShowForm(false); setEditPractice(null) }

  const generateFromPdf = async () => {
    if (!pdfFile) return
    setGenerating(true); setGenError('')
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(pdfFile)
      })
      const resp = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, subject, numQuestions: 5 })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al generar')
      setQuestions(data.questions)
    } catch (e: any) {
      setGenError(e.message)
    } finally { setGenerating(false) }
  }

  const addQ = () => setQuestions(prev => [...prev, { id: uid(), text: '', type: 'multiple', options: ['','','',''], correctOption: 0, points: 5 }])
  const updateQ = (id: string, patch: any) => setQuestions(prev => prev.map(q => q.id===id ? {...q,...patch} : q))
  const removeQ = (id: string) => setQuestions(prev => prev.filter(q => q.id!==id))

  const save = async () => {
    if (!title.trim() || questions.length === 0 || assigned.length === 0) { alert('Completá título, preguntas y asignación'); return }
    setSaving(true)
    try {
      if (editPractice) {
        await db.practices.update({ ...editPractice, title, subject, description: desc, questions, assignedTo: assigned, dueDate: dueDate||undefined })
      } else {
        await db.practices.add({ title, subject, description: desc, questions, assignedTo: assigned, dueDate: dueDate||undefined, isActive: true, lessonId: undefined })
      }
      cancel(); onReload()
    } finally { setSaving(false) }
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Prácticas ({practices.length})</h2>
        <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
          <label className="btn-primary" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            📄 Desde PDF
            <input type="file" accept=".pdf" style={{display:'none'}} onChange={e => { const f=e.target.files?.[0]; if(f) setPdfModal(f) }}/>
          </label>
          <button className="btn-outline" onClick={openNew}><Plus size={14}/> Manual</button>
        </div>
      </div>

      {pdfModal && (
        <CreatePracticeModal
          students={students}
          file={pdfModal}
          onClose={() => setPdfModal(null)}
          onSaved={() => { setPdfModal(null); onReload() }}
        />
      )}

      {showForm && (
        <div className="form-card">
          <h3>{editPractice ? 'Editar práctica' : 'Nueva práctica'}</h3>
          <div className="form-row">
            <div className="field full"><label>Título</label><input value={title} onChange={e => setTitle(e.target.value)}/></div>
            <div className="field"><label>Materia</label>
              <select value={subject} onChange={e => setSubject(e.target.value as Subject)}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
            </div>
          </div>
          <div className="field full"><label>Descripción</label><textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}/></div>
          <div className="form-row">
            <div className="field"><label>Fecha límite (opcional)</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></div>
          </div>

          <div className="field full">
            <label>Generar preguntas desde PDF con IA</label>
            <div className="file-upload-row">
              <label className="file-upload-btn">
                📎 {pdfFile ? pdfFile.name : 'Seleccionar PDF'}
                <input type="file" accept=".pdf" style={{display:'none'}} onChange={e => { setPdfFile(e.target.files?.[0] ?? null); setGenError('') }}/>
              </label>
              {pdfFile && <button className="btn-ghost" onClick={() => setPdfFile(null)}>✕ Quitar</button>}
              {pdfFile && (
                <button className="btn-primary sm" onClick={generateFromPdf} disabled={generating}>
                  {generating ? '⏳ Generando...' : '✨ Generar preguntas con IA'}
                </button>
              )}
            </div>
            {genError && <p style={{color:'var(--coral)',fontSize:'.82rem',marginTop:'.35rem'}}>⚠ {genError}</p>}
            {generating && <p style={{color:'var(--muted)',fontSize:'.82rem',marginTop:'.35rem'}}>Extrayendo texto y generando preguntas... puede tardar unos segundos.</p>}
          </div>

          <div className="field full"><label>Asignar a alumnos</label>
            <div className="chip-grid">
              {students.map(s => (
                <label key={s.id} className={`chip ${assigned.includes(s.id)?'selected':''}`}>
                  <input type="checkbox" checked={assigned.includes(s.id)}
                    onChange={e => setAssigned(prev => e.target.checked ? [...prev,s.id] : prev.filter(x=>x!==s.id))}/>
                  {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          </div>

          <div className="questions-section">
            <div className="qs-header"><h4>Preguntas ({questions.length})</h4><button className="btn-outline sm" onClick={addQ}><Plus size={12}/> Agregar</button></div>
            {questions.map((q, i) => (
              <div key={q.id} className="q-card">
                <div className="q-card-header">
                  <span>P{i+1}</span>
                  <select value={q.type} onChange={e => updateQ(q.id, {type: e.target.value, options: e.target.value==='multiple'?['','','','']:undefined})}>
                    <option value="multiple">Opción múltiple</option>
                    <option value="open">Desarrollo</option>
                  </select>
                  <input type="number" min={1} max={100} value={q.points} style={{width:60}} onChange={e => updateQ(q.id,{points:+e.target.value})}/> pts
                  <button className="icon-btn danger" onClick={() => removeQ(q.id)}><X size={12}/></button>
                </div>
                <textarea rows={2} value={q.text} onChange={e => updateQ(q.id,{text:e.target.value})} placeholder="Enunciado de la pregunta..."/>
                <label className="sandbox-toggle-label" style={{margin:'4px 0'}}>
                  <input type="checkbox" checked={q.hasSandbox ?? false} onChange={e => updateQ(q.id,{hasSandbox:e.target.checked})}/>
                  <span>🎨 Sandbox</span>
                </label>
                {q.type==='multiple' && q.options && (
                  <div className="options-builder">
                    {q.options.map((opt: string, oi: number) => (
                      <div key={oi} className="opt-row">
                        <input type="radio" name={`c-${q.id}`} checked={q.correctOption===oi} onChange={() => updateQ(q.id,{correctOption:oi})}/>
                        <span className="opt-letter">{String.fromCharCode(65+oi)}</span>
                        <input type="text" value={opt} onChange={e => { const opts=[...q.options]; opts[oi]=e.target.value; updateQ(q.id,{options:opts}) }}/>
                      </div>
                    ))}
                    <p className="hint">● = respuesta correcta</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button className="btn-outline" onClick={cancel}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar práctica'}</button>
          </div>
        </div>
      )}

      <div className="cards-grid">
        {practices.length === 0 ? <p className="empty-msg">No hay prácticas aún.</p> :
          practices.map(p => (
            <div key={p.id} className="lesson-card">
              <div className="lesson-card-top">
                <span className="subject-badge">{p.subject}</span>
                <span className={`status-dot ${p.isActive?'active':''}`}/>
              </div>
              <h3>{p.title}</h3>
              <p className="lesson-students">📋 {p.questions.length} preguntas · 👥 {p.assignedTo.length} alumnos</p>
              {p.dueDate && <p className="lesson-students">📅 Vence: {p.dueDate}</p>}
              <div style={{display:'flex',gap:'.4rem',marginTop:'auto',flexWrap:'wrap'}}>
                <button className="btn-danger-sm" style={{borderColor:'#bfdbfe',background:'#eff6ff',color:'#1d4ed8'}} onClick={() => openEdit(p)}><Pencil size={11}/> Editar</button>
                <button className="btn-danger-sm" onClick={async () => { await db.practices.delete(p.id); onReload() }}>Eliminar</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── REVIEWS TAB ──────────────────────────────────────────────────────
function ReviewsTab({ subs, students, practices, onReload }: { subs: Submission[]; students: Student[]; practices: Practice[]; onReload: () => void }) {
  const [expanded, setExpanded] = useState<string|null>(null)
  const [scores, setScores]     = useState<Record<string,number>>({})
  const [notes, setNotes]       = useState<Record<string,string>>({})
  const [saving, setSaving]     = useState(false)

  const pending  = subs.filter(s => !s.reviewed)
  const reviewed = subs.filter(s => s.reviewed)
  const getStudent  = (id: string) => students.find(s => s.id === id)
  const getPractice = (id: string) => practices.find(p => p.id === id)

  const save = async (sub: Submission) => {
    setSaving(true)
    try {
      await db.submissions.update({ ...sub, score: scores[sub.id] ?? sub.score, reviewed: true, teacherNote: notes[sub.id] ?? sub.teacherNote })
      onReload()
    } finally { setSaving(false) }
  }

  const renderSub = (sub: Submission) => {
    const student  = getStudent(sub.studentId)
    const practice = getPractice(sub.practiceId)
    const isOpen   = expanded === sub.id
    return (
      <div key={sub.id} className={`review-card ${!sub.reviewed?'pending':''}`}>
        <div className="review-header" onClick={() => setExpanded(isOpen?null:sub.id)}>
          <div className="avatar sm">{student?.firstName[0]}{student?.lastName[0]}</div>
          <div className="review-info">
            <strong>{student?.firstName} {student?.lastName}</strong>
            <span>{practice?.title} · {practice?.subject}</span>
          </div>
          {!sub.reviewed && <span className="badge">Pendiente</span>}
          {sub.reviewed && <span className="badge reviewed">Revisado · {sub.score} pts</span>}
          {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
        {isOpen && (
          <div className="review-body">
            <p className="review-date">Entregada: {new Date(sub.submittedAt).toLocaleString('es')}</p>
            {practice?.questions.map(q => {
              const ans = sub.answers.find(a => a.questionId === q.id)
              const isCorrect = q.type==='multiple' && ans?.value === q.correctOption
              const isWrong   = q.type==='multiple' && ans?.value !== q.correctOption
              return (
                <div key={q.id} className="review-q">
                  <div className="review-q-header"><span>{q.text}</span><span>{q.points} pts</span></div>
                  <div className={`review-ans ${isCorrect?'correct':''} ${isWrong?'wrong':''}`}>
                    {q.type==='multiple'
                      ? <span>{isCorrect?'✓':'✗'} Respondió: {q.options?.[ans?.value as number] ?? '—'} · Correcta: {q.options?.[q.correctOption??0]}</span>
                      : q.hasSandbox
                        ? <SandboxAnswerView value={ans?.value}/>
                        : <span>{(ans?.value as string)||<em>Sin respuesta</em>}</span>
                    }
                  </div>
                </div>
              )
            })}
            <div className="review-grade">
              <div className="field"><label>Puntaje</label>
                <input type="number" value={scores[sub.id] ?? sub.score ?? ''} onChange={e => setScores(p=>({...p,[sub.id]:+e.target.value}))}/>
              </div>
              <div className="field full"><label>Nota al alumno</label>
                <textarea rows={2} value={notes[sub.id] ?? sub.teacherNote ?? ''} onChange={e => setNotes(p=>({...p,[sub.id]:e.target.value}))} placeholder="Retroalimentación..."/>
              </div>
              <button className="btn-primary" onClick={() => save(sub)} disabled={saving}><Check size={14}/> Guardar revisión</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="tab-header"><h2>Revisiones ({subs.length})</h2></div>
      {pending.length > 0 && <><h3 className="review-section-title">⏳ Pendientes ({pending.length})</h3>{pending.map(renderSub)}</>}
      {reviewed.length > 0 && <><h3 className="review-section-title">✓ Revisadas ({reviewed.length})</h3>{reviewed.map(renderSub)}</>}
      {subs.length === 0 && <p className="empty-msg">No hay entregas aún.</p>}
    </div>
  )
}

// ── SETTINGS TAB ─────────────────────────────────────────────────────
function SettingsTab({ profile, onProfileUpdate }: { profile: TeacherProfile; onProfileUpdate: (p: TeacherProfile) => void }) {
  const [logoText, setLogoText]     = useState(profile.logoText)
  const [schoolName, setSchoolName] = useState(profile.schoolName)
  const [primary, setPrimary]       = useState(profile.primaryColor)
  const [secondary, setSecondary]   = useState(profile.secondaryColor)
  const [saving, setSaving]         = useState(false)
  const hasBranding = profile.addOns.includes('branding')

  // Live preview: update CSS variables as colors are picked
  useEffect(() => {
    if (hasBranding) applyTheme(primary, secondary, true)
  }, [primary, secondary, hasBranding])

  const save = async () => {
    setSaving(true)
    try {
      await auth.updateProfile({ logoText, schoolName, primaryColor: primary, secondaryColor: secondary })
      onProfileUpdate({ ...profile, logoText, schoolName, primaryColor: primary, secondaryColor: secondary })
    } finally { setSaving(false) }
  }

  const mailtoActivate = (addon: string, price: string) =>
    `mailto:salgueragonzaleze4@gmail.com?subject=Activar%20add-on%3A%20${encodeURIComponent(addon)}&body=Hola%2C%20quiero%20activar%20el%20add-on%20${encodeURIComponent(addon)}%20(${encodeURIComponent(price)})%20para%20mi%20cuenta%20TeachNest.`

  return (
    <div className="tab-content">
      <div className="tab-header"><h2>Ajustes</h2></div>
      <div className="form-card">
        <h3>Perfil</h3>
        <div className="form-row">
          <div className="field"><label>Nombre del portal</label><input value={logoText} onChange={e => setLogoText(e.target.value)}/></div>
          <div className="field"><label>Institución</label><input value={schoolName} onChange={e => setSchoolName(e.target.value)}/></div>
        </div>
        <h3 style={{marginTop:24}}>Colores {!hasBranding && <span className="addon-lock">🔒 Add-on</span>}</h3>
        {!hasBranding && <p className="hint">Activá el add-on de Branding para personalizar los colores.</p>}
        <div className="form-row" style={{opacity:hasBranding?1:.4,pointerEvents:hasBranding?'auto':'none'}}>
          <div className="field"><label>Color principal</label>
            <div className="color-row"><input type="color" value={primary} onChange={e => setPrimary(e.target.value)}/><span>{primary}</span></div>
          </div>
          <div className="field"><label>Color secundario</label>
            <div className="color-row"><input type="color" value={secondary} onChange={e => setSecondary(e.target.value)}/><span>{secondary}</span></div>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button>
        </div>
      </div>

      <div className="form-card" style={{marginTop:20}}>
        <h3>Tu plan</h3>
        <div className="plan-display">
          <span className="plan-name">Plan Base</span>
          <span className="plan-limit">👥 {profile.studentsLimit} alumnos máx.</span>
        </div>
        <h4 style={{marginTop:16,marginBottom:8}}>Add-ons activos</h4>
        {profile.addOns.length === 0
          ? <p className="hint">No tenés add-ons activados aún.</p>
          : profile.addOns.map(a => <span key={a} className="addon-chip active">{a}</span>)
        }
        <div className="addon-shop">
          {[
            {id:'branding',      label:'🎨 Branding propio',   price:'$5/mes', desc:'Colores e identidad personalizados'},
            {id:'extra_students',label:'👥 +10 alumnos',        price:'$3/mes', desc:'Ampliá tu límite de alumnos'},
            {id:'reports',       label:'📄 Reportes PDF',       price:'$4/mes', desc:'Exportá informes de progreso'},
          ].filter(a => !profile.addOns.includes(a.id)).map(a => (
            <div key={a.id} className="addon-row">
              <div><strong>{a.label}</strong><p>{a.desc}</p></div>
              <a href={mailtoActivate(a.label, a.price)} className="btn-outline sm" style={{textDecoration:'none',whiteSpace:'nowrap'}}>
                {a.price} — Activar
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── WHAT'S NEW BANNER ────────────────────────────────────────────
// ── RESOURCES TAB ────────────────────────────────────────────────────

const DOCS = [
  {
    title: 'Guía del Panel del Profesor',
    desc: 'Manual completo: alumnos, biblioteca, ZIP, imágenes, prácticas, revisiones y ajustes.',
    file: '/guia_panel_profesor.pdf',
    icon: '📘',
  },
]

type FeedbackType = 'bug' | 'sugerencia' | 'pregunta'

function ResourcesTab({ profile }: { profile: TeacherProfile }) {
  const [type, setType]     = useState<FeedbackType>('bug')
  const [msg, setMsg]       = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const handleSend = async () => {
    if (!msg.trim()) return
    setStatus('sending')
    setErrMsg('')
    try {
      const { error } = await supabase.functions.invoke('send-feedback', {
        body: { type, message: msg.trim(), academy: profile.schoolName || profile.logoText, teacherEmail: profile.email },
      })
      if (error) throw error
      setStatus('done')
      setMsg('')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (e: any) {
      setErrMsg(e?.message ?? 'Error al enviar')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="tab-content">
      <div className="tab-header"><h2>Recursos docentes</h2></div>

      {/* Documentacion */}
      <section className="res-section">
        <h3 className="res-section-title">📚 Documentacion</h3>
        <div className="res-docs-grid">
          {DOCS.map((d, i) => (
            <div key={i} className="res-doc-card">
              <span className="res-doc-icon">{d.icon}</span>
              <div className="res-doc-info">
                <p className="res-doc-title">{d.title}</p>
                <p className="res-doc-desc">{d.desc}</p>
              </div>
              <a
                className="btn-primary res-doc-btn"
                href={d.file}
                target="_blank"
                rel="noreferrer"
                download
              >
                Descargar PDF
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback */}
      <section className="res-section">
        <h3 className="res-section-title">💬 Comentarios y reportes</h3>
        <p className="res-feedback-hint">
          ¿Encontraste un bug, tenés una sugerencia o una consulta? Mandános un mensaje directamente.
        </p>
        <div className="res-feedback-form">
          <div className="res-type-row">
            {(['bug', 'sugerencia', 'pregunta'] as FeedbackType[]).map(t => (
              <button
                key={t}
                className={`res-type-btn ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
              >
                {t === 'bug' ? '🐛 Bug' : t === 'sugerencia' ? '💡 Sugerencia' : '❓ Pregunta'}
              </button>
            ))}
          </div>
          <textarea
            className="res-textarea"
            rows={5}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder={
              type === 'bug'
                ? 'Describí qué pasó, qué esperabas que pasara y cómo reproducirlo...'
                : type === 'sugerencia'
                ? 'Contános qué mejorarías o qué funcionalidad te gustaría ver...'
                : 'Escribí tu consulta...'
            }
          />
          <div className="res-feedback-actions">
            {status === 'done'    && <span className="res-sent-msg">✅ Enviado correctamente.</span>}
            {status === 'error'   && <span className="res-error-msg">⚠️ {errMsg}</span>}
            <button
              className="btn-primary"
              onClick={handleSend}
              disabled={!msg.trim() || status === 'sending'}
            >
              {status === 'sending' ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}


const WN_VERSION = 'tn_wn_v2'   // bump this string to show the banner again on next release

const UPDATES = [
  { emoji: '💻', text: 'Sandbox de código HTML/CSS/JS para Informática' },
  { emoji: '🎓', text: 'Nuevo grado: Técnico' },
  { emoji: '📚', text: 'Nueva materia: Informática' },
  { emoji: '🎨', text: 'Vista previa de colores en tiempo real' },
]

function WhatsNewBanner() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(WN_VERSION))
  const [hiding,  setHiding]  = useState(false)

  const dismiss = () => {
    setHiding(true)
    setTimeout(() => {
      localStorage.setItem(WN_VERSION, '1')
      setVisible(false)
    }, 300)
  }

  if (!visible) return null

  return (
    <div className={`wn-banner ${hiding ? 'wn-hiding' : ''}`}>
      <div className="wn-header">
        <span className="wn-title">✨ Novedades</span>
        <button className="wn-close" onClick={dismiss} title="Cerrar">✕</button>
      </div>
      <ul className="wn-list">
        {UPDATES.map((u, i) => (
          <li key={i} className="wn-item">
            <span className="wn-emoji">{u.emoji}</span>
            <span>{u.text}</span>
          </li>
        ))}
      </ul>
            <button className="wn-dismiss-btn" onClick={dismiss}>Entendido 👍</button>
    </div>
  )
}

