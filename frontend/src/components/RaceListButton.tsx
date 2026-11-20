import { Label } from '@primer/react'
import type { eventmanager } from '../lib/client'

interface RaceListButtonProps {
  race: eventmanager.RaceEventDetail
  isSelected: boolean
  label: string
  onSelect: () => void
}

export function RaceListButton({ race, isSelected, label, onSelect }: RaceListButtonProps) {
  const labelVariant =
    label === 'Live' ? 'success' : label === 'Done' ? 'secondary' : 'accent'

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        backgroundColor: isSelected ? 'var(--bgColor-accent-muted, #ddf4ff)' : 'var(--bgColor-default, #ffffff)',
        color: isSelected ? 'var(--fgColor-accent, #0969da)' : 'var(--fgColor-default, #1f2328)',
        fontWeight: isSelected ? 600 : 400,
        border: isSelected
          ? '1px solid var(--borderColor-accent-emphasis, #0969da)'
          : '1px solid var(--borderColor-default, #d0d7de)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        cursor: 'pointer',
        fontSize: '13px',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        #{race.sequence}. {race.name}
      </span>
      <Label variant={labelVariant} size="small">
        {label}
      </Label>
    </button>
  )
}
