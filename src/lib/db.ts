import { supabase } from './supabase'
import type { Student, Lesson, Practice, Submission } from './types'
import {
  validateTitle, validateName, validatePin, validateSubject, validateGrade, validateLevel,
  validateUUID, validateDate, validateContent, validateText,
  validateStorageUrl, sanitizeUrl, validateFile, validateImageFile,
  validateQuestion, ValidationError,
} from './validate'

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
      const firstName = validateName(s.firstName, 'El nombre')
      const lastName  = validateName(s.lastName,  'El apellido')
      const pin       = validatePin(s.pin)
      const grade     = validateGrade(s.grade)
      const level     = validateLevel(s.level)
      const { data, error } = await supabase.from('students')
        .insert({ teacher_id: t, first_name: firstName, last_name: lastName, grade, level, pin })
        .select().single()
      if (error) throw error; return toStudent(data)
    },
    async update(s: Pick<Student,'id'|'firstName'|'lastName'|'grade'|'level'|'pin'>): Promise<void> {
      const t = await tid()
      validateUUID(s.id, 'ID del alumno')
      const firstName = validateName(s.firstName, 'El nombre')
      const lastName  = validateName(s.lastName,  'El apellido')
      const pin       = validatePin(s.pin)
      const grade     = validateGrade(s.grade)
      const level     = validateLevel(s.level)
      const { error } = await supabase.from('students')
        .update({ first_name: firstName, last_name: lastName, grade, level, pin })
        .eq('id', s.id).eq('teacher_id', t)
      if (error) throw error
    },
    async delete(id: string) {
      const t = await tid()
      validateUUID(id, 'ID del alumno')
      const { error } = await supabase.from('students').delete().eq('id', id).eq('teacher_id', t)
      if (error) throw error
    },
    async findByPin(pin: string, teacherId: string): Promise<Student | null> {
      const cleanPin = validatePin(pin)
      const { data, error } = await supabase.from('students').select('*').eq('pin', cleanPin).eq('teacher_id', teacherId).maybeSingle()
      if (error) throw error; return data ? toStudent(data) : null
    },
    async isPinTaken(pin: string, excludeId?: string): Promise<boolean> {
      const t = await tid()
      const cleanPin = validatePin(pin)
      let q = supabase.from('students').select('id').eq('pin', cleanPin).eq('teacher_id', t)
      if (excludeId) q = q.neq('id', excludeId)
      const { data } = await q; return (data?.length ?? 0) > 0
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
      const title   = validateTitle(l.title)
      const subject = validateSubject(l.subject)
      const content = l.content ? validateContent(l.content) : null
      const fileUrl = validateStorageUrl(l.fileUrl) ?? null
      const ytUrl   = l.youtubeUrl ? sanitizeUrl(l.youtubeUrl) ?? null : null
      const { data, error } = await supabase.from('lessons')
        .insert({ teacher_id: t, title, subject, content, file_url: fileUrl, file_name: l.fileName ?? null, exam_key: l.examKey ?? null, youtube_url: ytUrl, page_images: l.pageImages ?? null, assigned_to: l.assignedTo, is_active: l.isActive })
        .select().single()
      if (error) throw error; return toLesson(data)
    },
    async update(l: Lesson): Promise<void> {
      const t = await tid()
      validateUUID(l.id, 'ID de la leccion')
      const title   = validateTitle(l.title)
      const subject = validateSubject(l.subject)
      const content = l.content ? validateContent(l.content) : null
      const fileUrl = validateStorageUrl(l.fileUrl) ?? null
      const ytUrl   = l.youtubeUrl ? sanitizeUrl(l.youtubeUrl) ?? null : null
      const { error } = await supabase.from('lessons')
        .update({ title, subject, content, file_url: fileUrl, file_name: l.fileName ?? null, exam_key: l.examKey ?? null, youtube_url: ytUrl, page_images: l.pageImages ?? null, assigned_to: l.assignedTo, is_active: l.isActive })
        .eq('id', l.id).eq('teacher_id', t)
      if (error) throw error
    },
    async delete(id: string) {
      const t = await tid()
      validateUUID(id, 'ID de la leccion')
      const { error } = await supabase.from('lessons').delete().eq('id', id).eq('teacher_id', t)
      if (error) throw error
    },
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
      const title   = validateTitle(p.title)
      const subject = validateSubject(p.subject)
      const desc    = p.description ? validateText(p.description, 'La descripcion', 1000) : ''
      const dueDate = p.dueDate ? validateDate(p.dueDate) : null
      if (p.questions.length === 0) throw new ValidationError('La practica necesita al menos una pregunta.')
      if (p.questions.length > 100) throw new ValidationError('La practica no puede tener mas de 100 preguntas.')
      p.questions.forEach(q => validateQuestion(q))
      const ins = {
        teacher_id: t, title, subject, description: desc,
        questions: p.questions, assigned_to: p.assignedTo,
        due_date: dueDate, is_active: p.isActive,
        lesson_id: p.lessonId || null,
      }
      const { data, error } = await supabase.from('practices').insert(ins).select().single()
      if (error) throw error; return toPractice(data)
    },
    async update(p: Practice): Promise<void> {
      const t = await tid()
      validateUUID(p.id, 'ID de la practica')
      const title   = validateTitle(p.title)
      const subject = validateSubject(p.subject)
      const desc    = p.description ? validateText(p.description, 'La descripcion', 1000) : ''
      const dueDate = p.dueDate ? validateDate(p.dueDate) : null
      p.questions.forEach(q => validateQuestion(q))
      const upd = {
        title, subject, description: desc,
        questions: p.questions, assigned_to: p.assignedTo,
        due_date: dueDate, is_active: p.isActive,
      }
      const { error } = await supabase.from('practices').update(upd).eq('id', p.id).eq('teacher_id', t)
      if (error) throw error
    },
    async delete(id: string) {
      const t = await tid()
      validateUUID(id, 'ID de la practica')
      const { error } = await supabase.from('practices').delete().eq('id', id).eq('teacher_id', t)
      if (error) throw error
    },
    async forStudent(studentId: string, teacherId: string): Promise<Practice[]> {
      const { data, error } = await supabase.from('practices').select('*').eq('is_active', true).eq('teacher_id', teacherId)
      if (error) throw error
      return (data ?? []).map(toPractice).filter(pr => pr.assignedTo.includes(studentId))
    },
  },

  submissions: {
    async getAll(): Promise<Submission[]> {
      const t = await tid()
      const { data, error } = await supabase.from('submissions').select('*').eq('teacher_id', t).order('submitted_at', { ascending: false })
      if (error) throw error; return (data ?? []).map(toSub)
    },
    async add(s: Omit<Submission,'id'|'submittedAt'>): Promise<Submission> {
      // Usa RPC con SECURITY DEFINER para bypasear RLS (alumnos no tienen Supabase Auth)
      const { data: newId, error } = await supabase.rpc('insert_student_submission', {
        p_teacher_id:       s.teacherId,
        p_practice_id:      s.practiceId,
        p_student_id:       s.studentId,
        p_answers:          s.answers,
        p_score:            s.score ?? null,
        p_anti_cheat_flags: s.antiCheatFlags,
      })
      if (error) throw error
      // Fetch the inserted row for the teacher portal
      const { data, error: e2 } = await supabase
        .from('submissions').select('*').eq('id', newId).single()
      if (e2) {
        // Row inserted but fetch blocked by RLS (normal for anon) — return minimal object
        return { id: newId, teacherId: s.teacherId, practiceId: s.practiceId,
          studentId: s.studentId, answers: s.answers, submittedAt: new Date().toISOString(),
          score: s.score, reviewed: false, antiCheatFlags: s.antiCheatFlags }
      }
      return toSub(data)
    },
    async update(s: Submission) {
      const t = await tid()
      validateUUID(s.id, 'ID de la entrega')
      if (s.score !== undefined) {
        if (!Number.isFinite(s.score) || s.score < 0 || s.score > 10000)
          throw new ValidationError('El puntaje debe ser un numero entre 0 y 10000.')
      }
      const note = s.teacherNote ? validateText(s.teacherNote, 'La nota', 2000) : null
      const upd = { score: s.score ?? null, reviewed: s.reviewed, teacher_note: note }
      const { error } = await supabase.from('submissions').update(upd).eq('id', s.id).eq('teacher_id', t)
      if (error) throw error
    },
    async exists(studentId: string, practiceId: string): Promise<boolean> {
      const { data } = await supabase.from('submissions').select('id').eq('student_id', studentId).eq('practice_id', practiceId).maybeSingle()
      return !!data
    },
  },

  storage: {
    async uploadFile(file: File, imageOnly = false): Promise<{ url: string; name: string }> {
      if (imageOnly) validateImageFile(file)
      else           validateFile(file)
      const ext  = file.name.split('.').pop()!.toLowerCase()
      const path = Date.now() + '-' + crypto.randomUUID() + '.' + ext
      const { error } = await supabase.storage.from('materials').upload(path, file, { upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('materials').getPublicUrl(path)
      return { url: data.publicUrl, name: file.name }
    },
  },
}

export interface QuestionImage {
  id: string; examKey: string; fromQ: number; toQ: number
  imageUrl: string; imageName: string; createdAt: string
}

const toQImage = (r: any): QuestionImage => ({
  id: r.id, examKey: r.exam_key, fromQ: r.from_q, toQ: r.to_q,
  imageUrl: r.image_url, imageName: r.image_name, createdAt: r.created_at,
})

export const qImages = {
  async add(q: Omit<QuestionImage,'id'|'createdAt'>): Promise<QuestionImage> {
    const ins = { exam_key: q.examKey, from_q: q.fromQ, to_q: q.toQ, image_url: q.imageUrl, image_name: q.imageName }
    const { data, error } = await supabase.from('question_images').insert(ins).select().single()
    if (error) throw error; return toQImage(data)
  },
  async forExam(examKey: string): Promise<QuestionImage[]> {
    const { data, error } = await supabase.from('question_images').select('*').eq('exam_key', examKey)
    if (error) throw error; return (data ?? []).map(toQImage)
  },
  findForQuestion(images: QuestionImage[], questionNum: number): QuestionImage | undefined {
    return images.find(img => questionNum >= img.fromQ && questionNum <= img.toQ)
  },
  buildExamKey(input: string): string {
    return input
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\.pdf$/i, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  },
}

export { ValidationError }
