// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { EventBanner } from './EventBanner'

describe('EventBanner', () => {
  it('renders a deterministic SVG fallback when bannerUrl is omitted', () => {
    const { container } = render(
      <EventBanner
        id="evt_123"
        name="Mile Championship"
        classRestriction="G1"
        tag="OFFICIAL"
        variant="hero"
      />,
    )

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.textContent).toContain('G1')
  })

  it('renders custom bannerUrl image and falls back to generated SVG on error', () => {
    const { container, getByAltText } = render(
      <EventBanner
        id="evt_456"
        name="Summer Sprint"
        bannerUrl="https://example.com/broken.png"
        classRestriction="G3"
        variant="hero"
      />,
    )

    const img = getByAltText('Summer Sprint') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()

    fireEvent.error(img)

    const fallbackSvg = container.querySelector('svg')
    expect(fallbackSvg).not.toBeNull()
    expect(fallbackSvg?.textContent).toContain('G3')
  })
})
