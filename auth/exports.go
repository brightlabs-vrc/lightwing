package auth

import (
	"context"
)

// Exported wrappers over the internal RBAC helpers for use by other
// services (e.g. eventmanager). The logic lives in rbac.go / permissions.go;
// these aliases only widen visibility without changing behavior.
func ResolveActor(ctx context.Context, token string) (*Actor, error) {
	return resolveActor(ctx, token)
}

func RequirePermission(ctx context.Context, actor *Actor, organizationId string, resource Resource, action Action) (*Actor, string, error) {
	return requirePermission(ctx, actor, organizationId, resource, action)
}

func RequireEventPermission(ctx context.Context, actor *Actor, eventId string, action Action) (*Actor, error) {
	return requireEventPermission(ctx, actor, eventId, action)
}

func IsSiteAdmin(siteRole SiteRoleName) bool {
	return isSiteAdmin(siteRole)
}

func IsEventAdmin(siteRole SiteRoleName) bool {
	return isEventAdmin(siteRole)
}
