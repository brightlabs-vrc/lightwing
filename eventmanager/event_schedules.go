package eventmanager

import (
	"context"
	"time"

	"encore.dev/beta/errs"
	"encore.app/auth"
)

// AddEventScheduleRequest carries the schedule payload plus the auth header.
//
// Mirrors ts-legacy/eventmanager/event-schedules.ts AddScheduleParams
// (POST /api/events/:id/schedules).
type AddEventScheduleRequest struct {
	EventID       string  `json:"eventId"`
	Title         *string `json:"title,omitempty"`
	StartsAt      string  `json:"startsAt"`
	EndsAt        *string `json:"endsAt,omitempty"`
	Location      *string `json:"location,omitempty"`
	Authorization string  `header:"Authorization"`
}

// AddEventScheduleCore adds a schedule slot to an event.
func AddEventScheduleCore(ctx context.Context, p *AddEventScheduleRequest) (*EventDetail, error) {
	var exists bool
	if err := db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM "event" WHERE id = $1)`, p.EventID,
	).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, &errs.Error{Code: errs.NotFound, Message: "event not found"}
	}
	if _, err := auth.RequireEventPermission(ctx, p.Authorization, p.EventID, auth.ActionUpdate); err != nil {
		return nil, err
	}

	startsAt, err := time.Parse(time.RFC3339Nano, p.StartsAt)
	if err != nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "startsAt must be an ISO-8601 timestamp"}
	}
	var endsAt *time.Time
	if p.EndsAt != nil && *p.EndsAt != "" {
		t, err := time.Parse(time.RFC3339Nano, *p.EndsAt)
		if err != nil {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "endsAt must be an ISO-8601 timestamp"}
		}
		utc := t.UTC()
		endsAt = &utc
	}

	if _, err := db.Exec(ctx,
		`INSERT INTO "event_schedule" (id, "eventId", title, "startsAt", "endsAt", location, "createdAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		newID(), p.EventID, p.Title, startsAt.UTC(), endsAt, p.Location, time.Now().UTC()); err != nil {
		return nil, err
	}
	return LoadEvent(ctx, p.EventID)
}

//encore:api public method=POST path=/api/event-schedules
func AddEventSchedule(ctx context.Context, p *AddEventScheduleRequest) (*EventDetail, error) {
	return AddEventScheduleCore(ctx, p)
}
