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
  clickable = true,
  style,
}) => {
  if (clickable && userId) {
    return (
      <Link
        to="/admin/users/$userId"
        params={{ userId }}
        style={{
          color: 'var(--color-accent-fg)',
          fontWeight: 'bold',
          textDecoration: 'underline',
          ...style,
        }}
      >
        {name}
      </Link>
    )
  }

  return (
    <span
      style={{
        color: 'var(--color-fg-default)',
        fontWeight: '600',
        ...style,
      }}
    >
      {name}
    </span>
  )
}
