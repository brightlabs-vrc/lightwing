// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownView } from './MarkdownView'

describe('MarkdownView', () => {
  it('renders fallback text when content is empty', () => {
    const { container } = render(<MarkdownView content="" fallbackText="No content provided" />)
    expect(container.textContent).toContain('No content provided')
  })

  it('renders markdown headers, links, and linebreaks', () => {
    const markdown = `# Title
### Socials
- [GitHub](https://github.com)
- [VRChat](https://vrchat.com)
Line one
Line two`

    const { container } = render(<MarkdownView content={markdown} />)

    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1?.textContent).toBe('Title')

    const h3 = container.querySelector('h3')
    expect(h3).not.toBeNull()
    expect(h3?.textContent).toBe('Socials')

    const links = container.querySelectorAll('a')
    expect(links.length).toBe(2)
    expect(links[0].getAttribute('href')).toBe('https://github.com')
    expect(links[0].getAttribute('target')).toBe('_blank')

    const list = container.querySelector('ul')
    expect(list).not.toBeNull()
    expect(list?.querySelectorAll('li').length).toBe(2)

    // With remarkBreaks, linebreaks become br elements
    const brs = container.querySelectorAll('br')
    expect(brs.length).toBeGreaterThan(0)
  })
})
