# Layout Inventory

Structural elements verified on each screen. The color scheme (SLDS vs Primer)
changes visual styling, but the layout structure (element counts, content
hierarchy, page regions) must remain identical.

## Screens

### 1. Auth Page (/auth)
- Heading: "Sign in to Lightwing"
- Description: "Continue to" + redirect path
- Mock mode notice text
- Primary button: "Continue with Discord"

### 2. Home Page (/)
- Banner with brand "LIGHTWING" + nav links
- Main: heading + active event count
- Event cards with heading, description, tag, detail lines
- Pagination with rows-per-page selector

### 3. Public Events List (/events)
- Same as Home but dedicated events route
- Banner, main with "Competitive Events" heading
- Event list items with status badges
- Pagination controls

### 4. Profile Page (/profile)
- Banner with brand + nav
- Main: "Edit Profile" form heading
- Form fields: Name, Email/Username, Discord info
- Save/Cancel buttons

### 5. Onboarding Page (/onboarding)
- Banner
- Main: "VRChat Account Linking" heading
- VRChat username input field
- Primary button to proceed

### 6. Event Detail (Public) (/events/$eventId)
- Banner with brand + nav + color mode
- Back button
- Event name heading
- Event status badge
- Tab navigation (Summary, Members, Races, Scoring)
- Race list or detail pane

### 7. Admin Dashboard (/admin/)
- Admin banner: "Project Lightwing Admin" brand
- Session info: "Signed in as" + user name + role
- Sign Out button + color mode selector
- Admin navigation: Home, Events & Races, Users, Teams, Back to Portal
- Main: "Admin Dashboard" heading
- Section cards: Events & Race Management, User Administration, Teams & Organizations
- Each card has heading, description, and "Manage" button

### 8. Admin Events (/admin/events)
- Admin banner + navigation
- "Event & Race Operations" heading
- Description text
- Action buttons: Refresh, Create Event
- Event list (cards or table)
- Pagination

### 9. Admin Users (/admin/users)
- Admin banner + navigation
- "User Account Directory" heading
- Description text
- Search field
- Table: VRChat Username, Discord Name, Site Role, Class Tier, Teams, Actions
- Pagination

### 10. Admin Teams (/admin/teams)
- Admin banner + navigation
- "Team Directory" heading
- "New Team" button
- Search field
- Table: Team Name, Unique Slug, Members, Admin Slots, Actions
- Pagination

### 11. Admin Event Detail (/admin/events/$eventId)
- Admin banner + navigation
- "Event & Race Operations" heading
- Back to Events link
- Event status with lifecycle info
- Event name heading
- Edit Details + Recompute Points buttons
- Event ID, Signups status, Lifecycle dropdown
- Tabbed navigation: Event Summary, Event Members, Races & Tracks, Datasets
- Summary sections: Description, Scoring Configuration, Owner Parameters,
  Class Restriction, Participation Model, Signups Status
- Scoring tables for each Grade
- Overall leaderboard table
