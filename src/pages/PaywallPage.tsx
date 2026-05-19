import { BookOpen } from 'lucide-react'
import { auth } from '../lib/auth'

interface Props { onSignOut: () => void }

export default function PaywallPage({ onSignOut }: Props) {
  const handleSignOut = () => { auth.signOut(); onSignOut() }

  return (
    <div className="paywall-root">
      <div className="paywall-logo"><BookOpen size={20} style={{verticalAlign:'middle', marginRight:6}}/>TeachNest</div>
      <div className="paywall-card">
        <h2>Activá tu cuenta</h2>
        <p>Para comenzar a usar TeachNest necesitás activar tu plan mensual.</p>

        <div className="paywall-price">
          <span className="amount">$12</span>
          <span className="period">por mes<br/><strong style={{color:'var(--teal)'}}>todo incluido</strong></span>
        </div>

        <ul className="paywall-features">
          {[
            'Hasta 30 alumnos activos',
            'Prácticas ilimitadas con opción múltiple y desarrollo',
            'Anti-copiado en preguntas abiertas',
            'Sandbox de matemáticas con dibujo libre',
            'Revisión y calificación de entregas',
            'Lecciones con video y contenido adjunto',
            'Acceso por PIN para alumnos (sin registro)',
          ].map((f, i) => (
            <li key={i}><span className="check">✓</span>{f}</li>
          ))}
        </ul>

        <button
          className="paywall-cta"
          onClick={() => window.open('mailto:edevcr25@gmail.com?subject=Activar%20TeachNest&body=Hola%2C%20quiero%20activar%20mi%20cuenta%20TeachNest.', '_blank')}
        >
          Contactar para activar →
        </button>
        <p className="paywall-note">Te enviamos los datos de pago por correo y activamos tu cuenta en minutos.</p>
      </div>
      <button className="paywall-signout" onClick={handleSignOut}>← Cerrar sesión</button>
    </div>
  )
}