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
	"encore.app/scorecalc"
)

// Class tiers and datasets endpoints.
//
// Mirrors ts-legacy/eventmanager/classes.ts and datasets.ts.

// ClassTierInfo describes one skill tier.
type ClassTierInfo struct {
	Tier  string `json:"tier"`
	Label string `json:"label"`
	Rank  int    `json:"rank"`
}

// ClassTiersResponse wraps the ordered tier list.
type ClassTiersResponse struct {
	Tiers []ClassTierInfo `json:"tiers"`
}

//encore:api public method=GET path=/api/classes
func ListClassTiers(ctx context.Context) (*ClassTiersResponse, error) {
	resp := &ClassTiersResponse{}
	for i, tier := range ClassTierOrder {
		resp.Tiers = append(resp.Tiers, ClassTierInfo{
			Tier:  string(tier),
			Label: ClassTierLabels[tier],
			Rank:  i + 1,
		})
	}
	return resp, nil
}

// SetUserClassRequest mirrors SetUserClassParams (PUT /api/user-class).
// Organization-scoped: gated by the event-update grant on the organization.
type SetUserClassRequest struct {
	UserID         string  `json:"userId"`
	OrganizationID *string `json:"organizationId,omitempty"`
	ClassTier      *string `json:"classTier"`
}

// SetUserClassResponse echoes the assignment.
type SetUserClassResponse struct {
	UserID         string  `json:"userId"`
	OrganizationID string  `json:"organizationId"`
	ClassTier      *string `json:"classTier"`
}

// getOrgUserTier looks up a participant's class tier within an organization.
// Returns an empty NullString if the event is not org-owned or no tier is assigned.
func getOrgUserTier(ctx context.Context, qq *sqlc.Queries, orgID sql.NullString, userID string) (sql.NullString, error) {
	if !orgID.Valid || orgID.String == "" {
		return sql.NullString{}, nil
	}
	tier, err := qq.GetOrgUserClassTier(ctx, sqlc.GetOrgUserClassTierParams{
		OrganizationId: orgID.String,
		UserId:         userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return sql.NullString{}, nil
	}
	if err != nil {
		return sql.NullString{}, err
	}
	return nullStringFromAny(tier), nil
}

// SetUserClassCore tags a participant with a skill class tier within an organization.
func SetUserClassCore(ctx context.Context, actor *auth.Actor, p *SetUserClassRequest) (*SetUserClassResponse, error) {
	if p.OrganizationID == nil || *p.OrganizationID == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "organizationId is required"}
	}
	orgID := *p.OrganizationID
	if _, _, err := auth.RequirePermission(ctx, actor, orgID, auth.ResourceEvent, auth.ActionUpdate); err != nil {
		return nil, err
	}
	exists, err := q().UserExists(ctx, p.UserID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	}
	if p.ClassTier == nil || *p.ClassTier == "" {
		if err := q().DeleteOrgUserClassTier(ctx, sqlc.DeleteOrgUserClassTierParams{
			OrganizationId: orgID,
			UserId:         p.UserID,
		}); err != nil {
			return nil, err
		}
		scorecalc.InvalidateLeaderboardCache(ctx)
		return &SetUserClassResponse{UserID: p.UserID, OrganizationID: orgID, ClassTier: nil}, nil
	}
	var actorID sql.NullString
	if actor != nil && actor.UserID != "" {
		actorID = sql.NullString{String: actor.UserID, Valid: true}
	}
	if err := q().UpsertOrgUserClassTier(ctx, sqlc.UpsertOrgUserClassTierParams{
		ID:              "oct-" + newID()[:8],
		OrganizationId:  orgID,
		UserId:          p.UserID,
		ClassTier:       *p.ClassTier,
		UpdatedByUserId: actorID,
	}); err != nil {
		return nil, err
	}
	scorecalc.InvalidateLeaderboardCache(ctx)
	return &SetUserClassResponse{UserID: p.UserID, OrganizationID: orgID, ClassTier: p.ClassTier}, nil
}

//encore:api auth method=PUT path=/api/user-class
func SetUserClass(ctx context.Context, p *SetUserClassRequest) (*SetUserClassResponse, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return SetUserClassCore(ctx, actor, p)
}

// OrgClassEntry represents one participant's class grade within an organization.
type OrgClassEntry struct {
	UserID    string  `json:"userId"`
	Name      string  `json:"name"`
	Slug      *string `json:"slug"`
	Image     *string `json:"image"`
	ClassTier *string `json:"classTier"`
	UpdatedAt string  `json:"updatedAt"`
}

// ListOrgClassesQuery lists class grades assigned within an organization.
type ListOrgClassesQuery struct {
	OrganizationID string `query:"organizationId"`
	Search         string `query:"search"`
	Limit          int    `query:"limit"`
	Offset         int    `query:"offset"`
}

// ListOrgClassesResponse wraps paginated org class grade entries.
type ListOrgClassesResponse struct {
	Entries []OrgClassEntry `json:"entries"`
	Total   int             `json:"total"`
}

//encore:api public method=GET path=/api/org-classes
func ListOrgClasses(ctx context.Context, p *ListOrgClassesQuery) (*ListOrgClassesResponse, error) {
	if p.OrganizationID == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "organizationId is required"}
	}
	limit := p.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := p.Offset
	if offset < 0 {
		offset = 0
	}
	pattern := ""
	if p.Search != "" {
		pattern = "%" + p.Search + "%"
	}
	rows, err := q().ListOrgClassTiers(ctx, sqlc.ListOrgClassTiersParams{
		OrganizationId: p.OrganizationID,
		Column2:        pattern,
		Limit:          int32(limit),
		Offset:         int32(offset),
	})
	if err != nil {
		return nil, err
	}
	total, err := q().CountOrgClassTiers(ctx, sqlc.CountOrgClassTiersParams{
		OrganizationId: p.OrganizationID,
		Column2:        pattern,
	})
	if err != nil {
		return nil, err
	}
	entries := make([]OrgClassEntry, 0, len(rows))
	for _, r := range rows {
		entries = append(entries, OrgClassEntry{
			UserID:    r.UserId,
			Name:      r.Name,
			Slug:      nullString(r.Slug),
			Image:     nullString(r.Image),
			ClassTier: classTierPtr(nullStringFromAny(r.ClassTier)),
			UpdatedAt: isoTime(r.UpdatedAt),
		})
	}
	return &ListOrgClassesResponse{Entries: entries, Total: int(total)}, nil
}

// UserOrgClassEntry represents one org-scoped class grade held by a user.
type UserOrgClassEntry struct {
	OrganizationID   string  `json:"organizationId"`
	OrganizationName string  `json:"organizationName"`
	OrganizationSlug string  `json:"organizationSlug"`
	ClassTier        *string `json:"classTier"`
	UpdatedAt        string  `json:"updatedAt"`
}

// ListUserOrgClassesQuery fetches all org-scoped class grades for a user.
type ListUserOrgClassesQuery struct {
	UserID string `query:"userId"`
}

// ListUserOrgClassesResponse wraps the user's org class grades.
type ListUserOrgClassesResponse struct {
	Classes []UserOrgClassEntry `json:"classes"`
}

//encore:api public method=GET path=/api/user-org-classes
func ListUserOrgClasses(ctx context.Context, p *ListUserOrgClassesQuery) (*ListUserOrgClassesResponse, error) {
	if p.UserID == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "userId is required"}
	}
	rows, err := q().ListUserOrgClassTiers(ctx, p.UserID)
	if err != nil {
		return nil, err
	}
	classes := make([]UserOrgClassEntry, 0, len(rows))
	for _, r := range rows {
		classes = append(classes, UserOrgClassEntry{
			OrganizationID:   r.OrganizationId,
			OrganizationName: r.OrganizationName,
			OrganizationSlug: r.OrganizationSlug,
			ClassTier:        classTierPtr(nullStringFromAny(r.ClassTier)),
			UpdatedAt:        isoTime(r.UpdatedAt),
		})
	}
	return &ListUserOrgClassesResponse{Classes: classes}, nil
}

// EligibleRace is one race the participant may enter.
type EligibleRace struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Sequence         int     `json:"sequence"`
	ClassRestriction *string `json:"classRestriction"`
}

// EligibleEvent is one event with enterable races.
type EligibleEvent struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	OrganizationID   *string        `json:"organizationId"`
	ClassRestriction *string        `json:"classRestriction"`
	EligibleRaces    []EligibleRace `json:"eligibleRaces"`
}

// EligibleEventsQuery fetches events a participant may enter.
type EligibleEventsQuery struct {
	UserID string `query:"userId"`
}

// EligibleEventsResponse wraps the eligible event list.
type EligibleEventsResponse struct {
	Events []*EligibleEvent `json:"events"`
}

// ListEligibleEventsCore returns events the participant may enter based on
// org-scoped class tier and each event's class restriction.
func ListEligibleEventsCore(ctx context.Context, query *EligibleEventsQuery) (*EligibleEventsResponse, error) {
	exists, err := sqlc.New(std()).UserExists(ctx, query.UserID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	}
	orgRows, err := sqlc.New(std()).ListUserOrgClassTiers(ctx, query.UserID)
	if err != nil {
		return nil, err
	}
	orgTiers := make(map[string]*ClassTier, len(orgRows))
	for _, or := range orgRows {
		ns := nullStringFromAny(or.ClassTier)
		if ns.Valid && ns.String != "" {
			t := ClassTier(ns.String)
			orgTiers[or.OrganizationId] = &t
		}
	}
	erows, err := sqlc.New(std()).ListEligibleEvents(ctx)
	if err != nil {
		return nil, err
	}
	type eventInfo struct {
		id         string
		name       string
		orgID      sql.NullString
		classRestr sql.NullString
	}
	var events []eventInfo
	for _, er := range erows {
		events = append(events, eventInfo{
			id: er.ID, name: er.Name, orgID: er.OrganizationId,
			classRestr: nullStringFromAny(er.ClassRestriction),
		})
	}
	rrows, err := sqlc.New(std()).ListAllEligibleRaces(ctx)
	if err != nil {
		return nil, err
	}
	racesByEvent := make(map[string][]sqlc.ListAllEligibleRacesRow, len(events))
	for _, rr := range rrows {
		racesByEvent[rr.EventId] = append(racesByEvent[rr.EventId], rr)
	}

	resp := &EligibleEventsResponse{Events: []*EligibleEvent{}}
	for _, e := range events {
		var tier *ClassTier
		if e.orgID.Valid {
			tier = orgTiers[e.orgID.String]
		}
		var eventRestr *ClassTier
		if e.classRestr.Valid {
			t := ClassTier(e.classRestr.String)
			eventRestr = &t
		}
		eventEligible := IsEligible(tier, eventRestr)
		rlist := racesByEvent[e.id]
		eligibleRaces := []EligibleRace{}
		for _, rr := range rlist {
			rc := nullStringFromAny(rr.ClassRestriction)
			effective := eventRestr
			if rc.Valid {
				t := ClassTier(rc.String)
				effective = &t
			}
			if IsEligible(tier, effective) {
				var effStr *string
				if effective != nil {
					s := string(*effective)
					effStr = &s
				}
				eligibleRaces = append(eligibleRaces, EligibleRace{
					ID: rr.ID, Name: rr.Name, Sequence: int(rr.Sequence), ClassRestriction: effStr,
				})
			}
		}
		if eventEligible || len(eligibleRaces) > 0 {
			resp.Events = append(resp.Events, &EligibleEvent{
				ID:               e.id,
				Name:             e.name,
				OrganizationID:   nullString(e.orgID),
				ClassRestriction: nullString(e.classRestr),
				EligibleRaces:    eligibleRaces,
			})
		}
	}
	return resp, nil
}

//encore:api public method=GET path=/api/eligible-events
func ListEligibleEvents(ctx context.Context, q *EligibleEventsQuery) (*EligibleEventsResponse, error) {
	return ListEligibleEventsCore(ctx, q)
}

// --- Datasets ---

// DatasetView mirrors the TS DatasetView.
type DatasetView struct {
	ID         string  `json:"id"`
	EventID    string  `json:"eventId"`
	Source     string  `json:"source"`
	Rows       int     `json:"rows"`
	Status     string  `json:"status"`
	ImportedAt *string `json:"importedAt"`
	CreatedAt  string  `json:"createdAt"`
	UpdatedAt  string  `json:"updatedAt"`
}

type datasetRow struct {
	ID         string
	EventID    string
	Source     string
	Rows       int
	Status     string
	ImportedAt *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func toDatasetView(d *datasetRow) *DatasetView {
	return &DatasetView{
		ID:         d.ID,
		EventID:    d.EventID,
		Source:     d.Source,
		Rows:       d.Rows,
		Status:     d.Status,
		ImportedAt: nullTime(d.ImportedAt),
		CreatedAt:  isoTime(d.CreatedAt),
		UpdatedAt:  isoTime(d.UpdatedAt),
	}
}

// DatasetsQuery scopes dataset listing by event.
type DatasetsQuery struct {
	EventID string `query:"eventId"`
}

// DatasetsResponse wraps the dataset list.
type DatasetsResponse struct {
	Datasets []*DatasetView `json:"datasets"`
}

// toDatasetRow maps a sqlc dataset row onto the local datasetRow.
func toDatasetRow(id, eventID, source string, rows int32, status any, importedAt sql.NullTime, createdAt, updatedAt time.Time) *datasetRow {
	return &datasetRow{
		ID: id, EventID: eventID, Source: source, Rows: int(rows),
		Status: stringFromAny(status), ImportedAt: timePtrFromNull(importedAt),
		CreatedAt: createdAt, UpdatedAt: updatedAt,
	}
}

// ListDatasetsCore lists datasets scoped by event.
func ListDatasetsCore(ctx context.Context, q *DatasetsQuery) (*DatasetsResponse, error) {
	if _, err := requireEventRow(ctx, q.EventID); err != nil {
		return nil, err
	}
	drows, err := sqlc.New(std()).ListDatasetsByEvent(ctx, q.EventID)
	if err != nil {
		return nil, err
	}
	resp := &DatasetsResponse{Datasets: []*DatasetView{}}
	for _, dr := range drows {
		resp.Datasets = append(resp.Datasets, toDatasetView(toDatasetRow(
			dr.ID, dr.EventId, dr.Source, dr.Rows, dr.Status,
			dr.ImportedAt, dr.CreatedAt, dr.UpdatedAt)))
	}
	return resp, nil
}

//encore:api public method=GET path=/api/datasets-list
func ListDatasets(ctx context.Context, q *DatasetsQuery) (*DatasetsResponse, error) {
	return ListDatasetsCore(ctx, q)
}

// CreateDatasetRequest mirrors CreateDatasetParams.
type CreateDatasetRequest struct {
	EventID string  `json:"eventId"`
	Source  string  `json:"source"`
	Rows    int     `json:"rows"`
	Status  *string `json:"status,omitempty"`
}

// CreateDatasetCore creates a dataset record for an event.
func CreateDatasetCore(ctx context.Context, actor *auth.Actor, p *CreateDatasetRequest) (*DatasetView, error) {
	if _, err := requireEventRow(ctx, p.EventID); err != nil {
		return nil, err
	}
	if _, err := auth.RequireEventPermission(ctx, actor, p.EventID, auth.ActionUpdate); err != nil {
		return nil, err
	}
	status := "PENDING"
	if p.Status != nil {
		status = *p.Status
	}
	var importedAt *time.Time
	if status == "DONE" {
		now := time.Now().UTC()
		importedAt = &now
	}
	id := "dataset-" + newID()[:8]
	now := time.Now().UTC()
	created, err := q().CreateDataset(ctx, sqlc.CreateDatasetParams{
		ID: id, EventId: p.EventID, Source: p.Source, Rows: int32(p.Rows),
		Status: status, ImportedAt: nullTimeFromPtr(importedAt), CreatedAt: now,
	})
	if err != nil {
		return nil, err
	}
	return toDatasetView(toDatasetRow(
		created.ID, created.EventId, created.Source, created.Rows, created.Status,
		created.ImportedAt, created.CreatedAt, created.UpdatedAt)), nil
}

//encore:api auth method=POST path=/api/datasets
func CreateDataset(ctx context.Context, p *CreateDatasetRequest) (*DatasetView, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return CreateDatasetCore(ctx, actor, p)
}

// UpdateDatasetStatusRequest mirrors UpdateDatasetStatusParams.
type UpdateDatasetStatusRequest struct {
	EventID   string `json:"eventId"`
	DatasetID string `json:"datasetId"`
	Status    string `json:"status"`
}

// UpdateDatasetStatusCore updates a dataset record's processing status.
func UpdateDatasetStatusCore(ctx context.Context, actor *auth.Actor, p *UpdateDatasetStatusRequest) (*DatasetView, error) {
	if _, err := requireEventRow(ctx, p.EventID); err != nil {
		return nil, err
	}
	if _, err := auth.RequireEventPermission(ctx, actor, p.EventID, auth.ActionUpdate); err != nil {
		return nil, err
	}
	fetched, err := q().GetDatasetByID(ctx, sqlc.GetDatasetByIDParams{
		ID: p.DatasetID, EventId: p.EventID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "dataset not found"}
	}
	if err != nil {
		return nil, err
	}
	d := toDatasetRow(
		fetched.ID, fetched.EventId, fetched.Source, fetched.Rows, fetched.Status,
		fetched.ImportedAt, fetched.CreatedAt, fetched.UpdatedAt)
	importedAt := d.ImportedAt
	if p.Status == "DONE" {
		now := time.Now().UTC()
		importedAt = &now
	}
	updated, err := q().UpdateDatasetStatus(ctx, sqlc.UpdateDatasetStatusParams{
		Status: p.Status, ImportedAt: nullTimeFromPtr(importedAt), ID: p.DatasetID,
	})
	if err != nil {
		return nil, err
	}
	return toDatasetView(toDatasetRow(
		updated.ID, updated.EventId, updated.Source, updated.Rows, updated.Status,
		updated.ImportedAt, updated.CreatedAt, updated.UpdatedAt)), nil
}

//encore:api auth method=PUT path=/api/dataset-status
func UpdateDatasetStatus(ctx context.Context, p *UpdateDatasetStatusRequest) (*DatasetView, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return UpdateDatasetStatusCore(ctx, actor, p)
}
