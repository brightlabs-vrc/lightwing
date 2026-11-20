package eventmanager

import (
	"testing"
	"time"

	"encore.app/auth"
	"encore.dev/beta/errs"
)

func TestTeamEventRosterAndSubstitutionFlow(t *testing.T) {
	f := newFixtures(t)

	adminID := f.createUser("tadm", "Event Admin", nil, "SITE_ADMIN")
	captainID := f.createUser("tcap", "Team Captain", nil, "USER")
	racer1ID := f.createUser("tr1", "Racer One", nil, "USER")
	racer2ID := f.createUser("tr2", "Racer Two", nil, "USER")
	backupID := f.createUser("tbk", "Backup Racer", nil, "USER")
	outsiderID := f.createUser("tout", "Outsider", nil, "USER")

	adminActor := &auth.Actor{UserID: adminID, SiteRole: auth.SiteRoleSiteAdmin}
	captainActor := &auth.Actor{UserID: captainID, SiteRole: auth.SiteRoleUser}

	// Create an approved team and assign members.
	teamID := "team-" + newID()[:8]
	now := time.Now().UTC()
	_, err := db.Exec(f.ctx,
		`INSERT INTO "team" (id, name, slug, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'APPROVED', $4, $4)`,
		teamID, "Apex Racers", "apex-"+teamID, now)
	if err != nil {
		t.Fatalf("insert team: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(f.ctx, `DELETE FROM "team" WHERE id = $1`, teamID)
	})

	for _, tm := range []struct {
		uid  string
		role string
	}{
		{captainID, "administrator"},
		{racer1ID, "member"},
		{racer2ID, "member"},
		{backupID, "member"},
	} {
		_, err := db.Exec(f.ctx,
			`INSERT INTO "teamMember" (id, "teamId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
			"tm-"+newID()[:8], teamID, tm.uid, tm.role, now)
		if err != nil {
			t.Fatalf("insert teamMember: %v", err)
		}
	}

	// 1. Create a team-based event with maxPrimaryRosterSize=2, maxBackupRosterSize=1, participantLimit=2 (max 2 teams).
	maxPrimary := 2
	maxBackup := 1
	maxTeams := 2
	evt, err := CreateEventCore(f.ctx, adminActor, &CreateEventRequest{
		Name:                  "Team Championship",
		OwnerType:             "USER",
		ScoringType:           ScoringPoints,
		GranularParticipation: false,
		ParticipantLimit:      OptInt{Set: true, Value: &maxTeams},
		IsTeamEvent:           true,
		MaxPrimaryRosterSize:  OptInt{Set: true, Value: &maxPrimary},
		MaxBackupRosterSize:   OptInt{Set: true, Value: &maxBackup},
	})
	if err != nil {
		t.Fatalf("CreateEventCore: %v", err)
	}
	f.events = append(f.events, evt.ID)

	if !evt.IsTeamEvent {
		t.Fatalf("expected IsTeamEvent=true")
	}
	if evt.MaxPrimaryRosterSize == nil || *evt.MaxPrimaryRosterSize != 2 {
		t.Fatalf("expected MaxPrimaryRosterSize=2, got %v", evt.MaxPrimaryRosterSize)
	}

	// Publish event so team admin self-service is open.
	if _, err := db.Exec(f.ctx, `UPDATE "event" SET status = 'PENDING' WHERE id = $1`, evt.ID); err != nil {
		t.Fatalf("publish event: %v", err)
	}

	// 2. Outsider cannot be added to team roster.
	if _, err := UpsertEventTeamRosterCore(f.ctx, captainActor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         teamID,
		PrimaryUserIDs: []string{outsiderID},
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for non-team member, got %v", err)
	}

	// 3. Exceeding primary limit fails.
	if _, err := UpsertEventTeamRosterCore(f.ctx, captainActor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         teamID,
		PrimaryUserIDs: []string{racer1ID, racer2ID, backupID},
	}); errs.Code(err) != errs.InvalidArgument {
		t.Fatalf("expected InvalidArgument when exceeding primary limit, got %v", err)
	}

	// 4. Valid team roster registration by Team Captain.
	evt, err = UpsertEventTeamRosterCore(f.ctx, captainActor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         teamID,
		PrimaryUserIDs: []string{racer1ID, racer2ID},
		BackupUserIDs:  []string{backupID},
	})
	if err != nil {
		t.Fatalf("UpsertEventTeamRosterCore: %v", err)
	}
	if len(evt.Teams) != 1 || len(evt.Teams[0].PrimaryRoster) != 2 || len(evt.Teams[0].BackupRoster) != 1 {
		t.Fatalf("unexpected team roster counts: %+v", evt.Teams)
	}

	// 5. Create a race and verify PRIMARY-only lineup enforcement.
	race, err := CreateRaceEventCore(f.ctx, adminActor, &CreateRaceEventRequest{
		EventID:        evt.ID,
		Name:           "Heat 1",
		DistanceMeters: 1600,
		TrackType:      "Turf",
		Location:       "Tokyo",
	})
	if err != nil {
		t.Fatalf("CreateRaceEventCore: %v", err)
	}

	// Backup member cannot be added to race lineup directly or have results recorded.
	if _, err := AddRaceEventMemberCore(f.ctx, adminActor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  backupID,
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for BACKUP race lineup add, got %v", err)
	}
	if err := RequireMembershipForResult(f.ctx, evt.ID, race.ID, backupID); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for BACKUP RequireMembershipForResult, got %v", err)
	}

	// Primary member succeeds for both race lineup and result recording.
	if err := RequireMembershipForResult(f.ctx, evt.ID, race.ID, racer1ID); err != nil {
		t.Fatalf("RequireMembershipForResult primary: %v", err)
	}
	if _, err := AddRaceEventMemberCore(f.ctx, adminActor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racer1ID,
	}); err != nil {
		t.Fatalf("AddRaceEventMemberCore primary: %v", err)
	}

	// 6. 1-click substitution swaps backupID in for racer1ID and replaces them in the unstarted race.
	replaceUpcoming := true
	evt, err = SubstituteEventTeamMemberCore(f.ctx, adminActor, &SubstituteEventTeamMemberRequest{
		EventID:                evt.ID,
		TeamID:                 teamID,
		IncomingUserID:         backupID,
		OutgoingUserID:         &racer1ID,
		ReplaceInUpcomingRaces: &replaceUpcoming,
	})
	if err != nil {
		t.Fatalf("SubstituteEventTeamMemberCore: %v", err)
	}
	if len(evt.RaceEvents) != 1 || len(evt.RaceEvents[0].Members) != 1 || evt.RaceEvents[0].Members[0].UserID != backupID {
		t.Fatalf("expected backupID to replace racer1ID in unstarted race, got %+v", evt.RaceEvents)
	}

	// 7. Constructors' sum: record points for both racer2ID and backupID and verify TeamPointsOverview.
	_, err = db.Exec(f.ctx, `UPDATE "event_points_entry" SET points = 15 WHERE "eventId" = $1 AND "userId" = $2`, evt.ID, racer2ID)
	if err != nil {
		t.Fatalf("update points racer2: %v", err)
	}
	_, err = db.Exec(f.ctx, `UPDATE "event_points_entry" SET points = 10 WHERE "eventId" = $1 AND "userId" = $2`, evt.ID, backupID)
	if err != nil {
		t.Fatalf("update points backup: %v", err)
	}
	evt, err = LoadEvent(f.ctx, evt.ID)
	if err != nil {
		t.Fatalf("LoadEvent: %v", err)
	}
	if len(evt.TeamPointsOverview) != 1 || evt.TeamPointsOverview[0].Points != 25 {
		t.Fatalf("expected TeamPointsOverview points=25, got %+v", evt.TeamPointsOverview)
	}
}

func TestGranularTeamEventLimitsAndTeamAdminLineup(t *testing.T) {
	f := newFixtures(t)

	adminID := f.createUser("gtadm", "Event Admin", nil, "SITE_ADMIN")
	captain1ID := f.createUser("gtcap1", "Team 1 Captain", nil, "USER")
	captain2ID := f.createUser("gtcap2", "Team 2 Captain", nil, "USER")
	racer1ID := f.createUser("gtr1", "Team 1 Racer A", nil, "USER")
	racer2ID := f.createUser("gtr2", "Team 1 Racer B", nil, "USER")
	racer3ID := f.createUser("gtr3", "Team 2 Racer A", nil, "USER")

	adminActor := &auth.Actor{UserID: adminID, SiteRole: auth.SiteRoleSiteAdmin}
	captain1Actor := &auth.Actor{UserID: captain1ID, SiteRole: auth.SiteRoleUser}
	captain2Actor := &auth.Actor{UserID: captain2ID, SiteRole: auth.SiteRoleUser}

	now := time.Now().UTC()
	team1ID := "team-" + newID()[:8]
	team2ID := "team-" + newID()[:8]
	for _, tm := range []struct {
		id, name, slug string
	}{
		{team1ID, "Velocity One", "vel-one-" + team1ID},
		{team2ID, "Velocity Two", "vel-two-" + team2ID},
	} {
		if _, err := db.Exec(f.ctx,
			`INSERT INTO "team" (id, name, slug, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'APPROVED', $4, $4)`,
			tm.id, tm.name, tm.slug, now); err != nil {
			t.Fatalf("insert team: %v", err)
		}
		tid := tm.id
		t.Cleanup(func() {
			_, _ = db.Exec(f.ctx, `DELETE FROM "team" WHERE id = $1`, tid)
		})
	}
	for _, m := range []struct{ tid, uid, role string }{
		{team1ID, captain1ID, "administrator"},
		{team1ID, racer1ID, "member"},
		{team1ID, racer2ID, "member"},
		{team2ID, captain2ID, "administrator"},
		{team2ID, racer3ID, "member"},
	} {
		if _, err := db.Exec(f.ctx,
			`INSERT INTO "teamMember" (id, "teamId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
			"tm-"+newID()[:8], m.tid, m.uid, m.role, now); err != nil {
			t.Fatalf("insert teamMember: %v", err)
		}
	}

	// Create a GRANULAR team event with participantLimit=1 (max 1 team) and maxConcurrentRaceParticipations=1.
	maxTeams := 1
	maxConcurrent := 1
	maxPrimary := 2
	evt, err := CreateEventCore(f.ctx, adminActor, &CreateEventRequest{
		Name:                            "Granular Team Relay",
		OwnerType:                       "USER",
		ScoringType:                     ScoringPoints,
		GranularParticipation:           true,
		ParticipantLimit:                OptInt{Set: true, Value: &maxTeams},
		MaxConcurrentRaceParticipations: OptInt{Set: true, Value: &maxConcurrent},
		IsTeamEvent:                     true,
		MaxPrimaryRosterSize:            OptInt{Set: true, Value: &maxPrimary},
	})
	if err != nil {
		t.Fatalf("CreateEventCore granular team event: %v", err)
	}
	f.events = append(f.events, evt.ID)
	if evt.ParticipantLimit == nil || *evt.ParticipantLimit != 1 {
		t.Fatalf("expected participantLimit=1 on granular team event, got %v", evt.ParticipantLimit)
	}

	if _, err := db.Exec(f.ctx, `UPDATE "event" SET status = 'PENDING' WHERE id = $1`, evt.ID); err != nil {
		t.Fatalf("publish event: %v", err)
	}

	// Team 1 registers.
	if _, err := UpsertEventTeamRosterCore(f.ctx, captain1Actor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         team1ID,
		PrimaryUserIDs: []string{racer1ID, racer2ID},
	}); err != nil {
		t.Fatalf("UpsertEventTeamRosterCore team 1: %v", err)
	}

	// Team 2 is blocked by event participantLimit (Team Limit = 1).
	if _, err := UpsertEventTeamRosterCore(f.ctx, captain2Actor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         team2ID,
		PrimaryUserIDs: []string{racer3ID},
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for exceeding granular team limit, got %v", err)
	}

	// Create a race with maxMembersPerTeam = 1.
	maxPerTeam := 1
	race, err := CreateRaceEventCore(f.ctx, adminActor, &CreateRaceEventRequest{
		EventID:           evt.ID,
		Name:              "Relay Leg 1",
		DistanceMeters:    1200,
		TrackType:         "Dirt",
		Location:          "Kyoto",
		MaxMembersPerTeam: OptInt{Set: true, Value: &maxPerTeam},
	})
	if err != nil {
		t.Fatalf("CreateRaceEventCore: %v", err)
	}
	if race.MaxMembersPerTeam == nil || *race.MaxMembersPerTeam != 1 {
		t.Fatalf("expected MaxMembersPerTeam=1, got %v", race.MaxMembersPerTeam)
	}

	// Team 1 Captain assigns racer1ID to the race (Team Admin self-service).
	if _, err := AddRaceEventMemberCore(f.ctx, captain1Actor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racer1ID,
	}); err != nil {
		t.Fatalf("Team Admin AddRaceEventMemberCore racer1: %v", err)
	}

	// Assigning racer2ID from the same team is blocked by maxMembersPerTeam=1.
	if _, err := AddRaceEventMemberCore(f.ctx, captain1Actor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racer2ID,
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for maxMembersPerTeam, got %v", err)
	}

	// Team 2 Captain cannot remove Team 1's racer.
	if _, err := RemoveRaceEventMemberCore(f.ctx, captain2Actor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racer1ID,
	}); errs.Code(err) != errs.PermissionDenied {
		t.Fatalf("expected PermissionDenied for cross-team removal, got %v", err)
	}

	// Team 1 Captain removes racer1ID and assigns racer2ID instead.
	if _, err := RemoveRaceEventMemberCore(f.ctx, captain1Actor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racer1ID,
	}); err != nil {
		t.Fatalf("Team Admin RemoveRaceEventMemberCore racer1: %v", err)
	}
	if _, err := AddRaceEventMemberCore(f.ctx, captain1Actor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racer2ID,
	}); err != nil {
		t.Fatalf("Team Admin AddRaceEventMemberCore racer2 after removal: %v", err)
	}
}

func TestConcludedTeamEventFreezesRosterAndSnapshotsHistory(t *testing.T) {
	f := newFixtures(t)

	adminID := f.createUser("frzadm", "Freeze Admin", nil, "SITE_ADMIN")
	racerID := f.createUser("frzr1", "Historical Racer", nil, "USER")
	adminActor := &auth.Actor{UserID: adminID, SiteRole: auth.SiteRoleSiteAdmin}

	now := time.Now().UTC()
	teamID := "team-" + newID()[:8]
	origSlug := "orig-team-" + teamID
	if _, err := db.Exec(f.ctx,
		`INSERT INTO "team" (id, name, slug, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'APPROVED', $4, $4)`,
		teamID, "Original Squad", origSlug, now); err != nil {
		t.Fatalf("insert team: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(f.ctx, `DELETE FROM "team" WHERE id = $1`, teamID)
	})
	if _, err := db.Exec(f.ctx,
		`INSERT INTO "teamMember" (id, "teamId", "userId", role, "createdAt") VALUES ($1, $2, $3, 'member', $4)`,
		"tm-"+newID()[:8], teamID, racerID, now); err != nil {
		t.Fatalf("insert teamMember: %v", err)
	}

	evt, err := CreateEventCore(f.ctx, adminActor, &CreateEventRequest{
		Name:        "Frozen History Cup",
		OwnerType:   "USER",
		ScoringType: ScoringPoints,
		IsTeamEvent: true,
	})
	if err != nil {
		t.Fatalf("CreateEventCore: %v", err)
	}
	f.events = append(f.events, evt.ID)
	if _, err := db.Exec(f.ctx, `UPDATE "event" SET status = 'ONGOING' WHERE id = $1`, evt.ID); err != nil {
		t.Fatalf("set ongoing: %v", err)
	}

	if _, err := UpsertEventTeamRosterCore(f.ctx, adminActor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         teamID,
		PrimaryUserIDs: []string{racerID},
	}); err != nil {
		t.Fatalf("UpsertEventTeamRosterCore: %v", err)
	}

	race, err := CreateRaceEventCore(f.ctx, adminActor, &CreateRaceEventRequest{
		EventID:        evt.ID,
		Name:           "Final Heat",
		DistanceMeters: 2000,
		TrackType:      "Turf",
		Location:       "Nakayama",
	})
	if err != nil {
		t.Fatalf("CreateRaceEventCore: %v", err)
	}
	if _, err := AddRaceEventMemberCore(f.ctx, adminActor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racerID,
	}); err != nil {
		t.Fatalf("AddRaceEventMemberCore: %v", err)
	}
	// Record a finished result so ListUserRaceRecords returns it.
	if _, err := db.Exec(f.ctx,
		`INSERT INTO "race_event_result" (id, "raceEventId", "userId", "placement", "finishTimeMs", "createdAt", "updatedAt") VALUES ($1, $2, $3, 1, 120000, $4, $4)`,
		"res-"+newID()[:8], race.ID, racerID, now); err != nil {
		t.Fatalf("insert result: %v", err)
	}

	// Conclude the event via SetEventStatusCore — this freezes team snapshots.
	concluded := "CONCLUDED"
	if _, err := SetEventStatusCore(f.ctx, adminActor, &SetEventStatusRequest{
		ID:     evt.ID,
		Status: &concluded,
	}); err != nil {
		t.Fatalf("SetEventStatusCore CONCLUDED: %v", err)
	}

	// All roster & lineup mutations must now fail with FailedPrecondition.
	if _, err := UpsertEventTeamRosterCore(f.ctx, adminActor, &UpsertEventTeamRosterRequest{
		EventID:        evt.ID,
		TeamID:         teamID,
		PrimaryUserIDs: []string{racerID},
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for roster upsert after CONCLUDED, got %v", err)
	}
	if _, err := RemoveEventTeamCore(f.ctx, adminActor, &RemoveEventTeamRequest{
		EventID: evt.ID,
		TeamID:  teamID,
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for team removal after CONCLUDED, got %v", err)
	}
	if _, err := RemoveEventMemberCore(f.ctx, adminActor, &RemoveEventMemberRequest{
		EventID: evt.ID,
		UserID:  racerID,
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for event member removal after CONCLUDED, got %v", err)
	}
	if _, err := RemoveRaceEventMemberCore(f.ctx, adminActor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  racerID,
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for race member removal after CONCLUDED, got %v", err)
	}

	// Rename the team and remove the user from teamMember (simulating moving teams later).
	if _, err := db.Exec(f.ctx, `UPDATE "team" SET name = 'Rebranded Squad', slug = $1 WHERE id = $2`, "rebranded-"+teamID, teamID); err != nil {
		t.Fatalf("rename team: %v", err)
	}
	if _, err := db.Exec(f.ctx, `DELETE FROM "teamMember" WHERE "userId" = $1`, racerID); err != nil {
		t.Fatalf("delete teamMember: %v", err)
	}

	// Historical race record must still reflect "Original Squad" and origSlug!
	records, err := ListUserRaceRecordsCore(f.ctx, &ListUserRaceRecordsParams{UserID: racerID})
	if err != nil {
		t.Fatalf("ListUserRaceRecordsCore: %v", err)
	}
	if len(records.Records) != 1 {
		t.Fatalf("expected 1 race record, got %d", len(records.Records))
	}
	rec := records.Records[0]
	if rec.TeamName == nil || *rec.TeamName != "Original Squad" {
		t.Fatalf("expected frozen TeamName='Original Squad', got %v", rec.TeamName)
	}
	if rec.TeamSlug == nil || *rec.TeamSlug != origSlug {
		t.Fatalf("expected frozen TeamSlug=%q, got %v", origSlug, rec.TeamSlug)
	}
}

