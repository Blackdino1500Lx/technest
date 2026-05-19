import { useState } from 'react'
import { auth } from '../lib/auth'

interface Props { onBack: () => void; onSuccess: () => void }

export default function AuthPage({ onBack }: Props) {
  const [mode, setMode]           = useState<'login'|'register'>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [fullName, setFullName]   = useState('')
  const [school, setSchool]       = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'register') {
        if (!fullName.trim()) { setError('Ingresa tu nombre completo'); setLoading(false); return }
        await auth.signUp(email, password, fullName, school)
      } else {
        await auth.signIn(email, password)
      }
    } catch (e: any) {
      setError(e.message ?? 'Error de autenticación')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <button className="auth-back" onClick={onBack}>← Volver</button>
        <div className="auth-logo">TeachNest</div>
        <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>

        {mode === 'register' && (
          <>
            <label>Nombre completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre"/>
            <label>Institución / Escuela (opcional)</label>
            <input value={school} onChange={e => setSchool(e.target.value)} placeholder="Ej: Academia XYZ"/>
          </>
        )}

        <label>Correo electrónico</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com"/>
        <label>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary full" onClick={submit} disabled={loading}>
          {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <p className="auth-switch">
          {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? ' Registrate' : ' Iniciá sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
