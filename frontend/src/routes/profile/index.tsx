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
          biography: data.biography,
          careerOverview: data.careerOverview,
          vrchatUsername: data.vrchatUsername,
        },
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      alert('Profile updated!')
    },
  })

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Edit Profile</h1>
      <div className="space-y-4 max-w-md">
        <label className="block">
          <span className="text-slate-700 font-medium">Name</span>
          <input
            type="text"
            className="border p-2 w-full mt-1"
            value={profile?.name ?? ''}
            disabled
          />
        </label>

        <label className="block">
          <span className="text-slate-700 font-medium">Biography</span>
          <textarea
            className="border p-2 w-full mt-1"
            rows={3}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-slate-700 font-medium">Career Overview</span>
          <textarea
            className="border p-2 w-full mt-1"
            rows={3}
            value={careerOverview}
            onChange={(e) => setCareerOverview(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-slate-700 font-medium">VRChat Username</span>
          <input
            type="text"
            className="border p-2 w-full mt-1"
            placeholder="e.g. user123"
            value={vrchatUsername}
            onChange={(e) => setVrchatUsername(e.target.value)}
          />
        </label>

        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() =>
            updateMutation.mutate({ biography, careerOverview, vrchatUsername })
          }
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
