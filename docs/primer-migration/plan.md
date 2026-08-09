# Primer UI Migration Plan

## Overview

Migrate the Lightwing frontend from legacy SLDS (Salesforce Lightning Design System),
@pxlkit/core, and Tailwind CSS to @primer/react, while preserving all routes,
data contracts, and user-facing behavior.

## Stages

| Stage | Description | Success Criteria |
|-------|-------------|-----------------|
| 1 | Baseline capture | Legacy screenshots on clean `main` for 9 screens |
| 2 | Review reference | Analyze `origin/refactor/primer-ui-unification` branch |
| 3 | Foundation | Primer deps installed, ThemeProvider wired, CSS variables defined |
| 4 | Public routes | Auth, onboarding, profile, events, event detail migrated |
| 5 | Admin routes | AdminLayout + all /admin/* routes migrated |
| 6 | Shared components | All UI components migrated to Primer primitives |
| 7 | Verification | Typecheck, build, frontend tests, backend tests pass |
| 8 | Layout parity | Playwright structural comparison confirms behavior parity |

## Key Decisions

- Use `@primer/react@38.35.0` + `@primer/octicons-react@19.33.0` (no react-brand)
- Import Primer components directly (Header, Button, Text, Box, etc.)
- No generic wrapper components (no AppButton, AppCard, AppField)
- Define CSS color variables in styles.css for dark/light/system modes
- Use `ThemeProvider` for color mode management with `ThemeProvider` from `@primer/react`

## Verification

- `pnpm typecheck` — TypeScript with strict mode
- `pnpm build` — Vite production build
- `npx vitest run` — Frontend unit tests (13/13)
- `encore test` — Full test suite including backend (110/110)
- `npx playwright test` — Layout parity tests (9/9)
