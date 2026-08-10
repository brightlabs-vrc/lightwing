import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isMockMode } from '../lib/auth'
import { Heading, Text, Label, Button, Spinner } from '@primer/react'
import { AlertBanner } from '../components/AlertBanner'

interface AuthSearch {
  redirect?: string
  error?: string
  error_description?: string
}

export const Route = createFileRoute('/auth')({
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
  const { session, loading, startDiscordSignIn } = useAuth()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const redirectPath = sanitizeRedirect(search.redirect)
  const destinationLabel = redirectPath === '/' ? 'home' : redirectPath

  useEffect(() => {
    if (!loading && session) {
      if (!session.user.vrchatUsername || session.user.vrchatUsername.trim() === '') {
        void navigate({ to: '/onboarding' })
        return
      }
      void navigate({ to: redirectPath })
    }
  }, [loading, session, navigate, redirectPath])

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: 'var(--color-canvas-default)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '16px',
        boxShadow: 'var(--color-shadow-large)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Expression/Brand Header */}
        <div style={{
          padding: '2.5rem 2rem',
          color: '#ffffff',
          backgroundImage: 'linear-gradient(135deg, #0969da 0%, #05264c 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <Heading as="h1" style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
            Sign in to Lightwing
          </Heading>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: '#c9d1d9' }}>Continue to</span>
            <Label variant="accent" style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
              {destinationLabel}
            </Label>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {isMockMode() ? (
            <div style={{
              backgroundColor: 'var(--color-attention-subtle)',
              border: '1px solid var(--color-attention-border)',
              padding: '1rem',
              borderRadius: '8px',
              color: 'var(--color-attention-fg)',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Mock mode is enabled. Sign-in uses local browser state and does not call Encore.
            </div>
          ) : null}

          {search.error === 'oauth' || search.error === 'state_mismatch' || search.error === 'state_security_mismatch' ? (
            <AlertBanner variant="error">
              Discord authentication failed{search.error_description ? `: ${search.error_description}` : ''}.
              {!search.error_description ? ` (${search.error})` : ''} This usually happens when the login
              session expires between steps or is interrupted. Please try signing in again.
            </AlertBanner>
          ) : search.error === 'forbidden' ? (
            <AlertBanner variant="error">
              Your account is authenticated, but it does not currently have SITE_ADMIN privileges.
            </AlertBanner>
          ) : search.error ? (
            <AlertBanner variant="error">
              Authentication error: {search.error}. Please try signing in again.
            </AlertBanner>
          ) : null}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
              <Spinner size="medium" />
              <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>Checking your session...</span>
            </div>
          ) : null}

          {!loading && session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                backgroundColor: 'var(--color-success-subtle)',
                border: '1px solid var(--color-success-border)',
                padding: '1.25rem',
                borderRadius: '8px',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <span style={{ fontWeight: 'bold', color: 'var(--color-success-fg)' }}>{session.user.vrchatUsername ?? session.user.name}</span>
                <span style={{ color: 'var(--color-fg-muted)' }}>{session.user.email}</span>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.5rem', color: 'var(--color-fg-muted)' }}>
                  {session.user.siteRole ?? 'USER'} session active
                </span>
              </div>
              <Button as={Link} to={redirectPath} variant="primary" style={{ width: '100%', padding: '12px' }}>
                Continue to {destinationLabel}
              </Button>
            </div>
          ) : null}

          {!loading && !session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Button
                onClick={() => {
                  void startDiscordSignIn(redirectPath)
                }}
                style={{
                  backgroundColor: '#5865F2',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <svg viewBox="0 0 24 24" style={{ height: '20px', width: '20px' }} fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3a13.6 13.6 0 0 0-.617 1.27 18.27 18.27 0 0 0-5.535 0A13.6 13.6 0 0 0 9.115 3a19.74 19.74 0 0 0-4.432 1.369C1.88 8.59 1.12 12.69 1.5 16.73a19.9 19.9 0 0 0 6.06 3.06c.49-.67.927-1.38 1.304-2.126-.715-.27-1.4-.604-2.047-.996.171-.126.34-.258.502-.394a14.2 14.2 0 0 0 12.122 0c.164.14.333.272.502.394-.648.393-1.333.727-2.048.997.377.745.814 1.455 1.303 2.125a19.84 19.84 0 0 0 6.062-3.06c.44-4.69-.752-8.75-3.183-12.36ZM8.02 14.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.334-.946 2.419-2.157 2.419Z" />
                </svg>
                Continue with Discord
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
