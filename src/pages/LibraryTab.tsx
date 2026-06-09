import { useState, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import type { Lesson, Student, Subject, Grade } from '../lib/types'
import { db, qImages } from '../lib/db'
import CreatePracticeModal from './CreatePracticeModal'
import {
  Upload, FileText, Search, Eye, EyeOff, Users, X, AlertTriangle,
  Loader2, CheckCircle, FolderOpen, Filter, Sparkles, Trash2
} from 'lucide-react'

interface Props { lessons: Lesson[]; students: Student[]; onReload: () => void }

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés', 'Informática']
const GRADES: Grade[]     = ['7° Grado', '8° Grado', '9° Grado', '10° Grado', '11° Grado', 'Universitario', 'Adulto', 'Técnico']

function detectGrade(path: string): Grade {
  const p = path.toLowerCase()
  if (/bachillerato|bachi/.test(p)) return '11° Grado'
  if (/mep.?7|grado.?7|sétimo|setimo|[^\d]7[°o]/.test(p)) return '7° Grado'
  if (/mep.?8|grado.?8|octavo|[^\d]8[°o]/.test(p)) return '8° Grado'
  if (/mep.?9|grado.?9|noveno|[^\d]9[°o]/.test(p)) return '9° Grado'
  if (/mep.?10|grado.?10|[^\d]10[°o]/.test(p)) return '10° Grado'
  if (/[^\d]11[°o]/.test(p)) return '11° Grado'
  if (/univers/.test(p)) return 'Universitario'
  return '7° Grado'
}
function detectSubject(path: string): Subject {
  if (/matem|math/i.test(path)) return 'Matemáticas'
  if (/espa[nñ]ol|español|lengua/i.test(path)) return 'Español'
  if (/ciencia|biolog|quimic|fisica/i.test(path)) return 'Ciencias'
  if (/social|historia|geograf/i.test(path)) return 'Estudios Sociales'
  if (/ingl[eé]s|english/i.test(path)) return 'Inglés'
  return 'Matemáticas'
}
function friendlyTitle(filePath: string): string {
  const parts = filePath.split('/')
  const folder = parts.length > 1 ? parts[parts.length - 2] : ''
  const file   = parts[parts.length - 1].replace('.pdf', '').replace(/_/g, ' ').trim()
  const grade  = detectGrade(folder + ' ' + filePath)
  return `${grade} · ${file}`
}

interface UploadJob {
  name: string; customTitle?: string; customDesc?: string
  path: string; grade: Grade; subject: Subject
  status: 'pending' | 'uploading' | 'done' | 'error' | 'skipped'; error?: string
}

// ── Assign modal ─────────────────────────────────────────────────
function AssignModal({ lesson, students, onClose, onSave }: { lesson: Lesson; students: Student[]; onClose: () => void; onSave: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(lesson.assignedTo)
  const [saving, setSaving]     = useState(false)
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const save = async () => { setSaving(true); await onSave(selected); setSaving(false) }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>Asignar material</h3>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <p className="modal-subtitle">{lesson.title}</p>
        <div className="modal-body">
          {students.length === 0
            ? <p className="hint-text">No hay alumnos registrados aún.</p>
            : (
              <div className="chip-grid">
                <label className="chip select-all" onClick={() => setSelected(selected.length === students.length ? [] : students.map(s => s.id))}>
                  {selected.length === students.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </label>
                {students.map(s => (
                  <label key={s.id} className={`chip ${selected.includes(s.id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)}/>
                    <span>{s.firstName} {s.lastName}</span>
                  </label>
                ))}
              </div>
            )
          }
        </div>
        <div className="form-actions">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar asignación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Subject section ───────────────────────────────────────────────
function SubjectSection({ subject, lessons, onAssign, onToggleActive, onCreatePractice, onDelete }: {
  subject: Subject; lessons: Lesson[]
  onAssign: (l: Lesson) => void; onToggleActive: (l: Lesson) => void
  onCreatePractice: (l: Lesson) => void; onDelete: (l: Lesson) => void
}) {
  if (lessons.length === 0) return null
  return (
    <div className="subject-section">
      <div className="subject-section-header">
        <span className={`subject-badge`}>{subject}</span>
        <span className="subject-count">{lessons.length} materiales</span>
      </div>
      <div className="cards-grid">
        {lessons.map(l => (
          <div className={`lesson-card ${!l.isActive ? 'lib-inactive' : ''}`} key={l.id}>
            <div className="lesson-card-top">
              <span className="subject-badge">{l.subject}</span>
              <span className={`status-dot ${l.isActive ? 'active' : ''}`} title={l.isActive ? 'Activo' : 'Inactivo'}/>
            </div>
            <div className="lib-card-icon"><FileText size={28}/></div>
            <h3>{l.title}</h3>
            {l.fileName && <p className="lesson-yt">📄 {l.fileName}</p>}
            <p className="lesson-students">
              <Users size={12}/> {l.assignedTo.length === 0 ? 'Sin asignar' : `${l.assignedTo.length} alumno${l.assignedTo.length !== 1 ? 's' : ''}`}
            </p>
            <div style={{ display: 'flex', gap: '.4rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <button className="btn-danger-sm" style={{ borderColor: '#bfdbfe', background: '#eff6ff', color: '#1d4ed8' }} onClick={() => onAssign(l)}>
                <Users size={11}/> Asignar
              </button>
              <button className="btn-danger-sm" onClick={() => onToggleActive(l)}>
                {l.isActive ? <><EyeOff size={11}/> Desactivar</> : <><Eye size={11}/> Activar</>}
              </button>
              <button className="btn-danger-sm" style={{ borderColor: '#d1fae5', background: '#ecfdf5', color: '#065f46' }} onClick={() => onCreatePractice(l)}>
                <Sparkles size={11}/> Crear práctica
              </button>
              {l.fileUrl && (
                <a href={l.fileUrl} target="_blank" rel="noreferrer" className="btn-danger-sm" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                  <FileText size={11}/> Ver PDF
                </a>
              )}
              <button className="btn-danger-sm" onClick={() => onDelete(l)}><Trash2 size={11}/> Borrar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LibraryTab({ lessons, students, onReload }: Props) {
  const [jobs, setJobs]               = useState<UploadJob[]>([])
  const [uploading, setUploading]     = useState(false)
  const [uploadDone, setUploadDone]   = useState(false)
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [filterStatus, setFilterStatus]   = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch]           = useState('')
  const [assignTarget, setAssignTarget] = useState<Lesson | null>(null)
  const [createTarget, setCreateTarget] = useState<Lesson | null>(null)
  const [pendingFile, setPendingFile]   = useState<File | null>(null)
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingGrade, setPendingGrade] = useState<Grade>('7° Grado')
  const [pendingSubject, setPendingSubject] = useState<Subject>('Matemáticas')
  const [pendingDesc, setPendingDesc]   = useState('')
  const zipRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const lessonsRef = useRef(lessons)
  useEffect(() => { lessonsRef.current = lessons }, [lessons])

  const handlePdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const grade   = detectGrade(file.name)
    const subject = detectSubject(file.name)
    const baseName = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ')
    setPendingFile(file); setPendingGrade(grade); setPendingSubject(subject)
    setPendingTitle(`${grade} · ${baseName}`); setPendingDesc('')
    e.target.value = ''
  }

  const confirmSinglePdf = async () => {
    if (!pendingFile) return
    if (!pendingTitle.trim()) { alert('El título es requerido'); return }
    const file = pendingFile
    const examKey = qImages.buildExamKey(pendingTitle.replace(/[^a-zA-Z0-9]/g, '_'))
    const job: UploadJob = { name: file.name, path: file.name, grade: pendingGrade, subject: pendingSubject, status: 'pending', customTitle: pendingTitle.trim(), customDesc: pendingDesc.trim() }
    setPendingFile(null); setJobs([job]); setUploadDone(false)
    setTimeout(() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    try {
      const res = await runUploadFiles([{ job, file }], examKey)
      if (res.done > 0) alert(`✅ "${job.customTitle}" guardado en la Biblioteca.`)
      else if (res.skipped > 0) alert(`⚠️ Ya existe un material con el archivo "${job.name}". Renombrá el PDF si querés subirlo de nuevo.`)
    } catch (err: any) { alert('Error inesperado:\n' + (err?.message ?? String(err))) }
  }

  const handleZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const zip = await JSZip.loadAsync(file)
    const newJobs: UploadJob[] = []
    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir || !relativePath.toLowerCase().endsWith('.pdf')) return
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('.')) return
      newJobs.push({ name: relativePath.split('/').pop() ?? relativePath, path: relativePath, grade: detectGrade(relativePath), subject: detectSubject(relativePath), status: 'pending' })
    })
    setJobs(newJobs); setUploadDone(false); e.target.value = ''
    await runUpload(newJobs, zip)
  }

  const runUpload = async (jobList: UploadJob[], zip: JSZip) => {
    setUploading(true)
    const updated = [...jobList]
    for (let i = 0; i < updated.length; i++) {
      const j = updated[i]
      if (lessons.some(l => l.fileName === j.name)) { updated[i] = { ...j, status: 'skipped' }; setJobs([...updated]); continue }
      updated[i] = { ...j, status: 'uploading' }; setJobs([...updated])
      try {
        const blob  = await zip.file(j.path)!.async('blob')
        const file  = new File([blob], j.name, { type: 'application/pdf' })
        const { url } = await db.storage.uploadFile(file)
        const jFolder = j.path.split('/').slice(-2, -1)[0] ?? ''
        const jBase   = j.name.replace(/\.pdf$/i, '')
        await db.lessons.add({ title: friendlyTitle(j.path), subject: j.subject, content: `Material — ${j.grade}.`, fileUrl: url, fileName: j.name, examKey: qImages.buildExamKey(`${jFolder}_${jBase}`), pageImages: [], assignedTo: [], isActive: false })
        updated[i] = { ...j, status: 'done' }
      } catch (err: any) { updated[i] = { ...j, status: 'error', error: err.message } }
      setJobs([...updated])
    }
    setUploading(false); setUploadDone(true); onReload()
  }

  const runUploadFiles = async (pairs: { job: UploadJob; file: File }[], examKey: string): Promise<{ done: number; skipped: number; error: number }> => {
    setUploading(true)
    const updated = pairs.map(p => p.job)
    const result = { done: 0, skipped: 0, error: 0 }
    for (let i = 0; i < pairs.length; i++) {
      const { job, file } = pairs[i]
      if (lessonsRef.current.some(l => l.fileName === job.name)) { updated[i] = { ...job, status: 'skipped' }; setJobs([...updated]); result.skipped++; continue }
      updated[i] = { ...job, status: 'uploading' }; setJobs([...updated])
      try {
        const { url } = await db.storage.uploadFile(file)
        await db.lessons.add({ title: job.customTitle ?? `${job.grade} · ${job.name.replace('.pdf', '').replace(/_/g, ' ')}`, subject: job.subject, content: job.customDesc ?? `Material — ${job.grade}.`, fileUrl: url, fileName: job.name, examKey, pageImages: [], assignedTo: [], isActive: false })
        updated[i] = { ...job, status: 'done' }; result.done++
      } catch (err: any) { updated[i] = { ...job, status: 'error', error: err?.message ?? String(err) }; result.error++; alert(`Error al subir "${job.name}":\n${err?.message}`) }
      setJobs([...updated])
    }
    setUploading(false); setUploadDone(true); onReload()
    return result
  }

  const toggleActive = async (l: Lesson) => { await db.lessons.update({ ...l, isActive: !l.isActive }); onReload() }
  const deleteLesson = async (l: Lesson) => {
    if (!window.confirm(`¿Borrar "${l.title}" de la Biblioteca?`)) return
    try { await db.lessons.delete(l.id); onReload() } catch (err: any) { alert('Error al borrar:\n' + (err?.message ?? String(err))) }
  }
  const saveAssign = async (ids: string[]) => {
    if (!assignTarget) return
    await db.lessons.update({ ...assignTarget, assignedTo: ids, isActive: ids.length > 0 })
    setAssignTarget(null); onReload()
  }

  const filtered = lessons.filter(l => {
    if (filterSubject !== 'all' && l.subject !== filterSubject) return false
    if (filterStatus === 'active' && !l.isActive) return false
    if (filterStatus === 'inactive' && l.isActive) return false
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !(l.fileName ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const lessonsBySubject = SUBJECTS.map(subject => ({
    subject,
    lessons: filtered.filter(l => l.subject === subject).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })).filter(g => g.lessons.length > 0)

  const doneCount    = jobs.filter(j => j.status === 'done').length
  const skippedCount = jobs.filter(j => j.status === 'skipped').length
  const errorCount   = jobs.filter(j => j.status === 'error').length

  return (
    <div className="tab-content">
      <div className="tab-header"><h2>Biblioteca ({lessons.length} materiales)</h2></div>

      {/* Upload zone */}
      <div className="library-upload-zone">
        <div className="lup-option">
          <div className="lup-text"><strong>📦 Subir ZIP de PDFs</strong><span>Procesamos todos los PDFs automáticamente</span></div>
          <button className="btn-primary" onClick={() => zipRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 size={14} className="spin"/> Subiendo...</> : <><Upload size={14}/> Elegir ZIP</>}
          </button>
          <input ref={zipRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleZip}/>
        </div>
        <div className="lup-divider">o</div>
        <div className="lup-option">
          <div className="lup-text"><strong>📄 Subir PDF individual</strong><span>Configurá el título, grado y materia</span></div>
          <button className="btn-outline" onClick={() => pdfRef.current?.click()} disabled={uploading}><Upload size={14}/> Elegir PDF</button>
          <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdf}/>
        </div>
      </div>

      {/* Single PDF modal */}
      {pendingFile && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPendingFile(null)}>
          <div className="modal-card" style={{ maxWidth: 680, width: "92vw" }}>
            <div className="modal-header">
              <div><h3>Agregar material educativo</h3><p className="modal-subtitle" style={{ padding: 0, marginTop: 4 }}>📄 {pendingFile.name}</p></div>
              <button className="icon-btn" onClick={() => setPendingFile(null)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="field full"><label>Título *</label>
                  <input value={pendingTitle} onChange={e => setPendingTitle(e.target.value)} placeholder="Ej: 10° Grado · Práctica 2024"/>
                </div>
                <div className="field"><label>Grado *</label>
                  <select value={pendingGrade} onChange={e => setPendingGrade(e.target.value as Grade)}>
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="field"><label>Materia *</label>
                  <select value={pendingSubject} onChange={e => setPendingSubject(e.target.value as Subject)}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field full"><label>Descripción (opcional)</label>
                  <textarea rows={2} value={pendingDesc} onChange={e => setPendingDesc(e.target.value)} placeholder="Ej: Geometría y Trigonometría"/>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={() => setPendingFile(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmSinglePdf} disabled={uploading}>
                {uploading ? <><Loader2 size={14} className="spin"/> Subiendo...</> : <><Upload size={14}/> Subir PDF</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {jobs.length > 0 && (
        <div className="upload-progress-card" ref={progressRef}>
          <div className="upc-header">
            <span>{uploading ? '⏳ Subiendo archivos...' : uploadDone ? '✅ Carga completada' : 'Archivos detectados'}</span>
            {uploadDone && (
              <span style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {doneCount > 0 && <span className="badge">{doneCount} subidos</span>}
                {skippedCount > 0 && <span className="badge" style={{ background: '#fef9c3', color: '#92400e' }}>{skippedCount} ya existían</span>}
                {errorCount > 0 && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>{errorCount} errores</span>}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {jobs.map((j, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.35rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '.82rem' }}>
                <span>{j.status === 'pending' ? '⬜' : j.status === 'uploading' ? <Loader2 size={12} className="spin"/> : j.status === 'done' ? <CheckCircle size={12} style={{ color: '#16a34a' }}/> : j.status === 'skipped' ? '⏭' : <AlertTriangle size={12} style={{ color: '#dc2626' }}/>}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
                <span style={{ color: '#64748b' }}>{j.grade} · {j.subject}</span>
                {j.error && <span style={{ color: '#dc2626', fontSize: '.75rem' }}>{j.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="library-filters">
        <div className="filter-group">
          <Search size={14} className="filter-icon"/>
          <input className="filter-input" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="filter-group">
          <Filter size={14} className="filter-icon"/>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="all">Todas las materias</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Materials */}
      {filtered.length === 0
        ? <div className="empty-state"><FolderOpen size={40}/><p className="empty-msg">{lessons.length === 0 ? 'No hay materiales. Subí un ZIP o PDF para empezar.' : 'No hay materiales con ese filtro.'}</p></div>
        : lessonsBySubject.map(({ subject, lessons: subjectLessons }) => (
          <SubjectSection key={subject} subject={subject} lessons={subjectLessons}
            onAssign={setAssignTarget} onToggleActive={toggleActive} onCreatePractice={setCreateTarget} onDelete={deleteLesson}/>
        ))
      }

      {createTarget && (
        <CreatePracticeModal lesson={createTarget} students={students} onClose={() => setCreateTarget(null)} onSaved={() => { setCreateTarget(null); onReload() }}/>
      )}
      {assignTarget && (
        <AssignModal lesson={assignTarget} students={students} onClose={() => setAssignTarget(null)} onSave={saveAssign}/>
      )}
    </div>
  )
}
