# Layout Inventory

Structural elements verified on each screen via Playwright browser automation.
The color scheme (SLDS vs Primer) changes visual styling, but the layout
structure (element counts, content hierarchy, page regions) must be preserved.

## Admin Pages (Updated: Sidebar Navigation Layout)

All admin pages use a new sidebar navigation layout with:
- Global header: "Project Lightwing Admin" brand, session info, Sign Out, color mode selector
- Sidebar: `NavList` with Dashboard, Events & Races, Users, Teams, and "Back to Portal" link
- Footer: "Project Lightwing Admin — Authorized access only"

### Admin Dashboard (/admin/)

Expected elements:
- Header with brand text and color mode selector
- Sidebar navigation showing: Dashboard, Events & Races, Users, Teams, Back to Portal
- Main content: "Active Administrator Session" heading
- "Events & Race Management" section with "Manage Events" link
- "User Administration" section with "Manage Users" link
- "Teams & Organizations" section with "Manage Teams" link
- Footer with authorization notice
- No redundant title/subtitle block (removed)

### Admin Events List (/admin/events)

Expected elements:
- Sidebar navigation (same as all admin pages)
- Main content: "Competition Events" heading (inline, no PageHeader title/subtitle)
- "Refresh" button and "Create Event" button (inline in card header)
- Event list cards or empty state
- Pagination controls
- Event creation dialog with all form fields

### Admin Event Detail (/admin/events/$eventId)

Expected elements:
- Sidebar navigation (same as all admin pages)
- "← Back to Events" button (inline in content)
- Event name heading
- Event status badge and description
- Event Operations inner navigation: Event Summary, Event Members, Races & Tracks, Datasets
- Scoring tables (OP, GIII, GII, GI)
- Leaderboard table

### Admin Users List (/admin/users)

Expected elements:
- Sidebar navigation
- Main content: "Registered System Competitors" heading (inline)
- Search field
- User table with columns: VRChat Username, Discord Name, Site Role, Class Tier, Team Affiliations, Actions
- Pagination controls

### Admin Users Detail (/admin/users/$userId)

Expected elements:
- Sidebar navigation
- User profile form with all identity/system fields

### Admin Teams List (/admin/teams)

Expected elements:
- Sidebar navigation
- Main content: "Registered Organization Teams" heading (inline)
- "New Team" button (inline)
- Search field
- Team table with columns: Team Name, Unique Slug, Members, Admin Slots Remaining, Actions

### Admin Team Detail (/admin/teams/$teamId)

Expected elements:
- Sidebar navigation
- Team detail form with demographics and role management

## Non-Admin Pages (unchanged)

### Public Events List (/events)

Expected elements:
- Header: "LIGHTWING" brand, nav links (Home, Events), Sign In, color mode selector
- Main content: "Competitive Events" h1 heading
- Event cards with name, status badge, scoring type, class, races, members
- Pagination controls

### Auth Page (/auth)

Expected elements:
- "Sign in to Lightwing" heading
- "Continue with Discord" button

### Onboarding Page (/onboarding)

Expected elements:
- VRChat username input with placeholder
- "Continue to Events" button

### Profile Page (/profile)

Expected elements:
- "Edit Profile" heading
- Form fields: Name, Handle, Biography, Career Overview, VRChat Username
- "Save Changes" button

### Event Detail (/events/$eventId)

Expected elements:
- "Back to Events" button
- Event name heading
- Status badge
- Races section with race names (e.g., "Summer Sprint Turf")
