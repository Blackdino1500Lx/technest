import { useState, useEffect } from 'react'
import type { Student, TeacherProfile, Practice, Lesson, Answer } from '../lib/types'
import { supabase } from '../lib/supabase'

interface Props { student: Student; teacher: TeacherProfile; onLogout: () => void }

export default function StudentPortal({ student, teacher, onLogout }: Props) {
  const [tab, setTab]                 = useState<'practices'|'lessons'>('practices')
  const [practices, setPractices]     = useState<Practice[]>([])
  const [lessons, setLessons]         = useState<Lesson[]>([])
  const [active, setActive]           = useState<Practice | null>(null)
  const [answers, setAnswers]         = useState<Record<string, string|number>>({})
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)
  const [submitted, setSubmitted]     = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [ps, ls] = await Promise.all([
      supabase.from('practices').select('*').eq('is_active', true).eq('teacher_id', teacher.id),
      supabase.from('lessons').select('*').eq('is_active', true).eq('teacher_id', teacher.id),
    ])
    const allP = ((ps.data ?? []) as any[])
      .map((r: any) => ({ id: r.id, teacherId: r.teacher_id, title: r.title, subject: r.subject, description: r.description ?? '', questions: r.questions ?? [], assignedTo: r.assigned_to ?? [], dueDate: r.due_date ?? undefined, createdAt: r.created_at, isActive: r.is_active, lessonId: r.lesson_id ?? undefined }))
      .filter((p: Practice) => p.assignedTo.includes(student.id))
    const allL = ((ls.data ?? []) as any[])
      .map((r: any) => ({ id: r.id, teacherId: r.teacher_id, title: r.title, subject: r.subject, content: r.content ?? undefined, fileUrl: r.file_url ?? undefined, fileName: r.file_name ?? undefined, examKey: r.exam_key ?? undefined, youtubeUrl: r.youtube_url ?? undefined, pageImages: r.page_images ?? undefined, assignedTo: r.assigned_to ?? [], isActive: r.is_active, createdAt: r.created_at }))
      .filter((l: Lesson) => l.assignedTo.includes(student.id))
    setPractices(allP); setLessons(allL)

    // Check which practices are already submitted
    const ids: string[] = []
    for (const p of allP) {
      const { data } = await supabase.from('submissions').select('id').eq('student_id', student.id).eq('practice_id', p.id).maybeSingle()
      if (data) ids.push(p.id)
    }
    setSubmitted(ids)
  }

  const submit = async () => {
    if (!active) return
    setSubmitting(true)
    try {
      const answerArr: Answer[] = active.questions.map(q => ({ questionId: q.id, value: answers[q.id] ?? '' }))
      const correct = active.questions.filter(q => q.type === 'multiple' && answers[q.id] === q.correctOption).length
      const total   = active.questions.filter(q => q.type === 'multiple').length
      const score   = total > 0 ? Math.round((correct / total) * active.questions.reduce((a, q) => a + (q.points ?? 0), 0)) : undefined

      await supabase.from('submissions').insert({
        teacher_id: teacher.id, practice_id: active.id, student_id: student.id,
        answers: answerArr, score: score ?? null, reviewed: false,
        teacher_note: null, anti_cheat_flags: [],
      })
      setDone(true)
      setTimeout(() => { setDone(false); setActive(null); setAnswers({}); loadData() }, 1500)
    } catch (e: any) { alert(e.message) }
    finally { setSubmitting(false) }
  }

  if (active) return (
    <div className="sp-practice">
      <div className="sp-nav">
        <button className="btn-ghost" onClick={() => setActive(null)}>← Mis prácticas</button>
        <span className="subject-badge">{active.subject}</span>
      </div>
      <div className="sp-content">
        <h1>{active.title}</h1>
        <p className="sp-desc">{active.description}</p>
        {done ? <div className="sp-done">✓ ¡Entregado!</div> : (
          <>
            {active.questions.map((q, i) => (
              <div key={q.id} className="sp-question">
                <div className="sp-q-header"><span>Pregunta {i+1}</span><span>{q.points} pts</span></div>
                <p className="sp-q-text">{q.text}</p>
                {q.type === 'multiple' && q.options ? (
                  <div className="sp-options">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`sp-option ${answers[q.id] === oi ? 'selected' : ''}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers(p => ({...p, [q.id]: oi}))}/>
                        <span className="opt-letter">{String.fromCharCode(65+oi)}</span> {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea className="sp-textarea" rows={4} value={(answers[q.id] as string) ?? ''}
                    onChange={e => setAnswers(p => ({...p, [q.id]: e.target.value}))}
                    placeholder="Escribí tu respuesta aquí..."/>
                )}
              </div>
            ))}
            <button className="btn-primary full" onClick={submit} disabled={submitting}>
              {submitting ? 'Enviando...' : '✓ Entregar práctica'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="sp-shell">
      <header className="sp-header">
        <span className="brand-logo sm">{teacher.logoText}</span>
        <span className="sp-student-name">{student.firstName} {student.lastName}</span>
        <button className="btn-ghost sm" onClick={onLogout}>Salir</button>
      </header>
      <div className="sp-tabs">
        <button className={tab==='practices'?'active':''} onClick={() => setTab('practices')}>📋 Prácticas</button>
        <button className={tab==='lessons'?'active':''} onClick={() => setTab('lessons')}>📖 Lecciones</button>
      </div>
      <div className="sp-list">
        {tab === 'practices' && (practices.length === 0 ? <p className="empty-msg">No tenés prácticas asignadas aún.</p> :
          practices.map(p => (
            <div key={p.id} className="sp-card">
              <div className="sp-card-info">
                <h3>{p.title}</h3>
                <span className="subject-badge sm">{p.subject}</span>
                {p.dueDate && <span className="sp-due">Vence: {p.dueDate}</span>}
              </div>
              {submitted.includes(p.id)
                ? <span className="sp-submitted">✓ Entregado</span>
                : <button className="btn-primary" onClick={() => { setActive(p); setAnswers({}) }}>Hacer práctica →</button>
              }
            </div>
          ))
        )}
        {tab === 'lessons' && (lessons.length === 0 ? <p className="empty-msg">No tenés lecciones asignadas aún.</p> :
          lessons.map(l => (
            <div key={l.id} className="sp-card">
              <div className="sp-card-info">
                <h3>{l.title}</h3>
                <span className="subject-badge sm">{l.subject}</span>
              </div>
              {l.fileUrl && <a className="btn-outline" href={l.fileUrl} target="_blank">Ver PDF</a>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
