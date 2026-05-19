import { useEffect, useState } from 'react'
import { auth } from './lib/auth'
import { applyTheme } from './lib/theme'
import type { TeacherProfile } from './lib/types'
import LandingPage   from './pages/LandingPage'
import AuthPage      from './pages/AuthPage'
import TeacherPortal from './pages/TeacherPortal'
import StudentLogin  from './pages/StudentLogin'

type View = 'landing' | 'auth' | 'portal' | 'student'

export default function App() {
  const [view,    setView]    = useState<View>('landing')
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.getSession().then(async s => {
      if (s) {
        const p = await auth.getProfile()
        setProfile(p)
        applyTheme(p?.primaryColor ?? '#e85d3f', p?.secondaryColor ?? '#0d9488', p?.addOns.includes('branding') ?? false)
        setView('portal')
      }
      setLoading(false)
    })
    return auth.onAuthChange(async s => {
      if (s) {
        const p = await auth.getProfile()
        setProfile(p)
        applyTheme(p?.primaryColor ?? '#e85d3f', p?.secondaryColor ?? '#0d9488', p?.addOns.includes('branding') ?? false)
        setView('portal')
      } else {
        setProfile(null)
        setView('landing')
      }
    })
  }, [])

  if (loading) return <div className="app-loading"><div className="spinner"/></div>

  if (view === 'student') return <StudentLogin onBack={() => setView('landing')}/>
  if (view === 'auth')    return <AuthPage onBack={() => setView('landing')} onSuccess={() => {}}/>
  if (view === 'portal' && profile) return (
    <TeacherPortal
      profile={profile}
      onProfileUpdate={p => { setProfile(p); applyTheme(p.primaryColor, p.secondaryColor, p.addOns.includes('branding')) }}
      onSignOut={() => { auth.signOut(); setView('landing') }}
    />
  )

  return <LandingPage onTeacher={() => setView('auth')} onStudent={() => setView('student')}/>
}
