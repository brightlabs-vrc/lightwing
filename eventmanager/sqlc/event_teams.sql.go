// Code generated for event_team & primary/backup roster queries.

package sqlc

import (
	"context"
	"database/sql"
	"time"
)

const getTeamForEvent = `-- name: GetTeamForEvent :one
SELECT id, name, slug, logo, status FROM "team" WHERE id = $1
`

type GetTeamForEventRow struct {
	ID     string
	Name   string
	Slug   string
	Logo   sql.NullString
	Status string
}

func (q *Queries) GetTeamForEvent(ctx context.Context, id string) (GetTeamForEventRow, error) {
	row := q.db.QueryRowContext(ctx, getTeamForEvent, id)
	var i GetTeamForEventRow
	err := row.Scan(&i.ID, &i.Name, &i.Slug, &i.Logo, &i.Status)
	return i, err
}

const isUserInTeam = `-- name: IsUserInTeam :one
SELECT EXISTS(SELECT 1 FROM "teamMember" WHERE "teamId" = $1 AND "userId" = $2)
`

type IsUserInTeamParams struct {
	TeamId string
	UserId string
}

func (q *Queries) IsUserInTeam(ctx context.Context, arg IsUserInTeamParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, isUserInTeam, arg.TeamId, arg.UserId)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

const isUserTeamAdmin = `-- name: IsUserTeamAdmin :one
SELECT EXISTS(
  SELECT 1 FROM "teamMember"
  WHERE "teamId" = $1
    AND "userId" = $2
    AND LOWER(COALESCE(role, '')) IN ('administrator', 'organizationadministrator')
)
`

type IsUserTeamAdminParams struct {
	TeamId string
	UserId string
}

func (q *Queries) IsUserTeamAdmin(ctx context.Context, arg IsUserTeamAdminParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, isUserTeamAdmin, arg.TeamId, arg.UserId)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

const listEventTeamsByEvent = `-- name: ListEventTeamsByEvent :many
SELECT et.id, et."eventId", et."teamId", et."registeredByUserId", et."createdAt", et."updatedAt",
       t.name, t.slug, t.logo
FROM "event_team" et
JOIN "team" t ON t.id = et."teamId"
WHERE et."eventId" = $1
ORDER BY et."createdAt" ASC
`

type ListEventTeamsByEventRow struct {
	ID                 string
	EventId            string
	TeamId             string
	RegisteredByUserId sql.NullString
	CreatedAt          time.Time
	UpdatedAt          time.Time
	Name               string
	Slug               string
	Logo               sql.NullString
}

func (q *Queries) ListEventTeamsByEvent(ctx context.Context, eventid string) ([]ListEventTeamsByEventRow, error) {
	rows, err := q.db.QueryContext(ctx, listEventTeamsByEvent, eventid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListEventTeamsByEventRow
	for rows.Next() {
		var i ListEventTeamsByEventRow
		if err := rows.Scan(
			&i.ID,
			&i.EventId,
			&i.TeamId,
			&i.RegisteredByUserId,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.Name,
			&i.Slug,
			&i.Logo,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const eventTeamExists = `-- name: EventTeamExists :one
SELECT EXISTS(SELECT 1 FROM "event_team" WHERE "eventId" = $1 AND "teamId" = $2)
`

type EventTeamExistsParams struct {
	EventId string
	TeamId  string
}

func (q *Queries) EventTeamExists(ctx context.Context, arg EventTeamExistsParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, eventTeamExists, arg.EventId, arg.TeamId)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

const countEventTeams = `-- name: CountEventTeams :one
SELECT COUNT(*) FROM "event_team" WHERE "eventId" = $1
`

func (q *Queries) CountEventTeams(ctx context.Context, eventid string) (int64, error) {
	row := q.db.QueryRowContext(ctx, countEventTeams, eventid)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const upsertEventTeam = `-- name: UpsertEventTeam :exec
INSERT INTO "event_team" (id, "eventId", "teamId", "registeredByUserId", "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $5)
ON CONFLICT ("eventId", "teamId") DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt"
`

type UpsertEventTeamParams struct {
	ID                 string
	EventId            string
	TeamId             string
	RegisteredByUserId sql.NullString
	CreatedAt          time.Time
}

func (q *Queries) UpsertEventTeam(ctx context.Context, arg UpsertEventTeamParams) error {
	_, err := q.db.ExecContext(ctx, upsertEventTeam,
		arg.ID,
		arg.EventId,
		arg.TeamId,
		arg.RegisteredByUserId,
		arg.CreatedAt,
	)
	return err
}

const deleteEventTeam = `-- name: DeleteEventTeam :exec
DELETE FROM "event_team" WHERE "eventId" = $1 AND "teamId" = $2
`

type DeleteEventTeamParams struct {
	EventId string
	TeamId  string
}

func (q *Queries) DeleteEventTeam(ctx context.Context, arg DeleteEventTeamParams) error {
	_, err := q.db.ExecContext(ctx, deleteEventTeam, arg.EventId, arg.TeamId)
	return err
}

const upsertEventTeamMember = `-- name: UpsertEventTeamMember :exec
INSERT INTO "event_member" (id, "eventId", "userId", "teamId", "rosterRole", "teamNameSnapshot", "teamSlugSnapshot", "createdAt")
VALUES (
  $1, $2, $3, $4, $5,
  (SELECT name FROM "team" WHERE id = $4),
  (SELECT slug FROM "team" WHERE id = $4),
  $6
)
ON CONFLICT ("eventId", "userId") DO UPDATE SET
  "teamId" = EXCLUDED."teamId",
  "rosterRole" = EXCLUDED."rosterRole",
  "teamNameSnapshot" = COALESCE(EXCLUDED."teamNameSnapshot", "event_member"."teamNameSnapshot"),
  "teamSlugSnapshot" = COALESCE(EXCLUDED."teamSlugSnapshot", "event_member"."teamSlugSnapshot")
`

type UpsertEventTeamMemberParams struct {
	ID         string
	EventId    string
	UserId     string
	TeamId     sql.NullString
	RosterRole sql.NullString
	CreatedAt  time.Time
}

func (q *Queries) UpsertEventTeamMember(ctx context.Context, arg UpsertEventTeamMemberParams) error {
	_, err := q.db.ExecContext(ctx, upsertEventTeamMember,
		arg.ID,
		arg.EventId,
		arg.UserId,
		arg.TeamId,
		arg.RosterRole,
		arg.CreatedAt,
	)
	return err
}

const getEventMemberTeamRole = `-- name: GetEventMemberTeamRole :one
SELECT "teamId", "rosterRole" FROM "event_member" WHERE "eventId" = $1 AND "userId" = $2
`

type GetEventMemberTeamRoleParams struct {
	EventId string
	UserId  string
}

type GetEventMemberTeamRoleRow struct {
	TeamId     sql.NullString
	RosterRole sql.NullString
}

func (q *Queries) GetEventMemberTeamRole(ctx context.Context, arg GetEventMemberTeamRoleParams) (GetEventMemberTeamRoleRow, error) {
	row := q.db.QueryRowContext(ctx, getEventMemberTeamRole, arg.EventId, arg.UserId)
	var i GetEventMemberTeamRoleRow
	err := row.Scan(&i.TeamId, &i.RosterRole)
	return i, err
}

const listEventMembersByTeam = `-- name: ListEventMembersByTeam :many
SELECT "userId", "rosterRole" FROM "event_member" WHERE "eventId" = $1 AND "teamId" = $2
`

type ListEventMembersByTeamParams struct {
	EventId string
	TeamId  sql.NullString
}

type ListEventMembersByTeamRow struct {
	UserId     string
	RosterRole sql.NullString
}

func (q *Queries) ListEventMembersByTeam(ctx context.Context, arg ListEventMembersByTeamParams) ([]ListEventMembersByTeamRow, error) {
	rows, err := q.db.QueryContext(ctx, listEventMembersByTeam, arg.EventId, arg.TeamId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListEventMembersByTeamRow
	for rows.Next() {
		var i ListEventMembersByTeamRow
		if err := rows.Scan(&i.UserId, &i.RosterRole); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const updateEventMemberRosterRole = `-- name: UpdateEventMemberRosterRole :exec
UPDATE "event_member" SET "rosterRole" = $1 WHERE "eventId" = $2 AND "userId" = $3
`

type UpdateEventMemberRosterRoleParams struct {
	RosterRole sql.NullString
	EventId    string
	UserId     string
}

func (q *Queries) UpdateEventMemberRosterRole(ctx context.Context, arg UpdateEventMemberRosterRoleParams) error {
	_, err := q.db.ExecContext(ctx, updateEventMemberRosterRole, arg.RosterRole, arg.EventId, arg.UserId)
	return err
}

const countTeamRosterByRole = `-- name: CountTeamRosterByRole :one
SELECT COUNT(*) FROM "event_member" WHERE "eventId" = $1 AND "teamId" = $2 AND "rosterRole" = $3
`

type CountTeamRosterByRoleParams struct {
	EventId    string
	TeamId     sql.NullString
	RosterRole sql.NullString
}

func (q *Queries) CountTeamRosterByRole(ctx context.Context, arg CountTeamRosterByRoleParams) (int64, error) {
	row := q.db.QueryRowContext(ctx, countTeamRosterByRole, arg.EventId, arg.TeamId, arg.RosterRole)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const getMaxTeamRosterCountByRole = `-- name: GetMaxTeamRosterCountByRole :one
SELECT COALESCE(MAX(c), 0)::integer FROM (
  SELECT COUNT(*) AS c FROM "event_member"
  WHERE "eventId" = $1 AND "teamId" IS NOT NULL AND "rosterRole" = $2
  GROUP BY "teamId"
) sub
`

type GetMaxTeamRosterCountByRoleParams struct {
	EventId    string
	RosterRole sql.NullString
}

func (q *Queries) GetMaxTeamRosterCountByRole(ctx context.Context, arg GetMaxTeamRosterCountByRoleParams) (int32, error) {
	row := q.db.QueryRowContext(ctx, getMaxTeamRosterCountByRole, arg.EventId, arg.RosterRole)
	var count int32
	err := row.Scan(&count)
	return count, err
}

const deleteIncomingDuplicateUnstartedRaceMembers = `-- name: DeleteIncomingDuplicateUnstartedRaceMembers :exec
DELETE FROM "race_event_member"
WHERE "userId" = $3
  AND "raceEventId" IN (
    SELECT r.id FROM "race_event" r
    JOIN "race_event_member" rem ON rem."raceEventId" = r.id
    WHERE r."eventId" = $1 AND r."startsAt" IS NULL AND rem."userId" = $2
  )
`

type DeleteIncomingDuplicateUnstartedRaceMembersParams struct {
	EventId  string
	UserId   string
	UserId_2 string
}

func (q *Queries) DeleteIncomingDuplicateUnstartedRaceMembers(ctx context.Context, arg DeleteIncomingDuplicateUnstartedRaceMembersParams) error {
	_, err := q.db.ExecContext(ctx, deleteIncomingDuplicateUnstartedRaceMembers, arg.EventId, arg.UserId, arg.UserId_2)
	return err
}

const replaceUserInUnstartedRaces = `-- name: ReplaceUserInUnstartedRaces :exec
UPDATE "race_event_member"
SET "userId" = $3
WHERE "userId" = $2
  AND "raceEventId" IN (
    SELECT id FROM "race_event" WHERE "eventId" = $1 AND "startsAt" IS NULL
  )
`

type ReplaceUserInUnstartedRacesParams struct {
	EventId  string
	UserId   string
	UserId_2 string
}

func (q *Queries) ReplaceUserInUnstartedRaces(ctx context.Context, arg ReplaceUserInUnstartedRacesParams) error {
	_, err := q.db.ExecContext(ctx, replaceUserInUnstartedRaces, arg.EventId, arg.UserId, arg.UserId_2)
	return err
}

const listTeamPointsOverview = `-- name: ListTeamPointsOverview :many
SELECT
  et."teamId",
  t.name,
  t.slug,
  t.logo,
  COALESCE(SUM(epe.points), 0)::integer AS points,
  COUNT(DISTINCT em."userId")::integer AS "memberCount"
FROM "event_team" et
JOIN "team" t ON t.id = et."teamId"
LEFT JOIN "event_member" em ON em."eventId" = et."eventId" AND em."teamId" = et."teamId"
LEFT JOIN "event_points_entry" epe ON epe."eventId" = et."eventId" AND epe."userId" = em."userId"
WHERE et."eventId" = $1
GROUP BY et."teamId", t.name, t.slug, t.logo
ORDER BY points DESC, t.name ASC
`

type ListTeamPointsOverviewRow struct {
	TeamId      string
	Name        string
	Slug        string
	Logo        sql.NullString
	Points      int32
	MemberCount int32
}

func (q *Queries) ListTeamPointsOverview(ctx context.Context, eventid string) ([]ListTeamPointsOverviewRow, error) {
	rows, err := q.db.QueryContext(ctx, listTeamPointsOverview, eventid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListTeamPointsOverviewRow
	for rows.Next() {
		var i ListTeamPointsOverviewRow
		if err := rows.Scan(
			&i.TeamId,
			&i.Name,
			&i.Slug,
			&i.Logo,
			&i.Points,
			&i.MemberCount,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const freezeEventMemberTeamSnapshots = `-- name: FreezeEventMemberTeamSnapshots :exec
UPDATE "event_member" em
SET
  "teamNameSnapshot" = t.name,
  "teamSlugSnapshot" = t.slug
FROM "team" t
WHERE em."eventId" = $1
  AND em."teamId" = t.id
`

func (q *Queries) FreezeEventMemberTeamSnapshots(ctx context.Context, eventid string) error {
	_, err := q.db.ExecContext(ctx, freezeEventMemberTeamSnapshots, eventid)
	return err
}

const countRaceMembersForTeam = `-- name: CountRaceMembersForTeam :one
SELECT COUNT(*)
FROM "race_event_member" rem
JOIN "race_event" re ON re.id = rem."raceEventId"
JOIN "event_member" em ON em."eventId" = re."eventId" AND em."userId" = rem."userId"
WHERE rem."raceEventId" = $1
  AND em."teamId" = $2
`

type CountRaceMembersForTeamParams struct {
	RaceEventId string
	TeamId      sql.NullString
}

func (q *Queries) CountRaceMembersForTeam(ctx context.Context, arg CountRaceMembersForTeamParams) (int64, error) {
	row := q.db.QueryRowContext(ctx, countRaceMembersForTeam, arg.RaceEventId, arg.TeamId)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const deleteUserFromUnstartedRaces = `-- name: DeleteUserFromUnstartedRaces :exec
DELETE FROM "race_event_member" rem
USING "race_event" re
WHERE rem."raceEventId" = re.id
  AND re."eventId" = $1
  AND re."startsAt" IS NULL
  AND rem."userId" = $2
`

type DeleteUserFromUnstartedRacesParams struct {
	EventId string
	UserId  string
}

func (q *Queries) DeleteUserFromUnstartedRaces(ctx context.Context, arg DeleteUserFromUnstartedRacesParams) error {
	_, err := q.db.ExecContext(ctx, deleteUserFromUnstartedRaces, arg.EventId, arg.UserId)
	return err
}

const raceResultExistsForUser = `-- name: RaceResultExistsForUser :one
SELECT EXISTS (
    SELECT 1 FROM "race_event_result"
    WHERE "raceEventId" = $1 AND "userId" = $2
)
`

type RaceResultExistsForUserParams struct {
	RaceEventId string
	UserId      string
}

func (q *Queries) RaceResultExistsForUser(ctx context.Context, arg RaceResultExistsForUserParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, raceResultExistsForUser, arg.RaceEventId, arg.UserId)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}


