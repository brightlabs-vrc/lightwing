import { Link } from '@tanstack/react-router'
import React from 'react'

interface UserLinkProps {
  userId: string
  name: string
  slug?: string | null
  admin?: boolean
  className?: string
  style?: React.CSSProperties
  clickable?: boolean
}

export const UserLink: React.FC<UserLinkProps> = ({
  userId,
  name,
  slug,
  admin = false,
  className = '',
  style,
  clickable = true,
}) => {
  if (clickable && (userId || slug)) {
    if (admin) {
      return (
        <Link
          to="/admin/users/$userId"
          params={{ userId }}
          className={`text-blue-600 hover:underline font-bold ${className}`}
          style={style}
        >
          {name}
        </Link>
      )
    }

    // Always resolve to slug path /:user if slug exists, otherwise fallback to /:user with userId
    const targetSlug = slug || userId
    return (
      <Link
        to="/$user"
        params={{ user: targetSlug }}
        className={`text-retro-primary hover:underline font-bold ${className}`}
        style={style}
      >
        {name}
      </Link>
    )
  }

  return (
    <span className={`text-slate-800 font-semibold ${className}`} style={style}>
      {name}
    </span>
  )
}
