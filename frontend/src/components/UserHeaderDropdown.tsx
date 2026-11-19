import { useState, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'

export interface UserHeaderDropdownProps {
  session: {
    user: {
      id: string
      name: string
      slug?: string | null
      image?: string | null
      vrchatUsername?: string | null
      classTier?: string | null
      siteRole?: string | null
      teams?: Array<{
        organizationId: string
        name: string
        slug: string
        role?: string
      }>
    }
  }
  signOutUser: (redirectUrl?: string) => Promise<void>
}

function formatClassTierLabel(classTier?: string | null): string {
  if (!classTier || classTier === 'PRE_OP' || classTier === 'OP') {
    return 'Open Class'
  }
  return `${classTier} Class`
}

export function UserHeaderDropdown({ session, signOutUser }: UserHeaderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = session.user.vrchatUsername || session.user.name
  const avatarUrl = session.user.image || '/fallback_avatar.jpg'
  const userSlug = session.user.slug || session.user.id
  const classTierLabel = formatClassTierLabel(session.user.classTier)
  const isSiteAdmin = session.user.siteRole === 'SITE_ADMIN'
  const managedOrgId =
    session.user.teams && session.user.teams.length > 0
      ? session.user.teams[0].organizationId
      : isSiteAdmin
        ? 'org_mock_urs'
        : null

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 border-2 border-retro-border hover:border-retro-primary rounded transition-colors bg-retro-surface focus:outline-none cursor-pointer"
        title={`${displayName} — ${classTierLabel}`}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          onError={(e) => {
            e.currentTarget.src = '/fallback_avatar.jpg'
          }}
          className="w-8 h-8 rounded-full object-cover border border-retro-border shrink-0"
        />
        <div className="hidden sm:flex flex-col items-start text-left leading-tight max-w-[130px]">
          <span className="font-sans text-xs font-bold text-retro-text truncate w-full">
            {displayName}
          </span>
          <span className="font-pixel text-[10px] text-retro-muted truncate w-full">
            {classTierLabel}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-retro-surface border-2 border-retro-border-strong rounded shadow-lg z-50 py-1 font-pixel text-xs">
          <div className="px-3 py-2 border-b border-retro-border">
            <div className="text-retro-text font-bold truncate">{displayName}</div>
            <div className="text-[10px] text-retro-muted mt-0.5">{classTierLabel}</div>
          </div>

          <Link
            to="/$user"
            params={{ user: userSlug }}
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-retro-text hover:bg-retro-bg hover:text-retro-primary transition-colors"
          >
            MY PROFILE
          </Link>
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-retro-text hover:bg-retro-bg hover:text-retro-primary transition-colors"
          >
            EDIT PROFILE
          </Link>

          <div className="border-t border-retro-border my-1" />

          {managedOrgId && (
            <Link
              to="/teams/manage/$id"
              params={{ id: managedOrgId }}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-retro-primary hover:bg-retro-bg transition-colors"
            >
              ORG / TEAM CONSOLE
            </Link>
          )}
          <Link
            to="/teams/new"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-retro-text hover:bg-retro-bg hover:text-retro-primary transition-colors"
          >
            + REGISTER TEAM / ORG
          </Link>
          {isSiteAdmin && (
            <Link
              to="/admin"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-retro-gold hover:bg-retro-bg transition-colors"
            >
              SITE ADMIN PANEL
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              void signOutUser('/auth')
            }}
            className="w-full text-left px-3 py-2 text-retro-red hover:bg-retro-bg transition-colors border-t border-retro-border mt-1 cursor-pointer"
          >
            SIGN OUT
          </button>
        </div>
      )}
    </div>
  )
}
