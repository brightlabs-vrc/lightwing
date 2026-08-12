import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-guard'
import { OnboardingFormClient } from './OnboardingFormClient'

export default async function OnboardingPage() {
  const session = await requireAuth({ pathname: '/onboarding' })

  // If user already has VRChat username, redirect to events
  if (session.user.vrchatUsername) {
    redirect('/events')
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '480px', width: '100%', backgroundColor: 'var(--color-canvas-default)', border: '1px solid var(--color-border-default)', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--color-shadow-large)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', color: 'var(--color-accent-fg)', margin: 0 }}>Welcome to Lightwing!</h1>
          <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>Please set your VRChat username to complete your profile.</span>
        </div>
        <OnboardingFormClient userId={session.user.id} />
        <p style={{ fontSize: '12px', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
          Already have an account?{' '}
          <a href="/auth" style={{ color: 'var(--color-accent-fg)' }}>Sign in</a>
        </p>
      </div>
    </div>
  )
}
