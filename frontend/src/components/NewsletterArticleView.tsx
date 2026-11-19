import React from 'react'
import { Link } from '@tanstack/react-router'
import { PixelBadge, PixelCard, PixelStack } from '@pxlkit/ui-kit'
import { MarkdownView } from './MarkdownView'
import { UserLink } from './UserLink'
import { formatLocalDateTime } from '../lib/datetime'

export interface NewsletterArticleViewProps {
  title: string
  summary?: string | null
  thumbnailUrl?: string | null
  content: string
  status?: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  organizationLogo?: string | null
  authorId?: string
  authorName: string
  authorSlug?: string | null
  authorImage?: string | null
  publishedAt?: string | null
  createdAt?: string | null
  isPreview?: boolean
}

export const NewsletterArticleView: React.FC<NewsletterArticleViewProps> = ({
  title,
  summary,
  thumbnailUrl,
  content,
  status = 'PUBLISHED',
  organizationId,
  organizationName,
  organizationSlug,
  organizationLogo,
  authorId,
  authorName,
  authorSlug,
  authorImage,
  publishedAt,
  createdAt,
  isPreview = false,
}) => {
  const displayDate = publishedAt || createdAt
  const cleanThumb = thumbnailUrl?.trim()

  return (
    <PixelCard className="bg-retro-surface border-2 border-retro-border-strong overflow-hidden">
      {cleanThumb && (
        <div className="-mx-4 -mt-4 mb-5 border-b-2 border-retro-border-strong bg-retro-bg">
          <img
            src={cleanThumb}
            alt={title || 'Newsletter thumbnail'}
            className="w-full max-h-80 object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )}

      <PixelStack gap={4}>
        {/* Org + Status + Date Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {organizationLogo ? (
              <img
                src={organizationLogo}
                alt={organizationName}
                className="w-7 h-7 rounded border border-retro-border object-cover bg-retro-bg shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded border border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-[10px] font-bold flex items-center justify-center shrink-0">
                {organizationName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isPreview ? (
              <span className="font-pixel text-xs text-retro-cyan font-bold truncate">
                {organizationName}
              </span>
            ) : (
              <Link
                to="/$user"
                params={{ user: organizationSlug || organizationId }}
                className="font-pixel text-xs text-retro-cyan hover:text-retro-primary font-bold truncate"
              >
                {organizationName}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status !== 'PUBLISHED' && (
              <PixelBadge tone="gold">{status}</PixelBadge>
            )}
            {displayDate && (
              <span className="font-sans text-xs text-retro-muted">
                {formatLocalDateTime(displayDate)}
              </span>
            )}
          </div>
        </div>

        {/* Title & Summary */}
        <div>
          <h1 className="font-pixel text-xl sm:text-2xl text-retro-text font-bold leading-snug">
            {title.trim() || 'Untitled Newsletter'}
          </h1>
          {summary && summary.trim() && (
            <p className="mt-2 font-sans text-sm text-retro-muted leading-relaxed">
              {summary}
            </p>
          )}
        </div>

        {/* Author */}
        <div className="flex items-center gap-2 pb-4 border-b border-retro-border">
          <img
            src={authorImage || '/fallback_avatar.jpg'}
            alt={authorName}
            onError={(e) => {
              e.currentTarget.src = '/fallback_avatar.jpg'
            }}
            className="w-6 h-6 rounded-full object-cover border border-retro-border"
          />
          <span className="font-sans text-xs text-retro-muted">By</span>
          {isPreview || !authorId ? (
            <span className="font-sans text-xs font-semibold text-retro-text">{authorName}</span>
          ) : (
            <UserLink
              userId={authorId}
              name={authorName}
              slug={authorSlug}
              className="font-sans text-xs font-semibold text-retro-text hover:text-retro-primary"
            />
          )}
        </div>

        {/* Markdown Body */}
        <div className="pt-1">
          <MarkdownView
            content={content}
            fallbackText="Start writing Markdown in the editor to see your newsletter preview here."
          />
        </div>
      </PixelStack>
    </PixelCard>
  )
}
