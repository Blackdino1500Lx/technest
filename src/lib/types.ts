export type Subject = 'Matemáticas' | 'Español' | 'Ciencias' | 'Estudios Sociales' | 'Inglés'
export type Grade   = '7° Grado' | '8° Grado' | '9° Grado' | '10° Grado' | '11° Grado' | 'Universitario' | 'Adulto'
export type Level   = 'Básico' | 'Intermedio' | 'Avanzado'
export type Plan    = 'basic'

export interface TeacherProfile {
  id: string
  email: string
  fullName: string
  schoolName: string
  plan: Plan
  addOns: string[]          // e.g. ['branding','extra_students','reports']
  primaryColor: string      // default coral, unlocked with 'branding' add-on
  secondaryColor: string
  logoText: string
  studentsLimit: number
  createdAt: string
}

export interface Student {
  id: string; teacherId: string
  firstName: string; lastName: string
  grade: Grade; level: Level; pin: string; createdAt: string
}

export interface Question {
  id: string; text: string; type: 'open' | 'multiple'
  options?: string[]; correctOption?: number; points: number
  imageUrl?: string; hasSandbox?: boolean
}

export interface Lesson {
  id: string; teacherId: string; title: string; subject: Subject
  content?: string; fileUrl?: string; fileName?: string; examKey?: string
  youtubeUrl?: string; pageImages?: string[]
  assignedTo: string[]; isActive: boolean; createdAt: string
}

export interface Practice {
  id: string; teacherId: string; title: string; subject: Subject
  description: string; questions: Question[]; assignedTo: string[]
  dueDate?: string; createdAt: string; isActive: boolean; lessonId?: string
}

export interface Answer {
  questionId: string; value: string | number; canvasImage?: string
}

export interface Submission {
  id: string; teacherId: string; practiceId: string; studentId: string
  answers: Answer[]; submittedAt: string; score?: number
  reviewed: boolean; teacherNote?: string; antiCheatFlags: string[]
}
