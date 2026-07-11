import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isMockMode } from '../lib/auth'

interface AuthSearch {
  redirect?: string
  error?: string
}

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: AuthPage,
})

function sanitizeRedirect(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/')) {
    return '/'
  }
  return raw
}

function AuthPage() {
  const { session, loading, startDiscordSignIn } = useAuth()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const redirectPath = sanitizeRedirect(search.redirect)

  // Once authenticated, return the user to where they were. This is what makes
  // the /auth route the single funnel for both admin and public sign-ins.
  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: redirectPath })
    }
  }, [loading, session, navigate, redirectPath])

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4'>
      <div className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm'>
        <div className='mb-6 text-center'>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900'>Sign in to Lightwing</h1>
          <p className='mt-1 text-sm text-slate-600'>
            Public pages and the admin panel share one login. Sign in with Discord, then
            continue to your destination.
          </p>
        </div>

        {isMockMode() ? (
          <p className='mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800'>
            Mock mode is enabled. Sign-in uses local browser state and does not call Encore.
          </p>
        ) : null}

        {search.error === 'forbidden' ? (
          <p className='mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            Your account is authenticated but does not currently have SITE_ADMIN privileges.
          </p>
        ) : null}

        {loading ? (
          <p className='text-center text-sm text-slate-500'>Loading session...</p>
        ) : null}

        {!loading && session ? (
          <div className='grid gap-4 text-center'>
            <div className='text-sm text-slate-700'>
              Signed in as <strong>{session.user.name}</strong> ({session.user.email})
              <span className='mt-1 block text-xs text-slate-500'>
                Site role: {session.user.siteRole ?? 'USER'}
              </span>
            </div>
            <Link
              to={redirectPath}
              className='inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'
            >
              Continue
            </Link>
          </div>
        ) : null}

        {!loading && !session ? (
          <div className='grid gap-4 text-center'>
            <p className='text-sm text-slate-700'>Only Discord OIDC is enabled for sign-in.</p>
            <button
              type='button'
              onClick={() => {
                void startDiscordSignIn(redirectPath)
              }}
              className='w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'
            >
              Continue with Discord
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
