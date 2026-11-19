import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  PixelButton,
  PixelContainer,
  PixelEmptyState,
  PixelSpinner,
  PixelStack,
} from '@pxlkit/ui-kit'
import { getPublicNewsletter } from '../../lib/public-api'
import { usePageHead } from '../../hooks/usePageHead'
import { NewsletterArticleView } from '../../components/NewsletterArticleView'

export const Route = createFileRoute('/newsletters/$newsletterId')({
  component: NewsletterDetailPage,
})

function NewsletterDetailPage() {
  const { newsletterId } = useParams({ from: '/newsletters/$newsletterId' })

  const { data: newsletter, isLoading, error } = useQuery({
    queryKey: ['public-newsletter', newsletterId],
    queryFn: () => getPublicNewsletter(newsletterId),
    enabled: Boolean(newsletterId),
  })

  usePageHead({
    title: newsletter ? `${newsletter.title} — ${newsletter.organizationName}` : 'Newsletter',
    description: newsletter?.summary || 'Organization newsletter on UmaKeiba.',
    image: newsletter?.thumbnailUrl || undefined,
    type: 'article',
  })

  if (isLoading) {
    return (
      <PixelContainer maxWidth="md" padding="md">
        <div className="flex justify-center items-center py-16">
          <PixelSpinner size="lg" />
        </div>
      </PixelContainer>
    )
  }

  if (error || !newsletter) {
    return (
      <PixelContainer maxWidth="md" padding="md">
        <PixelEmptyState
          title="Newsletter Not Found"
          description="This newsletter does not exist or is no longer published."
          action={
            <PixelButton asChild variant="solid" tone="purple" size="sm">
              <Link to="/newsletters">BACK TO NEWSLETTERS</Link>
            </PixelButton>
          }
        />
      </PixelContainer>
    )
  }

  return (
    <PixelContainer maxWidth="lg" padding="md">
      <PixelStack gap={5}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PixelButton asChild variant="ghost" tone="neutral" size="sm">
            <Link to="/newsletters">← ALL NEWSLETTERS</Link>
          </PixelButton>
          <PixelButton asChild variant="outline" tone="cyan" size="sm">
            <Link to="/$user" params={{ user: newsletter.organizationSlug || newsletter.organizationId }}>
              VIEW {newsletter.organizationName.toUpperCase()}
            </Link>
          </PixelButton>
        </div>

        <NewsletterArticleView
          title={newsletter.title}
          summary={newsletter.summary}
          thumbnailUrl={newsletter.thumbnailUrl}
          content={newsletter.content}
          status={newsletter.status}
          organizationId={newsletter.organizationId}
          organizationName={newsletter.organizationName}
          organizationSlug={newsletter.organizationSlug}
          organizationLogo={newsletter.organizationLogo}
          authorId={newsletter.authorId}
          authorName={newsletter.authorName}
          authorSlug={newsletter.authorSlug}
          authorImage={newsletter.authorImage}
          publishedAt={newsletter.publishedAt}
          createdAt={newsletter.createdAt}
        />
      </PixelStack>
    </PixelContainer>
  )
}
