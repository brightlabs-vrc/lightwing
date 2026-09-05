package auth

import (
	"context"
)

// Exported wrappers over the internal RBAC helpers for use by other
// services (e.g. eventmanager). The logic lives in rbac.go / permissions.go;
// these aliases only widen visibility without changing behavior.
func ResolveActor(ctx context.Context, authorization string) (*Actor, error) {
	return resolveActor(ctx, authorization)
}

func RequirePermission(ctx context.Context, authorization string, organizationId string, resource Resource, action Action) (*Actor, string, error) {
	return requirePermission(ctx, authorization, organizationId, resource, action)
}

func RequireEventPermission(ctx context.Context, authorization string, eventId string, action Action) (*Actor, error) {
	return requireEventPermission(ctx, authorization, eventId, action)
}

func IsSiteAdmin(siteRole SiteRoleName) bool {
	return isSiteAdmin(siteRole)
}
