import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { router } from '../router'
import { getAuthSession, signInWithDiscord, signOut, type AuthSession } from '../lib/auth'

interface AuthContextValue {
  session: AuthSession | null
  loading: boolean
  refreshSession: () => Promise<void>
  startDiscordSignIn: (redirectPath?: string) => Promise<void>
  signOutUser: (redirectTo?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    setLoading(true)
    try {
      const nextSession = await getAuthSession()
      setSession(nextSession)
    } finally {
      setLoading(false)
    }
  }, [])

  const startDiscordSignIn = useCallback(async (redirectPath?: string) => {
    await signInWithDiscord(redirectPath)
  }, [])

  const signOutUser = useCallback(
    async (redirectTo: string = '/auth') => {
      await signOut()
      setSession(null)
      // Navigate via the router instance directly. AuthProvider sits above
      // RouterProvider, so useNavigate() here is outside the router context
      // and would be a no-op.
      await router.navigate({ to: redirectTo })
    },
    [],
  )

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      refreshSession,
      startDiscordSignIn,
      signOutUser,
    }),
    [session, loading, refreshSession, startDiscordSignIn, signOutUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
