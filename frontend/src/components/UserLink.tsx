import { Link } from '@tanstack/react-router'
import React from 'react'

interface UserLinkProps {
  userId: string
  name: string
  className?: string
  style?: React.CSSProperties
  clickable?: boolean
}

export const UserLink: React.FC<UserLinkProps> = ({
  userId,
  name,
  className = '',
  style,
  clickable = true,
}) => {
  if (clickable && userId) {
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

  return (
    <span className={`text-slate-800 font-semibold ${className}`} style={style}>
      {name}
    </span>
  )
}
