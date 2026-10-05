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

    const targetPath = slug ? `/${slug}` : `/u/${userId}`
    return (
      <Link
        to={targetPath}
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
