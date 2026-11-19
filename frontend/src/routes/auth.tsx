import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  PixelAlert,
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelContainer,
  PixelSpinner,
  PixelStack,
} from '@pxlkit/ui-kit'
import { useAuth } from '../hooks/useAuth'
import { usePageHead } from '../hooks/usePageHead'
import { buildSeoMeta } from '../lib/seo'
import { isMockMode } from '../lib/auth'
import { EventBanner } from '../components/EventBanner'

interface AuthSearch {
  redirect?: string
  error?: string
  error_description?: string
}

export const Route = createFileRoute('/auth')({
  ssr: 'data-only',
  head: () => ({
    meta: buildSeoMeta({
      title: 'Sign In',
      description: 'Sign in to your UmaKeiba account.',
    }),
  }),
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
    error_description: typeof search.error_description === 'string' ? search.error_description : undefined,
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
  usePageHead({
    title: 'Sign In',
    description: 'Sign in to your UmaKeiba account.',
  })

  const { session, loading, startDiscordSignIn } = useAuth()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const redirectPath = sanitizeRedirect(search.redirect)
  const destinationLabel = redirectPath === '/' ? 'HOME' : redirectPath

  // Once authenticated, check if onboarding is needed and redirect accordingly.
  useEffect(() => {
    if (!loading && session) {
      if (!session.user.vrchatUsername || session.user.vrchatUsername.trim() === '') {
        void navigate({ to: '/onboarding' })
        return
      }
      void navigate({ to: redirectPath })
    }
  }, [loading, session, navigate, redirectPath])

  const errorMessage =
    search.error === 'forbidden'
      ? 'Your account is authenticated, but it does not currently have SITE_ADMIN privileges.'
      : search.error === 'oauth' ||
          search.error === 'state_mismatch' ||
          search.error === 'state_security_mismatch'
        ? `Discord authentication failed${search.error_description ? `: ${search.error_description}` : ` (${search.error})`}. This usually happens when the login session expires between steps or is interrupted. Please try signing in again.`
        : search.error
          ? `Authentication error: ${search.error}. Please try signing in again.`
          : null

  return (
    <PixelContainer maxWidth="sm" padding="md" className="py-6 sm:py-12">
      <PixelCard className="bg-retro-surface border-2 border-retro-border-strong overflow-hidden">
        {/* Retro Hero Header */}
        <div className="-mx-4 -mt-4 mb-6 relative h-44 border-b-2 border-retro-border-strong overflow-hidden flex flex-col justify-end">
          <div className="absolute inset-0">
            <EventBanner
              id="umakeiba-auth-header"
              name="UmaKeiba"
              classRestriction="OP"
              tag="OFFICIAL"
              variant="hero"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
          </div>

          <div className="relative z-10 p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <img src="/favicon.png" alt="UmaKeiba" className="w-7 h-7" />
              <PixelBadge tone="purple">UMAKEIBA ACCOUNT</PixelBadge>
            </div>
            <div>
              <h1 className="font-pixel text-xl sm:text-2xl font-bold text-white tracking-wide">
                SIGN IN TO UMAKEIBA
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="font-sans text-xs text-gray-300">Continue to</span>
                <PixelBadge tone="cyan">{destinationLabel}</PixelBadge>
              </div>
            </div>
          </div>
        </div>

        <PixelStack gap={5}>
          {isMockMode() ? (
            <PixelAlert
              tone="gold"
              message="Mock mode is enabled. Sign-in uses local browser state and does not call Encore."
            />
          ) : null}

          {errorMessage ? <PixelAlert tone="red" message={errorMessage} /> : null}

          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <PixelSpinner size="md" />
              <p className="font-pixel text-xs text-retro-muted">CHECKING YOUR SESSION...</p>
            </div>
          ) : null}

          {!loading && session ? (
            <PixelStack gap={4}>
              <div className="p-4 rounded bg-retro-bg border-2 border-retro-border space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-pixel text-sm text-retro-text font-bold">
                    {session.user.vrchatUsername ?? session.user.name}
                  </p>
                  <PixelBadge tone="green">
                    {session.user.siteRole ?? 'USER'} ACTIVE
                  </PixelBadge>
                </div>
                <p className="font-sans text-xs text-retro-muted">{session.user.email}</p>
              </div>

              <PixelButton asChild variant="solid" tone="purple" size="md" className="w-full">
                <Link to={redirectPath}>CONTINUE TO {destinationLabel}</Link>
              </PixelButton>
            </PixelStack>
          ) : null}

          {!loading && !session ? (
            <PixelStack gap={4}>
              <p className="font-sans text-sm text-retro-muted leading-relaxed">
                Authenticate with your Discord account to register for competitive racing events,
                manage teams, and track your seasonal standings.
              </p>

              <PixelButton
                type="button"
                variant="solid"
                tone="purple"
                size="lg"
                onClick={() => {
                  void startDiscordSignIn(redirectPath)
                }}
                className="w-full"
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3a13.6 13.6 0 0 0-.617 1.27 18.27 18.27 0 0 0-5.535 0A13.6 13.6 0 0 0 9.115 3a19.74 19.74 0 0 0-4.432 1.369C1.88 8.59 1.12 12.69 1.5 16.73a19.9 19.9 0 0 0 6.06 3.06c.49-.67.927-1.38 1.304-2.126-.715-.27-1.4-.604-2.047-.996.171-.126.34-.258.502-.394a14.2 14.2 0 0 0 12.122 0c.164.14.333.272.502.394-.648.393-1.333.727-2.048.997.377.745.814 1.455 1.303 2.125a19.84 19.84 0 0 0 6.062-3.06c.44-4.69-.752-8.75-3.183-12.36ZM8.02 14.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.334-.946 2.419-2.157 2.419Z" />
                  </svg>
                  <span>CONTINUE WITH DISCORD</span>
                </span>
              </PixelButton>

              <div className="pt-2 border-t border-retro-border flex justify-center">
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/">← BACK TO HOME</Link>
                </PixelButton>
              </div>
            </PixelStack>
          ) : null}
        </PixelStack>
      </PixelCard>
    </PixelContainer>
  )
}
