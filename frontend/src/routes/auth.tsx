import { createFileRoute, Link } from '@tanstack/react-router'
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
  const redirectPath = sanitizeRedirect(search.redirect)

  return (
    <section className='mx-auto grid max-w-3xl gap-4'>
      <h1 className='text-3xl font-bold tracking-tight text-slate-900'>Authentication</h1>
      <p className='text-sm text-slate-600'>
        Public pages and the admin panel share one login system. Sign in here with Discord,
        then continue to your destination.
      </p>
      {isMockMode() ? (
        <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800'>
          Mock mode is enabled. Sign-in uses local browser state and does not call Encore.
        </p>
      ) : null}

      {search.error === 'forbidden' ? (
        <p className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
          Your account is authenticated but does not currently have SITE_ADMIN privileges.
        </p>
      ) : null}

      {loading ? <p className='text-sm text-slate-500'>Loading session...</p> : null}

      {!loading && session ? (
        <div className='grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
          <p className='text-sm text-slate-700'>
            Signed in as <strong>{session.user.name}</strong> ({session.user.email})
          </p>
          <p className='text-sm text-slate-700'>Site role: <strong>{session.user.siteRole ?? 'USER'}</strong></p>
          <Link to={redirectPath} className='text-sm font-semibold text-sky-700 hover:text-sky-800'>Continue</Link>
        </div>
      ) : null}

      {!loading && !session ? (
        <div className='grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
          <p className='text-sm text-slate-700'>Only Discord OIDC is enabled for sign-in.</p>
          <button
            type='button'
            onClick={() => {
              void startDiscordSignIn(redirectPath)
            }}
            className='w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'
          >
            Continue with Discord
          </button>
        </div>
      ) : null}
    </section>
  )
}
