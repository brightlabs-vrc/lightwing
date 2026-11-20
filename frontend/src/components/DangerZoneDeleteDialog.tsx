import React, { useState } from 'react'
import { Button, Dialog, Flash, FormControl, TextInput } from '@primer/react'
import { AlertIcon, TrashIcon } from '@primer/octicons-react'

interface DangerZoneDeleteDialogProps {
  /** Controlled open state. When omitted, renders a Danger Zone card with an internal trigger button. */
  isOpen?: boolean
  onClose?: () => void
  /** Entity kind label, e.g., "user", "organization", "team" */
  entityType: 'user' | 'organization' | 'team'
  /** Human-readable display name of the entity */
  entityName: string
  /** Exact string the admin must type to unlock deletion (e.g., slug or username) */
  confirmText: string
  /** Bullet list or paragraph explaining what will be permanently deleted */
  consequences: string[]
  /** Async deletion callback */
  onConfirmDelete: () => Promise<void>
  /** Optional description shown on the inline Danger Zone card */
  cardDescription?: string
  /** Optional custom button label */
  buttonLabel?: string
  /** Optional disabled state for the trigger button */
  disabled?: boolean
}

export function DangerZoneDeleteDialog({
  isOpen: controlledOpen,
  onClose: controlledClose,
  entityType,
  entityName,
  confirmText,
  consequences,
  onConfirmDelete,
  cardDescription,
  buttonLabel,
  disabled = false,
}: DangerZoneDeleteDialogProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const [typedValue, setTypedValue] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = isControlled ? controlledOpen : internalOpen

  const handleClose = () => {
    if (deleting) return
    setTypedValue('')
    setError(null)
    if (isControlled) {
      controlledClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  const handleOpen = () => {
    setTypedValue('')
    setError(null)
    setInternalOpen(true)
  }

  const isMatch = typedValue.trim() === confirmText.trim()

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isMatch || deleting) return
    setDeleting(true)
    setError(null)
    try {
      await onConfirmDelete()
      setTypedValue('')
      if (isControlled) {
        controlledClose?.()
      } else {
        setInternalOpen(false)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to delete ${entityType}`)
    } finally {
      setDeleting(false)
    }
  }

  const entityTitle =
    entityType === 'user'
      ? 'User Account'
      : entityType === 'organization'
      ? 'Organization'
      : 'Competitive Team'

  return (
    <>
      {!isControlled && (
        <section
          aria-label="Danger Zone"
          style={{
            border: '1px solid var(--borderColor-danger-emphasis, #cf222e)',
            borderRadius: '6px',
            backgroundColor: 'var(--bgColor-default, #ffffff)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)',
              borderBottom: '1px solid var(--borderColor-danger-muted, rgba(255, 129, 130, 0.4))',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertIcon size={16} fill="var(--fgColor-danger, #d1242f)" />
            <h3
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--fgColor-danger, #d1242f)',
              }}
            >
              Danger Zone
            </h3>
          </div>

          <div
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
                Delete this {entityType}
              </div>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: 'var(--fgColor-muted, #636c76)',
                  lineHeight: 1.5,
                }}
              >
                {cardDescription ||
                  `Once you delete this ${entityType}, there is no going back. Please be certain.`}
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              leadingVisual={TrashIcon}
              disabled={disabled}
              onClick={handleOpen}
            >
              {buttonLabel || `Delete ${entityTitle}`}
            </Button>
          </div>
        </section>
      )}

      {open && (
        <Dialog
          title={`Delete ${entityTitle}: ${entityName}`}
          onClose={handleClose}
          width="medium"
        >
          <form onSubmit={(e) => void handleConfirm(e)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Flash variant="danger">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertIcon size={16} />
                  <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                    <strong>Unexpected bad things will happen if you don&apos;t read this!</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      This action <strong>cannot be undone</strong>. This will permanently delete{' '}
                      <strong>{entityName}</strong> and cascade remove the following data:
                    </p>
                  </div>
                </div>
              </Flash>

              {consequences.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '13px',
                    color: 'var(--fgColor-muted, #636c76)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {consequences.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}

              {error && (
                <Flash variant="danger">
                  <span style={{ fontSize: '13px' }}>{error}</span>
                </Flash>
              )}

              <FormControl required>
                <FormControl.Label>
                  To confirm, type <code style={{ fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bgColor-neutral-muted, rgba(175, 184, 193, 0.2))' }}>{confirmText}</code> in the box below
                </FormControl.Label>
                <TextInput
                  block
                  autoFocus
                  value={typedValue}
                  onChange={(e) => setTypedValue(e.target.value)}
                  placeholder={confirmText}
                  disabled={deleting}
                />
              </FormControl>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--borderColor-muted, #d8dee4)',
                }}
              >
                <Button type="button" onClick={handleClose} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={!isMatch || deleting}
                >
                  {deleting
                    ? `Deleting ${entityType}...`
                    : `I understand, delete this ${entityType}`}
                </Button>
              </div>
            </div>
          </form>
        </Dialog>
      )}
    </>
  )
}
