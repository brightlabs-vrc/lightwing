import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-guard'
import { getMyProfile } from '@/lib/public-api'
import { ProfileFormClient } from './ProfileFormClient'

interface PageProps {
  params: Promise<{ userId?: string }>
}

export default async function ProfilePage({ params }: PageProps) {
  const { userId } = await params
  const session = await requireAuth()

  const targetUserId = userId || session.user.id

  // Redirect to onboarding if viewing own profile and no VRChat username
  if (!session.user.vrchatUsername && targetUserId === session.user.id) {
    redirect('/onboarding')
  }

  const profile = await getMyProfile(targetUserId)

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '2rem' }}>Profile</h1>
      <ProfileFormClient initialProfile={profile} userId={targetUserId} />
    </div>
  )
}
