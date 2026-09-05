package auth

import (
	"testing"
)

// Test_roleHasPermission validates the RBAC permission matrix.
//
// Mirrors ts-legacy/auth/permissions.test.ts
func Test_roleHasPermission(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		resource Resource
		action   Action
		want     bool
	}{
		// Administrator full access
		{"admin read org", administratorRole, ResourceOrganization, ActionRead, true},
		{"admin create org", administratorRole, ResourceOrganization, ActionCreate, false}, // admin can't create
		{"admin update org", administratorRole, ResourceOrganization, ActionUpdate, true},
		{"admin delete org", administratorRole, ResourceOrganization, ActionDelete, true},
		{"admin read member", administratorRole, ResourceMember, ActionRead, true},
		{"admin create member", administratorRole, ResourceMember, ActionCreate, true},
		{"admin update member", administratorRole, ResourceMember, ActionUpdate, true},
		{"admin delete member", administratorRole, ResourceMember, ActionDelete, true},
		{"admin read invitation", administratorRole, ResourceInvitation, ActionRead, true},
		{"admin create invitation", administratorRole, ResourceInvitation, ActionCreate, true},
		{"admin read event", administratorRole, ResourceEvent, ActionRead, true},
		{"admin create event", administratorRole, ResourceEvent, ActionCreate, true},
		{"admin update event", administratorRole, ResourceEvent, ActionUpdate, true},
		{"admin delete event", administratorRole, ResourceEvent, ActionDelete, true},
		{"admin read raceEvent", administratorRole, ResourceRaceEvent, ActionRead, true},
		{"admin create raceEvent", administratorRole, ResourceRaceEvent, ActionCreate, true},
		{"admin read raceResult", administratorRole, ResourceRaceResult, ActionRead, true},

		// Member read-only access
		{"member read org", memberRole, ResourceOrganization, ActionRead, true},
		{"member create org", memberRole, ResourceOrganization, ActionCreate, false}, // member can't create
		{"member update org", memberRole, ResourceOrganization, ActionUpdate, false},
		{"member delete org", memberRole, ResourceOrganization, ActionDelete, false},
		{"member read member", memberRole, ResourceMember, ActionRead, true},
		{"member create member", memberRole, ResourceMember, ActionCreate, false},
		{"member read invitation", memberRole, ResourceInvitation, ActionRead, true},
		{"member read event", memberRole, ResourceEvent, ActionRead, true},
		{"member create event", memberRole, ResourceEvent, ActionCreate, false},
		{"member read raceEvent", memberRole, ResourceRaceEvent, ActionRead, true},
		{"member read raceResult", memberRole, ResourceRaceResult, ActionRead, true},

		// Unknown role
		{"unknown role", "guest", ResourceEvent, ActionRead, false},
		// Unknown resource
		{"unknown resource", administratorRole, "unknown", ActionRead, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := roleHasPermission(tt.role, tt.resource, tt.action)
			if got != tt.want {
				t.Errorf("roleHasPermission(%q, %q, %q) = %v, want %v",
					tt.role, tt.resource, tt.action, got, tt.want)
			}
		})
	}
}

// Test_isSiteAdmin validates site admin detection.
//
// Mirrors ts-legacy/auth/permissions.test.ts → "isSiteAdmin"
func Test_isSiteAdmin(t *testing.T) {
	tests := []struct {
		siteRole SiteRoleName
		want     bool
	}{
		{SiteRoleUser, false},
		{SiteRoleSiteAdmin, true},
		{"", false},
		{"USER", false},
		{"SITE_ADMIN", true},
		{"random", false},
	}

	for _, tt := range tests {
		t.Run(string(tt.siteRole), func(t *testing.T) {
			got := isSiteAdmin(tt.siteRole)
			if got != tt.want {
				t.Errorf("isSiteAdmin(%q) = %v, want %v", tt.siteRole, got, tt.want)
			}
		})
	}
}
