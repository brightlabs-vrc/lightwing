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
    }
  }
  signOutUser: (redirectUrl?: string) => Promise<void>
}

export function UserHeaderDropdown({ session, signOutUser }: UserHeaderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = session.user.vrchatUsername || session.user.name
  const avatarUrl = session.user.image || '/fallback_avatar.jpg'
  const userSlug = session.user.slug || session.user.id

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
        className="flex items-center gap-2 p-1 border-2 border-retro-border hover:border-retro-primary rounded-full transition-colors bg-retro-surface focus:outline-none"
        title={displayName}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          onError={(e) => {
            e.currentTarget.src = '/fallback_avatar.jpg'
          }}
          className="w-8 h-8 rounded-full object-cover"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-retro-surface border-2 border-retro-border-strong rounded shadow-lg z-50 py-1 font-pixel text-xs">
          <div className="px-3 py-2 border-b border-retro-border text-retro-text font-bold truncate">
            {displayName}
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
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              void signOutUser('/auth')
            }}
            className="w-full text-left px-3 py-2 text-retro-red hover:bg-retro-bg transition-colors border-t border-retro-border cursor-pointer"
          >
            SIGN OUT
          </button>
        </div>
      )}
    </div>
  )
}
