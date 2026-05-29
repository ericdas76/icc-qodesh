import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Profil, Role } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  profil: Profil | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasPermission: (module: string, action: string) => boolean
  isAdmin: () => boolean
  isReferent: () => boolean
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [permissions, setPermissions] = useState<{ module: string; action: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfil(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfil(session.user.id)
      else {
        setProfil(null)
        setRole(null)
        setPermissions([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfil = async (userId: string) => {
    try {
      const { data: profilData } = await supabase
        .from('profils')
        .select('*, roles(*)')
        .eq('id', userId)
        .single()

      if (profilData) {
        setProfil(profilData)
        setRole(profilData.roles || null)

        // Fetch permissions for this role
        if (profilData.role_id) {
          const { data: permsData } = await supabase
            .from('roles_permissions')
            .select('permissions(module, action)')
            .eq('role_id', profilData.role_id)

          if (permsData) {
            const perms: { module: string; action: string }[] = []
            for (const rp of permsData as any[]) {
              if (rp.permissions && !Array.isArray(rp.permissions)) {
                perms.push(rp.permissions)
              }
            }
            setPermissions(perms)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profil:', err)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const hasPermission = (module: string, action: string): boolean => {
    if (role?.nom === 'admin') return true
    return permissions.some(p => p.module === module && p.action === action)
  }

  const isAdmin = (): boolean => role?.nom === 'admin'
  const isReferent = (): boolean => role?.nom === 'referent' || role?.nom === 'admin'

  return (
    <AuthContext.Provider value={{
      user, session, profil, role, loading,
      signIn, signOut, hasPermission, isAdmin, isReferent
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
