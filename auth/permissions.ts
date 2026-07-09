// Single source of truth for the RBAC role/permission matrix used by the
// better-auth organization access-control plugin (see ./auth.ts) and by the
// event management service to gate mutating endpoints. Keeping the statements
// here — free of any better-auth imports — lets other services reuse the same
// authorization rules without pulling in the auth runtime.

export type Resource = "organization" | "member" | "invitation" | "event";
export type Action = "read" | "create" | "update" | "delete";

export const administratorRole = "administrator";
export const eventAdministratorRole = "eventAdministrator";
export const organizationAdministratorRole = "organizationAdministrator";
export const memberRole = "member";

// An organization may have at most three administrators (issue #6). Members are
// uncapped.
export const administratorRoleLimit = 3;

export const roleStatements = {
  administrator: {
    organization: ["read", "update", "delete"],
    member: ["read", "create", "update", "delete"],
    invitation: ["read", "create", "update", "delete"],
    event: ["read", "create", "update", "delete"],
  },
  eventAdministrator: {
    organization: ["read"],
    member: ["read"],
    invitation: ["read"],
    event: ["read", "create", "update", "delete"],
  },
  organizationAdministrator: {
    organization: ["read"],
    member: ["read", "create", "update"],
    invitation: ["read", "create"],
    event: ["read"],
  },
  member: {
    organization: ["read"],
    member: ["read"],
    invitation: ["read"],
    event: ["read"],
  },
} as const satisfies Record<string, Record<Resource, readonly Action[]>>;

export function roleHasPermission(
  role: string,
  resource: Resource,
  action: Action,
): boolean {
  const statements = roleStatements[role as keyof typeof roleStatements];
  if (!statements) {
    return false;
  }
  return (statements[resource] as readonly Action[]).includes(action);
}
