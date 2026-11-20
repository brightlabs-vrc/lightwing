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

	// Backup member cannot be added to race lineup directly.
	if _, err := AddRaceEventMemberCore(f.ctx, adminActor, &RaceMemberRequest{
		EventID: evt.ID,
		RaceID:  race.ID,
		UserID:  backupID,
	}); errs.Code(err) != errs.FailedPrecondition {
		t.Fatalf("expected FailedPrecondition for BACKUP race lineup add, got %v", err)
	}

	// Primary member succeeds.
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
