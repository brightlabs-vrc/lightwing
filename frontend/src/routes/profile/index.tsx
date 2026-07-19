import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireAuth } from '../../lib/auth-guard'
import { getMyProfile, updateMyProfile } from '../../lib/public-api'

export const Route = createFileRoute('/profile/')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { session } = useAuth()
  const [biography, setBiography] = useState('')
  const [careerOverview, setCareerOverview] = useState('')
  const [vrchatUsername, setVrchatUsername] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile', session?.user.id],
    queryFn: () => getMyProfile(session?.user.id ?? ''),
    enabled: !!session,
  })

  // Initialize form values when profile loads
  useEffect(() => {
    if (profile) {
      setBiography(profile.biography ?? '')
      setCareerOverview(profile.careerOverview ?? '')
      setVrchatUsername(profile.vrchatUsername ?? '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: { biography: string; careerOverview: string; vrchatUsername: string }) =>
      updateMyProfile(
        session?.user.id ?? '',
        {
          biography: data.biography || null,
          careerOverview: data.careerOverview || null,
          vrchatUsername: data.vrchatUsername || null,
        },
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      alert('Profile updated successfully!')
    },
  })

  if (isLoading) return <div className="p-6 font-pixel text-xs text-retro-muted animate-pulse">LOADING PROFILE...</div>

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-pixel tracking-wider text-retro-primary mb-6 text-center">EDIT PROFILE</h1>

      <div className="border-4 border-retro-border-strong bg-retro-surface p-6 pxl-corner-md pxl-shadow space-y-5">
        <label className="block">
          <span className="font-pixel text-[10px] text-retro-muted">NAME</span>
          <input
            type="text"
            className="border-2 border-retro-border bg-retro-card p-3 w-full mt-1.5 pxl-corner-sm text-retro-muted font-sans cursor-not-allowed opacity-75"
            value={profile?.name ?? ''}
            disabled
          />
        </label>

        <label className="block">
          <span className="font-pixel text-[10px] text-retro-text">BIOGRAPHY</span>
          <textarea
            className="border-2 border-retro-border-strong bg-retro-card p-3 w-full mt-1.5 pxl-corner-sm text-retro-text font-sans focus:border-retro-primary focus:outline-none"
            rows={3}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            placeholder="Tell us about yourself..."
          />
        </label>

        <label className="block">
          <span className="font-pixel text-[10px] text-retro-text">CAREER OVERVIEW</span>
          <textarea
            className="border-2 border-retro-border-strong bg-retro-card p-3 w-full mt-1.5 pxl-corner-sm text-retro-text font-sans focus:border-retro-primary focus:outline-none"
            rows={3}
            value={careerOverview}
            onChange={(e) => setCareerOverview(e.target.value)}
            placeholder="Summarize your competitive career..."
          />
        </label>

        <label className="block">
          <span className="font-pixel text-[10px] text-retro-text">VRCHAT USERNAME</span>
          <input
            type="text"
            className="border-2 border-retro-border-strong bg-retro-card p-3 w-full mt-1.5 pxl-corner-sm text-retro-text font-sans focus:border-retro-primary focus:outline-none"
            placeholder="e.g. user123"
            value={vrchatUsername}
            onChange={(e) => setVrchatUsername(e.target.value)}
          />
        </label>

        <button
          className="font-pixel text-xs tracking-wider bg-retro-primary text-white border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover hover:bg-indigo-700 active:translate-y-0.5 px-4 py-2.5 transition-all cursor-pointer w-full text-center mt-2 disabled:opacity-50"
          onClick={() =>
            updateMutation.mutate({ biography, careerOverview, vrchatUsername })
          }
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  )
}
