package eventmanager

import (
	"context"
	"database/sql"
	"errors"
	"time"

	encoreauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"
	"encore.app/auth"
	"encore.app/eventmanager/sqlc"
)

// --- Add member ---

// AddEventMemberRequest carries the event/user ids plus the auth header.
//
// Mirrors ts-legacy/eventmanager/event-members.ts AddMemberParams
// (POST /api/events/:id/members).
type AddEventMemberRequest struct {
	EventID string `json:"eventId"`
	UserID  string `json:"userId"`
}

// AddEventMemberCore registers a participant, enforcing the event's class
// restriction and seeding the scoring record. Idempotent for existing members.
func AddEventMemberCore(ctx context.Context, actor *auth.Actor, p *AddEventMemberRequest) (*EventDetail, error) {
	tier, err := q().GetUserClassTier(ctx, p.UserID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	} else if err != nil {
		return nil, err
	}
	userTier := nullStringFromAny(tier)

	event, err := requireEventRow(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if _, err := auth.RequireEventPermission(ctx, actor, p.EventID, auth.ActionUpdate); err != nil {
		return nil, err
	}
	if !IsEligible(toClassTier(classTierPtr(userTier)), toClassTier(classTierPtr(event.ClassRestriction))) {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "participant class tier does not satisfy the event class restriction"}
	}

	memberExists, err := q().EventMemberExists(ctx, sqlc.EventMemberExistsParams{
		EventId: p.EventID,
		UserId:  p.UserID,
	})
	if err != nil {
		return nil, err
	}
	if !memberExists {
		if event.ParticipantLimit.Valid {
			currentCount64, err := q().GetEventMemberCount(ctx, p.EventID)
			if err != nil {
				return nil, err
			}
			currentCount := int(currentCount64)
			if currentCount >= int(event.ParticipantLimit.Int64) {
				return nil, &errs.Error{
					Code:    errs.FailedPrecondition,
					Message: "Event participant capacity has been reached",
					Details: detailsMap{
						"code": CodeEventParticipantLimitReached,
						"limit": int(event.ParticipantLimit.Int64), "currentCount": currentCount,
					},
				}
			}
		}
		if err := q().InsertEventMember(ctx, sqlc.InsertEventMemberParams{
			ID: newID(), EventId: p.EventID, UserId: p.UserID, CreatedAt: time.Now().UTC(),
		}); err != nil {
			return nil, err
		}
	}
	if err := EnsureEventStandingsRow(ctx, p.EventID, p.UserID, event.ScoringType); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=POST path=/api/event-members
func AddEventMember(ctx context.Context, p *AddEventMemberRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return AddEventMemberCore(ctx, actor, p)
}

// RemoveMemberFromEvent deletes a member plus all associated standings and
// race participation rows.
//
// Mirrors ts-legacy/eventmanager/event-members.ts removeMemberFromEventInternal.
func RemoveMemberFromEvent(ctx context.Context, eventID, userID string) error {
	if err := q().DeleteEventMembersByUser(ctx, sqlc.DeleteEventMembersByUserParams{
		EventId: eventID, UserId: userID,
	}); err != nil {
		return err
	}
	if err := q().DeleteEventPointsByUser(ctx, sqlc.DeleteEventPointsByUserParams{
		EventId: eventID, UserId: userID,
	}); err != nil {
		return err
	}
	if err := q().DeleteEventLadderByUser(ctx, sqlc.DeleteEventLadderByUserParams{
		EventId: eventID, UserId: userID,
	}); err != nil {
		return err
	}
	if err := q().DeleteRaceEventMemberByEvent(ctx, sqlc.DeleteRaceEventMemberByEventParams{
		UserId: userID, EventId: eventID,
	}); err != nil {
		return err
	}
	if err := q().DeleteRaceResultsByEvent(ctx, sqlc.DeleteRaceResultsByEventParams{
		UserId: userID, EventId: eventID,
	}); err != nil {
		return err
	}
	return nil
}

// --- Remove member ---

// RemoveEventMemberRequest carries the event/user ids plus the auth header
// (DELETE decodes the struct from query params).
//
// Mirrors ts-legacy/eventmanager/event-members.ts RemoveMemberParams
// (DELETE /api/events/:id/members/:userId).
type RemoveEventMemberRequest struct {
	EventID string `query:"eventId"`
	UserID  string `query:"userId"`
}

// RemoveEventMemberCore removes a participant from an event.
func RemoveEventMemberCore(ctx context.Context, actor *auth.Actor, p *RemoveEventMemberRequest) (*EventDetail, error) {
	exists, err := q().EventExists(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, &errs.Error{Code: errs.NotFound, Message: "event not found"}
	}
	if _, err := auth.RequireEventPermission(ctx, actor, p.EventID, auth.ActionUpdate); err != nil {
		return nil, err
	}
	if err := RemoveMemberFromEvent(ctx, p.EventID, p.UserID); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=DELETE path=/api/event-members
func RemoveEventMember(ctx context.Context, p *RemoveEventMemberRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return RemoveEventMemberCore(ctx, actor, p)
}

// --- Join (self-service) ---

// JoinEventRequest carries the event id plus the auth header.
//
// Mirrors ts-legacy/eventmanager/event-members.ts JoinEventParams
// (POST /api/events/:id/join).
type JoinEventRequest struct {
	EventID string `json:"eventId"`
}

// JoinEventCore lets an authenticated user join a PENDING or ONGOING
// event. No event permission required; class restriction, signup lock, and
// capacity are enforced.
func JoinEventCore(ctx context.Context, actor *auth.Actor, p *JoinEventRequest) (*EventDetail, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	userID := actor.UserID

	tier, err := q().GetUserClassTier(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	} else if err != nil {
		return nil, err
	}
	userTier := nullStringFromAny(tier)

	event, err := requireEventRow(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if event.Status != "PENDING" && event.Status != "ONGOING" {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "event is not open for public signup (must be PENDING or ONGOING)"}
	}
	if event.SignupsLocked {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "signups are locked for this event"}
	}
	if !IsEligible(toClassTier(classTierPtr(userTier)), toClassTier(classTierPtr(event.ClassRestriction))) {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "participant class tier does not satisfy the event class restriction"}
	}

	memberExists, err := q().EventMemberExists(ctx, sqlc.EventMemberExistsParams{
		EventId: p.EventID,
		UserId:  userID,
	})
	if err != nil {
		return nil, err
	}
	if !memberExists {
		if event.ParticipantLimit.Valid {
			currentCount64, err := q().GetEventMemberCount(ctx, p.EventID)
			if err != nil {
				return nil, err
			}
			currentCount := int(currentCount64)
			if currentCount >= int(event.ParticipantLimit.Int64) {
				return nil, &errs.Error{
					Code:    errs.FailedPrecondition,
					Message: "Event participant capacity has been reached",
					Details: detailsMap{
						"code": CodeEventParticipantLimitReached,
						"limit": int(event.ParticipantLimit.Int64), "currentCount": currentCount,
					},
				}
			}
		}
		if err := q().InsertEventMember(ctx, sqlc.InsertEventMemberParams{
			ID: newID(), EventId: p.EventID, UserId: userID, CreatedAt: time.Now().UTC(),
		}); err != nil {
			return nil, err
		}
	}
	if err := EnsureEventStandingsRow(ctx, p.EventID, userID, event.ScoringType); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=POST path=/api/event-join
func JoinEvent(ctx context.Context, p *JoinEventRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return JoinEventCore(ctx, actor, p)
}

// --- Leave (self-service) ---

// LeaveEventRequest carries the event id.
//
// Mirrors ts-legacy/eventmanager/event-members.ts LeaveEventParams
// (DELETE /api/events/:id/join).
type LeaveEventRequest struct {
	EventID string `query:"eventId"`
}

// LeaveEventCore lets an authenticated user withdraw from an event.
func LeaveEventCore(ctx context.Context, actor *auth.Actor, p *LeaveEventRequest) (*EventDetail, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	event, err := requireEventRow(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if event.SignupsLocked {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "signups are locked for this event"}
	}
	if err := RemoveMemberFromEvent(ctx, p.EventID, actor.UserID); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=DELETE path=/api/event-join
func LeaveEvent(ctx context.Context, p *LeaveEventRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return LeaveEventCore(ctx, actor, p)
}

// --- Signups lock ---

// SetEventSignupsLockedRequest toggles the signup lock plus the auth header.
//
// Mirrors ts-legacy/eventmanager/event-members.ts SetSignupsLockedParams
// (PUT /api/events/:id/signups-lock).
type SetEventSignupsLockedRequest struct {
	EventID string `json:"eventId"`
	Locked  bool   `json:"locked"`
}

// SetEventSignupsLockedCore toggles an event's signup lock. Gated by
// event-update permission.
func SetEventSignupsLockedCore(ctx context.Context, actor *auth.Actor, p *SetEventSignupsLockedRequest) (*EventDetail, error) {
	exists, err := q().EventExists(ctx, p.EventID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, &errs.Error{Code: errs.NotFound, Message: "event not found"}
	}
	if _, err := auth.RequireEventPermission(ctx, actor, p.EventID, auth.ActionUpdate); err != nil {
		return nil, err
	}
	if err := q().UpdateEventSignupsLocked(ctx, sqlc.UpdateEventSignupsLockedParams{
		SignupsLocked: p.Locked, UpdatedAt: time.Now().UTC(), ID: p.EventID,
	}); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api auth method=PUT path=/api/event-signups-lock
func SetEventSignupsLocked(ctx context.Context, p *SetEventSignupsLockedRequest) (*EventDetail, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return SetEventSignupsLockedCore(ctx, actor, p)
}
