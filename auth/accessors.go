package auth

import (
	"context"
)

// Additional cross-service accessors for the teammanager service.
// (ResolveActor/RequirePermission/IsSiteAdmin already live in exports.go;
// this file only adds what is missing there without touching it.)

// AdministratorRole is the org-level role name for organization administrators.
const AdministratorRole = administratorRole

// AdministratorRoleLimit is the max number of administrators per organization.
const AdministratorRoleLimit = administratorRoleLimit

// RequireSiteAdmin asserts the caller holds the global SITE_ADMIN role.
func RequireSiteAdmin(ctx context.Context, authorization string) (*Actor, error) {
	return requireSiteAdmin(ctx, authorization)
}

// InvalidateMemberRole drops the cached role for an org membership.
// Called after member add/role-change/remove.
func InvalidateMemberRole(ctx context.Context, organizationID, userID string) error {
	if memberRoleCache == nil {
		return nil
	}
	_, err := memberRoleCache.Delete(ctx, memberRoleCacheKey{Key: organizationID + ":" + userID})
	return err
}
