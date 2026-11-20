import React, { useCallback, useMemo, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { MarkdownView } from './MarkdownView'

export type MarkdownEditorMode = 'split' | 'write' | 'preview'

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  minHeight?: string
  defaultMode?: MarkdownEditorMode
  previewFallbackText?: string
  renderPreview?: (content: string) => React.ReactNode
  className?: string
}

const retroEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--retro-bg, #F2F0EB)',
    color: 'var(--retro-text, #1A1A2E)',
    fontSize: '13px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  '.cm-content': {
    padding: '12px 10px',
    caretColor: 'var(--retro-primary, #4F46E5)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--retro-surface, #E6E2DC)',
    color: 'var(--retro-muted, #646478)',
    borderRight: '1px solid var(--retro-border, #BEBAA2)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--retro-primary, #4F46E5)',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(79, 70, 229, 0.24)',
  },
  '.cm-placeholder': {
    color: 'var(--retro-muted, #646478)',
    fontStyle: 'italic',
  },
})

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Write your content in Markdown...',
  minHeight = '260px',
  defaultMode = 'split',
  previewFallbackText = 'Nothing to preview yet.',
  renderPreview,
  className = '',
}) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const [mode, setMode] = useState<MarkdownEditorMode>(defaultMode)
  const [insertPopover, setInsertPopover] = useState<'link' | 'image' | null>(null)
  const [insertUrl, setInsertUrl] = useState('')
  const [insertLabel, setInsertLabel] = useState('')

  const getView = useCallback((): EditorView | null => {
    return editorRef.current?.view ?? null
  }, [])

  const wrapSelection = useCallback(
    (prefix: string, suffix: string, fallbackText: string) => {
      const view = getView()
      if (!view) {
        onChange(`${value}${prefix}${fallbackText}${suffix}`)
        return
      }
      const { from, to } = view.state.selection.main
      const selected = view.state.sliceDoc(from, to)
      const inner = selected || fallbackText
      const replacement = `${prefix}${inner}${suffix}`
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: {
          anchor: from + prefix.length,
          head: from + prefix.length + inner.length,
        },
      })
      view.focus()
    },
    [getView, onChange, value],
  )

  const prefixLines = useCallback(
    (linePrefix: string, fallbackText: string) => {
      const view = getView()
      if (!view) {
        onChange(`${value ? `${value}\n` : ''}${linePrefix}${fallbackText}`)
        return
      }
      const { from, to } = view.state.selection.main
      const firstLine = view.state.doc.lineAt(from)
      const lastLine = view.state.doc.lineAt(to)
      const selectedBlock = view.state.sliceDoc(firstLine.from, lastLine.to)

      if (!selectedBlock.trim()) {
        const insertText = `${linePrefix}${fallbackText}`
        view.dispatch({
          changes: { from: firstLine.from, to: lastLine.to, insert: insertText },
          selection: {
            anchor: firstLine.from + linePrefix.length,
            head: firstLine.from + insertText.length,
          },
        })
        view.focus()
        return
      }

      const lines = selectedBlock.split('\n')
      const updated = lines
        .map((line, idx) => {
          if (linePrefix === '1. ') {
            return `${idx + 1}. ${line.replace(/^\d+\.\s+/, '')}`
          }
          return line.startsWith(linePrefix) ? line.slice(linePrefix.length) : `${linePrefix}${line}`
        })
        .join('\n')

      view.dispatch({
        changes: { from: firstLine.from, to: lastLine.to, insert: updated },
        selection: { anchor: firstLine.from, head: firstLine.from + updated.length },
      })
      view.focus()
    },
    [getView, onChange, value],
  )

  const insertBlock = useCallback(
    (snippet: string) => {
      const view = getView()
      if (!view) {
        onChange(`${value ? `${value}\n\n` : ''}${snippet}`)
        return
      }
      const { from, to } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      const needsLeadingNewline = line.text.trim().length > 0
      const text = `${needsLeadingNewline ? '\n\n' : ''}${snippet}\n`
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    },
    [getView, onChange, value],
  )

  const openInsertPopover = useCallback(
    (kind: 'link' | 'image') => {
      const view = getView()
      let selected = ''
      if (view) {
        const { from, to } = view.state.selection.main
        selected = view.state.sliceDoc(from, to)
      }
      setInsertLabel(selected)
      setInsertUrl('')
      setInsertPopover((prev) => (prev === kind ? null : kind))
    },
    [getView],
  )

  const confirmInsertMedia = useCallback(() => {
    const cleanUrl = insertUrl.trim()
    if (!cleanUrl) return
    const cleanLabel = insertLabel.trim() || (insertPopover === 'image' ? 'image' : 'link text')
    const markdownSnippet =
      insertPopover === 'image' ? `![${cleanLabel}](${cleanUrl})` : `[${cleanLabel}](${cleanUrl})`

    const view = getView()
    if (!view) {
      onChange(`${value ? `${value} ` : ''}${markdownSnippet}`)
    } else {
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: markdownSnippet },
        selection: { anchor: from + markdownSnippet.length },
      })
      view.focus()
    }
    setInsertPopover(null)
    setInsertUrl('')
    setInsertLabel('')
  }, [getView, insertLabel, insertPopover, insertUrl, onChange, value])

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      retroEditorTheme,
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-b',
            run: () => {
              wrapSelection('**', '**', 'bold text')
              return true
            },
          },
          {
            key: 'Mod-i',
            run: () => {
              wrapSelection('*', '*', 'italic text')
              return true
            },
          },
          {
            key: 'Mod-k',
            run: () => {
              openInsertPopover('link')
              return true
            },
          },
        ]),
      ),
    ],
    [openInsertPopover, wrapSelection],
  )

  const toolbarBtnClass =
    'p-1.5 rounded text-retro-muted hover:text-retro-text hover:bg-retro-bg border border-transparent hover:border-retro-border transition-colors cursor-pointer'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="font-pixel text-[11px] text-retro-muted uppercase tracking-wider">
          {label}
        </label>
      )}

      <div className="rounded border-2 border-retro-border-strong bg-retro-surface overflow-hidden">
        {/* Toolbar + View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 bg-retro-surface border-b border-retro-border">
          <div className="flex flex-wrap items-center gap-0.5">
            <button
              type="button"
              title="Heading 1"
              aria-label="Heading 1"
              className={toolbarBtnClass}
              onClick={() => prefixLines('# ', 'Heading 1')}
            >
              <i className="hn hn-heading-1-solid text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Heading 2"
              aria-label="Heading 2"
              className={toolbarBtnClass}
              onClick={() => prefixLines('## ', 'Heading 2')}
            >
              <i className="hn hn-heading-2-solid text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Heading 3"
              aria-label="Heading 3"
              className={toolbarBtnClass}
              onClick={() => prefixLines('### ', 'Heading 3')}
            >
              <i className="hn hn-heading-3-solid text-sm" aria-hidden="true" />
            </button>

            <span className="w-px h-4 bg-retro-border mx-1" />

            <button
              type="button"
              title="Bold (Ctrl/Cmd+B)"
              aria-label="Bold"
              className={toolbarBtnClass}
              onClick={() => wrapSelection('**', '**', 'bold text')}
            >
              <i className="hn hn-bold text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Italic (Ctrl/Cmd+I)"
              aria-label="Italic"
              className={toolbarBtnClass}
              onClick={() => wrapSelection('*', '*', 'italic text')}
            >
              <i className="hn hn-italics text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Strikethrough"
              aria-label="Strikethrough"
              className={toolbarBtnClass}
              onClick={() => wrapSelection('~~', '~~', 'strikethrough')}
            >
              <i className="hn hn-strike-through text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Inline Code"
              aria-label="Inline Code"
              className={toolbarBtnClass}
              onClick={() => wrapSelection('`', '`', 'code')}
            >
              <i className="hn hn-code text-sm" aria-hidden="true" />
            </button>

            <span className="w-px h-4 bg-retro-border mx-1" />

            <button
              type="button"
              title="Bullet List"
              aria-label="Bullet List"
              className={toolbarBtnClass}
              onClick={() => prefixLines('- ', 'List item')}
            >
              <i className="hn hn-bullet-list text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Numbered List"
              aria-label="Numbered List"
              className={toolbarBtnClass}
              onClick={() => prefixLines('1. ', 'List item')}
            >
              <i className="hn hn-numbered-list text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Task List"
              aria-label="Task List"
              className={toolbarBtnClass}
              onClick={() => prefixLines('- [ ] ', 'Task item')}
            >
              <i className="hn hn-check-list text-sm" aria-hidden="true" />
            </button>

            <span className="w-px h-4 bg-retro-border mx-1" />

            <button
              type="button"
              title="Blockquote"
              aria-label="Blockquote"
              className={toolbarBtnClass}
              onClick={() => prefixLines('> ', 'Quote')}
            >
              <i className="hn hn-quote-left text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Code Block"
              aria-label="Code Block"
              className={toolbarBtnClass}
              onClick={() => insertBlock('```\ncode\n```')}
            >
              <i className="hn hn-code-block text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Insert Table"
              aria-label="Insert Table"
              className={toolbarBtnClass}
              onClick={() =>
                insertBlock('| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |')
              }
            >
              <i className="hn hn-table text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Horizontal Rule"
              aria-label="Horizontal Rule"
              className={toolbarBtnClass}
              onClick={() => insertBlock('---')}
            >
              <i className="hn hn-minus text-sm" aria-hidden="true" />
            </button>

            <span className="w-px h-4 bg-retro-border mx-1" />

            <button
              type="button"
              title="Insert Link (Ctrl/Cmd+K)"
              aria-label="Insert Link"
              className={`${toolbarBtnClass} ${insertPopover === 'link' ? 'bg-retro-bg text-retro-primary border-retro-primary' : ''}`}
              onClick={() => openInsertPopover('link')}
            >
              <i className="hn hn-link text-sm" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Insert Image"
              aria-label="Insert Image"
              className={`${toolbarBtnClass} ${insertPopover === 'image' ? 'bg-retro-bg text-retro-primary border-retro-primary' : ''}`}
              onClick={() => openInsertPopover('image')}
            >
              <i className="hn hn-image text-sm" aria-hidden="true" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center rounded border border-retro-border bg-retro-bg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setMode('write')}
              className={`flex items-center gap-1 px-2 py-1 rounded font-pixel text-[10px] transition-colors cursor-pointer ${
                mode === 'write'
                  ? 'bg-retro-primary text-white'
                  : 'text-retro-muted hover:text-retro-text'
              }`}
            >
              <i className="hn hn-pencil text-[11px]" aria-hidden="true" />
              WRITE
            </button>
            <button
              type="button"
              onClick={() => setMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded font-pixel text-[10px] transition-colors cursor-pointer ${
                mode === 'split'
                  ? 'bg-retro-primary text-white'
                  : 'text-retro-muted hover:text-retro-text'
              }`}
            >
              <i className="hn hn-side-nav-collapse text-[11px]" aria-hidden="true" />
              SPLIT
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1 px-2 py-1 rounded font-pixel text-[10px] transition-colors cursor-pointer ${
                mode === 'preview'
                  ? 'bg-retro-primary text-white'
                  : 'text-retro-muted hover:text-retro-text'
              }`}
            >
              <i className="hn hn-eye text-[11px]" aria-hidden="true" />
              PREVIEW
            </button>
          </div>
        </div>

        {/* Inline Link / Image Insertion Bar */}
        {insertPopover && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-retro-bg/90 border-b border-retro-border">
            <span className="font-pixel text-[10px] text-retro-cyan uppercase">
              {insertPopover === 'image' ? 'INSERT IMAGE' : 'INSERT LINK'}
            </span>
            <input
              type="text"
              value={insertLabel}
              onChange={(e) => setInsertLabel(e.target.value)}
              placeholder={insertPopover === 'image' ? 'Alt text (optional)' : 'Link label'}
              className="px-2 py-1 text-xs rounded bg-retro-surface border border-retro-border text-retro-text font-sans w-40 focus:outline-none focus:border-retro-primary"
            />
            <input
              type="url"
              value={insertUrl}
              onChange={(e) => setInsertUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmInsertMedia()
                } else if (e.key === 'Escape') {
                  setInsertPopover(null)
                }
              }}
              placeholder="https://..."
              autoFocus
              className="flex-1 min-w-[200px] px-2 py-1 text-xs rounded bg-retro-surface border border-retro-border text-retro-text font-sans focus:outline-none focus:border-retro-primary"
            />
            <button
              type="button"
              onClick={confirmInsertMedia}
              disabled={!insertUrl.trim()}
              className="px-2.5 py-1 rounded bg-retro-primary text-white font-pixel text-[10px] disabled:opacity-40 cursor-pointer"
            >
              INSERT
            </button>
            <button
              type="button"
              onClick={() => setInsertPopover(null)}
              className="px-2 py-1 rounded border border-retro-border text-retro-muted hover:text-retro-text font-pixel text-[10px] cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Editor & Live Preview Panes */}
        <div
          className={`grid ${
            mode === 'split' ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-retro-border' : 'grid-cols-1'
          }`}
        >
          {(mode === 'write' || mode === 'split') && (
            <div className="min-w-0 bg-retro-bg">
              <CodeMirror
                ref={editorRef}
                value={value}
                onChange={onChange}
                theme={retroEditorTheme}
                extensions={extensions}
                placeholder={placeholder}
                minHeight={minHeight}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  highlightActiveLine: true,
                  bracketMatching: true,
                }}
              />
            </div>
          )}

          {(mode === 'preview' || mode === 'split') && (
            <div
              className="min-w-0 bg-retro-bg/40 p-4 overflow-y-auto"
              style={{ minHeight, maxHeight: mode === 'split' ? '560px' : undefined }}
            >
              {renderPreview ? (
                renderPreview(value)
              ) : (
                <MarkdownView content={value} fallbackText={previewFallbackText} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
