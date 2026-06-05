import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, TeacherProfile } from '../lib/types'
import StudentPortal from './StudentPortal'
import { validatePin, ValidationError } from '../lib/validate'
import { checkPinAllowed, recordPinFailure, recordPinSuccess, getPinAttemptsLeft } from '../lib/rateLimiter'

interface Props { onBack: () => void }

// Sanitiza el código de aula: sólo alfanumérico + espacios, máx 60 chars
function sanitizeClassCode(v: string): string {
  return v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-\.]/g, '').slice(0, 60).trim()
}

export default function StudentLogin({ onBack }: Props) {
  const [teacherCode, setTeacherCode] = useState('')
  const [pin, setPin]                 = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [student, setStudent]         = useState<Student | null>(null)
  const [teacher, setTeacher]         = useState<TeacherProfile | null>(null)
  // teacherId provisional para el rate limiter (antes de conocer el real, usamos el código)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)

  const login = async () => {
    setError(''); setLoading(true)
    try {
      // 1. Validar PIN antes de tocar la red
      let cleanPin: string
      try {
        cleanPin = validatePin(pin)
      } catch (e: any) {
        setError(e.message); setLoading(false); return
      }

      const cleanCode = sanitizeClassCode(teacherCode)
      if (cleanCode.length < 2) {
        setError('Ingresá el nombre de tu aula.'); setLoading(false); return
      }

      // 2. Verificar rate limit (usamos el código de aula como bucket key)
      try { checkPinAllowed(cleanCode) } catch (e: any) {
        setError(e.message); setLoading(false); return
      }

      // 3. Buscar docente por nombre de aula (exacto o parcial, máx 3 resultados)
      const { data: teachers } = await supabase
        .from('teachers').select('id,email,full_name,school_name,plan,add_ons,primary_color,secondary_color,logo_text,students_limit,created_at')
        .ilike('school_name', `%${cleanCode}%`)
        .limit(3)  // Limitado para evitar enumeración masiva

      let foundStudent: Student | null = null
      let foundTeacher: any = null

      for (const t of teachers ?? []) {
        const { data: s } = await supabase
          .from('students').select('*').eq('pin', cleanPin).eq('teacher_id', t.id).maybeSingle()
        if (s) { foundStudent = { id: s.id, teacherId: s.teacher_id, firstName: s.first_name, lastName: s.last_name, grade: s.grade, level: s.level, pin: s.pin, createdAt: s.created_at }; foundTeacher = t; break }
      }

      if (!foundStudent) {
        // Registrar intento fallido
        recordPinFailure(cleanCode)
        const left = getPinAttemptsLeft(cleanCode)
        setAttemptsLeft(left)
        const attemptsMsg = left !== null && left > 0 ? ` (${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''})` : ''
        setError(`PIN o código de aula incorrecto.${attemptsMsg}`)
        setLoading(false); return
      }

      // Login exitoso — limpiar rate limit
      recordPinSuccess(cleanCode)
      setAttemptsLeft(null)

      const profile: TeacherProfile = {
        id: foundTeacher.id, email: foundTeacher.email, fullName: foundTeacher.full_name,
        schoolName: foundTeacher.school_name, plan: foundTeacher.plan,
        addOns: foundTeacher.add_ons ?? [], primaryColor: foundTeacher.primary_color,
        secondaryColor: foundTeacher.secondary_color, logoText: foundTeacher.logo_text,
        studentsLimit: foundTeacher.students_limit, createdAt: foundTeacher.created_at,
      }
      setStudent(foundStudent); setTeacher(profile)

    } catch (e: any) {
      if (e instanceof ValidationError) setError(e.message)
      else setError('Error de conexión. Intentá de nuevo.')
    } finally { setLoading(false) }
  }

  if (student && teacher) return (
    <StudentPortal student={student} teacher={teacher} onLogout={() => { setStudent(null); setTeacher(null) }}/>
  )

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <button className="auth-back" onClick={onBack}>← Volver</button>
        <div className="auth-logo">TeachNest</div>
        <h2>Acceso de alumno</h2>
        <label>Código de aula</label>
        <input
          value={teacherCode}
          onChange={e => setTeacherCode(e.target.value)}
          placeholder="Ej: Academia XYZ"
          maxLength={60}
          autoComplete="off"
        />
        <p style={{fontSize:'.75rem',color:'var(--muted)',margin:'-.25rem 0 .25rem'}}>
          Preguntale a tu docente el nombre del aula
        </p>
        <label>Tu PIN</label>
        <input
          type="password"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}  // Solo dígitos
          placeholder="••••"
          autoComplete="current-password"
          onKeyDown={e => e.key === 'Enter' && login()}
        />
        {attemptsLeft !== null && attemptsLeft <= 2 && attemptsLeft > 0 && (
          <p style={{fontSize:'.78rem',color:'#f59e0b',margin:'-.1rem 0 .25rem'}}>
            ⚠️ Quedan {attemptsLeft} intento{attemptsLeft !== 1 ? 's' : ''} antes del bloqueo.
          </p>
        )}
        {error && <div className="auth-error">{error}</div>}
        <button className="btn-primary full" onClick={login} disabled={loading}>
          {loading ? 'Buscando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
