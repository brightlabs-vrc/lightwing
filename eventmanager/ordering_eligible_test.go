package eventmanager

import (
	"context"
	"strings"
	"testing"
)

// Ports of the remaining race-service legacy tests:
//
//	ts-legacy/eventmanager/ordering.test.ts
//	ts-legacy/eventmanager/eligible_races.test.ts

// --- ordering.test.ts: auto-sequencing ---

func Test_RaceAutoSequencing(t *testing.T) {
	f := newFixtures(t)
	ctx := context.Background()

	admin := f.createUser("ordadmin", "Admin User", strptr("OP"), "SITE_ADMIN")
	authHeader := f.createSession(admin)
	eventID := f.createEventDirect(admin, "Auto Seq Event", "UNOFFICIAL", nil, false)

	mkRace := func(name string, seq *int) *RaceEventDetail {
		t.Helper()
		r, err := CreateRaceEventCore(ctx, &CreateRaceEventRequest{
			EventID: eventID, Authorization: authHeader, Name: name,
			DistanceMeters: 1600, TrackType: "Turf", Location: "Kyoto", Sequence: seq,
		})
		if err != nil {
			t.Fatalf("CreateRaceEventCore(%s): %v", name, err)
		}
		return r
	}

	race1 := mkRace("Kyoto Derby", nil)
	if race1.Sequence != 1 {
		t.Errorf("first race sequence = %d, want 1", race1.Sequence)
	}
	race2 := mkRace("Tokyo Classic", nil)
	if race2.Sequence != 2 {
		t.Errorf("second race sequence = %d, want 2", race2.Sequence)
	}
	race3 := mkRace("Sapporo Sprint", intptr(999))
	if race3.Sequence != 999 {
		t.Errorf("explicit race sequence = %d, want 999", race3.Sequence)
	}
}

// --- ordering.test.ts: reorder endpoint ---

func Test_RaceReorderSuccessAndIdempotent(t *testing.T) {
	f := newFixtures(t)
	ctx := context.Background()

	admin := f.createUser("reoadmin", "Admin User", strptr("OP"), "SITE_ADMIN")
	authHeader := f.createSession(admin)
	eventID := f.createEventDirect(admin, "Reorder Event", "UNOFFICIAL", nil, false)

	var ids []string
	for _, name := range []string{"Race A", "Race B", "Race C"} {
		r, err := CreateRaceEventCore(ctx, &CreateRaceEventRequest{
			EventID: eventID, Authorization: authHeader, Name: name,
			DistanceMeters: 1200, TrackType: "Turf", Location: "Kyoto",
		})
		if err != nil {
			t.Fatalf("CreateRaceEventCore(%s): %v", name, err)
		}
		ids = append(ids, r.ID)
	}
	r1, r2, r3 := ids[0], ids[1], ids[2]

	resp, err := ReorderRaceEventsCore(ctx, &ReorderRaceEventsRequest{
		EventID: eventID, Authorization: authHeader,
		OrderedRaceIDs: []string{r3, r1, r2},
	})
	if err != nil {
		t.Fatalf("ReorderRaceEventsCore: %v", err)
	}
	if len(resp.Races) != 3 {
		t.Fatalf("races = %d, want 3", len(resp.Races))
	}
	want := []struct {
		id  string
		seq int
	}{{r3, 1}, {r1, 2}, {r2, 3}}
	for i, w := range want {
		if resp.Races[i].ID != w.id || resp.Races[i].Sequence != w.seq {
			t.Errorf("races[%d] = (%s, %d), want (%s, %d)",
				i, resp.Races[i].ID, resp.Races[i].Sequence, w.id, w.seq)
		}
	}

	// Idempotency: same order again succeeds and is stable.
	again, err := ReorderRaceEventsCore(ctx, &ReorderRaceEventsRequest{
		EventID: eventID, Authorization: authHeader,
		OrderedRaceIDs: []string{r3, r1, r2},
	})
	if err != nil {
		t.Fatalf("idempotent reorder: %v", err)
	}
	for i, w := range want {
		if again.Races[i].ID != w.id || again.Races[i].Sequence != w.seq {
			t.Errorf("idempotent races[%d] = (%s, %d), want (%s, %d)",
				i, again.Races[i].ID, again.Races[i].Sequence, w.id, w.seq)
		}
	}
}

func Test_RaceReorderValidation(t *testing.T) {
	f := newFixtures(t)
	ctx := context.Background()

	admin := f.createUser("reovadmin", "Admin User", strptr("OP"), "SITE_ADMIN")
	authHeader := f.createSession(admin)
	eventID := f.createEventDirect(admin, "Validation Event", "UNOFFICIAL", nil, false)

	mk := func(name string) string {
		t.Helper()
		r, err := CreateRaceEventCore(ctx, &CreateRaceEventRequest{
			EventID: eventID, Authorization: authHeader, Name: name,
			DistanceMeters: 1200, TrackType: "Turf", Location: "Kyoto",
		})
		if err != nil {
			t.Fatalf("CreateRaceEventCore(%s): %v", name, err)
		}
		return r.ID
	}
	r1 := mk("Race 1")
	mk("Race 2")

	reorder := func(ids []string) error {
		_, err := ReorderRaceEventsCore(ctx, &ReorderRaceEventsRequest{
			EventID: eventID, Authorization: authHeader, OrderedRaceIDs: ids,
		})
		return err
	}

	if err := reorder([]string{r1, r1}); err == nil ||
		!strings.Contains(err.Error(), "duplicate race IDs") {
		t.Errorf("duplicates err = %v, want duplicate race IDs", err)
	}
	if err := reorder([]string{r1}); err == nil ||
		!strings.Contains(err.Error(), "payload must contain exactly all") {
		t.Errorf("partial err = %v, want payload must contain exactly all", err)
	}
	if err := reorder([]string{r1, "foreign-race-id"}); err == nil ||
		!strings.Contains(err.Error(), "does not belong to event") {
		t.Errorf("foreign err = %v, want does not belong to event", err)
	}
}

// --- eligible_races.test.ts ---

func Test_EligibleRacesDiscovery(t *testing.T) {
	f := newFixtures(t)
	ctx := context.Background()

	admin := f.createUser("eligadmin", "Eligibility Admin", nil, "SITE_ADMIN")
	authHeader := f.createSession(admin)
	user := f.createUser("eliguser", "Eligible User", strptr("OP"), "USER")

	event1 := f.createEventDirect(admin, "Event OP", "UNOFFICIAL", strptr("OP"), false)
	event2 := f.createEventDirect(admin, "Event G1", "UNOFFICIAL", strptr("G1"), false)
	event3 := f.createEventDirect(admin, "Event G2-NoQual", "UNOFFICIAL", strptr("G2"), false)

	mkRace := func(eventID, name string, seq int, restr *string) string {
		t.Helper()
		r, err := CreateRaceEventCore(ctx, &CreateRaceEventRequest{
			EventID: eventID, Authorization: authHeader, Name: name, Sequence: &seq,
			DistanceMeters: 1000, TrackType: "Turf", Location: "Tokyo", ClassRestriction: restr,
		})
		if err != nil {
			t.Fatalf("CreateRaceEventCore(%s): %v", name, err)
		}
		return r.ID
	}

	race1a := mkRace(event1, "Race Seq 2 OP", 2, strptr("OP"))
	mkRace(event1, "Race Seq 1 G1", 1, strptr("G1"))
	race1c := mkRace(event1, "Race Seq 3 Null", 3, nil)
	race2a := mkRace(event2, "Race G1-OP", 1, strptr("OP"))
	mkRace(event2, "Race G1-Null", 2, nil)

	resp, err := ListEligibleEventsCore(ctx, &EligibleEventsQuery{UserID: user})
	if err != nil {
		t.Fatalf("ListEligibleEventsCore: %v", err)
	}
	byID := map[string]*EligibleEvent{}
	for _, e := range resp.Events {
		byID[e.ID] = e
	}
	if byID[event1] == nil {
		t.Errorf("event1 missing from eligible events")
	}
	if byID[event2] == nil {
		t.Errorf("event2 missing from eligible events (race-level OP grant)")
	}
	if byID[event3] != nil {
		t.Errorf("event3 should be excluded (no qualifying race)")
	}

	e1 := byID[event1]
	if e1 != nil {
		if len(e1.EligibleRaces) != 2 {
			t.Errorf("event1 races = %d, want 2", len(e1.EligibleRaces))
		} else {
			if e1.EligibleRaces[0].ID != race1a || e1.EligibleRaces[0].Sequence != 2 ||
				!strEq(e1.EligibleRaces[0].ClassRestriction, "OP") {
				t.Errorf("event1 race[0] = %+v, want race1a seq 2 OP", e1.EligibleRaces[0])
			}
			if e1.EligibleRaces[1].ID != race1c || e1.EligibleRaces[1].Sequence != 3 ||
				!strEq(e1.EligibleRaces[1].ClassRestriction, "OP") {
				t.Errorf("event1 race[1] = %+v, want race1c seq 3 OP (fallback)", e1.EligibleRaces[1])
			}
		}
	}
	e2 := byID[event2]
	if e2 != nil {
		if len(e2.EligibleRaces) != 1 || e2.EligibleRaces[0].ID != race2a ||
			!strEq(e2.EligibleRaces[0].ClassRestriction, "OP") {
			t.Errorf("event2 races = %+v, want [race2a OP]", e2.EligibleRaces)
		}
	}
}

func strEq(s *string, want string) bool {
	return s != nil && *s == want
}
