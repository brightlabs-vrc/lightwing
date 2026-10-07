import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewProps {
  content: string | null | undefined
  fallbackText?: string
  className?: string
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({
  content,
  fallbackText = 'No description provided.',
  className = '',
}) => {
  if (!content || !content.trim()) {
    return (
      <div className={`font-sans text-sm text-retro-muted italic ${className}`}>
        {fallbackText}
      </div>
    )
  }

  return (
    <div
      className={`prose prose-invert max-w-none text-retro-text font-sans text-sm leading-relaxed
        [&_h1]:text-xl [&_h1]:font-pixel [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-retro-primary
        [&_h2]:text-lg [&_h2]:font-pixel [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-retro-text
        [&_h3]:text-base [&_h3]:font-pixel [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-retro-text
        [&_p]:mb-3 [&_p]:leading-relaxed
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
        [&_li]:mb-1
        [&_a]:text-retro-primary [&_a]:underline [&_a]:hover:text-retro-primary/80
        [&_blockquote]:border-l-4 [&_blockquote]:border-retro-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_blockquote]:text-retro-muted
        [&_code]:bg-retro-bg [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_code]:text-retro-gold
        [&_pre]:bg-retro-bg [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:mb-3
        [&_img]:max-w-full [&_img]:rounded [&_img]:my-3 [&_img]:border [&_img]:border-retro-border
        [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_table]:border [&_table]:border-retro-border
        [&_th]:bg-retro-surface [&_th]:p-2 [&_th]:border [&_th]:border-retro-border [&_th]:text-left [&_th]:font-pixel [&_th]:text-xs
        [&_td]:p-2 [&_td]:border [&_td]:border-retro-border
        ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
