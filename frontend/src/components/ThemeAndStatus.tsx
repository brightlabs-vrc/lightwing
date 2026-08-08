import React from 'react'
import { ThemeProvider, ActionMenu, ActionList } from '@primer/react'
import { SunIcon, MoonIcon, CpuIcon } from '@primer/octicons-react'
import { useColorMode } from '../hooks/useColorMode'

export const ColorModeSelector: React.FC = () => {
  const { colorMode, setColorMode } = useColorMode()

  const items = [
    { value: 'light' as const, label: 'Light', icon: SunIcon },
    { value: 'dark' as const, label: 'Dark', icon: MoonIcon },
    { value: 'system' as const, label: 'System', icon: CpuIcon },
  ]

  const active = items.find((i) => i.value === colorMode) || items[2]
  const ActiveIcon = active.icon

  return (
    <ActionMenu>
      <ActionMenu.Button leadingVisual={ActiveIcon} size="small">
        {active.label}
      </ActionMenu.Button>
      <ActionMenu.Overlay>
        <ActionList selectionVariant="single">
          {items.map((item) => (
            <ActionList.Item
              key={item.value}
              selected={item.value === colorMode}
              onSelect={() => setColorMode(item.value)}
            >
              <ActionList.LeadingVisual>
                <item.icon />
              </ActionList.LeadingVisual>
              {item.label}
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  )
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedColorMode } = useColorMode()

  return (
    <ThemeProvider colorMode={resolvedColorMode}>
      {children}
    </ThemeProvider>
  )
}
