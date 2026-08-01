import type { eventmanager } from '../lib/client'

interface RaceListButtonProps {
  race: eventmanager.RaceEventDetail
  isSelected: boolean
  label: string
  onSelect: () => void
}

export function RaceListButton({ race, isSelected, label, onSelect }: RaceListButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="slds-button slds-button_neutral"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        background: isSelected ? '#0176d3' : '#ffffff',
        color: isSelected ? '#ffffff' : '#0176d3',
        fontWeight: isSelected ? 'bold' : 'normal',
        border: isSelected ? '1px solid #0176d3' : '1px solid #dddbda',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        #{race.sequence}. {race.name}
      </span>
      <span style={{ fontSize: '10px', opacity: 0.85 }}>{label}</span>
    </button>
  )
}
