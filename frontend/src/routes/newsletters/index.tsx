import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  PixelBadge,
  PixelCard,
  PixelContainer,
  PixelEmptyState,
  PixelInput,
  PixelSectionHeader,
  PixelStack,
} from '@pxlkit/ui-kit'
import { listPublicNewsletters } from '../../lib/public-api'
import { usePageHead } from '../../hooks/usePageHead'
import { buildSeoMeta } from '../../lib/seo'
import { formatLocalDateTime } from '../../lib/datetime'
import { Pagination } from '../../components/Pagination'
import { PixelSkeletonList } from '../../components/LoadingSkeleton'

export const Route = createFileRoute('/newsletters/')({
  ssr: 'data-only',
  head: () => ({
    meta: buildSeoMeta({
      title: 'Community Newsletters',
      description: 'Read announcements, updates, and dispatches from organizations on UmaKeiba.',
    }),
  }),
  component: NewslettersFeedPage,
})

function NewslettersFeedPage() {
  usePageHead({
    title: 'Community Newsletters',
    description: 'Read announcements, updates, and dispatches from organizations on UmaKeiba.',
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-newsletters', search, page, pageSize],
    queryFn: () =>
      listPublicNewsletters({
        search: search.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  })

  const newsletters = data?.newsletters ?? []
  const total = data?.total ?? 0

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelStack gap={6}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <PixelSectionHeader
            title="COMMUNITY NEWSLETTERS"
            titleTone="purple"
            size="lg"
          />
          <div className="w-full sm:w-80">
            <PixelInput
              placeholder="Search newsletters or organizations..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <PixelSkeletonList count={4} />
        ) : error ? (
          <PixelEmptyState
            title="Unable to Load Newsletters"
            description={error instanceof Error ? error.message : 'An unexpected error occurred.'}
          />
        ) : newsletters.length === 0 ? (
          <PixelEmptyState
            title="No Newsletters Found"
            description={
              search.trim()
                ? `No published newsletters matched "${search}".`
                : 'Organizations have not published any newsletters yet.'
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newsletters.map((nl) => (
                <Link
                  key={nl.id}
                  to="/newsletters/$newsletterId"
                  params={{ newsletterId: nl.id }}
                  className="block group"
                >
                  <PixelCard className="h-full bg-retro-surface border-2 border-retro-border-strong group-hover:border-retro-primary transition-colors overflow-hidden flex flex-col">
                    {nl.thumbnailUrl && (
                      <div className="-mx-4 -mt-4 mb-4 border-b-2 border-retro-border bg-retro-bg">
                        <img
                          src={nl.thumbnailUrl}
                          alt={nl.title}
                          className="w-full h-44 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <PixelBadge tone="cyan">{nl.organizationName}</PixelBadge>
                      <span className="font-sans text-[11px] text-retro-muted">
                        {nl.publishedAt
                          ? formatLocalDateTime(nl.publishedAt)
                          : formatLocalDateTime(nl.createdAt)}
                      </span>
                    </div>

                    <h2 className="font-pixel text-sm text-retro-text font-bold group-hover:text-retro-primary transition-colors line-clamp-2">
                      {nl.title}
                    </h2>

                    {nl.summary && (
                      <p className="font-sans text-xs text-retro-muted mt-2 line-clamp-3 flex-1">
                        {nl.summary}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-retro-border flex items-center justify-between">
                      <span className="font-sans text-xs text-retro-muted">
                        By {nl.authorName}
                      </span>
                      <span className="font-pixel text-[10px] text-retro-primary">
                        READ MORE →
                      </span>
                    </div>
                  </PixelCard>
                </Link>
              ))}
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next)
                setPage(1)
              }}
              variant="pixel"
            />
          </>
        )}
      </PixelStack>
    </PixelContainer>
  )
}
