// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { MarkdownEditor } from './MarkdownEditor'

afterEach(() => {
  cleanup()
})

describe('MarkdownEditor', () => {
  it('renders live preview alongside editor in split mode', () => {
    const onChange = vi.fn()
    const { container } = render(
      <MarkdownEditor
        label="CONTENT"
        value={'# Hello Race Fans\n\nWelcome to **Season 4**.'}
        onChange={onChange}
        defaultMode="split"
      />,
    )

    expect(screen.getByText('CONTENT')).toBeTruthy()
    const h1 = container.querySelector('.markdown-content h1')
    expect(h1?.textContent).toBe('Hello Race Fans')
    const strong = container.querySelector('.markdown-content strong')
    expect(strong?.textContent).toBe('Season 4')
  })

  it('switches between write, split, and preview modes', () => {
    const { container } = render(
      <MarkdownEditor value="**Preview Check**" onChange={vi.fn()} defaultMode="write" />,
    )

    expect(container.querySelector('.markdown-content')).toBeNull()

    fireEvent.click(screen.getByText('PREVIEW'))
    expect(container.querySelector('.markdown-content strong')?.textContent).toBe('Preview Check')
  })

  it('inserts markdown formatting when toolbar buttons are clicked', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value="" onChange={onChange} defaultMode="write" />)

    fireEvent.click(screen.getByLabelText('Bold'))
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toContain('**bold text**')
  })
})
