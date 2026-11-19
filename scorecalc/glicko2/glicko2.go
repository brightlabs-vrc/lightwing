package glicko2

import (
	"math"
	"sort"
	"strings"
	"time"
)

// Glicko-2 rating system constants.
const (
	DefaultRating     = 1500.0
	DefaultRD         = 350.0
	DefaultVolatility = 0.06
	Tau               = 0.5
	Scale             = 173.7178
	ConvergenceTol    = 0.000001
	MaxPhi            = DefaultRD / Scale

	// Inactivity decay: 1 rating period per 14 days elapsed between rated races,
	// capped at 26 periods (~1 year) per jump.
	RatingPeriodDays = 14.0
	MaxIdlePeriods   = 26.0

	// Provisional thresholds: fewer than 5 rated races OR RD > 110.
	ProvisionalMinRaces    = 5
	ProvisionalRDThreshold = 110
)

// ChronologicalRaceResult is a single race result input fed into the Glicko-2 replay.
type ChronologicalRaceResult struct {
	ResultID     string
	RaceEventID  string
	EventID      string
	RaceSequence int
	OccurredAt   time.Time
	EventYear    int
	UserID       string
	Position     *int
	ResultStatus *string
}

// UserSeasonRatingSnapshot represents a user's Glicko-2 state at the end of a calendar year.
type UserSeasonRatingSnapshot struct {
	UserID            string
	Year              int
	Rating            int
	RatingDeviation   int
	RatingVolatility  float64
	PeakRating        int
	SeasonRatingDelta int
	RatedRaces        int
	IsProvisional     bool
}

// RaceResultRatingDelta records the rating transition for one race_result row.
type RaceResultRatingDelta struct {
	ResultID     string
	UserID       string
	RatingBefore int
	RatingAfter  int
	RatingDelta  int
	RDAfter      int
}

// HistoryResult holds all computed outputs from a full historical replay.
type HistoryResult struct {
	Snapshots      []UserSeasonRatingSnapshot
	ResultDeltas   []RaceResultRatingDelta
	RacesProcessed int
	UsersRated     int
	YearsProcessed []int
}

type state struct {
	mu          float64
	phi         float64
	sigma       float64
	peakRating  int
	ratedRaces  int
	lastRaceAt  time.Time
	hasLastRace bool
}

func newDefaultState() *state {
	return &state{
		mu:         0, // (1500 - 1500) / 173.7178
		phi:        MaxPhi,
		sigma:      DefaultVolatility,
		peakRating: int(DefaultRating),
	}
}

func (s *state) displayRating() int {
	return int(math.Round(s.mu*Scale + DefaultRating))
}

func (s *state) displayRD() int {
	rd := int(math.Round(s.phi * Scale))
	if rd < 30 {
		return 30
	}
	if rd > int(DefaultRD) {
		return int(DefaultRD)
	}
	return rd
}

func (s *state) isProvisional() bool {
	return s.ratedRaces < ProvisionalMinRaces || s.displayRD() > ProvisionalRDThreshold
}

func gFunc(phi float64) float64 {
	return 1.0 / math.Sqrt(1.0+3.0*phi*phi/(math.Pi*math.Pi))
}

func eFunc(mu, muJ, phiJ float64) float64 {
	return 1.0 / (1.0 + math.Exp(-gFunc(phiJ)*(mu-muJ)))
}

// FieldSizePairwiseWeight returns the weight per pairwise matchup in an N-runner race.
// For N=2, w(2) = 1.0 (exact standard 1v1 Glicko-2).
// For larger N, total weight scales sub-linearly as 1 + 0.25*ln(N-1) so winning
// a larger field rewards more without collapsing RD by (N-1)x in a single race.
func FieldSizePairwiseWeight(fieldSize int) float64 {
	if fieldSize <= 2 {
		return 1.0
	}
	nMinus1 := float64(fieldSize - 1)
	return (1.0 + 0.25*math.Log(nMinus1)) / nMinus1
}

// computeNewVolatility solves Step 5 of Mark Glickman's Glicko-2 paper using the Illinois algorithm.
func computeNewVolatility(phi, sigma, v, delta float64) float64 {
	a := math.Log(sigma * sigma)
	tau2 := Tau * Tau
	phi2 := phi * phi
	delta2 := delta * delta

	f := func(x float64) float64 {
		ex := math.Exp(x)
		num := ex * (delta2 - phi2 - v - ex)
		den := 2.0 * math.Pow(phi2+v+ex, 2)
		return num/den - (x-a)/tau2
	}

	A := a
	var B float64
	if delta2 > phi2+v {
		B = math.Log(delta2 - phi2 - v)
	} else {
		k := 1.0
		for f(a-k*Tau) < 0 {
			k += 1.0
			if k > 100 {
				break
			}
		}
		B = a - k*Tau
	}

	fA := f(A)
	fB := f(B)

	for i := 0; i < 100 && math.Abs(B-A) > ConvergenceTol; i++ {
		denom := fB - fA
		if denom == 0 || math.IsNaN(denom) || math.IsInf(denom, 0) {
			break
		}
		C := A + (A-B)*fA/denom
		fC := f(C)
		if fC*fB <= 0 {
			A = B
			fA = fB
		} else {
			fA = fA / 2.0
		}
		B = C
		fB = fC
	}

	newSigma := math.Exp(A / 2.0)
	if math.IsNaN(newSigma) || math.IsInf(newSigma, 0) || newSigma <= 0 {
		return sigma
	}
	return newSigma
}

// ApplyInactivityDecay increases phi for elapsed 14-day rating periods since last rated race.
func ApplyInactivityDecay(phi, sigma float64, lastRaceAt, currentRaceAt time.Time, hasLastRace bool) float64 {
	if !hasLastRace || !currentRaceAt.After(lastRaceAt) {
		return phi
	}
	days := currentRaceAt.Sub(lastRaceAt).Hours() / 24.0
	periods := days / RatingPeriodDays
	if periods <= 0 {
		return phi
	}
	if periods > MaxIdlePeriods {
		periods = MaxIdlePeriods
	}
	decayed := math.Sqrt(phi*phi + periods*sigma*sigma)
	if decayed > MaxPhi {
		return MaxPhi
	}
	return decayed
}

type raceGroup struct {
	raceEventID string
	eventYear   int
	occurredAt  time.Time
	results     []ChronologicalRaceResult
}

type eligibleRunner struct {
	resultID     string
	userID       string
	effectivePos int
}

// extractEligibleRunners applies Lightwing's status rules:
// - Exclude DNS and DEFERRED (and entries with neither positive position nor DNF/DSQ).
// - Treat DNF and DSQ as tied for last place behind all positioned finishers (maxPos + 1).
func extractEligibleRunners(results []ChronologicalRaceResult) []eligibleRunner {
	maxPos := 0
	for _, r := range results {
		status := ""
		if r.ResultStatus != nil {
			status = strings.ToUpper(strings.TrimSpace(*r.ResultStatus))
		}
		if status == "DNS" || status == "DEFERRED" || status == "DNF" || status == "DSQ" {
			continue
		}
		if r.Position != nil && *r.Position > maxPos {
			maxPos = *r.Position
		}
	}

	runners := make([]eligibleRunner, 0, len(results))
	seenUsers := make(map[string]bool, len(results))
	for _, r := range results {
		if seenUsers[r.UserID] {
			continue
		}
		status := ""
		if r.ResultStatus != nil {
			status = strings.ToUpper(strings.TrimSpace(*r.ResultStatus))
		}
		if status == "DNS" || status == "DEFERRED" {
			continue
		}
		if status == "DNF" || status == "DSQ" {
			seenUsers[r.UserID] = true
			runners = append(runners, eligibleRunner{
				resultID:     r.ResultID,
				userID:       r.UserID,
				effectivePos: maxPos + 1,
			})
			continue
		}
		if r.Position != nil && *r.Position > 0 {
			seenUsers[r.UserID] = true
			runners = append(runners, eligibleRunner{
				resultID:     r.ResultID,
				userID:       r.UserID,
				effectivePos: *r.Position,
			})
		}
	}
	return runners
}

// ComputeHistory replays all race results chronologically and produces per-year
// user rating snapshots and per-race-result rating deltas.
func ComputeHistory(results []ChronologicalRaceResult) HistoryResult {
	if len(results) == 0 {
		return HistoryResult{}
	}

	raceOrder := make([]*raceGroup, 0)
	raceMap := make(map[string]*raceGroup)
	yearSet := make(map[int]bool)

	for _, r := range results {
		yearSet[r.EventYear] = true
		rg, ok := raceMap[r.RaceEventID]
		if !ok {
			rg = &raceGroup{
				raceEventID: r.RaceEventID,
				eventYear:   r.EventYear,
				occurredAt:  r.OccurredAt,
			}
			raceMap[r.RaceEventID] = rg
			raceOrder = append(raceOrder, rg)
		}
		rg.results = append(rg.results, r)
	}

	years := make([]int, 0, len(yearSet))
	for y := range yearSet {
		years = append(years, y)
	}
	sort.Ints(years)

	racesByYear := make(map[int][]*raceGroup, len(years))
	for _, rg := range raceOrder {
		racesByYear[rg.eventYear] = append(racesByYear[rg.eventYear], rg)
	}

	states := make(map[string]*state)
	deltas := make([]RaceResultRatingDelta, 0, len(results))
	snapshots := make([]UserSeasonRatingSnapshot, 0)
	racesProcessed := 0

	for _, yr := range years {
		seasonStartRatings := make(map[string]int, len(states))
		for uid, st := range states {
			seasonStartRatings[uid] = st.displayRating()
		}

		for _, rg := range racesByYear[yr] {
			runners := extractEligibleRunners(rg.results)
			if len(runners) < 2 {
				continue
			}
			racesProcessed++

			type preState struct {
				mu           float64
				phi          float64
				sigma        float64
				ratingBefore int
			}
			pre := make([]preState, len(runners))
			for i, runner := range runners {
				st, ok := states[runner.userID]
				if !ok {
					st = newDefaultState()
					states[runner.userID] = st
				}
				if _, seenStart := seasonStartRatings[runner.userID]; !seenStart {
					seasonStartRatings[runner.userID] = st.displayRating()
				}
				decayedPhi := ApplyInactivityDecay(st.phi, st.sigma, st.lastRaceAt, rg.occurredAt, st.hasLastRace)
				pre[i] = preState{
					mu:           st.mu,
					phi:          decayedPhi,
					sigma:        st.sigma,
					ratingBefore: st.displayRating(),
				}
			}

			w := FieldSizePairwiseWeight(len(runners))

			type postState struct {
				mu    float64
				phi   float64
				sigma float64
			}
			post := make([]postState, len(runners))

			for i := range runners {
				var vInv float64
				var sumTerm float64

				for j := range runners {
					if i == j {
						continue
					}
					var s float64
					switch {
					case runners[i].effectivePos < runners[j].effectivePos:
						s = 1.0
					case runners[i].effectivePos == runners[j].effectivePos:
						s = 0.5
					default:
						s = 0.0
					}

					gJ := gFunc(pre[j].phi)
					eIJ := eFunc(pre[i].mu, pre[j].mu, pre[j].phi)

					vInv += w * gJ * gJ * eIJ * (1.0 - eIJ)
					sumTerm += w * gJ * (s - eIJ)
				}

				if vInv <= 0 {
					post[i] = postState{mu: pre[i].mu, phi: pre[i].phi, sigma: pre[i].sigma}
					continue
				}

				v := 1.0 / vInv
				delta := v * sumTerm
				newSigma := computeNewVolatility(pre[i].phi, pre[i].sigma, v, delta)
				phiStar := math.Sqrt(pre[i].phi*pre[i].phi + newSigma*newSigma)
				newPhi := 1.0 / math.Sqrt(1.0/(phiStar*phiStar)+1.0/v)
				newMu := pre[i].mu + newPhi*newPhi*sumTerm

				post[i] = postState{
					mu:    newMu,
					phi:   newPhi,
					sigma: newSigma,
				}
			}

			for i, runner := range runners {
				st := states[runner.userID]
				st.mu = post[i].mu
				st.phi = post[i].phi
				st.sigma = post[i].sigma
				st.ratedRaces++
				st.lastRaceAt = rg.occurredAt
				st.hasLastRace = true

				ratingAfter := st.displayRating()
				if ratingAfter > st.peakRating {
					st.peakRating = ratingAfter
				}
				rdAfter := st.displayRD()

				deltas = append(deltas, RaceResultRatingDelta{
					ResultID:     runner.resultID,
					UserID:       runner.userID,
					RatingBefore: pre[i].ratingBefore,
					RatingAfter:  ratingAfter,
					RatingDelta:  ratingAfter - pre[i].ratingBefore,
					RDAfter:      rdAfter,
				})
			}
		}

		for uid, st := range states {
			r := st.displayRating()
			startR := seasonStartRatings[uid]
			snapshots = append(snapshots, UserSeasonRatingSnapshot{
				UserID:            uid,
				Year:              yr,
				Rating:            r,
				RatingDeviation:   st.displayRD(),
				RatingVolatility:  st.sigma,
				PeakRating:        st.peakRating,
				SeasonRatingDelta: r - startR,
				RatedRaces:        st.ratedRaces,
				IsProvisional:     st.isProvisional(),
			})
		}
	}

	return HistoryResult{
		Snapshots:      snapshots,
		ResultDeltas:   deltas,
		RacesProcessed: racesProcessed,
		UsersRated:     len(states),
		YearsProcessed: years,
	}
}
