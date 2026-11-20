package eventmanager

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"encore.app/auth"
	"encore.app/eventmanager/sqlc"
	encoreauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"
)

const (
	RosterRolePrimary = "PRIMARY"
	RosterRoleBackup  = "BACKUP"
)

// EventTeamView represents a team registered in a team-based event along with
// its primary and backup rosters.
type EventTeamView struct {
	ID            string            `json:"id"`
	TeamID        string            `json:"teamId"`
	Name          string            `json:"name"`
	Slug          string            `json:"slug"`
	Logo          *string           `json:"logo,omitempty"`
	PrimaryRoster []EventMemberView `json:"primaryRoster"`
	BackupRoster  []EventMemberView `json:"backupRoster"`
	CreatedAt     string            `json:"createdAt"`
}

// TeamPointsEntryView represents one team's summed Constructors' score in a team-based event.
type TeamPointsEntryView struct {
	TeamID      string  `json:"teamId"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Logo        *string `json:"logo,omitempty"`
	Points      int     `json:"points"`
	MemberCount int     `json:"memberCount"`
}

// UpsertEventTeamRosterRequest registers a team in a team-based event or updates
// its primary and backup rosters.
type UpsertEventTeamRosterRequest struct {
	EventID        string   `json:"eventId"`
	TeamID         string   `json:"teamId"`
	PrimaryUserIDs []string `json:"primaryUserIds"`
	BackupUserIDs  []string `json:"backupUserIds"`
}

// SubstituteEventTeamMemberRequest promotes a backup member to primary, or
// atomically swaps a backup member with an outgoing primary member.
type SubstituteEventTeamMemberRequest struct {
	EventID                string  `json:"eventId"`
	TeamID                 string  `json:"teamId"`
	IncomingUserID         string  `json:"incomingUserId"`
	OutgoingUserID         *string `json:"outgoingUserId,omitempty"`
	ReplaceInUpcomingRaces *bool   `json:"replaceInUpcomingRaces,omitempty"`
}

// RemoveEventTeamRequest unregisters a team (and all its roster members) from an event.
type RemoveEventTeamRequest struct {
	EventID string `query:"eventId"`
	TeamID  string `query:"teamId"`
}

// requireEventOrTeamAdminPermission allows either an event admin (always) or
// a team administrator (when self-service signups are open on a PENDING/ONGOING event).
func requireEventOrTeamAdminPermission(ctx context.Context, actor *auth.Actor, event *eventRow, teamID string) error {
	if actor == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	if event.Status == "CONCLUDED" {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "team rosters and team associations are frozen once an event has concluded"}
	}
	if _, err := auth.RequireEventPermission(ctx, actor, event.ID, auth.ActionUpdate); err == nil {
		return nil
	}
	// Fallback to Team Admin self-service when signups are open.
	isTeamAdmin, err := q().IsUserTeamAdmin(ctx, sqlc.IsUserTeamAdminParams{
		TeamId: teamID,
		UserId: actor.UserID,
	})
	if err != nil {
		return err
	}
	if !isTeamAdmin {
		return &errs.Error{Code: errs.PermissionDenied, Message: "event update permission or team administrator role required"}
	}
	if event.Status != "PENDING" && event.Status != "ONGOING" {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "event is not open for team signups (must be PENDING or ONGOING)"}
	}
	if event.SignupsLocked {
		return &errs.Error{Code: errs.FailedPrecondition, Message: "signups are locked for this event"}
	}
	return nil
}

// UpsertEventTeamRosterCore registers a team and sets its primary/backup roster.
func UpsertEventTeamRosterCore(ctx context.Context, actor *auth.Actor, p *UpsertEventTeamRosterRequest) (*EventDetail, error) {
	if p.EventID == "" || p.TeamID == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "eventId and teamId are required"}
	}
	event, err := requireEventRow(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if !event.IsTeamEvent {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "this event is not configured as a team-based event"}
	}
	if err := requireEventOrTeamAdminPermission(ctx, actor, event, p.TeamID); err != nil {
		return nil, err
	}

	team, err := q().GetTeamForEvent(ctx, p.TeamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}
	if team.Status != "APPROVED" {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "only approved teams can register for events"}
	}

	// Deduplicate and validate primary and backup lists.
	primarySet := make(map[string]bool, len(p.PrimaryUserIDs))
	primaryIDs := make([]string, 0, len(p.PrimaryUserIDs))
	for _, uid := range p.PrimaryUserIDs {
		if uid == "" || primarySet[uid] {
			continue
		}
		primarySet[uid] = true
		primaryIDs = append(primaryIDs, uid)
	}
	backupSet := make(map[string]bool, len(p.BackupUserIDs))
	backupIDs := make([]string, 0, len(p.BackupUserIDs))
	for _, uid := range p.BackupUserIDs {
		if uid == "" || backupSet[uid] {
			continue
		}
		if primarySet[uid] {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "a competitor cannot be on both primary and backup rosters"}
		}
		backupSet[uid] = true
		backupIDs = append(backupIDs, uid)
	}

	if len(primaryIDs) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "at least 1 primary roster member is required"}
	}
	if event.MaxPrimaryRosterSize.Valid && len(primaryIDs) > int(event.MaxPrimaryRosterSize.Int64) {
		return nil, &errs.Error{
			Code:    errs.InvalidArgument,
			Message: fmt.Sprintf("primary roster exceeds the event limit of %d", event.MaxPrimaryRosterSize.Int64),
		}
	}
	if event.MaxBackupRosterSize.Valid && len(backupIDs) > int(event.MaxBackupRosterSize.Int64) {
		return nil, &errs.Error{
			Code:    errs.InvalidArgument,
			Message: fmt.Sprintf("backup roster exceeds the event limit of %d", event.MaxBackupRosterSize.Int64),
		}
	}

	// Enforce event-level team capacity (participantLimit caps registered teams on both regular and granular team events).
	alreadyRegistered, err := q().EventTeamExists(ctx, sqlc.EventTeamExistsParams{
		EventId: p.EventID,
		TeamId:  p.TeamID,
	})
	if err != nil {
		return nil, err
	}
	if !alreadyRegistered && event.ParticipantLimit.Valid {
		teamCount, err := q().CountEventTeams(ctx, p.EventID)
		if err != nil {
			return nil, err
		}
		if teamCount >= event.ParticipantLimit.Int64 {
			return nil, &errs.Error{
				Code:    errs.FailedPrecondition,
				Message: "Event team capacity has been reached",
				Details: detailsMap{
					"code":         CodeEventParticipantLimitReached,
					"limit":        int(event.ParticipantLimit.Int64),
					"currentCount": int(teamCount),
				},
			}
		}
	}

	// Validate each roster member: belongs to team, eligible class tier, not registered under another team.
	allUsers := make([]string, 0, len(primaryIDs)+len(backupIDs))
	allUsers = append(allUsers, primaryIDs...)
	allUsers = append(allUsers, backupIDs...)
	for _, uid := range allUsers {
		inTeam, err := q().IsUserInTeam(ctx, sqlc.IsUserInTeamParams{TeamId: p.TeamID, UserId: uid})
		if err != nil {
			return nil, err
		}
		if !inTeam {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: fmt.Sprintf("user %s is not a member of team %s", uid, team.Name)}
		}
		userTier, err := getOrgUserTier(ctx, q(), event.OrganizationID, uid)
		if err != nil {
			return nil, err
		}
		if !IsEligible(toClassTier(classTierPtr(userTier)), toClassTier(classTierPtr(event.ClassRestriction))) {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "one or more roster members do not satisfy the event class restriction"}
		}
		existingRow, err := q().GetEventMemberTeamRole(ctx, sqlc.GetEventMemberTeamRoleParams{
			EventId: p.EventID,
			UserId:  uid,
		})
		if err == nil && existingRow.TeamId.Valid && existingRow.TeamId.String != p.TeamID {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "a roster member is already registered under another team in this event"}
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
	}

	now := time.Now().UTC()
	if err := q().UpsertEventTeam(ctx, sqlc.UpsertEventTeamParams{
		ID:                 "evteam-" + newID()[:8],
		EventId:            p.EventID,
		TeamId:             p.TeamID,
		RegisteredByUserId: sql.NullString{String: actor.UserID, Valid: actor.UserID != ""},
		CreatedAt:          now,
	}); err != nil {
		return nil, err
	}

	// Remove previous members of this team who are no longer on either roster.
	existingTeamMembers, err := q().ListEventMembersByTeam(ctx, sqlc.ListEventMembersByTeamParams{
		EventId: p.EventID,
		TeamId:  sql.NullString{String: p.TeamID, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	for _, em := range existingTeamMembers {
		if !primarySet[em.UserId] && !backupSet[em.UserId] {
			if err := RemoveMemberFromEvent(ctx, p.EventID, em.UserId); err != nil {
				return nil, err
			}
		}
	}

	teamIDNull := sql.NullString{String: p.TeamID, Valid: true}
	for _, uid := range primaryIDs {
		if err := q().UpsertEventTeamMember(ctx, sqlc.UpsertEventTeamMemberParams{
			ID:         newID(),
			EventId:    p.EventID,
			UserId:     uid,
			TeamId:     teamIDNull,
			RosterRole: sql.NullString{String: RosterRolePrimary, Valid: true},
			CreatedAt:  now,
		}); err != nil {
			return nil, err
		}
		if err := EnsureEventStandingsRow(ctx, p.EventID, uid, event.ScoringType); err != nil {
			return nil, err
		}
	}
	for _, uid := range backupIDs {
		if err := q().UpsertEventTeamMember(ctx, sqlc.UpsertEventTeamMemberParams{
			ID:         newID(),
			EventId:    p.EventID,
			UserId:     uid,
			TeamId:     teamIDNull,
			RosterRole: sql.NullString{String: RosterRoleBackup, Valid: true},
			CreatedAt:  now,
		}); err != nil {
			return nil, err
		}
		// Ensure a member moved to BACKUP is removed from any not-yet-started race lineups.
		if err := q().DeleteUserFromUnstartedRaces(ctx, sqlc.DeleteUserFromUnstartedRacesParams{
			EventId: p.EventID,
			UserId:  uid,
		}); err != nil {
			return nil, err
		}
		if err := EnsureEventStandingsRow(ctx, p.EventID, uid, event.ScoringType); err != nil {
			return nil, err
		}
	}

	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=POST path=/api/event-teams
func UpsertEventTeamRoster(ctx context.Context, p *UpsertEventTeamRosterRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return UpsertEventTeamRosterCore(ctx, actor, p)
}

// SubstituteEventTeamMemberCore promotes a BACKUP roster member to PRIMARY, or
// swaps them with an outgoing PRIMARY member (optionally substituting them in
// not-yet-started races).
func SubstituteEventTeamMemberCore(ctx context.Context, actor *auth.Actor, p *SubstituteEventTeamMemberRequest) (*EventDetail, error) {
	if p.EventID == "" || p.TeamID == "" || p.IncomingUserID == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "eventId, teamId, and incomingUserId are required"}
	}
	event, err := requireEventRow(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if !event.IsTeamEvent {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "this event is not configured as a team-based event"}
	}
	if err := requireEventOrTeamAdminPermission(ctx, actor, event, p.TeamID); err != nil {
		return nil, err
	}

	inRow, err := q().GetEventMemberTeamRole(ctx, sqlc.GetEventMemberTeamRoleParams{
		EventId: p.EventID,
		UserId:  p.IncomingUserID,
	})
	if errors.Is(err, sql.ErrNoRows) || !inRow.TeamId.Valid || inRow.TeamId.String != p.TeamID {
		return nil, &errs.Error{Code: errs.NotFound, Message: "incoming user is not registered on this team's event roster"}
	}
	if err != nil {
		return nil, err
	}
	if !inRow.RosterRole.Valid || inRow.RosterRole.String != RosterRoleBackup {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "incoming user must currently be on the BACKUP roster"}
	}

	outgoingID := ""
	if p.OutgoingUserID != nil {
		outgoingID = *p.OutgoingUserID
	}

	if outgoingID != "" {
		if outgoingID == p.IncomingUserID {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "incoming and outgoing users must be different"}
		}
		outRow, err := q().GetEventMemberTeamRole(ctx, sqlc.GetEventMemberTeamRoleParams{
			EventId: p.EventID,
			UserId:  outgoingID,
		})
		if errors.Is(err, sql.ErrNoRows) || !outRow.TeamId.Valid || outRow.TeamId.String != p.TeamID {
			return nil, &errs.Error{Code: errs.NotFound, Message: "outgoing user is not registered on this team's event roster"}
		}
		if err != nil {
			return nil, err
		}
		if !outRow.RosterRole.Valid || outRow.RosterRole.String != RosterRolePrimary {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "outgoing user must currently be on the PRIMARY roster"}
		}

		// Atomic swap in a transaction.
		stx, err := std().BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer stx.Rollback()
		qq := q().WithTx(stx)

		if err := qq.UpdateEventMemberRosterRole(ctx, sqlc.UpdateEventMemberRosterRoleParams{
			RosterRole: sql.NullString{String: RosterRoleBackup, Valid: true},
			EventId:    p.EventID,
			UserId:     outgoingID,
		}); err != nil {
			return nil, err
		}
		if err := qq.UpdateEventMemberRosterRole(ctx, sqlc.UpdateEventMemberRosterRoleParams{
			RosterRole: sql.NullString{String: RosterRolePrimary, Valid: true},
			EventId:    p.EventID,
			UserId:     p.IncomingUserID,
		}); err != nil {
			return nil, err
		}

		replaceUpcoming := true
		if p.ReplaceInUpcomingRaces != nil {
			replaceUpcoming = *p.ReplaceInUpcomingRaces
		}
		if replaceUpcoming {
			if err := qq.DeleteIncomingDuplicateUnstartedRaceMembers(ctx, sqlc.DeleteIncomingDuplicateUnstartedRaceMembersParams{
				EventId:  p.EventID,
				UserId:   outgoingID,
				UserId_2: p.IncomingUserID,
			}); err != nil {
				return nil, err
			}
			if err := qq.ReplaceUserInUnstartedRaces(ctx, sqlc.ReplaceUserInUnstartedRacesParams{
				EventId:  p.EventID,
				UserId:   outgoingID,
				UserId_2: p.IncomingUserID,
			}); err != nil {
				return nil, err
			}
		}
		if err := stx.Commit(); err != nil {
			return nil, err
		}
	} else {
		// Direct promotion to PRIMARY (enforce maxPrimaryRosterSize).
		if event.MaxPrimaryRosterSize.Valid {
			currentPrimary, err := q().CountTeamRosterByRole(ctx, sqlc.CountTeamRosterByRoleParams{
				EventId:    p.EventID,
				TeamId:     sql.NullString{String: p.TeamID, Valid: true},
				RosterRole: sql.NullString{String: RosterRolePrimary, Valid: true},
			})
			if err != nil {
				return nil, err
			}
			if currentPrimary >= event.MaxPrimaryRosterSize.Int64 {
				return nil, &errs.Error{
					Code:    errs.FailedPrecondition,
					Message: fmt.Sprintf("primary roster is full (%d/%d); select a primary member to swap out", currentPrimary, event.MaxPrimaryRosterSize.Int64),
				}
			}
		}
		if err := q().UpdateEventMemberRosterRole(ctx, sqlc.UpdateEventMemberRosterRoleParams{
			RosterRole: sql.NullString{String: RosterRolePrimary, Valid: true},
			EventId:    p.EventID,
			UserId:     p.IncomingUserID,
		}); err != nil {
			return nil, err
		}
	}

	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=POST path=/api/event-teams-sub
func SubstituteEventTeamMember(ctx context.Context, p *SubstituteEventTeamMemberRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return SubstituteEventTeamMemberCore(ctx, actor, p)
}

// RemoveEventTeamCore removes a team and all its members from an event.
func RemoveEventTeamCore(ctx context.Context, actor *auth.Actor, p *RemoveEventTeamRequest) (*EventDetail, error) {
	if p.EventID == "" || p.TeamID == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "eventId and teamId are required"}
	}
	event, err := requireEventRow(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if err := requireEventOrTeamAdminPermission(ctx, actor, event, p.TeamID); err != nil {
		return nil, err
	}

	members, err := q().ListEventMembersByTeam(ctx, sqlc.ListEventMembersByTeamParams{
		EventId: p.EventID,
		TeamId:  sql.NullString{String: p.TeamID, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		if err := RemoveMemberFromEvent(ctx, p.EventID, m.UserId); err != nil {
			return nil, err
		}
	}
	if err := q().DeleteEventTeam(ctx, sqlc.DeleteEventTeamParams{
		EventId: p.EventID,
		TeamId:  p.TeamID,
	}); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=DELETE path=/api/event-teams
func RemoveEventTeam(ctx context.Context, p *RemoveEventTeamRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return RemoveEventTeamCore(ctx, actor, p)
}
