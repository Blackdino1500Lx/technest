import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, TeacherProfile } from '../lib/types'
import StudentPortal from './StudentPortal'

interface Props { onBack: () => void }

export default function StudentLogin({ onBack }: Props) {
  const [teacherCode, setTeacherCode] = useState('')
  const [pin, setPin]                 = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [student, setStudent]         = useState<Student | null>(null)
  const [teacher, setTeacher]         = useState<TeacherProfile | null>(null)

  const login = async () => {
    setError(''); setLoading(true)
    try {
      // Teacher code = first 8 chars of teacher UUID or school slug
      // For now: find teacher by school_name slug or direct ID search
      // Simple approach: student enters PIN, we search all students for that PIN+teacherCode
      const { data: teachers } = await supabase
        .from('teachers').select('*')
        .ilike('school_name', `%${teacherCode.trim()}%`)
        .limit(5)

      let foundStudent: Student | null = null
      let foundTeacher: any = null

      for (const t of teachers ?? []) {
        const { data: s } = await supabase
          .from('students').select('*').eq('pin', pin.trim()).eq('teacher_id', t.id).maybeSingle()
        if (s) { foundStudent = { id: s.id, teacherId: s.teacher_id, firstName: s.first_name, lastName: s.last_name, grade: s.grade, level: s.level, pin: s.pin, createdAt: s.created_at }; foundTeacher = t; break }
      }

      if (!foundStudent) { setError('PIN o código de aula incorrecto'); setLoading(false); return }

      const profile: TeacherProfile = {
        id: foundTeacher.id, email: foundTeacher.email, fullName: foundTeacher.full_name,
        schoolName: foundTeacher.school_name, plan: foundTeacher.plan,
        addOns: foundTeacher.add_ons ?? [], primaryColor: foundTeacher.primary_color,
        secondaryColor: foundTeacher.secondary_color, logoText: foundTeacher.logo_text,
        studentsLimit: foundTeacher.students_limit, createdAt: foundTeacher.created_at,
      }
      setStudent(foundStudent); setTeacher(profile)
    } catch (e: any) { setError(e.message ?? 'Error') }
    finally { setLoading(false) }
  }

  if (student && teacher) return <StudentPortal student={student} teacher={teacher} onLogout={() => { setStudent(null); setTeacher(null) }}/>

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <button className="auth-back" onClick={onBack}>← Volver</button>
        <div className="auth-logo">TeachNest</div>
        <h2>Acceso de alumno</h2>
        <label>Código de aula</label>
        <input value={teacherCode} onChange={e => setTeacherCode(e.target.value)} placeholder="Nombre de tu institución"/>
        <label>Tu PIN</label>
        <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••"/>
        {error && <div className="auth-error">{error}</div>}
        <button className="btn-primary full" onClick={login} disabled={loading}>
          {loading ? 'Buscando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
