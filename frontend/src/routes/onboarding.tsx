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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/90 shadow-xl p-8">
        <h1 className="text-2xl font-bold mb-2">Welcome to Lightwing!</h1>
        <p className="text-slate-600 mb-6">
          Please set your VRChat username to complete your profile.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-slate-700 font-medium">VRChat Username</span>
            <input
              type="text"
              className="border p-2 w-full mt-1 rounded"
              placeholder="e.g. user123"
              value={vrchatUsername}
              onChange={(e) => setVrchatUsername(e.target.value)}
              autoFocus
            />
          </label>
          
          <button
            type="submit"
            className="w-full bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Continue to Events'}
          </button>
        </form>
      </div>
    </div>
  )
}
