package eventmanager

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/et"
	"encore.app/shared"
)

// TestMain sets up a single shared test database for all tests in this package.
func TestMain(m *testing.M) {
	ctx := context.Background()
	testDB, err := et.NewTestDatabase(ctx, "lightwing")
	if err == nil {
		shared.SetTestDB(testDB)
	}
	code := m.Run()
	os.Exit(code)
}

// fixtures tracks rows created by a test for ordered cleanup.
type fixtures struct {
	t      *testing.T
	ctx    context.Context
	users  []string
	tokens []string
	events []string
}

func newFixtures(t *testing.T) *fixtures {
	t.Helper()
	f := &fixtures{t: t, ctx: context.Background()}
	t.Cleanup(f.cleanup)
	return f
}

func (f *fixtures) cleanup() {
	ctx := context.Background()
	if len(f.events) > 0 {
		_, _ = shared.DB.Exec(ctx,
			`DELETE FROM "race_result" WHERE "raceEventId" IN (SELECT id FROM "race_event" WHERE "eventId" = ANY($1))`, f.events)
		_, _ = shared.DB.Exec(ctx,
			`DELETE FROM "race_event_member" WHERE "raceEventId" IN (SELECT id FROM "race_event" WHERE "eventId" = ANY($1))`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "race_event" WHERE "eventId" = ANY($1)`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "event_points_entry" WHERE "eventId" = ANY($1)`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "event_ladder_entry" WHERE "eventId" = ANY($1)`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "event_member" WHERE "eventId" = ANY($1)`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "event_admin" WHERE "eventId" = ANY($1)`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "event_schedule" WHERE "eventId" = ANY($1)`, f.events)
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "event" WHERE id = ANY($1)`, f.events)
	}
	if len(f.tokens) > 0 {
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "session" WHERE token = ANY($1)`, f.tokens)
	}
	if len(f.users) > 0 {
		_, _ = shared.DB.Exec(ctx, `DELETE FROM "user" WHERE id = ANY($1)`, f.users)
	}
}

// createUser inserts a user with a unique id/email and returns its id.
func (f *fixtures) createUser(prefix, name string, classTier *string, siteRole string) string {
	f.t.Helper()
	id := prefix + "-" + newID()[:8]
	now := time.Now().UTC()
	var tier any
	if classTier != nil {
		tier = *classTier
	}
	_, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "user" (id, name, email, image, "siteRole", "vrchatUsername", slug, "classTier", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, '', $4, NULL, $5, $6, $7, $7)`,
		id, name, id+"@example.com", siteRole, "slug-"+id, tier, now)
	if err != nil {
		f.t.Fatalf("insert user: %v", err)
	}
	f.users = append(f.users, id)
	return id
}

// createSession mints a Bearer *** for a user.
func (f *fixtures) createSession(userID string) string {
	f.t.Helper()
	token := "token-" + newID()
	now := time.Now().UTC()
	_, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "session" (id, "userId", token, "activeOrganizationId", "expiresAt", "createdAt", "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, NULL, $3, $4, $4)`,
		userID, token, now.Add(time.Hour), now)
	if err != nil {
		f.t.Fatalf("insert session: %v", err)
	}
	f.tokens = append(f.tokens, token)
	return "Bearer " + token
}

func strptr(s string) *string { return &s }

// createEventDirect inserts an event row without going through the API.
func (f *fixtures) createEventDirect(ownerID, name, status string, restriction *string, granular bool) string {
	f.t.Helper()
	id := "event-" + newID()[:8]
	now := time.Now().UTC()
	var r any
	if restriction != nil {
		r = *restriction
	}
	_, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "event" (id, name, "ownerType", "ownerUserId", status, "scoringType",
		  "classRestriction", "granularParticipation", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'USER', $3, $4, 1, $5, $6, $7, $7)`,
		id, name, ownerID, status, r, granular, now)
	if err != nil {
		f.t.Fatalf("insert event: %v", err)
	}
	f.events = append(f.events, id)
	return id
}

// createEventDirectWithLimit inserts an event row with a participant limit.
func (f *fixtures) createEventDirectWithLimit(ownerID, name string, limit int) string {
	f.t.Helper()
	id := "event-" + newID()[:8]
	now := time.Now().UTC()
	_, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "event" (id, name, "ownerType", "ownerUserId", status, "scoringType",
		  "participantLimit", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'USER', $3, 'UNOFFICIAL', 1, $4, $5, $5)`,
		id, name, ownerID, limit, now)
	if err != nil {
		f.t.Fatalf("insert event: %v", err)
	}
	f.events = append(f.events, id)
	return id
}

// createRace inserts a race_event row for an event.
func (f *fixtures) createRace(eventID, name string) string {
	f.t.Helper()
	id := "race-" + newID()[:8]
	now := time.Now().UTC()
	_, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "race_event" (id, "eventId", name, sequence, "distanceMeters", "trackType", location, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, 1, 1200, 'Turf', 'Kyoto', $4, $4)`,
		id, eventID, name, now)
	if err != nil {
		f.t.Fatalf("insert race: %v", err)
	}
	return id
}

// requireErrCode asserts err is an Encore error with the given code.
func requireErrCode(t *testing.T, err error, code errs.ErrCode, substr string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error containing %q, got nil", substr)
	}
	if errs.Code(err) != code {
		t.Fatalf("error code = %v, want %v (err: %v)", errs.Code(err), code, err)
	}
	if substr != "" && !strings.Contains(err.Error(), substr) {
		t.Fatalf("error %q does not contain %q", err.Error(), substr)
	}
}

// --- Mirrors join_leave.test.ts: joinEvent and leaveEvent public endpoints ---

func Test_JoinAndLeaveUnofficialEvent(t *testing.T) {
	f := newFixtures(t)
	userID := f.createUser("participant", "Participant User", strptr("OP"), "USER")
	token := f.createSession(userID)
	eventID := f.createEventDirect(userID, "Summer Open", "UNOFFICIAL", strptr("OP"), false)

	joined, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: token})
	if err != nil {
		t.Fatalf("join: %v", err)
	}
	if joined.ID != eventID {
		t.Errorf("joined.ID = %q, want %q", joined.ID, eventID)
	}
	if len(joined.Members) != 1 || joined.Members[0].UserID != userID {
		t.Fatalf("joined members = %+v, want 1 member %q", joined.Members, userID)
	}
	if joined.Members[0].Name != "Participant User" {
		t.Errorf("member name = %q, want %q", joined.Members[0].Name, "Participant User")
	}

	loaded, err := LoadEvent(f.ctx, eventID)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(loaded.Members) != 1 {
		t.Fatalf("loaded members = %d, want 1", len(loaded.Members))
	}

	left, err := LeaveEventCore(f.ctx, &LeaveEventRequest{EventID: eventID, Authorization: token})
	if err != nil {
		t.Fatalf("leave: %v", err)
	}
	if len(left.Members) != 0 {
		t.Fatalf("members after leave = %d, want 0", len(left.Members))
	}
	loadedAfter, err := LoadEvent(f.ctx, eventID)
	if err != nil {
		t.Fatalf("load after leave: %v", err)
	}
	if len(loadedAfter.Members) != 0 {
		t.Fatalf("loaded members after leave = %d, want 0", len(loadedAfter.Members))
	}
}

func Test_JoinRejectedOnDraftOrConcluded(t *testing.T) {
	f := newFixtures(t)
	userID := f.createUser("participant", "Participant User", strptr("G3"), "USER")
	token := f.createSession(userID)
	draftID := f.createEventDirect(userID, "Draft Cup", "DRAFT", strptr("G3"), false)
	concludedID := f.createEventDirect(userID, "Concluded Cup", "CONCLUDED", strptr("G3"), false)

	_, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: draftID, Authorization: token})
	requireErrCode(t, err, errs.FailedPrecondition, "not open for public signup")
	_, err = JoinEventCore(f.ctx, &JoinEventRequest{EventID: concludedID, Authorization: token})
	requireErrCode(t, err, errs.FailedPrecondition, "not open for public signup")
}

func Test_JoinRejectedOnClassTierMismatch(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	userID := f.createUser("participant-low", "Low Tier Participant", strptr("G1"), "USER")
	token := f.createSession(userID)
	eventID := f.createEventDirect(creatorID, "Elite G3 Championship", "OFFICIAL", strptr("G3"), false)

	_, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: token})
	requireErrCode(t, err, errs.FailedPrecondition, "class tier does not satisfy")
}

// --- Mirrors join_leave.test.ts: signupsLocked enforcement ---

func Test_SignupsLockedBlocksSelfService(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	creatorToken := f.createSession(creatorID)
	userID := f.createUser("participant", "Participant User", strptr("OP"), "USER")
	token := f.createSession(userID)
	eventID := f.createEventDirect(creatorID, "Summer Open", "UNOFFICIAL", strptr("OP"), false)

	if _, err := SetEventSignupsLockedCore(f.ctx, &SetEventSignupsLockedRequest{
		EventID: eventID, Locked: true, Authorization: creatorToken,
	}); err != nil {
		t.Fatalf("lock: %v", err)
	}

	_, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: token})
	requireErrCode(t, err, errs.FailedPrecondition, "signups are locked")

	// Admin bypass still works while locked.
	if _, err := AddEventMemberCore(f.ctx, &AddEventMemberRequest{
		EventID: eventID, UserID: userID, Authorization: creatorToken,
	}); err != nil {
		t.Fatalf("admin add while locked: %v", err)
	}
	_, err = LeaveEventCore(f.ctx, &LeaveEventRequest{EventID: eventID, Authorization: token})
	requireErrCode(t, err, errs.FailedPrecondition, "signups are locked")
}

func Test_AdminMutationsSucceedWhileLocked(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	creatorToken := f.createSession(creatorID)
	userID := f.createUser("participant", "Participant User", strptr("OP"), "USER")
	eventID := f.createEventDirect(creatorID, "Summer Open", "UNOFFICIAL", strptr("OP"), false)

	if _, err := SetEventSignupsLockedCore(f.ctx, &SetEventSignupsLockedRequest{
		EventID: eventID, Locked: true, Authorization: creatorToken,
	}); err != nil {
		t.Fatalf("lock: %v", err)
	}
	added, err := AddEventMemberCore(f.ctx, &AddEventMemberRequest{
		EventID: eventID, UserID: userID, Authorization: creatorToken,
	})
	if err != nil {
		t.Fatalf("admin add: %v", err)
	}
	if len(added.Members) != 1 {
		t.Fatalf("members = %d, want 1", len(added.Members))
	}
	removed, err := RemoveEventMemberCore(f.ctx, &RemoveEventMemberRequest{
		EventID: eventID, UserID: userID, Authorization: creatorToken,
	})
	if err != nil {
		t.Fatalf("admin remove: %v", err)
	}
	if len(removed.Members) != 0 {
		t.Fatalf("members = %d, want 0", len(removed.Members))
	}
}

// --- Mirrors join_leave.test.ts: withdrawal cleanup ---

func Test_LeaveRemovesStandingsAndRaceRows(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	creatorToken := f.createSession(creatorID)
	userID := f.createUser("participant", "Participant User", strptr("OP"), "USER")
	token := f.createSession(userID)
	eventID := f.createEventDirect(creatorID, "Championship Series", "UNOFFICIAL", strptr("OP"), false)
	raceID := f.createRace(eventID, "Race 1")

	if _, err := AddEventMemberCore(f.ctx, &AddEventMemberRequest{
		EventID: eventID, UserID: userID, Authorization: creatorToken,
	}); err != nil {
		t.Fatalf("add member: %v", err)
	}
	now := time.Now().UTC()
	if _, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "race_event_member" (id, "raceEventId", "userId", "createdAt") VALUES ($1,$2,$3,$4)`,
		"rem-"+newID()[:8], raceID, userID, now); err != nil {
		t.Fatalf("insert race member: %v", err)
	}
	if _, err := shared.DB.Exec(f.ctx,
		`INSERT INTO "race_result" (id, "raceEventId", "userId", position, points, "createdAt", "updatedAt")
		 VALUES ($1,$2,$3,1,10,$4,$4)`,
		"res-"+newID()[:8], raceID, userID, now); err != nil {
		t.Fatalf("insert result: %v", err)
	}

	count := func(q string, args ...any) int {
		var n int
		if err := shared.DB.QueryRow(f.ctx, q, args...).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
		return n
	}
	if n := count(`SELECT COUNT(*) FROM "event_member" WHERE "eventId"=$1 AND "userId"=$2`, eventID, userID); n != 1 {
		t.Fatalf("event_member rows = %d, want 1", n)
	}
	if n := count(`SELECT COUNT(*) FROM "event_points_entry" WHERE "eventId"=$1 AND "userId"=$2`, eventID, userID); n != 1 {
		t.Fatalf("points rows = %d, want 1", n)
	}

	if _, err := LeaveEventCore(f.ctx, &LeaveEventRequest{EventID: eventID, Authorization: token}); err != nil {
		t.Fatalf("leave: %v", err)
	}
	tables := [][2]string{
		{`SELECT COUNT(*) FROM "event_member" WHERE "eventId"=$1 AND "userId"=$2`, eventID},
		{`SELECT COUNT(*) FROM "event_points_entry" WHERE "eventId"=$1 AND "userId"=$2`, eventID},
		{`SELECT COUNT(*) FROM "event_ladder_entry" WHERE "eventId"=$1 AND "userId"=$2`, eventID},
		{`SELECT COUNT(*) FROM "race_event_member" WHERE "raceEventId"=$1 AND "userId"=$2`, raceID},
		{`SELECT COUNT(*) FROM "race_result" WHERE "raceEventId"=$1 AND "userId"=$2`, raceID},
	}
	for _, tc := range tables {
		if n := count(tc[0], tc[1], userID); n != 0 {
			t.Errorf("rows after leave = %d, want 0 (%s)", n, tc[0])
		}
	}
}

// --- Mirrors join_leave.test.ts: time + participation controls (event scope) ---

func Test_ScheduledAtRoundTrip(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	creatorToken := f.createSession(creatorID)
	iso := "2026-12-25T18:00:00.000Z"
	detail, err := CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: creatorToken, Name: "Scheduled Event",
		OwnerType: "USER", ScoringType: ScoringPoints, ScheduledAt: &iso,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	f.events = append(f.events, detail.ID)
	if detail.ScheduledAt == nil {
		t.Fatalf("scheduledAt is nil")
	}
	got, err := time.Parse(time.RFC3339Nano, *detail.ScheduledAt)
	if err != nil {
		t.Fatalf("parse scheduledAt: %v", err)
	}
	want, _ := time.Parse(time.RFC3339Nano, iso)
	if !got.Equal(want) {
		t.Errorf("scheduledAt = %q, want %q", *detail.ScheduledAt, iso)
	}
}

func Test_RegularEventEnforcesParticipantLimit(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	eventID := f.createEventDirectWithLimit(creatorID, "Cap 2 Event", 2)

	tokens := []string{}
	for _, p := range []string{"u1", "u2", "u3"} {
		uid := f.createUser(p, "User "+p, strptr("OP"), "USER")
		tokens = append(tokens, f.createSession(uid))
	}
	if _, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: tokens[0]}); err != nil {
		t.Fatalf("join 1: %v", err)
	}
	if _, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: tokens[1]}); err != nil {
		t.Fatalf("join 2: %v", err)
	}
	_, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: tokens[2]})
	requireErrCode(t, err, errs.FailedPrecondition, "capacity has been reached")
}

// --- participation-limits.ts unit coverage ---

func Test_ParseOptionalPositiveInt(t *testing.T) {
	if v, err := ParseOptionalPositiveInt(nil, "participantLimit"); err != nil || v != nil {
		t.Errorf("nil = %v, %v; want nil, nil", v, err)
	}
	if v, err := ParseOptionalPositiveInt(float64(3), "participantLimit"); err != nil || v == nil || *v != 3 {
		t.Errorf("3 = %v, %v; want 3, nil", v, err)
	}
	for _, bad := range []any{float64(0), float64(-5), float64(1.5), "abc", true} {
		if _, err := ParseOptionalPositiveInt(bad, "participantLimit"); err == nil {
			t.Errorf("value %v (%T): expected error, got nil", bad, bad)
		} else if errs.Code(err) != errs.InvalidArgument {
			t.Errorf("value %v: code = %v, want InvalidArgument", bad, errs.Code(err))
		}
	}
	if err := AssertLimitCanBeReduced(2, 1, CodeParticipantLimitBelowEnrollment, "too low"); err == nil {
		t.Errorf("expected reduction error, got nil")
	}
	if err := AssertLimitCanBeReduced(2, 2, CodeParticipantLimitBelowEnrollment, "too low"); err != nil {
		t.Errorf("equal limit should pass, got %v", err)
	}
}

// --- create/update validation (events.ts + event-updates.ts) ---

func Test_CreateEventValidation(t *testing.T) {
	f := newFixtures(t)
	userID := f.createUser("creator", "Creator User", nil, "USER")
	token := f.createSession(userID)

	two := 2
	_, err := CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: token, Name: "Granular Capped", OwnerType: "USER",
		ScoringType: ScoringPoints, GranularParticipation: true,
		ParticipantLimit: OptInt{Set: true, Value: &two},
	})
	requireErrCode(t, err, errs.InvalidArgument, "Granular events cannot have")

	_, err = CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: token, Name: "Regular Maxed", OwnerType: "USER",
		ScoringType: ScoringPoints,
		MaxConcurrentRaceParticipations: OptInt{Set: true, Value: &two},
	})
	requireErrCode(t, err, errs.InvalidArgument, "Regular events cannot have")

	custom := "CUSTOM"
	_, err = CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: token, Name: "Custom No Tables", OwnerType: "USER",
		ScoringType: ScoringPoints, ScoringRulesMode: &custom,
	})
	requireErrCode(t, err, errs.InvalidArgument, "customScoringTables is required")

	org := "org-" + newID()[:8]
	_, err = CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: token, Name: "Org Event", OwnerType: "ORGANIZATION",
		OrganizationID: &org, ScoringType: ScoringPoints,
	})
	requireErrCode(t, err, errs.PermissionDenied, "")
}

func Test_UpdateEventLimitReductionRejected(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	creatorToken := f.createSession(creatorID)
	eventID := f.createEventDirectWithLimit(creatorID, "Capped Event", 5)

	for _, p := range []string{"m1", "m2"} {
		uid := f.createUser(p, "Member "+p, strptr("OP"), "USER")
		tok := f.createSession(uid)
		if _, err := JoinEventCore(f.ctx, &JoinEventRequest{EventID: eventID, Authorization: tok}); err != nil {
			t.Fatalf("join: %v", err)
		}
	}
	one := 1
	_, err := UpdateEventCore(f.ctx, &UpdateEventRequest{
		ID: eventID, Authorization: creatorToken,
		ParticipantLimit: OptInt{Set: true, Value: &one},
	})
	requireErrCode(t, err, errs.FailedPrecondition, "cannot be lower than the current enrollment")

	renamed := "Renamed Event"
	updated, err := UpdateEventCore(f.ctx, &UpdateEventRequest{
		ID: eventID, Authorization: creatorToken, Name: &renamed,
	})
	if err != nil {
		t.Fatalf("rename: %v", err)
	}
	if updated.Name != renamed {
		t.Errorf("name = %q, want %q", updated.Name, renamed)
	}
}

// --- schedules + admins ---

func Test_AddScheduleAndAdmins(t *testing.T) {
	f := newFixtures(t)
	creatorID := f.createUser("creator", "Creator User", nil, "USER")
	creatorToken := f.createSession(creatorID)
	eventID := f.createEventDirect(creatorID, "Scheduled Admin Event", "UNOFFICIAL", nil, false)

	withSched, err := AddEventScheduleCore(f.ctx, &AddEventScheduleRequest{
		EventID: eventID, Authorization: creatorToken,
		Title: strptr("Qualifiers"), StartsAt: "2026-09-01T10:00:00Z", Location: strptr("Hall A"),
	})
	if err != nil {
		t.Fatalf("add schedule: %v", err)
	}
	if len(withSched.Schedules) != 1 || withSched.Schedules[0].Title == nil ||
		*withSched.Schedules[0].Title != "Qualifiers" {
		t.Fatalf("schedules = %+v, want 1 titled Qualifiers", withSched.Schedules)
	}

	adminID := f.createUser("admin2", "Second Admin", nil, "USER")
	if _, err := AddEventAdminCore(f.ctx, &AddEventAdminRequest{
		EventID: eventID, UserID: adminID, Authorization: creatorToken,
	}); err != nil {
		t.Fatalf("add admin: %v", err)
	}
	listed, err := ListEventAdminsCore(f.ctx, eventID)
	if err != nil {
		t.Fatalf("list admins: %v", err)
	}
	if len(listed.Admins) != 1 || listed.Admins[0].UserID != adminID {
		t.Fatalf("admins = %+v, want [%q]", listed.Admins, adminID)
	}
	if _, err := RemoveEventAdminCore(f.ctx, &RemoveEventAdminRequest{
		EventID: eventID, UserID: adminID, Authorization: creatorToken,
	}); err != nil {
		t.Fatalf("remove admin: %v", err)
	}
	listed, err = ListEventAdminsCore(f.ctx, eventID)
	if err != nil {
		t.Fatalf("list admins: %v", err)
	}
	if len(listed.Admins) != 0 {
		t.Fatalf("admins = %+v, want empty", listed.Admins)
	}
}

// --- list + delete ---

func Test_ListAndDeleteEvents(t *testing.T) {
	f := newFixtures(t)
	userID := f.createUser("lister", "Lister User", nil, "USER")
	token := f.createSession(userID)

	a, err := CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: token, Name: "List Event A " + newID()[:8],
		OwnerType: "USER", ScoringType: ScoringPoints,
	})
	if err != nil {
		t.Fatalf("create A: %v", err)
	}
	f.events = append(f.events, a.ID)
	if a.ScoringTypeLabel != "points-based" || a.Status != "UNOFFICIAL" {
		t.Errorf("detail = label %q status %q", a.ScoringTypeLabel, a.Status)
	}
	b, err := CreateEventCore(f.ctx, &CreateEventRequest{
		Authorization: token, Name: "List Event B " + newID()[:8],
		OwnerType: "USER", ScoringType: ScoringLadder,
	})
	if err != nil {
		t.Fatalf("create B: %v", err)
	}
	f.events = append(f.events, b.ID)
	if b.ScoringTypeLabel != "ladder-elo" {
		t.Errorf("ladder label = %q", b.ScoringTypeLabel)
	}
	draftID := f.createEventDirect(userID, "Draft Hidden "+newID()[:8], "DRAFT", nil, false)

	listed, err := ListEventsCore(f.ctx, &ListEventsQuery{Limit: 50})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if listed.Total < 3 {
		t.Errorf("total = %d, want >= 3", listed.Total)
	}
	seen := map[string]bool{}
	for _, e := range listed.Events {
		seen[e.ID] = true
	}
	for _, id := range []string{a.ID, b.ID, draftID} {
		if !seen[id] {
			t.Errorf("list missing %s", id)
		}
	}

	pub, err := ListPublicEventsCore(f.ctx, &ListPublicEventsQuery{Limit: 50})
	if err != nil {
		t.Fatalf("public list: %v", err)
	}
	pubSeen := map[string]bool{}
	for _, e := range pub.Events {
		pubSeen[e.ID] = true
	}
	if !pubSeen[a.ID] || !pubSeen[b.ID] {
		t.Errorf("public list missing created events")
	}
	if pubSeen[draftID] {
		t.Errorf("public list must exclude DRAFT events")
	}

	del, err := DeleteEventCore(f.ctx, &DeleteEventRequest{ID: a.ID, Authorization: token})
	if err != nil || !del.Deleted {
		t.Fatalf("delete: %v %+v", del, err)
	}
	if _, err := LoadEvent(f.ctx, a.ID); errs.Code(err) != errs.NotFound {
		t.Fatalf("load after delete: code = %v, want NotFound", errs.Code(err))
	}
}

// NOTE on ordering.test.ts and eligible_races.test.ts: both exercise
// race-scoped services (raceevents.ts createRaceEvent/reorderRaceEvents and
// classes.ts listEligibleEvents), which are ported separately. The event-level
// behaviors those files depend on (join/leave, signups lock, member cleanup,
// participant limits, schedules) are covered above.
