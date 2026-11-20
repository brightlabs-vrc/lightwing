import React, { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  PixelAlert,
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelInput,
  PixelModal,
  PixelSectionHeader,
  PixelSpinner,
  PixelStack,
  useToast,
} from '@pxlkit/ui-kit'
import {
  createNewsletter,
  deleteNewsletter,
  listOrgNewsletters,
  updateNewsletter,
} from '../lib/admin-api'
import type { teammanager } from '../lib/client'
import { useAuth } from '../hooks/useAuth'
import { formatLocalDateTime } from '../lib/datetime'
import { MarkdownEditor } from './MarkdownEditor'
import { NewsletterArticleView } from './NewsletterArticleView'

interface OrgNewslettersTabProps {
  organizationId: string
  organization: teammanager.Team
}

export const OrgNewslettersTab: React.FC<OrgNewslettersTabProps> = ({
  organizationId,
  organization,
}) => {
  const { session } = useAuth()
  const { toast } = useToast()

  const [newsletters, setNewsletters] = useState<teammanager.Newsletter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Composer state
  const [isComposing, setIsComposing] = useState(false)
  const [editingNewsletter, setEditingNewsletter] = useState<teammanager.Newsletter | null>(null)
  const [title, setTitle] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<teammanager.Newsletter | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadNewsletters = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await listOrgNewsletters(organizationId, 50, 0)
      setNewsletters(resp.newsletters)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load newsletters')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void loadNewsletters()
  }, [loadNewsletters])

  const openNewComposer = () => {
    setEditingNewsletter(null)
    setTitle('')
    setThumbnailUrl('')
    setSummary('')
    setStatus('DRAFT')
    setContent('')
    setFormError(null)
    setIsComposing(true)
  }

  const openEditComposer = (nl: teammanager.Newsletter) => {
    setEditingNewsletter(nl)
    setTitle(nl.title)
    setThumbnailUrl(nl.thumbnailUrl ?? '')
    setSummary(nl.summary ?? '')
    setStatus(nl.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')
    setContent(nl.content)
    setFormError(null)
    setIsComposing(true)
  }

  const closeComposer = () => {
    setIsComposing(false)
    setEditingNewsletter(null)
    setFormError(null)
  }

  const handleSave = async (e: React.FormEvent, overrideStatus?: 'DRAFT' | 'PUBLISHED') => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFormError('Newsletter title is required.')
      return
    }

    const finalStatus = overrideStatus ?? status
    setSaving(true)
    setFormError(null)
    try {
      if (editingNewsletter) {
        await updateNewsletter({
          id: editingNewsletter.id,
          title: trimmedTitle,
          summary: summary.trim(),
          clearSummary: !summary.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
          clearThumbnail: !thumbnailUrl.trim(),
          content,
          status: finalStatus,
        })
        toast({
          tone: 'green',
          title: finalStatus === 'PUBLISHED' ? 'Newsletter published!' : 'Newsletter draft saved.',
        })
      } else {
        await createNewsletter({
          organizationId,
          title: trimmedTitle,
          summary: summary.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
          content,
          status: finalStatus,
        })
        toast({
          tone: 'green',
          title: finalStatus === 'PUBLISHED' ? 'Newsletter published!' : 'Newsletter draft created.',
        })
      }
      closeComposer()
      await loadNewsletters()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Failed to save newsletter')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickToggleStatus = async (nl: teammanager.Newsletter) => {
    const nextStatus = nl.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    try {
      await updateNewsletter({
        id: nl.id,
        title: nl.title,
        summary: nl.summary ?? '',
        clearSummary: false,
        thumbnailUrl: nl.thumbnailUrl ?? '',
        clearThumbnail: false,
        content: nl.content,
        status: nextStatus,
      })
      toast({
        tone: 'green',
        title: nextStatus === 'PUBLISHED' ? 'Newsletter published!' : 'Newsletter unpublished to draft.',
      })
      await loadNewsletters()
    } catch (cause) {
      toast({
        tone: 'red',
        title: cause instanceof Error ? cause.message : 'Failed to update newsletter status',
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteNewsletter(deleteTarget.id)
      toast({ tone: 'green', title: 'Newsletter deleted.' })
      setDeleteTarget(null)
      await loadNewsletters()
    } catch (cause) {
      toast({
        tone: 'red',
        title: cause instanceof Error ? cause.message : 'Failed to delete newsletter',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (isComposing) {
    const authorName = session?.user?.name || 'Organization Staff'
    const authorImage = session?.user?.image || null

    return (
      <PixelStack gap={6}>
        <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
          <PixelStack direction="row" align="center" justify="between" wrap gap={3}>
            <PixelSectionHeader
              title={editingNewsletter ? 'EDIT NEWSLETTER' : 'NEW NEWSLETTER'}
              titleTone="purple"
              size="sm"
            />
            <PixelButton variant="ghost" tone="neutral" size="sm" onClick={closeComposer}>
              ← BACK TO NEWSLETTERS
            </PixelButton>
          </PixelStack>
        </PixelCard>

        {formError && <PixelAlert tone="red" message={formError} />}

        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-6">
          {/* Dedicated Form for Title & Thumbnail URL */}
          <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
            <PixelStack gap={4}>
              <PixelSectionHeader title="NEWSLETTER DETAILS" titleTone="cyan" size="sm" />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <PixelInput
                    label="NEWSLETTER TITLE *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Season 4 Grand Prix Schedule & Rule Updates"
                    maxLength={200}
                    required
                  />

                  <PixelInput
                    label="THUMBNAIL URL"
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://example.com/banner.png"
                  />

                  <PixelInput
                    label="SUMMARY / EXCERPT (OPTIONAL)"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="A short teaser shown on newsletter cards and link previews..."
                    maxLength={320}
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="font-pixel text-[11px] text-retro-muted uppercase tracking-wider">
                      PUBLISH STATUS
                    </label>
                    <div className="flex items-center gap-2">
                      <PixelButton
                        type="button"
                        size="sm"
                        variant={status === 'DRAFT' ? 'solid' : 'outline'}
                        tone={status === 'DRAFT' ? 'gold' : 'neutral'}
                        onClick={() => setStatus('DRAFT')}
                      >
                        DRAFT
                      </PixelButton>
                      <PixelButton
                        type="button"
                        size="sm"
                        variant={status === 'PUBLISHED' ? 'solid' : 'outline'}
                        tone={status === 'PUBLISHED' ? 'green' : 'neutral'}
                        onClick={() => setStatus('PUBLISHED')}
                      >
                        PUBLISHED
                      </PixelButton>
                    </div>
                  </div>
                </div>

                {/* Live Thumbnail Preview Box */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-pixel text-[11px] text-retro-muted uppercase tracking-wider">
                    THUMBNAIL PREVIEW
                  </span>
                  <div className="flex-1 min-h-[160px] rounded border-2 border-retro-border bg-retro-bg flex items-center justify-center overflow-hidden">
                    {thumbnailUrl.trim() ? (
                      <img
                        src={thumbnailUrl.trim()}
                        alt="Thumbnail preview"
                        className="w-full h-full max-h-56 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="font-sans text-xs text-retro-muted italic px-4 text-center">
                        Enter a Thumbnail URL to preview the cover image.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </PixelStack>
          </PixelCard>

          {/* CodeMirror 6 Rich Markdown Editor + Live "As It Appears" Preview */}
          <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
            <PixelStack gap={4}>
              <PixelSectionHeader
                title="CONTENT & LIVE PREVIEW"
                titleTone="purple"
                size="sm"
              />
              <MarkdownEditor
                value={content}
                onChange={setContent}
                minHeight="380px"
                defaultMode="split"
                placeholder="Write your newsletter in Markdown, or use the formatting toolbar above..."
                renderPreview={(markdownBody) => (
                  <NewsletterArticleView
                    isPreview
                    title={title}
                    summary={summary}
                    thumbnailUrl={thumbnailUrl}
                    content={markdownBody}
                    status={status}
                    organizationId={organization.id}
                    organizationName={organization.name}
                    organizationSlug={organization.slug}
                    organizationLogo={organization.logo}
                    authorName={authorName}
                    authorImage={authorImage}
                    publishedAt={status === 'PUBLISHED' ? new Date().toISOString() : null}
                  />
                )}
              />

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-retro-border">
                <PixelButton
                  type="button"
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  onClick={closeComposer}
                  disabled={saving}
                >
                  CANCEL
                </PixelButton>
                <PixelButton
                  type="button"
                  variant="outline"
                  tone="gold"
                  size="sm"
                  disabled={saving}
                  onClick={(e) => void handleSave(e, 'DRAFT')}
                >
                  {saving ? 'SAVING...' : 'SAVE AS DRAFT'}
                </PixelButton>
                <PixelButton
                  type="button"
                  variant="solid"
                  tone="green"
                  size="sm"
                  disabled={saving}
                  onClick={(e) => void handleSave(e, 'PUBLISHED')}
                >
                  {saving ? 'PUBLISHING...' : 'PUBLISH NEWSLETTER'}
                </PixelButton>
              </div>
            </PixelStack>
          </PixelCard>
        </form>
      </PixelStack>
    )
  }

  return (
    <PixelStack gap={6}>
      <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
        <PixelStack direction="row" align="center" justify="between" wrap gap={3}>
          <div>
            <PixelSectionHeader title="ORGANIZATION NEWSLETTERS" titleTone="purple" size="sm" />
            <p className="font-sans text-xs text-retro-muted mt-1">
              Publish updates, announcements, and community dispatches in Markdown.
            </p>
          </div>
          <PixelButton variant="solid" tone="purple" size="sm" onClick={openNewComposer}>
            + NEW NEWSLETTER
          </PixelButton>
        </PixelStack>
      </PixelCard>

      {error && <PixelAlert tone="red" message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <PixelSpinner size="md" />
        </div>
      ) : newsletters.length === 0 ? (
        <PixelCard className="bg-retro-surface border-2 border-retro-border text-center py-10">
          <PixelStack gap={3} align="center">
            <div className="font-pixel text-sm text-retro-text">NO NEWSLETTERS YET</div>
            <p className="font-sans text-xs text-retro-muted max-w-md">
              Create your organization&apos;s first newsletter to share race recaps, schedule updates, and community news.
            </p>
            <PixelButton variant="solid" tone="purple" size="sm" onClick={openNewComposer}>
              + CREATE FIRST NEWSLETTER
            </PixelButton>
          </PixelStack>
        </PixelCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {newsletters.map((nl) => (
            <PixelCard
              key={nl.id}
              className="bg-retro-surface border-2 border-retro-border hover:border-retro-primary transition-colors"
            >
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                <div className="flex gap-4 min-w-0 flex-1">
                  {nl.thumbnailUrl && (
                    <img
                      src={nl.thumbnailUrl}
                      alt={nl.title}
                      className="w-24 h-16 rounded border border-retro-border object-cover bg-retro-bg shrink-0 hidden sm:block"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <PixelBadge tone={nl.status === 'PUBLISHED' ? 'green' : 'gold'}>
                        {nl.status}
                      </PixelBadge>
                      <span className="font-sans text-xs text-retro-muted">
                        {nl.publishedAt
                          ? `Published ${formatLocalDateTime(nl.publishedAt)}`
                          : `Updated ${formatLocalDateTime(nl.updatedAt)}`}
                      </span>
                    </div>
                    <h3 className="font-pixel text-sm text-retro-text font-bold truncate">
                      {nl.title}
                    </h3>
                    {nl.summary && (
                      <p className="font-sans text-xs text-retro-muted mt-1 line-clamp-2">
                        {nl.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {nl.status === 'PUBLISHED' && (
                    <PixelButton asChild variant="ghost" tone="cyan" size="sm">
                      <Link to="/newsletters/$newsletterId" params={{ newsletterId: nl.id }}>
                        VIEW
                      </Link>
                    </PixelButton>
                  )}
                  <PixelButton
                    variant="outline"
                    tone="neutral"
                    size="sm"
                    onClick={() => openEditComposer(nl)}
                  >
                    EDIT
                  </PixelButton>
                  <PixelButton
                    variant="soft"
                    tone={nl.status === 'PUBLISHED' ? 'gold' : 'green'}
                    size="sm"
                    onClick={() => void handleQuickToggleStatus(nl)}
                  >
                    {nl.status === 'PUBLISHED' ? 'UNPUBLISH' : 'PUBLISH'}
                  </PixelButton>
                  <PixelButton
                    variant="ghost"
                    tone="red"
                    size="sm"
                    onClick={() => setDeleteTarget(nl)}
                  >
                    DELETE
                  </PixelButton>
                </div>
              </div>
            </PixelCard>
          ))}
        </div>
      )}

      {deleteTarget && (
        <PixelModal
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="DELETE NEWSLETTER"
        >
          <PixelStack gap={4}>
            <p className="font-sans text-sm text-retro-text">
              Are you sure you want to permanently delete{' '}
              <strong className="text-retro-primary">{deleteTarget.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <PixelButton
                variant="ghost"
                tone="neutral"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                CANCEL
              </PixelButton>
              <PixelButton
                variant="solid"
                tone="red"
                size="sm"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
              >
                {deleting ? 'DELETING...' : 'DELETE'}
              </PixelButton>
            </div>
          </PixelStack>
        </PixelModal>
      )}
    </PixelStack>
  )
}
