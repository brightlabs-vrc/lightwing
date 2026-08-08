import type { eventmanager } from '../lib/client'
import { Button } from '@primer/react'

interface RaceListButtonProps {
  race: eventmanager.RaceEventDetail
  isSelected: boolean
  label: string
  onSelect: () => void
}

export function RaceListButton({ race, isSelected, label, onSelect }: RaceListButtonProps) {
  return (
    <Button
      onClick={onSelect}
      variant={isSelected ? 'primary' : 'default'}
      style={{
        width: '100%',
        textAlign: 'left',
        justifyContent: 'space-between',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        fontWeight: isSelected ? 'bold' : 'normal',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
        #{race.sequence}. {race.name}
      </span>
      <span style={{ fontSize: '10px', opacity: 0.85 }}>{label}</span>
    </Button>
  )
}
export default RaceListButton
