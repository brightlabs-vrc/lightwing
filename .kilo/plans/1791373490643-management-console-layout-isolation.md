# Management Console Layout Isolation

## Decision
Create a `-ManagementLayout.tsx` isolated layout wrapper for `/teams/new` and `/teams/manage/$id`, mirroring the admin pattern where `__root.tsx` bypasses the public header for console routes.

## Rationale
- Eliminates double header: public root layout injects the public nav, then each page renders its own "MANAGEMENT CONSOLE" inline header
- Org switcher and tab navigation (Overview / Events / Approvals) belong in a persistent layout header, not repeated per page
- Follows established admin isolation pattern (`isAdminArea` check in `__root.tsx`)
- Retro `pxlkit` styling preserved — only chrome changes

## Changes

### 1. Bypass public header in `__root.tsx`
Add a `isManagementArea` check alongside the existing `isAdminArea` check so console routes render only `<Outlet />` without the public header/footer.

### 2. Create `-ManagementLayout.tsx`
New file at `frontend/src/routes/teams/-ManagementLayout.tsx`:
- Persistent header: "MANAGEMENT CONSOLE" brand + org switcher dropdown + PUBLIC SITE / ADMIN PANEL / SIGN OUT
- Tab context bar: Overview & Roster / Events & Races / Team Approvals
- `<Outlet />` for page content
- Retro `pxlkit` styling (`PixelContainer`, `PixelStack`, `PixelButton`, etc.)

### 3. Wire `-ManagementLayout.tsx` into routes
- `teams/new.tsx` — wrap in `-ManagementLayout.tsx`
- `teams/manage.$id.tsx` — remove inline header, rely on layout header + tab bar

### 4. Remove inline headers
Delete the inline header blocks from `teams/new.tsx` and `teams/manage.$id.tsx` (org switcher, PUBLIC SITE button, SIGN OUT — now in layout).

## Rollout
- Layout is additive; no route signature changes
- No database or API changes
- Pure frontend refactor — safe to deploy atomically

## Validation
- Navigate to `/teams/new` and `/teams/manage/$id` — confirm public header is gone, layout header appears
- Confirm tab navigation and org switcher function correctly
- Confirm public pages (`/`, `/events`, `/leaderboard`, `/profile`) still render public header
