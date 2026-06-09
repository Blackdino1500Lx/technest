import { useState, useEffect } from 'react'
import type { Lesson, Student, Question, Subject } from '../lib/types'
import { db, qImages } from '../lib/db'
import { extractTextFromUrl, extractTextFromFile } from '../lib/pdfExtract'
import { parseQuestionsFromText } from '../lib/pdfParse'
import { X, Loader2, AlertTriangle, Check, Trash2, Plus, Edit3, Image } from 'lucide-react'

const SUBJECTS: Subject[] = ['Matemáticas', 'Español', 'Ciencias', 'Estudios Sociales', 'Inglés', 'Informática']

interface Props {
  lesson?: Lesson          // crear desde lección de la Biblioteca
  file?: File              // crear desde PDF subido directamente
  initialSubject?: Subject
  students: Student[]
  onClose: () => void
  onSaved: () => void
}

type Step = 'extracting' | 'review' | 'saving' | 'done' | 'error'
const uid = () => Math.random().toString(36).slice(2, 10)

export default function CreatePracticeModal({ lesson, file, initialSubject, students, onClose, onSaved }: Props) {
  const sourceName = lesson?.title ?? file?.name ?? 'PDF'
  const [step, setStep]               = useState<Step>('extracting')
  const [progress, setProgress]       = useState('')
  const [questions, setQuestions]     = useState<Question[]>([])
  const [editingQ, setEditingQ]       = useState<string | null>(null)
  const [error, setError]             = useState('')
  const [subject, setSubject]         = useState<Subject>(lesson?.subject ?? initialSubject ?? 'Matemáticas')
  const [title, setTitle]             = useState(lesson ? `Práctica · ${lesson.title}` : `Práctica · ${(file?.name ?? '').replace(/\.pdf$/i, '')}`)
  const [description, setDescription] = useState(lesson ? `Basada en: ${lesson.fileName ?? lesson.title}` : `Basada en: ${file?.name ?? ''}`)
  const [dueDate, setDueDate]         = useState('')
  const [assignedTo, setAssignedTo]   = useState<string[]>([])
  const [uploadingImg, setUploadingImg] = useState<string | null>(null)

  useEffect(() => { startProcess() }, [])

  async function startProcess() {
    setStep('extracting'); setError('')
    try {
      setProgress('Extrayendo texto del PDF...')
      let pdfText = ''
      if (file) { pdfText = await extractTextFromFile(file) }
      else if (lesson?.fileUrl) { pdfText = await extractTextFromUrl(lesson.fileUrl) }
      else { throw new Error('No hay PDF para procesar.') }

      if (!pdfText || pdfText.trim().length < 100)
        throw new Error('No se pudo extraer texto del PDF. ¿Es un PDF escaneado? Probá crear la práctica manualmente.')

      setProgress('Parseando preguntas...')
      const parsed = parseQuestionsFromText(pdfText)
      if (parsed.length === 0)
        throw new Error('No se encontraron preguntas en el PDF. Podés agregarlas manualmente con el botón "Agregar".')

      // Buscar imágenes si viene de lección
      let imgs: Awaited<ReturnType<typeof qImages.forExam>> = []
      if (lesson) {
        setProgress('Buscando imágenes...')
        const examKey = lesson.examKey ?? qImages.buildExamKey((lesson.fileName ?? lesson.title).replace(/\.pdf$/i, ''))
        try { imgs = await qImages.forExam(examKey) } catch (_e) { /* no images */ }
      }

      const isMath = subject === 'Matemáticas'
      const qs: Question[] = parsed.map(p => {
        const img = qImages.findForQuestion(imgs, p.num)
        return {
          id: uid(), text: p.text,
          type: (isMath && p.options.length === 0) ? 'open' : 'multiple',
          options: p.options.length >= 3 ? p.options.slice(0, 4) : ['', '', '', ''],
          correctOption: 0,
          points: isMath ? 10 : 5,
          imageUrl: img?.imageUrl,
        }
      })

      setQuestions(qs); setStep('review')
    } catch (e: any) { setError(e.message ?? 'Error procesando el PDF'); setStep('error') }
  }

  const updateQ = (id: string, patch: Partial<Question>) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  const removeQ = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id))
  const addQ = () => {
    const isMath = subject === 'Matemáticas'
    setQuestions(prev => [...prev, { id: uid(), text: '', points: 5, type: isMath ? 'open' : 'multiple', options: isMath ? undefined : ['', '', '', ''], correctOption: 0 }])
  }

  const handleImageUpload = async (qId: string, imgFile: File) => {
    setUploadingImg(qId)
    try { const { url } = await db.storage.uploadFile(imgFile); updateQ(qId, { imageUrl: url }) }
    catch (e: any) { alert('Error subiendo imagen: ' + (e?.message ?? e)) }
    finally { setUploadingImg(null) }
  }

  const save = async () => {
    if (!title.trim())           { alert('El título es requerido'); return }
    if (questions.length === 0)  { alert('Necesitás al menos una pregunta'); return }
    if (assignedTo.length === 0) { alert('Asigná a al menos un alumno'); return }
    setStep('saving')
    try {
      await db.practices.add({ title, subject, description, questions, assignedTo, dueDate: dueDate || undefined, isActive: true, lessonId: lesson?.id })
      setStep('done')
      setTimeout(() => { onSaved(); onClose() }, 1200)
    } catch (e: any) { setError(e.message ?? 'Error guardando'); setStep('error') }
  }

  const totalPoints = questions.reduce((a, q) => a + (Number(q.points) || 0), 0)
  const withImages  = questions.filter(q => q.imageUrl).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h3>Crear práctica</h3>
            <p className="modal-subtitle" style={{ padding: 0, marginTop: 4 }}>{sourceName}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {step === 'extracting' && (
          <div className="modal-loading"><Loader2 size={32} className="spin"/><p className="ai-progress-text">{progress}</p></div>
        )}
        {step === 'error' && (
          <div className="modal-body">
            <div className="error-msg" style={{ marginBottom: 16 }}><AlertTriangle size={16}/> {error}</div>
            <div className="form-actions">
              <button className="btn-outline" onClick={onClose}>Cerrar</button>
              <button className="btn-primary" onClick={startProcess}>Reintentar</button>
            </div>
          </div>
        )}
        {step === 'done' && (
          <div className="modal-loading"><Check size={48} style={{ color: 'var(--success, #22c55e)' }}/><p style={{ fontWeight: 600, fontSize: 16 }}>¡Práctica creada!</p></div>
        )}
        {step === 'saving' && (
          <div className="modal-loading"><Loader2 size={32} className="spin"/><p>Guardando...</p></div>
        )}

        {step === 'review' && (
          <>
            <div className="modal-body">
              {/* Metadata */}
              <div className="create-practice-meta">
                <div className="field full"><label>Título</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}/>
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="field"><label>Materia</label>
                    <select value={subject} onChange={e => setSubject(e.target.value as Subject)}>
                      {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Fecha límite (opcional)</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/>
                  </div>
                </div>
                <div className="field full"><label>Descripción</label>
                  <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}/>
                </div>
              </div>

              {/* Assign */}
              <div className="field full" style={{ marginBottom: 20 }}>
                <label>Asignar a alumnos</label>
                <div className="chip-grid">
                  {students.length === 0
                    ? <span className="hint">Registrá alumnos primero.</span>
                    : students.map(s => (
                      <label key={s.id} className={`chip ${assignedTo.includes(s.id) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={assignedTo.includes(s.id)}
                          onChange={e => setAssignedTo(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))}/>
                        {s.firstName} {s.lastName}
                      </label>
                    ))
                  }
                </div>
              </div>

              {/* Summary */}
              <div className="ai-generated-banner">
                <Check size={14} style={{ color: '#22c55e' }}/>
                <span>
                  <strong>{questions.length} preguntas</strong> extraídas · {totalPoints} pts
                  {withImages > 0 && <> · <strong>{withImages}</strong> con imagen 🖼️</>}
                </span>
                <button className="btn-outline sm" onClick={addQ}><Plus size={12}/> Agregar</button>
              </div>

              {/* Questions */}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {questions.map((q, idx) => (
                  <div className="q-card" key={q.id}>
                    <div className="q-card-header">
                      <span>P{idx + 1} · {q.type === 'open' ? 'Desarrollo' : 'Opción múltiple'}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                        <input type="number" min={1} max={100} value={q.points} style={{ width: 56 }}
                          onChange={e => updateQ(q.id, { points: +e.target.value })}/>
                        <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>pts</span>
                        {/* Image upload */}
                        <label className="icon-btn" title="Adjuntar imagen" style={{ cursor: 'pointer' }}>
                          {uploadingImg === q.id ? <Loader2 size={14} className="spin"/> : <Image size={14}/>}
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(q.id, f) }}/>
                        </label>
                        <button className="icon-btn" onClick={() => setEditingQ(editingQ === q.id ? null : q.id)}><Edit3 size={14}/></button>
                        <button className="icon-btn danger" onClick={() => removeQ(q.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>

                    {/* Image preview */}
                    {q.imageUrl && (
                      <div className="q-image-preview">
                        <img src={q.imageUrl} alt="Figura" style={{ maxWidth: '100%', borderRadius: 6, margin: '6px 0' }}/>
                        <button className="btn-ghost" onClick={() => updateQ(q.id, { imageUrl: undefined })} style={{ fontSize: '.75rem' }}>
                          <X size={11}/> Quitar imagen
                        </button>
                      </div>
                    )}

                    {/* Sandbox toggle */}
                    <label className="sandbox-toggle-label" style={{ marginTop: 8 }}>
                      <input type="checkbox" checked={q.hasSandbox ?? false}
                        onChange={e => {
                          const on = e.target.checked
                          updateQ(q.id, {
                            hasSandbox: on,
                            type: on ? 'open' : 'multiple',
                            options: on ? undefined : ['', '', '', ''],
                          })
                        }}/>
                      <span>🎨 Habilitar sandbox (texto + dibujo libre)</span>
                    </label>

                    {editingQ === q.id ? (
                      <>
                        <textarea rows={3} value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })} placeholder="Enunciado"/>
                        {q.type === 'multiple' && q.options && (
                          <div className="options-builder">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="opt-row">
                                <input type="radio" name={`c-${q.id}`} checked={q.correctOption === oi} onChange={() => updateQ(q.id, { correctOption: oi })}/>
                                <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
                                <input type="text" value={opt} onChange={e => { const opts = [...(q.options ?? [])]; opts[oi] = e.target.value; updateQ(q.id, { options: opts }) }}/>
                              </div>
                            ))}
                            <p className="hint">● = respuesta correcta</p>
                          </div>
                        )}
                        <button className="btn-outline sm" style={{ marginTop: 8 }} onClick={() => setEditingQ(null)}>
                          <Check size={12}/> Listo
                        </button>
                      </>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        <p style={{ fontSize: '.88rem', color: 'var(--ink)', margin: '0 0 6px' }}>
                          {q.text || <em style={{ color: 'var(--muted)' }}>Sin enunciado</em>}
                        </p>
                        {q.type === 'multiple' && q.options && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {q.options.map((opt, oi) => (
                              <span key={oi} style={{ fontSize: '.82rem', color: oi === q.correctOption ? 'var(--teal,#1E9E8E)' : 'var(--muted,#6B7280)', display: 'flex', gap: 6 }}>
                                <strong>{String.fromCharCode(65 + oi)})</strong> {opt || <em>sin texto</em>}
                                {oi === q.correctOption && <span style={{ fontSize: '.75rem', color: 'var(--teal,#1E9E8E)' }}>✓</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" onClick={save}>
                <Check size={15}/> Guardar práctica ({questions.length} preguntas · {totalPoints} pts)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
