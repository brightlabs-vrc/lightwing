// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatPageTitle,
  cleanDescription,
  updateHeadMetadata,
  buildSeoMeta,
  SITE_NAME,
} from './seo'

describe('seo utility functions', () => {
  describe('formatPageTitle', () => {
    it('returns SITE_NAME when rawTitle is empty or undefined', () => {
      expect(formatPageTitle()).toBe('UmaKeiba')
      expect(formatPageTitle('')).toBe('UmaKeiba')
      expect(formatPageTitle('   ')).toBe('UmaKeiba')
    })

    it('formats title with " | UmaKeiba" suffix', () => {
      expect(formatPageTitle('Autumn Championship 2026')).toBe(
        'Autumn Championship 2026 | UmaKeiba'
      )
      expect(formatPageTitle('Mejiro McQueen')).toBe('Mejiro McQueen | UmaKeiba')
      expect(formatPageTitle('SpecialWeek')).toBe('SpecialWeek | UmaKeiba')
    })

    it('does not duplicate suffix if title already ends with "| UmaKeiba"', () => {
      expect(formatPageTitle('Autumn Championship 2026 | UmaKeiba')).toBe(
        'Autumn Championship 2026 | UmaKeiba'
      )
    })
  })

  describe('cleanDescription', () => {
    it('returns empty string when description is empty or missing', () => {
      expect(cleanDescription()).toBe('')
      expect(cleanDescription('')).toBe('')
      expect(cleanDescription('   ')).toBe('')
    })

    it('strips markdown formatting tags', () => {
      const markdown = '# Championship Event\n\n**Welcome** to [UmaKeiba](https://example.com) with `code`!'
      expect(cleanDescription(markdown)).toBe(
        'Championship Event Welcome to UmaKeiba with code!'
      )
    })

    it('truncates descriptions exceeding maxLength', () => {
      const longText = 'A'.repeat(200)
      const cleaned = cleanDescription(longText, 50)
      expect(cleaned.length).toBe(50)
      expect(cleaned.endsWith('...')).toBe(true)
    })
  })

  describe('updateHeadMetadata', () => {
    beforeEach(() => {
      document.title = 'Default Title'
      const metas = document.querySelectorAll('meta')
      metas.forEach((m) => m.remove())
    })

    it('updates document.title and inserts Open Graph and Twitter meta tags', () => {
      updateHeadMetadata({
        title: 'SpecialWeek',
        description: 'Top racing contender in UmaKeiba',
        image: 'https://example.com/avatar.jpg',
        type: 'profile',
      })

      expect(document.title).toBe('SpecialWeek | UmaKeiba')

      const ogTitle = document.querySelector('meta[property="og:title"]')
      expect(ogTitle?.getAttribute('content')).toBe('SpecialWeek | UmaKeiba')

      const ogDesc = document.querySelector('meta[property="og:description"]')
      expect(ogDesc?.getAttribute('content')).toBe('Top racing contender in UmaKeiba')

      const ogImage = document.querySelector('meta[property="og:image"]')
      expect(ogImage?.getAttribute('content')).toBe('https://example.com/avatar.jpg')

      const ogSiteName = document.querySelector('meta[property="og:site_name"]')
      expect(ogSiteName?.getAttribute('content')).toBe(SITE_NAME)

      const ogType = document.querySelector('meta[property="og:type"]')
      expect(ogType?.getAttribute('content')).toBe('profile')

      const twitterCard = document.querySelector('meta[name="twitter:card"]')
      expect(twitterCard?.getAttribute('content')).toBe('summary_large_image')

      const twitterTitle = document.querySelector('meta[name="twitter:title"]')
      expect(twitterTitle?.getAttribute('content')).toBe('SpecialWeek | UmaKeiba')
    })
  })

  describe('buildSeoMeta', () => {
    it('builds SSR meta descriptors with formatted title, cleaned description, and custom image', () => {
      const meta = buildSeoMeta({
        title: 'Spring Grand Prix',
        description: '# Welcome\nJoin the **Spring Grand Prix**!',
        image: 'https://example.com/banner.png',
        type: 'article',
        url: 'https://umakeiba.example.com/events/evt_1',
      })

      expect(meta).toContainEqual({ title: 'Spring Grand Prix | UmaKeiba' })
      expect(meta).toContainEqual({
        name: 'description',
        content: 'Welcome Join the Spring Grand Prix!',
      })
      expect(meta).toContainEqual({
        property: 'og:site_name',
        content: SITE_NAME,
      })
      expect(meta).toContainEqual({
        property: 'og:title',
        content: 'Spring Grand Prix | UmaKeiba',
      })
      expect(meta).toContainEqual({
        property: 'og:description',
        content: 'Welcome Join the Spring Grand Prix!',
      })
      expect(meta).toContainEqual({
        property: 'og:type',
        content: 'article',
      })
      expect(meta).toContainEqual({
        property: 'og:url',
        content: 'https://umakeiba.example.com/events/evt_1',
      })
      expect(meta).toContainEqual({
        property: 'og:image',
        content: 'https://example.com/banner.png',
      })
      expect(meta).toContainEqual({
        name: 'twitter:card',
        content: 'summary_large_image',
      })
      expect(meta).toContainEqual({
        name: 'twitter:image',
        content: 'https://example.com/banner.png',
      })
    })

    it('falls back to default description, /favicon.png, and summary twitter card when omitted', () => {
      const meta = buildSeoMeta({})
      expect(meta).toContainEqual({ title: 'UmaKeiba' })
      expect(meta).toContainEqual({
        property: 'og:image',
        content: '/favicon.png',
      })
      expect(meta).toContainEqual({
        name: 'twitter:card',
        content: 'summary',
      })
    })
  })
})
