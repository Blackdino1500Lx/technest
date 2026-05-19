import { useState, useEffect } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import type { TeacherProfile, Student, Lesson, Practice, Submission, Grade, Level, Subject } from '../lib/types'
import { LogOut, Users, BookOpen, FileText, ClipboardList, Settings, Plus, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  profile: TeacherProfile
  onProfileUpdate: (p: TeacherProfile) => void
  onSignOut: () => void
}

type Tab = 'students' | 'lessons' | 'practices' | 'reviews' | 'settings'
const GRADES: Grade[] = ['7° Grado','8° Grado','9° Grado','10° Grado','11° Grado','Universitario','Adulto']
const LEVELS: Level[] = ['Básico','Intermedio','Avanzado']
const SUBJECTS: Subject[] = ['Matemáticas','Español','Ciencias','Estudios Sociales','Inglés']
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
        <div className="sidebar-logo">{profile.logoText}</div>
        <nav className="sidebar-nav">
          {([
            ['students',  'Alumnos',    <Users size={18}/>],
            ['lessons',   'Lecciones',  <BookOpen size={18}/>],
            ['practices', 'Prácticas',  <FileText size={18}/>],
            ['reviews',   'Revisiones', <ClipboardList size={18}/>],
            ['settings',  'Ajustes',    <Settings size={18}/>],
          ] as [Tab, string, React.ReactNode][]).map(([t, label, icon]) => (
            <button key={t} className={`sidebar-item ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {icon} {label}
              {t === 'reviews' && pendingCount > 0 && <span className="badge">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <button className="sidebar-signout" onClick={onSignOut}><LogOut size={16}/> Salir</button>
      </aside>

      <main className="portal-main">
        {loading ? <div className="portal-loading"><div className="spinner"/></div> : (
          <>
            {tab === 'students'  && <StudentsTab  students={students}  onReload={loadAll} profile={profile}/>}
            {tab === 'lessons'   && <LessonsTab   lessons={lessons}    students={students} onReload={loadAll}/>}
            {tab === 'practices' && <PracticesTab practices={practices} students={students} onReload={loadAll}/>}
            {tab === 'reviews'   && <ReviewsTab   subs={subs} students={students} practices={practices} onReload={loadAll}/>}
            {tab === 'settings'  && <SettingsTab  profile={profile} onProfileUpdate={onProfileUpdate}/>}
          </>
        )}
      </main>
    </div>
  )
}

// ── STUDENTS TAB ─────────────────────────────────────────────────────
function StudentsTab({ students, onReload, profile }: { students: Student[]; onReload: () => void; profile: TeacherProfile }) {
  const [showForm, setShowForm] = useState(false)
  const [fn, setFn] = useState(''); const [ln, setLn] = useState('')
  const [grade, setGrade] = useState<Grade>('10° Grado')
  const [level, setLevel] = useState<Level>('Básico')
  const [saving, setSaving] = useState(false)

  const genPin = () => Math.floor(1000 + Math.random() * 9000).toString()
  const [pin, setPin] = useState(genPin)

  const save = async () => {
    if (!fn.trim() || !ln.trim()) return
    setSaving(true)
    try {
      await db.students.add({ firstName: fn, lastName: ln, grade, level, pin })
      setFn(''); setLn(''); setPin(genPin()); setShowForm(false); onReload()
    } finally { setSaving(false) }
  }

  const atLimit = students.length >= profile.studentsLimit

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Alumnos ({students.length}/{profile.studentsLimit})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)} disabled={atLimit}>
          <Plus size={14}/> Nuevo alumno
        </button>
      </div>
      {atLimit && <div className="limit-warning">Alcanzaste el límite de alumnos. Mejorá tu plan para agregar más.</div>}

      {showForm && (
        <div className="form-card">
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
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
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
              <button className="icon-btn danger" onClick={async () => { await db.students.delete(s.id); onReload() }}><Trash2 size={14}/></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── LESSONS TAB ──────────────────────────────────────────────────────
function LessonsTab({ lessons, students, onReload }: { lessons: Lesson[]; students: Student[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle]       = useState('')
  const [subject, setSubject]   = useState<Subject>('Matemáticas')
  const [content, setContent]   = useState('')
  const [ytUrl, setYtUrl]       = useState('')
  const [assigned, setAssigned] = useState<string[]>([])
  const [pdfFile, setPdfFile]   = useState<File|null>(null)
  const [saving, setSaving]     = useState(false)

  const save = async () => {
    if (!title.trim()) return; setSaving(true)
    try {
      let fileUrl: string | undefined; let fileName: string | undefined
      if (pdfFile) {
        const uploaded = await db.storage.uploadFile(pdfFile)
        fileUrl = uploaded.url; fileName = uploaded.name
      }
      await db.lessons.add({ title, subject, content: content || undefined, youtubeUrl: ytUrl || undefined, fileUrl, fileName, assignedTo: assigned, isActive: true })
      setTitle(''); setContent(''); setYtUrl(''); setPdfFile(null); setAssigned([]); setShowForm(false); onReload()
    } finally { setSaving(false) }
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Lecciones ({lessons.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14}/> Nueva lección</button>
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-row">
            <div className="field full"><label>Título</label><input value={title} onChange={e => setTitle(e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Materia</label>
              <select value={subject} onChange={e => setSubject(e.target.value as Subject)}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field full"><label>Video YouTube (opcional)</label><input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="https://youtube.com/..."/></div>
          </div>
          <div className="field full"><label>Contenido / Explicación</label>
            <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} placeholder="Escribe aquí el contenido de la lección..."/>
          </div>
          <div className="field full">
            <label>Adjuntar PDF (opcional)</label>
            <div className="file-upload-row">
              <label className="file-upload-btn">
                📎 {pdfFile ? pdfFile.name : 'Seleccionar archivo'}
                <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" style={{display:'none'}} onChange={e => setPdfFile(e.target.files?.[0] ?? null)}/>
              </label>
              {pdfFile && <button className="btn-ghost" onClick={() => setPdfFile(null)}>✕ Quitar</button>}
            </div>
          </div>
          <div className="field full"><label>Asignar a alumnos</label>
            <div className="chip-grid">
              {students.map(s => (
                <label key={s.id} className={`chip ${assigned.includes(s.id)?'selected':''}`}>
                  <input type="checkbox" checked={assigned.includes(s.id)} onChange={e => setAssigned(prev => e.target.checked ? [...prev,s.id] : prev.filter(x => x!==s.id))}/>
                  {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          </div>
        </div>
      )}

      <div className="cards-grid">
        {lessons.length === 0 ? <p className="empty-msg">No hay lecciones aún.</p> :
          lessons.map(l => (
            <div key={l.id} className="lesson-card">
              <div className="lesson-card-top">
                <span className="subject-badge">{l.subject}</span>
                <span className={`status-dot ${l.isActive?'active':''}`}/>
              </div>
              <h3>{l.title}</h3>
              {l.youtubeUrl && <p className="lesson-yt">▶ Video adjunto</p>}
              <p className="lesson-students">👥 {l.assignedTo.length} alumno{l.assignedTo.length!==1?'s':''}</p>
              <button className="btn-danger-sm" onClick={async () => { await db.lessons.delete(l.id); onReload() }}>Eliminar</button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── PRACTICES TAB ────────────────────────────────────────────────────
function PracticesTab({ practices, students, onReload }: { practices: Practice[]; students: Student[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle]       = useState('')
  const [subject, setSubject]   = useState<Subject>('Matemáticas')
  const [desc, setDesc]         = useState('')
  const [questions, setQuestions] = useState<any[]>([])
  const [assigned, setAssigned]   = useState<string[]>([])
  const [dueDate, setDueDate]     = useState('')
  const [saving, setSaving]       = useState(false)

  const addQ = () => setQuestions(prev => [...prev, { id: uid(), text: '', type: 'multiple', options: ['','','',''], correctOption: 0, points: 5 }])
  const updateQ = (id: string, patch: any) => setQuestions(prev => prev.map(q => q.id===id ? {...q,...patch} : q))
  const removeQ = (id: string) => setQuestions(prev => prev.filter(q => q.id!==id))

  const save = async () => {
    if (!title.trim() || questions.length === 0 || assigned.length === 0) { alert('Completa título, preguntas y asignación'); return }
    setSaving(true)
    try {
      await db.practices.add({ title, subject, description: desc, questions, assignedTo: assigned, dueDate: dueDate || undefined, isActive: true, lessonId: undefined })
      setTitle(''); setDesc(''); setQuestions([]); setAssigned([]); setDueDate(''); setShowForm(false); onReload()
    } finally { setSaving(false) }
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Prácticas ({practices.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14}/> Nueva práctica</button>
      </div>

      {showForm && (
        <div className="form-card">
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

          <div className="field full"><label>Asignar a alumnos</label>
            <div className="chip-grid">
              {students.map(s => (
                <label key={s.id} className={`chip ${assigned.includes(s.id)?'selected':''}`}>
                  <input type="checkbox" checked={assigned.includes(s.id)} onChange={e => setAssigned(prev => e.target.checked ? [...prev,s.id] : prev.filter(x => x!==s.id))}/>
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
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
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
              <button className="btn-danger-sm" onClick={async () => { await db.practices.delete(p.id); onReload() }}>Eliminar</button>
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
  const [logoText, setLogoText]       = useState(profile.logoText)
  const [schoolName, setSchoolName]   = useState(profile.schoolName)
  const [primary, setPrimary]         = useState(profile.primaryColor)
  const [secondary, setSecondary]     = useState(profile.secondaryColor)
  const [saving, setSaving]           = useState(false)
  const hasBranding = profile.addOns.includes('branding')

  const save = async () => {
    setSaving(true)
    try {
      await auth.updateProfile({ logoText, schoolName, primaryColor: primary, secondaryColor: secondary })
      onProfileUpdate({ ...profile, logoText, schoolName, primaryColor: primary, secondaryColor: secondary })
    } finally { setSaving(false) }
  }

  return (
    <div className="tab-content">
      <div className="tab-header"><h2>Ajustes</h2></div>
      <div className="form-card">
        <h3>Perfil</h3>
        <div className="form-row">
          <div className="field"><label>Nombre del portal</label><input value={logoText} onChange={e => setLogoText(e.target.value)}/></div>
          <div className="field"><label>Institución</label><input value={schoolName} onChange={e => setSchoolName(e.target.value)}/></div>
        </div>

        <h3 style={{marginTop:24}}>Personalización de colores {!hasBranding && <span className="addon-lock">🔒 Add-on</span>}</h3>
        {!hasBranding && <p className="hint">Activá el add-on de Branding ($5/mes) para personalizar los colores de tu portal.</p>}
        <div className="form-row" style={{opacity: hasBranding?1:0.4, pointerEvents: hasBranding?'auto':'none'}}>
          <div className="field">
            <label>Color principal</label>
            <div className="color-row"><input type="color" value={primary} onChange={e => setPrimary(e.target.value)}/><span>{primary}</span></div>
          </div>
          <div className="field">
            <label>Color secundario</label>
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
        <h4 style={{marginTop:16}}>Add-ons activos</h4>
        {profile.addOns.length === 0
          ? <p className="hint">No tenés add-ons activados aún.</p>
          : profile.addOns.map(a => <span key={a} className="addon-chip active">{a}</span>)
        }
        <div className="addon-shop">
          {[
            {id:'branding',     label:'🎨 Branding propio',    price:'$5/mes', desc:'Colores e identidad personalizados'},
            {id:'extra_students',label:'👥 +10 alumnos',       price:'$3/mes', desc:'Amplía tu límite de alumnos'},
            {id:'reports',      label:'📄 Reportes PDF',       price:'$4/mes', desc:'Exporta informes de progreso'},
          ].filter(a => !profile.addOns.includes(a.id)).map(a => (
            <div key={a.id} className="addon-row">
              <div><strong>{a.label}</strong><p>{a.desc}</p></div>
              <button className="btn-outline sm">{a.price} — Activar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}