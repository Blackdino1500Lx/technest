import { useState } from 'react'
import { db } from '../lib/db'
import type { Student, Question, Subject } from '../lib/types'
import { extractTextFromFile, extractTextFromUrl } from '../lib/pdfExtract'
import { parseQuestionsFromText } from '../lib/pdfParse'
import { X, Loader2, AlertTriangle, Check, Trash2, Plus, Edit3 } from 'lucide-react'

interface Props {
  students: Student[]
  initialFile?: File          // PDF dropped directly from practices tab
  initialFileUrl?: string     // from a lesson already stored
  initialTitle?: string
  initialSubject?: Subject
  onClose: () => void
  onSaved: () => void
}

type Step = 'extracting' | 'review' | 'saving' | 'done' | 'error'
const uid = () => Math.random().toString(36).slice(2, 10)

export default function CreatePracticeModal({ students, initialFile, initialFileUrl, initialTitle, initialSubject, onClose, onSaved }: Props) {
  const [step, setStep]               = useState<Step>('extracting')
  const [progress, setProgress]       = useState('')
  const [questions, setQuestions]     = useState<Question[]>([])
  const [editingQ, setEditingQ]       = useState<string | null>(null)
  const [error, setError]             = useState('')
  const [title, setTitle]             = useState(initialTitle ?? 'Nueva práctica')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate]         = useState('')
  const [subject, setSubject]         = useState<Subject>(initialSubject ?? 'Matemáticas')
  const [assignedTo, setAssignedTo]   = useState<string[]>([])

  const SUBJECTS: Subject[] = ['Matemáticas','Español','Ciencias','Estudios Sociales','Inglés']

  useState(() => { startProcess() })

  async function startProcess() {
    setStep('extracting'); setError('')
    try {
      setProgress('Extrayendo texto del PDF...')
      let pdfText = ''
      if (initialFile)    pdfText = await extractTextFromFile(initialFile)
      else if (initialFileUrl) pdfText = await extractTextFromUrl(initialFileUrl)

      if (!pdfText || pdfText.trim().length < 50)
        throw new Error('No se pudo extraer texto del PDF. Verificá que el archivo tenga texto seleccionable.')

      setProgress('Detectando preguntas...')
      const parsed = parseQuestionsFromText(pdfText)
      if (parsed.length === 0)
        throw new Error('No se encontraron preguntas numeradas en el PDF. El formato debe tener preguntas como "1)" o "1."')

      const isMath = subject === 'Matemáticas'
      const qs: Question[] = parsed.map(p => ({
        id:            uid(),
        text:          p.text,
        type:          (isMath && p.options.length === 0) ? 'open' : 'multiple',
        options:       p.options.length >= 3 ? p.options.slice(0, 4) : ['', '', '', ''],
        correctOption: 0,
        points:        isMath ? 10 : 5,
      }))

      setQuestions(qs)
      setStep('review')
    } catch (e: any) {
      setError(e.message ?? 'Error procesando el PDF')
      setStep('error')
    }
  }

  const updateQ = (id: string, patch: Partial<Question>) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  const removeQ = (id: string) =>
    setQuestions(prev => prev.filter(q => q.id !== id))
  const addQ = () => setQuestions(prev => [...prev, {
    id: uid(), text: '', points: 5,
    type: subject === 'Matemáticas' ? 'open' : 'multiple',
    options: ['', '', '', ''], correctOption: 0,
  }])

  const save = async () => {
    if (!title.trim())           { alert('El título es requerido'); return }
    if (questions.length === 0)  { alert('Necesitás al menos una pregunta'); return }
    if (assignedTo.length === 0) { alert('Asigná a al menos un alumno'); return }
    setStep('saving')
    try {
      await db.practices.add({ title, subject, description, questions, assignedTo, dueDate: dueDate || undefined, isActive: true, lessonId: undefined })
      setStep('done')
      setTimeout(() => { onSaved(); onClose() }, 1000)
    } catch (e: any) {
      setError(e.message ?? 'Error guardando'); setStep('error')
    }
  }

  const totalPoints = questions.reduce((a, q) => a + (Number(q.points) || 0), 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h3>Crear práctica desde PDF</h3>
            <p className="modal-subtitle">{initialFile?.name ?? 'Procesando documento...'}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {step === 'extracting' && (
          <div className="modal-loading">
            <Loader2 size={32} className="spin"/>
            <p className="ai-progress-text">{progress}</p>
          </div>
        )}

        {step === 'error' && (
          <div className="modal-body">
            <div className="error-msg" style={{marginBottom:16}}>
              <AlertTriangle size={16}/> {error}
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={onClose}>Cerrar</button>
              <button className="btn-primary" onClick={startProcess}>Reintentar</button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="modal-loading">
            <Check size={48} style={{color:'#22c55e'}}/>
            <p style={{fontWeight:600,fontSize:16}}>¡Práctica creada!</p>
          </div>
        )}

        {step === 'saving' && (
          <div className="modal-loading"><Loader2 size={32} className="spin"/><p>Guardando...</p></div>
        )}

        {step === 'review' && (
          <>
            <div className="modal-body">
              <div className="create-practice-meta">
                <div className="field full"><label>Título</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}/>
                </div>
                <div className="form-row" style={{marginBottom:0}}>
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

              <div className="field full" style={{marginBottom:20}}>
                <label>Asignar a alumnos</label>
                <div className="chip-grid">
                  {students.length === 0
                    ? <span className="hint">Registrá alumnos primero.</span>
                    : students.map(s => (
                      <label key={s.id} className={`chip ${assignedTo.includes(s.id)?'selected':''}`}>
                        <input type="checkbox" checked={assignedTo.includes(s.id)}
                          onChange={e => setAssignedTo(prev =>
                            e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id)
                          )}/>
                        {s.firstName} {s.lastName}
                      </label>
                    ))
                  }
                </div>
              </div>

              <div className="ai-generated-banner">
                <Check size={14} style={{color:'#22c55e'}}/>
                <span><strong>{questions.length} preguntas</strong> detectadas · {totalPoints} pts totales</span>
                <button className="btn-outline sm" onClick={addQ}><Plus size={12}/> Agregar</button>
              </div>

              <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:'.6rem'}}>
                {questions.map((q, idx) => (
                  <div className="q-card" key={q.id}>
                    <div className="q-card-header">
                      <span>P{idx+1} · {q.type==='open'?'Desarrollo':'Opción múltiple'}</span>
                      <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:'auto'}}>
                        <input type="number" min={1} max={100} value={q.points} style={{width:56}}
                          onChange={e => updateQ(q.id,{points:+e.target.value})}/> <span style={{fontSize:'.8rem',color:'var(--muted)'}}>pts</span>
                        <button className="icon-btn" onClick={() => setEditingQ(editingQ===q.id?null:q.id)}><Edit3 size={14}/></button>
                        <button className="icon-btn danger" onClick={() => removeQ(q.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>

                    {editingQ === q.id ? (
                      <>
                        <textarea rows={3} value={q.text} onChange={e => updateQ(q.id,{text:e.target.value})} placeholder="Enunciado"/>
                        {q.type==='multiple' && q.options && (
                          <div className="options-builder">
                            {q.options.map((opt,oi) => (
                              <div key={oi} className="opt-row">
                                <input type="radio" name={`c-${q.id}`} checked={q.correctOption===oi}
                                  onChange={() => updateQ(q.id,{correctOption:oi})}/>
                                <span className="opt-letter">{String.fromCharCode(65+oi)}</span>
                                <input type="text" value={opt}
                                  onChange={e => { const opts=[...(q.options??[])]; opts[oi]=e.target.value; updateQ(q.id,{options:opts}) }}/>
                              </div>
                            ))}
                            <p className="hint">● = respuesta correcta</p>
                          </div>
                        )}
                        <button className="btn-outline sm" style={{marginTop:8}} onClick={() => setEditingQ(null)}>
                          <Check size={12}/> Listo
                        </button>
                      </>
                    ) : (
                      <p style={{fontSize:'.88rem',color:'var(--ink)',margin:'.25rem 0 0'}}>{q.text || <em style={{color:'var(--muted)'}}>Sin enunciado</em>}</p>
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