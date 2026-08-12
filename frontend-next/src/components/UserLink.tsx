'use client'
import Link from 'next/link'
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
  const mergedStyle = {
    fontWeight: 'bold' as const,
    ...style,
  }

  if (clickable && userId) {
    return (
      <Link
        href={`/admin/users/${userId}`}
        className={className}
        style={{
          color: 'var(--color-accent-fg)',
          textDecoration: 'none',
          ...mergedStyle,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = 'underline'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = 'none'
        }}
      >
        {name}
      </Link>
    )
  }

  return (
    <span
      className={className}
      style={{
        color: 'var(--color-fg-default)',
        ...mergedStyle,
      }}
    >
      {name}
    </span>
  )
}
