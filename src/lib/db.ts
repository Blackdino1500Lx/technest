import { supabase } from './supabase'
import type { Student, Lesson, Practice, Submission } from './types'

const toStudent  = (r: any): Student  => ({ id: r.id, teacherId: r.teacher_id, firstName: r.first_name, lastName: r.last_name, grade: r.grade, level: r.level, pin: r.pin, createdAt: r.created_at })
const toLesson   = (r: any): Lesson   => ({ id: r.id, teacherId: r.teacher_id, title: r.title, subject: r.subject, content: r.content ?? undefined, fileUrl: r.file_url ?? undefined, fileName: r.file_name ?? undefined, examKey: r.exam_key ?? undefined, youtubeUrl: r.youtube_url ?? undefined, pageImages: r.page_images ?? undefined, assignedTo: r.assigned_to ?? [], isActive: r.is_active, createdAt: r.created_at })
const toPractice = (r: any): Practice => ({ id: r.id, teacherId: r.teacher_id, title: r.title, subject: r.subject, description: r.description ?? '', questions: r.questions ?? [], assignedTo: r.assigned_to ?? [], dueDate: r.due_date ?? undefined, createdAt: r.created_at, isActive: r.is_active, lessonId: r.lesson_id ?? undefined })
const toSub      = (r: any): Submission => ({ id: r.id, teacherId: r.teacher_id, practiceId: r.practice_id, studentId: r.student_id, answers: r.answers ?? [], submittedAt: r.submitted_at, score: r.score ?? undefined, reviewed: r.reviewed, teacherNote: r.teacher_note ?? undefined, antiCheatFlags: r.anti_cheat_flags ?? [] })

async function tid(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export const db = {
  students: {
    async getAll(): Promise<Student[]> {
      const t = await tid()
      const { data, error } = await supabase.from('students').select('*').eq('teacher_id', t).order('created_at')
      if (error) throw error; return (data ?? []).map(toStudent)
    },
    async add(s: Omit<Student,'id'|'createdAt'|'teacherId'>): Promise<Student> {
      const t = await tid()
      const { data, error } = await supabase.from('students')
        .insert({ teacher_id: t, first_name: s.firstName, last_name: s.lastName, grade: s.grade, level: s.level, pin: s.pin })
        .select().single()
      if (error) throw error; return toStudent(data)
    },
    async delete(id: string) { const { error } = await supabase.from('students').delete().eq('id', id); if (error) throw error },
    async findByPin(pin: string, teacherId: string): Promise<Student | null> {
      const { data, error } = await supabase.from('students').select('*').eq('pin', pin).eq('teacher_id', teacherId).maybeSingle()
      if (error) throw error; return data ? toStudent(data) : null
    },
  },

  lessons: {
    async getAll(): Promise<Lesson[]> {
      const t = await tid()
      const { data, error } = await supabase.from('lessons').select('*').eq('teacher_id', t).order('created_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toLesson)
    },
    async add(l: Omit<Lesson,'id'|'createdAt'|'teacherId'>): Promise<Lesson> {
      const t = await tid()
      const { data, error } = await supabase.from('lessons')
        .insert({ teacher_id: t, title: l.title, subject: l.subject, content: l.content ?? null, file_url: l.fileUrl ?? null, file_name: l.fileName ?? null, exam_key: l.examKey ?? null, youtube_url: l.youtubeUrl ?? null, page_images: l.pageImages ?? null, assigned_to: l.assignedTo, is_active: l.isActive })
        .select().single()
      if (error) throw error; return toLesson(data)
    },
    async update(l: Lesson): Promise<void> {
      const { error } = await supabase.from('lessons')
        .update({ title: l.title, subject: l.subject, content: l.content ?? null, file_url: l.fileUrl ?? null, file_name: l.fileName ?? null, exam_key: l.examKey ?? null, youtube_url: l.youtubeUrl ?? null, page_images: l.pageImages ?? null, assigned_to: l.assignedTo, is_active: l.isActive })
        .eq('id', l.id)
      if (error) throw error
    },
    async delete(id: string) { const { error } = await supabase.from('lessons').delete().eq('id', id); if (error) throw error },
    async forStudent(studentId: string, teacherId: string): Promise<Lesson[]> {
      const { data, error } = await supabase.from('lessons').select('*').eq('is_active', true).eq('teacher_id', teacherId)
      if (error) throw error
      return (data ?? []).map(toLesson).filter(l => l.assignedTo.includes(studentId))
    },
  },

  practices: {
    async getAll(): Promise<Practice[]> {
      const t = await tid()
      const { data, error } = await supabase.from('practices').select('*').eq('teacher_id', t).order('created_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toPractice)
    },
    async add(p: Omit<Practice,'id'|'createdAt'|'teacherId'>): Promise<Practice> {
      const t = await tid()
      const { data, error } = await supabase.from('practices')
        .insert({ teacher_id: t, title: p.title, subject: p.subject, description: p.description, questions: p.questions, assigned_to: p.assignedTo, due_date: p.dueDate || null, is_active: p.isActive, lesson_id: p.lessonId || null })
        .select().single()
      if (error) throw error; return toPractice(data)
    },
    async delete(id: string) { const { error } = await supabase.from('practices').delete().eq('id', id); if (error) throw error },
    async forStudent(studentId: string, teacherId: string): Promise<Practice[]> {
      const { data, error } = await supabase.from('practices').select('*').eq('is_active', true).eq('teacher_id', teacherId)
      if (error) throw error
      return (data ?? []).map(toPractice).filter(p => p.assignedTo.includes(studentId))
    },
  },

  submissions: {
    async getAll(): Promise<Submission[]> {
      const t = await tid()
      const { data, error } = await supabase.from('submissions').select('*').eq('teacher_id', t).order('submitted_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toSub)
    },
    async add(s: Omit<Submission,'id'|'submittedAt'>): Promise<Submission> {
      const { data, error } = await supabase.from('submissions')
        .insert({ teacher_id: s.teacherId, practice_id: s.practiceId, student_id: s.studentId, answers: s.answers, score: s.score ?? null, reviewed: s.reviewed, teacher_note: s.teacherNote ?? null, anti_cheat_flags: s.antiCheatFlags })
        .select().single()
      if (error) throw error; return toSub(data)
    },
    async update(s: Submission) {
      const { error } = await supabase.from('submissions').update({ score: s.score ?? null, reviewed: s.reviewed, teacher_note: s.teacherNote ?? null }).eq('id', s.id)
      if (error) throw error
    },
    async exists(studentId: string, practiceId: string): Promise<boolean> {
      const { data } = await supabase.from('submissions').select('id').eq('student_id', studentId).eq('practice_id', practiceId).maybeSingle()
      return !!data
    },
  },

  storage: {
    async uploadFile(file: File): Promise<{ url: string; name: string }> {
      const ext  = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('materials').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('materials').getPublicUrl(path)
      return { url: data.publicUrl, name: file.name }
    },
  },
}
