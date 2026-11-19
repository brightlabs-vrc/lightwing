-- Organization Newsletters

-- name: CreateNewsletter :one
INSERT INTO "organization_newsletter" (
    id, "organizationId", "authorId", title, slug, summary, "thumbnailUrl", content, status, "publishedAt", "createdAt", "updatedAt"
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING id;

-- name: GetNewsletterByID :one
SELECT
    n.id, n."organizationId", n."authorId", n.title, n.slug, n.summary, n."thumbnailUrl",
    n.content, n.status, n."publishedAt", n."createdAt", n."updatedAt",
    o.name AS org_name, o.slug AS org_slug, o.logo AS org_logo,
    u.name AS author_name, u."vrchatUsername" AS author_vrc, u.slug AS author_slug, u.image AS author_image
FROM "organization_newsletter" n
JOIN "organization" o ON o.id = n."organizationId"
JOIN "user" u ON u.id = n."authorId"
WHERE n.id = $1;

-- name: GetPublishedNewsletterByIDOrSlug :one
SELECT
    n.id, n."organizationId", n."authorId", n.title, n.slug, n.summary, n."thumbnailUrl",
    n.content, n.status, n."publishedAt", n."createdAt", n."updatedAt",
    o.name AS org_name, o.slug AS org_slug, o.logo AS org_logo,
    u.name AS author_name, u."vrchatUsername" AS author_vrc, u.slug AS author_slug, u.image AS author_image
FROM "organization_newsletter" n
JOIN "organization" o ON o.id = n."organizationId"
JOIN "user" u ON u.id = n."authorId"
WHERE n.status = 'PUBLISHED' AND (n.id = $1 OR n.slug = $1)
LIMIT 1;

-- name: NewsletterSlugExistsForOrg :one
SELECT id FROM "organization_newsletter"
WHERE "organizationId" = $1 AND slug = $2 AND id != $3
LIMIT 1;

-- name: UpdateNewsletter :exec
UPDATE "organization_newsletter"
SET
    title = sqlc.arg('title'),
    slug = sqlc.arg('slug'),
    summary = sqlc.narg('summary'),
    "thumbnailUrl" = sqlc.narg('thumbnail_url'),
    content = sqlc.arg('content'),
    status = sqlc.arg('status'),
    "publishedAt" = sqlc.narg('published_at'),
    "authorId" = sqlc.arg('author_id'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');

-- name: DeleteNewsletter :exec
DELETE FROM "organization_newsletter" WHERE id = $1;

-- name: ListPublishedNewsletters :many
SELECT
    n.id, n."organizationId", n."authorId", n.title, n.slug, n.summary, n."thumbnailUrl",
    n.content, n.status, n."publishedAt", n."createdAt", n."updatedAt",
    o.name AS org_name, o.slug AS org_slug, o.logo AS org_logo,
    u.name AS author_name, u."vrchatUsername" AS author_vrc, u.slug AS author_slug, u.image AS author_image
FROM "organization_newsletter" n
JOIN "organization" o ON o.id = n."organizationId"
JOIN "user" u ON u.id = n."authorId"
WHERE n.status = 'PUBLISHED'
  AND (sqlc.arg('organization_id')::text = '' OR n."organizationId" = sqlc.arg('organization_id')::text)
  AND (
    sqlc.arg('search')::text = ''
    OR n.title ILIKE '%' || sqlc.arg('search')::text || '%'
    OR COALESCE(n.summary, '') ILIKE '%' || sqlc.arg('search')::text || '%'
    OR o.name ILIKE '%' || sqlc.arg('search')::text || '%'
  )
ORDER BY COALESCE(n."publishedAt", n."createdAt") DESC, n."createdAt" DESC
LIMIT sqlc.arg('limit_val')::int OFFSET sqlc.arg('offset_val')::int;

-- name: CountPublishedNewsletters :one
SELECT COUNT(*)
FROM "organization_newsletter" n
JOIN "organization" o ON o.id = n."organizationId"
WHERE n.status = 'PUBLISHED'
  AND (sqlc.arg('organization_id')::text = '' OR n."organizationId" = sqlc.arg('organization_id')::text)
  AND (
    sqlc.arg('search')::text = ''
    OR n.title ILIKE '%' || sqlc.arg('search')::text || '%'
    OR COALESCE(n.summary, '') ILIKE '%' || sqlc.arg('search')::text || '%'
    OR o.name ILIKE '%' || sqlc.arg('search')::text || '%'
  );

-- name: ListOrgNewsletters :many
SELECT
    n.id, n."organizationId", n."authorId", n.title, n.slug, n.summary, n."thumbnailUrl",
    n.content, n.status, n."publishedAt", n."createdAt", n."updatedAt",
    o.name AS org_name, o.slug AS org_slug, o.logo AS org_logo,
    u.name AS author_name, u."vrchatUsername" AS author_vrc, u.slug AS author_slug, u.image AS author_image
FROM "organization_newsletter" n
JOIN "organization" o ON o.id = n."organizationId"
JOIN "user" u ON u.id = n."authorId"
WHERE n."organizationId" = sqlc.arg('organization_id')
ORDER BY n."updatedAt" DESC, n."createdAt" DESC
LIMIT sqlc.arg('limit_val')::int OFFSET sqlc.arg('offset_val')::int;

-- name: CountOrgNewsletters :one
SELECT COUNT(*)
FROM "organization_newsletter"
WHERE "organizationId" = $1;
