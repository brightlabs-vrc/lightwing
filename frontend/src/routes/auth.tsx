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
  const destinationLabel = redirectPath === '/' ? 'home' : redirectPath

  // Once authenticated, check if onboarding is needed and redirect accordingly.
  useEffect(() => {
    if (!loading && session) {
      // Check if vrchatUsername is null/empty - if so, redirect to onboarding
      if (!session.user.vrchatUsername || session.user.vrchatUsername.trim() === '') {
        void navigate({ to: '/onboarding' })
        return
      }
      void navigate({ to: redirectPath })
    }
  }, [loading, session, navigate, redirectPath])

  return (
    <div className='flex min-h-screen items-center justify-center px-4 py-10'>
      <div className='w-full max-w-lg overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur'>
        <div className='flex flex-col gap-5 border-b border-slate-200/80 bg-[linear-gradient(135deg,_#0f172a_0%,_#1e3a8a_100%)] px-8 py-10 text-white'>
          <h1 className='text-5xl font-extrabold tracking-tight leading-none drop-shadow-sm sm:text-[3.4rem]'>Sign in to Lightwing</h1>
          <p className='flex flex-wrap items-center gap-2 text-sm leading-6 text-sky-50/90'>
            <span>Continue to</span>
            <span className='inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white'>
              {destinationLabel}
            </span>
          </p>
        </div>

        <div className='space-y-8 px-8 py-10'>
          {isMockMode() ? (
            <p className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900'>
              Mock mode is enabled. Sign-in uses local browser state and does not call Encore.
            </p>
          ) : null}

          {search.error === 'forbidden' ? (
            <p className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900'>
              Your account is authenticated, but it does not currently have SITE_ADMIN privileges.
            </p>
          ) : null}

          {loading ? (
            <div className='space-y-4 text-center'>
              <div className='mx-auto h-10 w-10 animate-pulse rounded-full bg-slate-200' />
              <p className='text-sm text-slate-500'>Checking your session...</p>
            </div>
          ) : null}

          {!loading && session ? (
            <div className='space-y-7'>
              <div className='space-y-1.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-5 text-sm text-slate-700'>
                <p className='font-medium text-slate-900'>{session.user.name}</p>
                <p className='text-slate-600'>{session.user.email}</p>
                <p className='mt-3 text-xs uppercase tracking-[0.2em] text-emerald-700'>
                  {session.user.siteRole ?? 'USER'} session active
                </p>
              </div>
              <Link
                to={redirectPath}
                className='block rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800'
              >
                Continue to {destinationLabel}
              </Link>
            </div>
          ) : null}

          {!loading && !session ? (
            <div className='space-y-7 pt-3'>
              <button
                type='button'
                onClick={() => {
                  void startDiscordSignIn(redirectPath)
                }}
                className='flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50'
              >
                <svg viewBox='0 0 24 24' className='h-5 w-5' fill='currentColor' aria-hidden='true'>
                  <path d='M20.317 4.369A19.79 19.79 0 0 0 15.885 3a13.6 13.6 0 0 0-.617 1.27 18.27 18.27 0 0 0-5.535 0A13.6 13.6 0 0 0 9.115 3a19.74 19.74 0 0 0-4.432 1.369C1.88 8.59 1.12 12.69 1.5 16.73a19.9 19.9 0 0 0 6.06 3.06c.49-.67.927-1.38 1.304-2.126-.715-.27-1.4-.604-2.047-.996.171-.126.34-.258.502-.394a14.2 14.2 0 0 0 12.122 0c.164.14.333.272.502.394-.648.393-1.333.727-2.048.997.377.745.814 1.455 1.303 2.125a19.84 19.84 0 0 0 6.062-3.06c.44-4.69-.752-8.75-3.183-12.36ZM8.02 14.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.334-.946 2.419-2.157 2.419Z' />
                </svg>
                Continue with Discord
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
