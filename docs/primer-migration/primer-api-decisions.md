# Primer API Decisions

## Theme Management

- **`ThemeProvider`** from `@primer/react` (v38): wraps the app and injects
  `data-color-mode="light|dark"` attribute on a wrapping div.
- **`useColorMode`** hook (custom, `frontend/src/hooks/useColorMode.tsx`):
  provides `colorMode` ('light'|'dark'|'system'), `resolvedColorMode`
  ('light'|'dark'), and `setColorMode`. Persists to `localStorage`.
- **`ColorModeSelector`** component (`ThemeAndStatus.tsx`): uses
  `ActionMenu` + `ActionList` with `SunIcon`, `MoonIcon`, `CpuIcon` from
  `@primer/octicons-react`.

## CSS Color Variables

In `@primer/react` v38, the `ThemeProvider` provides theme values via React
context (CSS-in-JS), but components also use raw CSS custom properties
(`var(--color-canvas-default)`, `var(--color-fg-default)`, etc.) in inline
styles. These variables must be defined in `styles.css`, scoped under
`[data-color-mode='light']` and `[data-color-mode='dark']` selectors.

## Components Used

| Component | Import Source |
|-----------|--------------|
| Header, PageLayout, ActionMenu, ActionList | `@primer/react` |
| Button, ButtonPrimaryAction | `@primer/react` |
| Text, Heading, Box, Flex | `@primer/react` |
| Table, Tr, Th, Td, Tbody, Thead | `@primer/react` |
| TextInput, Select, Checkbox, Toggle | `@primer/react` |
| Avatar, AvatarStack | `@primer/react` |
| Badge, LabelText, Spinner | `@primer/react` |
| Dialog (modal) | `@primer/react` |
| TabNav | `@primer/react` |
| Octicon icons | `@primer/octicons-react` |

## Not Imported

- `@primer/react-brand` — listed as dependency in primer branch but never
  imported. Not added to reduce bundle size.
