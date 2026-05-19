import { supabase } from './supabase'
import type { TeacherProfile } from './types'

const toProfile = (r: any): TeacherProfile => ({
  id: r.id, email: r.email, fullName: r.full_name, schoolName: r.school_name ?? '',
  plan: r.plan ?? 'basic', addOns: r.add_ons ?? [],
  primaryColor: r.primary_color ?? '#e85d3f',
  secondaryColor: r.secondary_color ?? '#0d9488',
  logoText: r.logo_text ?? 'TeachNest',
  studentsLimit: r.students_limit ?? 30,
  createdAt: r.created_at,
})

export const auth = {
  async signUp(email: string, password: string, fullName: string, schoolName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    const uid = data.user!.id
    await supabase.from('teachers').insert({
      id: uid, email, full_name: fullName, school_name: schoolName,
    })
    return uid
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.session
  },

  async signOut() { await supabase.auth.signOut() },

  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async getProfile(): Promise<TeacherProfile | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const { data, error } = await supabase.from('teachers').select('*').eq('id', session.user.id).single()
    if (error || !data) return null
    return toProfile(data)
  },

  async updateProfile(patch: Partial<Pick<TeacherProfile, 'primaryColor'|'secondaryColor'|'logoText'|'schoolName'|'fullName'>>) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('teachers').update({
      primary_color: patch.primaryColor,
      secondary_color: patch.secondaryColor,
      logo_text: patch.logoText,
      school_name: patch.schoolName,
      full_name: patch.fullName,
    }).eq('id', session.user.id)
  },

  onAuthChange(cb: (session: any) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => cb(s))
    return () => subscription.unsubscribe()
  },
}
