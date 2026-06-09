import { useState, useEffect, useRef } from 'react'
import type { Student, TeacherProfile, Practice, Lesson, Answer } from '../lib/types'
import { db } from '../lib/db'
import MathSandbox from '../components/MathSandbox'

interface Props { student: Student; teacher: TeacherProfile; onLogout: () => void }

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function StudentPortal({ student, teacher, onLogout }: Props) {
  const [tab, setTab]                     = useState<'practices'|'lessons'>('practices')
  const [practices, setPractices]         = useState<Practice[]>([])
  const [lessons, setLessons]             = useState<Lesson[]>([])
  const [active, setActive]               = useState<Practice | null>(null)
  const [linkedLesson, setLinkedLesson]   = useState<Lesson | null>(null)
  const [showLesson, setShowLesson]       = useState(false)
  const [answers, setAnswers]             = useState<Record<string, string|number>>({})
  const [canvasAnswers, setCanvasAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting]       = useState(false)
  const [done, setDone]                   = useState(false)
  const [submitted, setSubmitted]         = useState<string[]>([])
  const antiCheatFlags                    = useRef<string[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [ps, ls] = await Promise.all([
      db.practices.forStudent(student.id, teacher.id),
      db.lessons.forStudent(student.id, teacher.id),
    ])
    setPractices(ps); setLessons(ls)
    const ids: string[] = []
    for (const p of ps) {
      if (await db.submissions.exists(student.id, p.id)) ids.push(p.id)
    }
    setSubmitted(ids)
  }

  function startPractice(p: Practice) {
    setActive(p)
    setAnswers({})
    setCanvasAnswers({})
    antiCheatFlags.current = []
    if (p.lessonId) {
      const lesson = lessons.find(l => l.id === p.lessonId)
      if (lesson) { setLinkedLesson(lesson); setShowLesson(true); return }
    }
    setLinkedLesson(null); setShowLesson(false)
  }

  async function submit() {
    if (!active) return
    setSubmitting(true)
    try {
      const answerArr: Answer[] = active.questions.map(q => ({
        questionId: q.id,
        value: answers[q.id] ?? '',
        canvasImage: canvasAnswers[q.id],
      }))
      const mcqs    = active.questions.filter(q => q.type === 'multiple')
      const correct = mcqs.filter(q => answers[q.id] === q.correctOption).length
      const total   = mcqs.length
      const pts     = active.questions.reduce((a, q) => a + (q.points ?? 0), 0)
      const score   = total > 0 ? Math.round((correct / total) * pts) : undefined
      await db.submissions.add({
        teacherId: teacher.id, practiceId: active.id, studentId: student.id,
        answers: answerArr, score, reviewed: false,
        teacherNote: undefined, antiCheatFlags: antiCheatFlags.current,
      })
      setDone(true)
      setTimeout(() => {
        setDone(false); setActive(null); setLinkedLesson(null)
        setAnswers({}); setCanvasAnswers({}); loadData()
      }, 1500)
    } catch (e: any) { alert(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Lesson viewer (before practice) ─────────────────────────────
  if (showLesson && linkedLesson && active) {
    const ytId = linkedLesson.youtubeUrl ? getYoutubeId(linkedLesson.youtubeUrl) : null
    return (
      <div className="sp-practice">
        <div className="sp-nav">
          <button className="btn-ghost" onClick={() => { setActive(null); setShowLesson(false) }}>
            {'<'} Mis practicas
          </button>
          <span className="subject-badge">{linkedLesson.subject}</span>
        </div>
        <div className="sp-content">
          <h1>Leccion: {linkedLesson.title}</h1>
          {linkedLesson.content && (
            <p className="sp-desc" style={{ whiteSpace: 'pre-line' }}>{linkedLesson.content}</p>
          )}
          {linkedLesson.fileUrl && (
            <a href={linkedLesson.fileUrl} target="_blank" rel="noreferrer"
              className="btn-outline" style={{ display: 'inline-block', marginBottom: 12 }}>
              Ver documento de la leccion
            </a>
          )}
          {ytId && (
            <div style={{ marginBottom: 20 }}>
              <iframe
                width="100%" height="260"
                src={'https://www.youtube.com/embed/' + ytId}
                allowFullScreen
                style={{ borderRadius: 10, border: 'none' }}
              />
            </div>
          )}
          <button className="btn-primary full" onClick={() => setShowLesson(false)}>
            Ir a la practica
          </button>
        </div>
      </div>
    )
  }

  // ── Active practice ──────────────────────────────────────────────
  if (active) {
    return (
      <div className="sp-practice">
        <div className="sp-nav">
          <button className="btn-ghost" onClick={() => { setActive(null); setLinkedLesson(null) }}>
            {'<'} Mis practicas
          </button>
          <span className="subject-badge">{active.subject}</span>
          {linkedLesson && (
            <button className="btn-ghost" onClick={() => setShowLesson(true)}
              style={{ marginLeft: 'auto', fontSize: '.8rem' }}>
              Ver leccion
            </button>
          )}
        </div>
        <div className="sp-content">
          <h1>{active.title}</h1>
          <p className="sp-desc">{active.description}</p>
          {done ? (
            <div className="sp-done">Entregado!</div>
          ) : (
            <>
              {active.questions.map((q, i) => (
                <div key={q.id} className="sp-question">
                  <div className="sp-q-header">
                    <span>Pregunta {i + 1}</span>
                    <span>{q.points} pts</span>
                  </div>
                  {q.imageUrl && (
                    <img src={q.imageUrl} alt={'Figura pregunta ' + (i + 1)}
                      style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 10, display: 'block' }} />
                  )}
                  <p className="sp-q-text">{q.text}</p>
                  {q.type === 'multiple' && q.options ? (
                    <div className="sp-options">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className={'sp-option ' + (answers[q.id] === oi ? 'selected' : '')}>
                          <input type="radio" name={q.id}
                            checked={answers[q.id] === oi}
                            onChange={() => setAnswers(prev => ({ ...prev, [q.id]: oi }))} />
                          <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
                          {' '}{opt}
                        </label>
                      ))}
                    </div>
                  ) : q.hasSandbox ? (
                    <MathSandbox
                      textValue={(answers[q.id] as string) ?? ''}
                      canvasValue={canvasAnswers[q.id] ?? ''}
                      onTextChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                      onCanvasChange={v => setCanvasAnswers(prev => ({ ...prev, [q.id]: v }))}
                      flagsRef={antiCheatFlags}
                      placeholder="Escribi tu desarrollo aqui..."
                      subject={active.subject}
                    />
                  ) : (
                    <textarea className="sp-textarea" rows={4}
                      value={(answers[q.id] as string) ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Escribi tu respuesta aqui..." />
                  )}
                </div>
              ))}
              <button className="btn-primary full" onClick={submit} disabled={submitting}>
                {submitting ? 'Enviando...' : 'Entregar practica'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────
  return (
    <div className="sp-shell">
      <header className="sp-header">
        <span className="brand-logo sm">{teacher.logoText}</span>
        <span className="sp-student-name">{student.firstName} {student.lastName}</span>
        <button className="btn-ghost sm" onClick={onLogout}>Salir</button>
      </header>
      <div className="sp-tabs">
        <button className={tab === 'practices' ? 'active' : ''} onClick={() => setTab('practices')}>
          Practicas
        </button>
        <button className={tab === 'lessons' ? 'active' : ''} onClick={() => setTab('lessons')}>
          Lecciones
        </button>
      </div>
      <div className="sp-list">
        {tab === 'practices' && (
          practices.length === 0
            ? <p className="empty-msg">No tenes practicas asignadas aun.</p>
            : practices.map(p => (
              <div key={p.id} className="sp-card">
                <div className="sp-card-info">
                  <h3>{p.title}</h3>
                  <span className="subject-badge sm">{p.subject}</span>
                  {p.dueDate && <span className="sp-due">Vence: {p.dueDate}</span>}
                </div>
                {submitted.includes(p.id)
                  ? <span className="sp-submitted">Entregado</span>
                  : <button className="btn-primary" onClick={() => startPractice(p)}>Hacer practica</button>
                }
              </div>
            ))
        )}
        {tab === 'lessons' && (
          lessons.length === 0
            ? <p className="empty-msg">No tenes lecciones asignadas aun.</p>
            : lessons.map(l => (
              <div key={l.id} className="sp-card">
                <div className="sp-card-info">
                  <h3>{l.title}</h3>
                  <span className="subject-badge sm">{l.subject}</span>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                  {l.fileUrl && (
                    <a className="btn-outline" href={l.fileUrl} target="_blank" rel="noreferrer">Ver PDF</a>
                  )}
                  {l.youtubeUrl && (
                    <a className="btn-outline" href={l.youtubeUrl} target="_blank" rel="noreferrer">Ver video</a>
                  )}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
