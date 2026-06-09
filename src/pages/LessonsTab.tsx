import { useState, useRef } from 'react'
import JSZip from 'jszip'
import type { Lesson, Student, Subject } from '../lib/types'
import { db, qImages } from '../lib/db'
import CreatePracticeModal from './CreatePracticeModal'
import { Plus, Trash2, AlertTriangle, Loader2, FileText, Eye, EyeOff, Upload, Sparkles } from 'lucide-react'

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés', 'Informática']

interface Props { lessons: Lesson[]; students: Student[]; onReload: () => void }

function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Subject section ───────────────────────────────────────────────
function SubjectSection({ subject, lessons, onToggleActive, onRemove, onCreatePractice }: {
  subject: Subject; lessons: Lesson[]
  onToggleActive: (l: Lesson) => void; onRemove: (id: string) => void; onCreatePractice: (l: Lesson) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (lessons.length === 0) return null
  return (
    <div className="subject-section">
      <div className="subject-section-header">
        <span className="subject-badge">{subject}</span>
        <span className="subject-count">{lessons.length} lecciones</span>
      </div>
      <div className="cards-grid">
        {lessons.map(l => (
          <div className={`lesson-card ${!l.isActive ? 'lib-inactive' : ''}`} key={l.id}>
            <div className="lesson-card-top">
              <span className="subject-badge">{l.subject}</span>
              <span className={`status-dot ${l.isActive ? 'active' : ''}`}/>
            </div>
            <div className="lib-card-icon"><FileText size={28}/></div>
            <h3>{l.title}</h3>
            {l.fileName && <p className="lesson-yt">📄 {l.fileName}</p>}
            <p className="lesson-students">👥 {l.assignedTo.length} alumno{l.assignedTo.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', gap: '.4rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <button className="btn-danger-sm" onClick={() => onToggleActive(l)}>
                {l.isActive ? <><EyeOff size={11}/> Desactivar</> : <><Eye size={11}/> Activar</>}
              </button>
              <button className="btn-danger-sm" style={{ borderColor: '#d1fae5', background: '#ecfdf5', color: '#065f46' }} onClick={() => onCreatePractice(l)}>
                <Sparkles size={11}/> Crear práctica
              </button>
              <button className="btn-danger-sm" onClick={() => onRemove(l.id)}><Trash2 size={11}/> Eliminar</button>
            </div>
            <button style={{ width: '100%', fontSize: '.75rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '.5rem', marginTop: '.5rem' }}
              onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
              {expanded === l.id ? '▲ Ver menos' : '▼ Ver detalles'}
            </button>
            {expanded === l.id && (
              <div style={{ marginTop: '.75rem', paddingTop: '.75rem', borderTop: '1px solid #e2e8f0' }}>
                {l.content && <p style={{ fontSize: '.875rem', marginBottom: '.75rem', color: '#475569' }}>{l.content}</p>}
                {l.fileUrl && (
                  <a href={l.fileUrl} target="_blank" rel="noreferrer" className="btn-danger-sm" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <FileText size={11}/> Ver documento
                  </a>
                )}
                {l.youtubeUrl && ytEmbed(l.youtubeUrl) && (
                  <div style={{ marginTop: 12 }}>
                    <iframe width="100%" height="160" src={`https://www.youtube.com/embed/${ytEmbed(l.youtubeUrl)}`}
                      allowFullScreen style={{ borderRadius: 8, border: 'none' }}/>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LessonsTab({ lessons, students, onReload }: Props) {
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [uploading, setUploading]   = useState(false)
  const [createTarget, setCreateTarget] = useState<Lesson | null>(null)
  const [pendingImagesZip, setPendingImagesZip] = useState<File | null>(null)
  const imagesZipRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '', subject: SUBJECTS[0] as Subject,
    content: '', youtubeUrl: '',
    fileUrl: '', fileName: '',
    assignedTo: [] as string[], isActive: true,
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setErr('')
    try { const { url, name } = await db.storage.uploadFile(file); setForm(f => ({ ...f, fileUrl: url, fileName: name })) }
    catch (_e) { setErr('Error subiendo el archivo. Intentá de nuevo.') }
    finally { setUploading(false) }
  }

  const processImagesZip = async (zipFile: File, examKey: string) => {
    const zip = await JSZip.loadAsync(zipFile)
    for (const [relativePath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      const ext = relativePath.toLowerCase()
      if (!ext.endsWith('.png') && !ext.endsWith('.jpg') && !ext.endsWith('.jpeg')) continue
      const blob = await entry.async('blob')
      const fileName = relativePath.split('/').pop() || relativePath
      const imgFile = new File([blob], fileName, { type: 'image/png' })
      const questionNum = parseInt(fileName.match(/\d+/)?.[0] || '0')
      const { url } = await db.storage.uploadFile(imgFile)
      await qImages.add({ examKey, fromQ: questionNum, toQ: questionNum, imageUrl: url, imageName: fileName })
    }
  }

  const save = async () => {
    if (!form.title.trim())           { setErr('El título es requerido'); return }
    if (form.assignedTo.length === 0) { setErr('Asigná a al menos un alumno'); return }
    if (!form.content && !form.fileUrl && !form.youtubeUrl) { setErr('Agregá contenido: texto, documento o video'); return }
    setSaving(true); setErr('')
    try {
      const examKey = qImages.buildExamKey(form.title.replace(/[^a-zA-Z0-9]/g, '_'))
      await db.lessons.add({ ...form, examKey })
      if (pendingImagesZip) { await processImagesZip(pendingImagesZip, examKey); setPendingImagesZip(null) }
      await onReload()
      setShowForm(false)
      setForm({ title: '', subject: SUBJECTS[0], content: '', youtubeUrl: '', fileUrl: '', fileName: '', assignedTo: [], isActive: true })
    } catch (e: any) { setErr(e.message ?? 'Error guardando lección') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => { if (!confirm('¿Eliminar esta lección?')) return; await db.lessons.delete(id); onReload() }
  const toggleActive = async (l: Lesson) => { await db.lessons.update({ ...l, isActive: !l.isActive }); onReload() }

  const lessonsBySubject = SUBJECTS.map(subject => ({
    subject,
    lessons: lessons.filter(l => l.subject === subject)
  })).filter(g => g.lessons.length > 0)

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Lecciones ({lessons.length})</h2>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14}/> Nueva lección</button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Crear lección</h3>
          <div className="form-row">
            <div className="field"><label>Título</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Introducción a las fracciones"/>
            </div>
            <div className="field"><label>Materia</label>
              <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value as Subject }))}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="field full"><label>Contenido / Explicación (texto)</label>
            <textarea rows={5} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Escribí la explicación de la lección aquí..."/>
          </div>

          <div className="field full"><label>Documento (PDF, Word, PPT)</label>
            <div className="file-upload-row">
              <label className="file-upload-btn">
                {uploading ? <><Loader2 size={14} className="spin"/> Subiendo...</> : <><Upload size={14}/> {form.fileUrl ? form.fileName : 'Seleccionar archivo'}</>}
                <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading}/>
              </label>
              {form.fileUrl && <button className="btn-ghost" onClick={() => setForm(f => ({ ...f, fileUrl: '', fileName: '' }))}>✕ Quitar</button>}
            </div>
          </div>

          <div className="field full">
            <label>📷 ZIP de imágenes por pregunta (opcional)</label>
            <div className="file-upload-row">
              <button type="button" className="btn-outline" onClick={() => imagesZipRef.current?.click()}>
                {pendingImagesZip ? `✅ ${pendingImagesZip.name}` : '📦 Seleccionar ZIP de imágenes'}
              </button>
              <input ref={imagesZipRef} type="file" accept=".zip" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setPendingImagesZip(f); e.target.value = '' }}/>
            </div>
            <small style={{ color: '#64748b', fontSize: '.78rem' }}>Las imágenes se asocian por número de pregunta (ej: 1.png, 2.jpg)</small>
          </div>

          <div className="field full"><label>Video de YouTube (URL)</label>
            <input value={form.youtubeUrl} onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..."/>
            {form.youtubeUrl && ytEmbed(form.youtubeUrl) && (
              <div style={{ marginTop: 10 }}>
                <iframe width="100%" height="200" src={`https://www.youtube.com/embed/${ytEmbed(form.youtubeUrl)}`}
                  allowFullScreen style={{ borderRadius: 8, border: 'none' }}/>
              </div>
            )}
          </div>

          <div className="field full"><label>Asignar a alumnos</label>
            <div className="chip-grid">
              {students.length === 0
                ? <span style={{ color: '#64748b', fontSize: '.85rem' }}>Registrá alumnos primero.</span>
                : students.map(s => (
                  <label key={s.id} className={`chip ${form.assignedTo.includes(s.id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={form.assignedTo.includes(s.id)}
                      onChange={e => setForm(f => ({ ...f, assignedTo: e.target.checked ? [...f.assignedTo, s.id] : f.assignedTo.filter(x => x !== s.id) }))}/>
                    {s.firstName} {s.lastName}
                  </label>
                ))
              }
            </div>
          </div>

          {err && <div className="limit-warning"><AlertTriangle size={13}/> {err}</div>}
          <div className="form-actions">
            <button className="btn-outline" onClick={() => { setShowForm(false); setErr(''); setPendingImagesZip(null) }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin"/> Guardando...</> : 'Guardar lección'}
            </button>
          </div>
        </div>
      )}

      {lessons.length === 0
        ? <p className="empty-msg">No hay lecciones aún. Creá una nueva para empezar.</p>
        : lessonsBySubject.map(({ subject, lessons: subjectLessons }) => (
          <SubjectSection key={subject} subject={subject} lessons={subjectLessons}
            onToggleActive={toggleActive} onRemove={remove} onCreatePractice={setCreateTarget}/>
        ))
      }

      {createTarget && (
        <CreatePracticeModal lesson={createTarget} students={students} onClose={() => setCreateTarget(null)} onSaved={() => { setCreateTarget(null); onReload() }}/>
      )}
    </div>
  )
}
