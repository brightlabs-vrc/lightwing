'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button, Heading, Text, Spinner } from '@primer/react'
import { AlertBanner } from '@/components'

function AuthContent() {
  const { session, loading, signOutUser, startDiscordSignIn } = useAuth()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/events'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const [localLoading, setLocalLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // If already authenticated, redirect away
    if (session && mounted) {
      window.location.href = redirect
    }
    setLocalLoading(false)
  }, [session, redirect, mounted])

  if (!mounted) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spinner size="large" />
      </div>
    )
  }

  if (session) {
    return null // Redirecting...
  }

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '4rem auto',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <Heading as="h1" style={{ marginBottom: '1rem' }}>
        Sign In
      </Heading>
      <Text
        color="fg.muted"
        style={{ marginBottom: '2rem', lineHeight: 1.6 }}
      >
        Sign in with Discord to access Lightwing.
      </Text>

      {error && (
        <AlertBanner variant="error" style={{ marginBottom: '1.5rem' }}>
          {error === 'forbidden' ? (
            <Text>Access denied.</Text>
          ) : (
            <div>
              <Text style={{ fontWeight: 600 }}>Authentication failed.</Text>
              {(errorDescription || error) && (
                <Text
                  as="p"
                  color="fg.muted"
                  style={{ marginTop: '0.25rem', fontSize: '13px' }}
                >
                  {errorDescription || error}
                </Text>
              )}
            </div>
          )}
        </AlertBanner>
      )}

      <Button
        variant="primary"
        size="large"
        onClick={() => {
          void startDiscordSignIn(redirect)
        }}
        style={{ width: '100%' }}
      >
        Sign in with Discord
      </Button>

      <Text
        as="p"
        color="fg.muted"
        style={{ marginTop: '1.5rem', fontSize: '13px' }}
      >
        By signing in, you agree to the URS Competitive Portal terms of service.
      </Text>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spinner size="large" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
