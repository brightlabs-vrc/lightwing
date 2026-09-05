-- Organization lookups.

-- name: GetOrgByID :one
SELECT id, name, slug, logo, "rankingAverage", "pointsAverage", "seasonRank", "averagePointsPerEvent"
FROM "organization" WHERE id = $1;

-- name: GetOrgBySlug :one
SELECT id, name, slug, logo, "rankingAverage", "pointsAverage", "seasonRank", "averagePointsPerEvent"
FROM "organization" WHERE slug = $1;

-- name: OrgIDBySlug :one
SELECT id FROM "organization" WHERE slug = $1;

-- name: OrgIDByID :one
SELECT id FROM "organization" WHERE id = $1;

-- name: OrgSlugByID :one
SELECT slug FROM "organization" WHERE id = $1;

-- name: CreateOrg :one
INSERT INTO "organization" (id, name, slug, logo, "updatedAt")
VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING id;

-- name: TouchOrg :exec
UPDATE "organization" SET "updatedAt" = $1 WHERE id = $2;

-- Team listing (search and no-search variants; LIMIT NULL means no limit).

-- name: CountTeams :one
SELECT COUNT(*) FROM "organization";

-- name: CountTeamsBySearch :one
SELECT COUNT(*) FROM "organization"
WHERE name ILIKE '%' || $1::text || '%' OR slug ILIKE '%' || $1::text || '%';

-- name: ListTeamRows :many
SELECT id, name, slug, logo FROM "organization"
ORDER BY name ASC LIMIT NULLIF($1::int, 0) OFFSET $2;

-- name: ListTeamRowsBySearch :many
SELECT id, name, slug, logo FROM "organization"
WHERE name ILIKE '%' || $1::text || '%' OR slug ILIKE '%' || $1::text || '%'
ORDER BY name ASC LIMIT NULLIF($2::int, 0) OFFSET $3;

-- name: CountMembersAndAdmins :one
SELECT COUNT(*), COUNT(*) FILTER (WHERE role = $2)
FROM "member" WHERE "organizationId" = $1;

-- Membership.

-- name: ListMemberRows :many
SELECT m."userId", m.role, u.name, u."vrchatUsername", u.slug
FROM "member" m JOIN "user" u ON u.id = m."userId"
WHERE m."organizationId" = $1 ORDER BY m."createdAt" ASC;

-- name: CountTeamMembers :one
SELECT COUNT(*) FROM "member" m JOIN "user" u ON u.id = m."userId"
WHERE m."organizationId" = $1;

-- name: CountTeamMembersBySearch :one
SELECT COUNT(*) FROM "member" m JOIN "user" u ON u.id = m."userId"
WHERE m."organizationId" = $1
  AND (u.name ILIKE '%' || $2::text || '%' OR u."vrchatUsername" ILIKE '%' || $2::text || '%' OR u.slug ILIKE '%' || $2::text || '%');

-- name: ListTeamMemberRows :many
SELECT m."userId", m.role, u.name, u."vrchatUsername", u.slug
FROM "member" m JOIN "user" u ON u.id = m."userId"
WHERE m."organizationId" = $1 ORDER BY m."createdAt" ASC
LIMIT NULLIF($2::int, 0) OFFSET $3;

-- name: ListTeamMemberRowsBySearch :many
SELECT m."userId", m.role, u.name, u."vrchatUsername", u.slug
FROM "member" m JOIN "user" u ON u.id = m."userId"
WHERE m."organizationId" = $1
  AND (u.name ILIKE '%' || $2::text || '%' OR u."vrchatUsername" ILIKE '%' || $2::text || '%' OR u.slug ILIKE '%' || $2::text || '%')
ORDER BY m."createdAt" ASC
LIMIT NULLIF($3::int, 0) OFFSET $4;

-- name: UserIDByID :one
SELECT id FROM "user" WHERE id = $1;

-- name: MemberIDByOrgAndUser :one
SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2;

-- name: MemberRoleByOrgAndUser :one
SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2;

-- name: InsertMember :exec
INSERT INTO "member" (id, "organizationId", "userId", role)
VALUES (gen_random_uuid()::text, $1, $2, $3);

-- name: UpdateMemberRole :exec
UPDATE "member" SET role = $1 WHERE "organizationId" = $2 AND "userId" = $3;

-- name: DeleteMember :exec
DELETE FROM "member" WHERE "organizationId" = $1 AND "userId" = $2;

-- name: CountAdmins :one
SELECT COUNT(*) FROM "member" WHERE "organizationId" = $1 AND role = $2;
