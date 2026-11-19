import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

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
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
