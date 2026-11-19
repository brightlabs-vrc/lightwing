export interface PageHeadOptions {
  title?: string
  description?: string
  image?: string
  type?: string
  url?: string
}

export const SITE_NAME = 'UmaKeiba'

/**
 * Formats a page title with the site name suffix "| UmaKeiba".
 */
export function formatPageTitle(rawTitle?: string): string {
  if (!rawTitle || !rawTitle.trim()) {
    return SITE_NAME
  }

  const trimmed = rawTitle.trim()

  // Avoid duplicating suffix if already present
  if (trimmed.endsWith(`| ${SITE_NAME}`)) {
    return trimmed
  }

  return `${trimmed} | ${SITE_NAME}`
}

/**
 * Cleans Markdown and formatting characters from descriptions for meta tags,
 * and caps the description length.
 */
export function cleanDescription(desc?: string, maxLength = 160): string {
  if (!desc || !desc.trim()) {
    return ''
  }

  let text = desc
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Remove bold / italic markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Convert links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Convert inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove newlines
    .replace(/[\r\n]+/g, ' ')
    // Collapse extra spaces
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 3) + '...'
  }

  return text
}

function setMetaTag(selectorAttr: 'name' | 'property', attrValue: string, contentValue: string) {
  if (typeof document === 'undefined') return

  if (!contentValue) {
    const existing = document.querySelector(`meta[${selectorAttr}="${attrValue}"]`)
    if (existing) {
      existing.remove()
    }
    return
  }

  let element = document.querySelector(`meta[${selectorAttr}="${attrValue}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(selectorAttr, attrValue)
    document.head.appendChild(element)
  }
  element.setAttribute('content', contentValue)
}

/**
 * Dynamically updates document title and Open Graph / Twitter head meta tags.
 */
export function updateHeadMetadata(options: PageHeadOptions): void {
  if (typeof document === 'undefined') return

  const formattedTitle = formatPageTitle(options.title)
  document.title = formattedTitle

  const descriptionText = cleanDescription(options.description)
  const currentUrl =
    options.url || (typeof window !== 'undefined' ? window.location.href : '')
  const currentImage =
    options.image ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/favicon.png`
      : '')
  const pageType = options.type || 'website'

  // Standard Meta Tags
  setMetaTag('name', 'description', descriptionText)

  // OpenGraph Meta Tags
  setMetaTag('property', 'og:site_name', SITE_NAME)
  setMetaTag('property', 'og:title', formattedTitle)
  setMetaTag('property', 'og:description', descriptionText)
  setMetaTag('property', 'og:type', pageType)
  if (currentUrl) setMetaTag('property', 'og:url', currentUrl)
  if (currentImage) setMetaTag('property', 'og:image', currentImage)

  // Twitter Meta Tags
  setMetaTag(
    'name',
    'twitter:card',
    options.image ? 'summary_large_image' : 'summary'
  )
  setMetaTag('name', 'twitter:title', formattedTitle)
  setMetaTag('name', 'twitter:description', descriptionText)
  if (currentImage) setMetaTag('name', 'twitter:image', currentImage)
}
