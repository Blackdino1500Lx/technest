import { BookOpen, Users, BarChart2, CheckCircle, Brain, Shield, Palette } from 'lucide-react'

interface Props { onTeacher: () => void; onStudent: () => void }

export default function LandingPage({ onTeacher, onStudent }: Props) {
  return (
    <div className="landing-root">
      <nav className="landing-nav">
        <div className="nav-inner">
          <div className="nav-logo"><BookOpen size={22}/><span>TeachNest</span></div>
          <div className="nav-links">
            <a href="#features">Servicios</a>
            <a href="#about">Acerca</a>
            <button className="btn-outline" onClick={onStudent}>Soy Alumno</button>
            <button className="btn-primary" onClick={onTeacher}>Portal Docente</button>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg-shapes">
          <div className="shape s1"/><div className="shape s2"/><div className="shape s3"/>
        </div>
        <div className="hero-inner">
          <div className="hero-content">
            <span className="hero-badge">Plataforma educativa · Docentes independientes</span>
            <h1>Tu aula digital,<br/>a tu <em>manera.</em></h1>
            <p>Crea prácticas, gestiona alumnos, revisa entregas y da seguimiento al progreso — todo desde un solo lugar, con tu propia marca.</p>
            <div className="hero-ctas">
              <button className="btn-hero-primary" onClick={onTeacher}>Empezar ahora</button>
              <button className="btn-hero-outline" onClick={onStudent}>Acceder como alumno</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-card hc1"><CheckCircle size={15} className="hc-icon"/><span>Práctica entregada ✓</span></div>
            <div className="hero-card hc2"><Brain size={15} className="hc-icon"/><span>Sandbox de matemáticas</span></div>
            <div className="hero-card hc3"><BarChart2 size={15} className="hc-icon"/><span>Progreso del alumno</span></div>
            <div className="ill-circle"/>
            <div className="ill-dots">{Array.from({length:9}).map((_,i)=><div key={i} className="dot"/>)}</div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-inner">
          <div className="section-label">¿Qué ofrecemos?</div>
          <h2>Todo lo que necesitás<br/>en un solo lugar</h2>
          <div className="feat-grid">
            {[
              {icon:<Users size={22}/>, title:'Gestión de alumnos', desc:'Registrá cada estudiante con su grado y nivel. Asignales prácticas específicas según su avance.'},
              {icon:<BookOpen size={22}/>, title:'Prácticas inteligentes', desc:'Crea desde un PDF y las preguntas se extraen automáticamente — opción múltiple y desarrollo.'},
              {icon:<Shield size={22}/>, title:'Anti-copiado', desc:'Las preguntas abiertas detectan pegado masivo de texto para garantizar respuestas propias.'},
              {icon:<BarChart2 size={22}/>, title:'Revisión y calificación', desc:'Revisá cada entrega, asignale puntaje y dejá una nota personalizada para el alumno.'},
              {icon:<Brain size={22}/>, title:'Sandbox de matemáticas', desc:'Los alumnos muestran su desarrollo con texto y dibujo libre en un lienzo integrado.'},
              {icon:<Palette size={22}/>, title:'Tu marca, tus colores', desc:'Personalizá el portal con los colores e identidad de tu institución o escuela.'},
            ].map((f,i)=>(
              <div className="feat-card" key={i}>
                <div className="feat-icon">{f.icon}</div>
                <h3>{f.title}</h3><p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-inner">
          <div className="about-text">
            <div className="section-label">Para docentes independientes</div>
            <h2>Tu plataforma profesional,<br/>lista en minutos.</h2>
            <p>TeachNest es para tutores, profesores particulares e instituciones pequeñas que quieren ofrecer una experiencia digital completa a sus alumnos sin depender de plataformas genéricas.</p>
            <p>Con un solo plan obtenés prácticas ilimitadas, sandbox de dibujo, revisiones con anti-copiado y la opción de personalizar el portal con tu propia imagen.</p>
            <button className="btn-primary" onClick={onTeacher}>Comenzar ahora</button>
          </div>
          <div className="about-stats">
            {[
              {n:'$12', label:'por mes, todo incluido'},
              {n:'30', label:'alumnos en el plan base'},
              {n:'100%', label:'revisión personalizada'},
            ].map((s,i)=>(
              <div className="stat-card" key={i}>
                <span className="stat-n">{s.n}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="nav-logo"><BookOpen size={18}/><span>TeachNest</span></div>
          <span>© 2026 TeachNest <a href="https://edevcr.netlify.app/">powered by E+Dev</a> · Todos los derechos reservados</span>
        </div>
      </footer>
    </div>
  )
}