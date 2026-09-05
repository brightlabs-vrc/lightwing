package auth

import (
	"regexp"
)

// permissions.go: RBAC role/permission matrix.
// Single source of truth for authorization rules, free of framework imports
// so other services can reuse the same permission checks.
//
// Source: ts-legacy/auth/permissions.ts

// Resource is a protected resource name.
type Resource string

const (
	ResourceOrganization Resource = "organization"
	ResourceMember       Resource = "member"
	ResourceInvitation   Resource = "invitation"
	ResourceEvent        Resource = "event"
	ResourceRaceEvent    Resource = "raceEvent"
	ResourceRaceResult   Resource = "raceResult"
)

// Action is a CRUD action string.
type Action string

const (
	ActionRead   Action = "read"
	ActionCreate Action = "create"
	ActionUpdate Action = "update"
	ActionDelete Action = "delete"
)

// SiteRoleName is the global (non-organization) privilege axis.
type SiteRoleName string

const (
	SiteRoleUser      SiteRoleName = "USER"
	SiteRoleSiteAdmin SiteRoleName = "SITE_ADMIN"
)

const siteAdminRoleName = "SITE_ADMIN"

// isSiteAdmin returns true when the supplied global site role has platform-wide
// administrator rights.
//
// Mirrors ts-legacy/auth/permissions.ts isSiteAdmin
func isSiteAdmin(siteRole SiteRoleName) bool {
	return siteRole == SiteRoleSiteAdmin
}

// administratorRole is the org-level role name for organization administrators.
const administratorRole = "administrator"

// memberRole is the default org-level role name.
const memberRole = "member"

// administratorRoleLimit is the max number of admins per org (issue #6).
const administratorRoleLimit = 3

// roleStatement maps a resource to the list of actions the role can perform.
type roleStatement map[Resource][]Action

// roleStatements is the RBAC permission matrix.
// Mirrors ts-legacy/auth/permissions.ts roleStatements
var roleStatements = map[string]roleStatement{
	administratorRole: {
		ResourceOrganization: {ActionRead, ActionUpdate, ActionDelete},
		ResourceMember:       {ActionRead, ActionCreate, ActionUpdate, ActionDelete},
		ResourceInvitation:   {ActionRead, ActionCreate, ActionUpdate, ActionDelete},
		ResourceEvent:        {ActionRead, ActionCreate, ActionUpdate, ActionDelete},
		ResourceRaceEvent:    {ActionRead, ActionCreate, ActionUpdate, ActionDelete},
		ResourceRaceResult:   {ActionRead, ActionCreate, ActionUpdate, ActionDelete},
	},
	memberRole: {
		ResourceOrganization: {ActionRead},
		ResourceMember:       {ActionRead},
		ResourceInvitation:   {ActionRead},
		ResourceEvent:        {ActionRead},
		ResourceRaceEvent:    {ActionRead},
		ResourceRaceResult:   {ActionRead},
	},
}

// roleHasPermission checks whether a role grants a given action on a resource.
// Unknown roles and resources are denied.
//
// Mirrors ts-legacy/auth/permissions.ts roleHasPermission
func roleHasPermission(role string, resource Resource, action Action) bool {
	statements, ok := roleStatements[role]
	if !ok {
		return false
	}
	actions, ok := statements[resource]
	if !ok {
		return false
	}
	for _, a := range actions {
		if a == action {
			return true
		}
	}
	return false
}

// validSlugRe matches team slug format: ^[a-z0-9]+(?:-[a-z0-9]+)*$
var validSlugRe = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// userSlugRe matches user slug format: ^[a-z0-9]+$
var userSlugRe = regexp.MustCompile(`^[a-z0-9]+$`)

// RESERVED_SLUGS is the set of URL-path segments reserved by the frontend
// router. These can never be used as user or team slugs.
//
// Source: ts-legacy/lib/slugs.ts RESERVED_SLUGS
var RESERVED_SLUGS = map[string]bool{
	"admin":       true,
	"api":         true,
	"events":      true,
	"teams":       true,
	"users":       true,
	"settings":    true,
	"login":       true,
	"auth":        true,
	"profile":     true,
	"onboarding":  true,
	"admin-panel": true,
	"dashboard":   true,
	"help":        true,
	"support":     true,
	"status":      true,
}

func isReservedSlug(slug string) bool {
	return RESERVED_SLUGS[slug]
}
