import { useAuth } from '../hooks/useAuth'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requireAuth } from '../lib/auth-guard'
import { updateMyProfile } from '../lib/public-api'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { session } = useAuth()
  const [vrchatUsername, setVrchatUsername] = useState('')

  const updateMutation = useMutation({
    mutationFn: (username: string) =>
      updateMyProfile(
        session?.user.id ?? '',
        { vrchatUsername: username || null },
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      // Redirect to events after completing onboarding
      window.location.href = '/events'
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(vrchatUsername.trim() || '')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-retro-bg text-retro-text font-sans">
      <div className="w-full max-w-md border-4 border-retro-border-strong bg-retro-surface p-8 pxl-corner-md pxl-shadow">
        <h1 className="text-md font-pixel tracking-wider text-retro-primary mb-3">WELCOME TO LIGHTWING!</h1>
        <p className="font-pixel text-[10px] text-retro-muted mb-6 leading-relaxed">
          Please set your VRChat username to complete your profile.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="font-pixel text-[10px] text-retro-text">VRCHAT USERNAME</span>
            <input
              type="text"
              className="border-2 border-retro-border-strong bg-retro-card p-3 w-full mt-1.5 pxl-corner-sm text-retro-text font-sans focus:border-retro-primary focus:outline-none"
              placeholder="e.g. user123"
              value={vrchatUsername}
              onChange={(e) => setVrchatUsername(e.target.value)}
              autoFocus
              required
            />
          </label>
          
          <button
            type="submit"
            className="font-pixel text-xs tracking-wider bg-retro-green text-white border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover hover:bg-green-700 active:translate-y-0.5 px-4 py-2.5 transition-all cursor-pointer w-full text-center mt-2 disabled:opacity-50"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'SAVING...' : 'CONTINUE TO EVENTS'}
          </button>
        </form>
      </div>
    </div>
  )
}
