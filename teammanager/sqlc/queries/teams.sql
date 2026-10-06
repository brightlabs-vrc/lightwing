-- Organization lookups and CRUD

-- name: GetOrgByID :one
SELECT id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt", "rankingAverage", "pointsAverage", "seasonRank", "averagePointsPerEvent"
FROM "organization" WHERE id = $1;

-- name: GetOrgBySlug :one
SELECT id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt", "rankingAverage", "pointsAverage", "seasonRank", "averagePointsPerEvent"
FROM "organization" WHERE slug = $1;

-- name: OrgIDBySlug :one
SELECT id FROM "organization" WHERE slug = $1;

-- name: OrgIDByID :one
SELECT id FROM "organization" WHERE id = $1;

-- name: OrgSlugByID :one
SELECT slug FROM "organization" WHERE id = $1;

-- name: CreateOrg :one
INSERT INTO "organization" (id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9) RETURNING id;

-- name: CreateOrgWithID :one
INSERT INTO "organization" (id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10) RETURNING id;

-- name: TouchOrg :exec
UPDATE "organization" SET "updatedAt" = $1 WHERE id = $2;

-- name: UpdateOrg :exec
UPDATE "organization"
SET "slug" = sqlc.arg('slug'),
    "updatedAt" = sqlc.arg('updated_at'),
    "name" = COALESCE(sqlc.narg('name'), "name"),
    "logo" = CASE WHEN sqlc.arg('clear_logo')::boolean THEN NULL ELSE COALESCE(sqlc.narg('logo'), "logo") END
WHERE id = sqlc.arg('id');

-- name: UpdateOrgStatus :exec
UPDATE "organization"
SET status = $1, "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $2;

-- name: ListApprovedOrgs :many
SELECT id, name, slug, logo, "orgType", status
FROM "organization"
WHERE status = 'APPROVED'
ORDER BY name ASC;

-- name: ListPendingOrgs :many
SELECT id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt"
FROM "organization"
WHERE status = 'PENDING'
ORDER BY "createdAt" ASC;

-- Team listing and CRUD

-- name: CountTeams :one
SELECT COUNT(*) FROM "team" WHERE status = 'APPROVED';

-- name: CountTeamsBySearch :one
SELECT COUNT(*) FROM "team"
WHERE status = 'APPROVED' AND (name ILIKE '%' || $1::text || '%' OR slug ILIKE '%' || $1::text || '%');

-- name: ListTeamRows :many
SELECT id, name, slug, logo, status FROM "team"
WHERE status = 'APPROVED'
ORDER BY name ASC LIMIT NULLIF($1::int, 0) OFFSET $2;

-- name: ListTeamRowsBySearch :many
SELECT id, name, slug, logo, status FROM "team"
WHERE status = 'APPROVED' AND (name ILIKE '%' || $1::text || '%' OR slug ILIKE '%' || $1::text || '%')
ORDER BY name ASC LIMIT NULLIF($2::int, 0) OFFSET $3;

-- name: GetTeamByID :one
SELECT id, name, slug, logo, status, "submittedByUserId", "reviewedByUserId", "reviewedAt", "createdAt", "updatedAt"
FROM "team" WHERE id = $1;

-- name: GetTeamBySlug :one
SELECT id, name, slug, logo, status, "submittedByUserId", "reviewedByUserId", "reviewedAt", "createdAt", "updatedAt"
FROM "team" WHERE slug = $1;

-- name: TeamIDBySlug :one
SELECT id FROM "team" WHERE slug = $1;

-- name: TeamSlugByID :one
SELECT slug FROM "team" WHERE id = $1;

-- name: CreateTeam :one
INSERT INTO "team" (id, name, slug, logo, status, "submittedByUserId", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id;

-- name: UpdateTeam :exec
UPDATE "team"
SET "slug" = sqlc.arg('slug'),
    "updatedAt" = sqlc.arg('updated_at'),
    "name" = COALESCE(sqlc.narg('name'), "name"),
    "logo" = CASE WHEN sqlc.arg('clear_logo')::boolean THEN NULL ELSE COALESCE(sqlc.narg('logo'), "logo") END
WHERE id = sqlc.arg('id');

-- name: UpdateTeamStatus :exec
UPDATE "team"
SET status = sqlc.arg('status'),
    "reviewedByUserId" = sqlc.arg('reviewedByUserId'),
    "reviewedAt" = sqlc.arg('reviewedAt'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');

-- name: ListPendingTeams :many
SELECT id, name, slug, logo, status, "submittedByUserId", "createdAt", "updatedAt"
FROM "team"
WHERE status = 'PENDING'
ORDER BY "createdAt" ASC;

-- teamOrganization queries

-- name: InsertTeamOrganization :exec
INSERT INTO "teamOrganization" ("teamId", "organizationId", "isPrimary", "createdAt")
VALUES ($1, $2, $3, CURRENT_TIMESTAMP);

-- name: DeleteTeamOrganization :exec
DELETE FROM "teamOrganization"
WHERE "teamId" = $1 AND "organizationId" = $2;

-- name: DeleteTeamOrganizationsForTeam :exec
DELETE FROM "teamOrganization"
WHERE "teamId" = $1;

-- name: DeleteTeamMembersForTeam :exec
DELETE FROM "teamMember"
WHERE "teamId" = $1;

-- name: DeleteTeam :exec
DELETE FROM "team"
WHERE id = $1;

-- name: UpdateOrgDetails :exec
UPDATE "organization"
SET "slug" = sqlc.arg('slug'),
    "updatedAt" = sqlc.arg('updated_at'),
    "name" = COALESCE(sqlc.narg('name'), "name"),
    "logo" = CASE WHEN sqlc.arg('clear_logo')::boolean THEN NULL ELSE COALESCE(sqlc.narg('logo'), "logo") END,
    "discordInvite" = COALESCE(sqlc.narg('discord_invite'), "discordInvite"),
    "vrchatGroupId" = COALESCE(sqlc.narg('vrchat_group_id'), "vrchatGroupId")
WHERE id = sqlc.arg('id');

-- name: CountAdminOrgs :one
SELECT COUNT(*) FROM "organization";

-- name: CountAdminOrgsBySearch :one
SELECT COUNT(*) FROM "organization"
WHERE name ILIKE '%' || $1::text || '%' OR slug ILIKE '%' || $1::text || '%';

-- name: ListAdminOrgs :many
SELECT id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt"
FROM "organization"
ORDER BY name ASC
LIMIT NULLIF($1::int, 0) OFFSET $2;

-- name: ListAdminOrgsBySearch :many
SELECT id, name, slug, logo, "orgType", status, "discordInvite", "vrchatGroupId", "submittedByUserId", "createdAt", "updatedAt"
FROM "organization"
WHERE name ILIKE '%' || $1::text || '%' OR slug ILIKE '%' || $1::text || '%'
ORDER BY name ASC
LIMIT NULLIF($2::int, 0) OFFSET $3;

-- name: GetPrimaryOrgForTeam :one
SELECT o.id, o.name, o.slug, o.logo, o."orgType", o.status
FROM "organization" o
JOIN "teamOrganization" tor ON o.id = tor."organizationId"
WHERE tor."teamId" = $1 AND tor."isPrimary" = true;

-- name: ListOrgsForTeam :many
SELECT o.id, o.name, o.slug, o.logo, o."orgType", o.status, tor."isPrimary"
FROM "organization" o
JOIN "teamOrganization" tor ON o.id = tor."organizationId"
WHERE tor."teamId" = $1
ORDER BY tor."isPrimary" DESC, o.name ASC;

-- name: ListOrgsForTeamsBatch :many
SELECT tor."teamId", o.id, o.name, o.slug, o.logo, o."orgType", o.status, tor."isPrimary"
FROM "organization" o
JOIN "teamOrganization" tor ON o.id = tor."organizationId"
WHERE tor."teamId" = ANY($1::text[])
ORDER BY tor."isPrimary" DESC, o.name ASC;

-- name: ListTeamsForOrg :many
SELECT t.id, t.name, t.slug, t.logo, t.status, tor."isPrimary"
FROM "team" t
JOIN "teamOrganization" tor ON t.id = tor."teamId"
WHERE tor."organizationId" = $1
ORDER BY t.name ASC;

-- name: CheckTeamOrgLink :one
SELECT "isPrimary" FROM "teamOrganization"
WHERE "teamId" = $1 AND "organizationId" = $2;

-- Member / Roster queries for Organization (`member` table)

-- name: CountMembersAndAdmins :one
SELECT COUNT(*), COUNT(*) FILTER (WHERE role = $2)
FROM "member" WHERE "organizationId" = $1;

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

-- name: BatchCountMembersAndAdmins :many
SELECT "organizationId", COUNT(*), COUNT(*) FILTER (WHERE role = $1)
FROM "member"
WHERE "organizationId" = ANY($2::text[])
GROUP BY "organizationId";

-- Member / Roster queries for Team (`teamMember` table)

-- name: InsertTeamMemberRow :exec
INSERT INTO "teamMember" (id, "teamId", "userId", role)
VALUES (gen_random_uuid()::text, $1, $2, $3);

-- name: DeleteTeamMemberRow :exec
DELETE FROM "teamMember" WHERE "teamId" = $1 AND "userId" = $2;

-- name: UpdateTeamMemberRoleRow :exec
UPDATE "teamMember" SET role = $1 WHERE "teamId" = $2 AND "userId" = $3;

-- name: ListRosterForTeam :many
SELECT tm."userId", tm.role, u.name, u."vrchatUsername", u.slug
FROM "teamMember" tm JOIN "user" u ON u.id = tm."userId"
WHERE tm."teamId" = $1 ORDER BY tm."createdAt" ASC;

-- name: ListRosterForTeamsBatch :many
SELECT tm."teamId", tm."userId", tm.role, u.name, u."vrchatUsername", u.slug
FROM "teamMember" tm JOIN "user" u ON u.id = tm."userId"
WHERE tm."teamId" = ANY($1::text[]) ORDER BY tm."createdAt" ASC;

-- name: CountRosterForTeam :one
SELECT COUNT(*) FROM "teamMember" WHERE "teamId" = $1;

-- Team stats update
-- name: UpdateTeamStats :exec
UPDATE "organization"
SET "rankingAverage" = COALESCE(sqlc.narg('ranking_average'), "rankingAverage"),
    "pointsAverage" = COALESCE(sqlc.narg('points_average'), "pointsAverage"),
    "seasonRank" = COALESCE(sqlc.narg('season_rank'), "seasonRank"),
    "averagePointsPerEvent" = COALESCE(sqlc.narg('average_points_per_event'), "averagePointsPerEvent")
WHERE id = sqlc.arg('id');
