interface Props { onTeacher: () => void; onStudent: () => void }

export default function LandingPage({ onTeacher, onStudent }: Props) {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="brand-logo">TeachNest</span>
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={onStudent}>Soy Alumno</button>
          <button className="btn-primary" onClick={onTeacher}>Portal Docente</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Plataforma educativa · Docentes independientes</span>
          <h1>Tu aula digital,<br/><em>a tu manera.</em></h1>
          <p className="hero-sub">
            Crea prácticas, gestiona alumnos, revisa entregas y hace seguimiento
            del progreso — todo desde un solo lugar.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary lg" onClick={onTeacher}>Empezar ahora</button>
            <button className="btn-outline lg" onClick={onStudent}>Acceder como alumno</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <span className="hero-card-icon">✓</span>
            <span>Práctica entregada</span>
          </div>
          <div className="hero-card secondary">
            <span className="hero-card-icon">↑</span>
            <span>Progreso del alumno</span>
          </div>
          <div className="hero-card accent">
            <span className="hero-card-icon">🎨</span>
            <span>Sandbox de matemáticas</span>
          </div>
        </div>
      </section>

      <section className="features">
        {[
          { icon: '📋', title: 'Prácticas inteligentes', desc: 'Crea desde un PDF y las preguntas se extraen automáticamente.' },
          { icon: '🎨', title: 'Sandbox de dibujo', desc: 'Los alumnos muestran su desarrollo matemático con texto y dibujo libre.' },
          { icon: '🔒', title: 'Anti-copiado', desc: 'Bloqueamos el pegado de texto en preguntas de desarrollo.' },
          { icon: '📊', title: 'Revisiones rápidas', desc: 'Ve respuestas, dibujos y puntaje en una sola vista.' },
          { icon: '🎨', title: 'Tu marca, tus colores', desc: 'Personaliza el portal con los colores e identidad de tu institución.' },
          { icon: '👥', title: 'Multi-alumno', desc: 'Gestiona hasta 30 alumnos en el plan base.' },
        ].map(f => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="pricing">
        <h2>Un solo plan, sin sorpresas</h2>
        <div className="pricing-card">
          <div className="pricing-header">
            <span className="pricing-name">Plan Base</span>
            <div className="pricing-price"><span>$12</span><span>/mes</span></div>
          </div>
          <ul className="pricing-features">
            {['Hasta 30 alumnos','Prácticas y lecciones ilimitadas','Sandbox de matemáticas','Revisiones con anti-copiado','Soporte por email'].map(f =>
              <li key={f}><span>✓</span>{f}</li>
            )}
          </ul>
          <div className="pricing-addons">
            <p>+ Mejoras opcionales:</p>
            <span className="addon-chip">🎨 Branding propio +$5/mes</span>
            <span className="addon-chip">👥 +10 alumnos +$3/mes</span>
            <span className="addon-chip">📄 Reportes PDF +$4/mes</span>
          </div>
          <button className="btn-primary full" onClick={onTeacher}>Comenzar →</button>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2025 TeachNest by E+Dev</span>
      </footer>
    </div>
  )
}
