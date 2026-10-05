package scorecalc

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"time"

	"encore.app/shared"
	"encore.dev/beta/errs"
	"encore.dev/rlog"
	"encore.dev/storage/cache"
)

// LeaderboardEntry represents one row on the overall leaderboard.
type LeaderboardEntry struct {
	Rank                   int      `json:"rank"`
	UserID                 string   `json:"userId"`
	Name                   string   `json:"name"`
	Slug                   *string  `json:"slug"`
	Image                  *string  `json:"image"`
	ClassTier              *string  `json:"classTier"`
	TotalPoints            int      `json:"totalPoints"`
	AveragePosition        float64  `json:"averagePosition"`
	AveragePointsPerSeason float64  `json:"averagePointsPerSeason"`
	EventsParticipated     int      `json:"eventsParticipated"`
	RacesParticipated      int      `json:"racesParticipated"`
	Wins                   int      `json:"wins"`
}

// LeaderboardResponse holds paginated leaderboard rows along with total count.
type LeaderboardResponse struct {
	Entries      []LeaderboardEntry `json:"entries"`
	Total        int                `json:"total"`
	CalculatedAt string             `json:"calculatedAt"`
}

// GetLeaderboardParams specifies sorting, filtering, and pagination query params.
type GetLeaderboardParams struct {
	SortBy           string `query:"sortBy"`           // "points", "avgPosition", "avgPointsPerSeason"
	Search           string `query:"search"`           // search driver name or slug
	ClassTier        string `query:"classTier"`        // filter by class tier e.g. "G1", "G2", "G3", "OP"
	Limit            int    `query:"limit"`            // pagination limit
	Offset           int    `query:"offset"`           // pagination offset
	ForceRecalculate bool   `query:"forceRecalculate"` // bypass cache if true
}

// Internal cache struct for the calculated leaderboard data.
type cachedLeaderboardData struct {
	Entries      []LeaderboardEntry
	CalculatedAt time.Time
}

type leaderboardCacheKey struct {
	ID string
}

type leaderboardCacheValue struct {
	DataJSON string `json:"dataJson"`
}

var (
	leaderboardCache = cache.NewStructKeyspace[leaderboardCacheKey, leaderboardCacheValue](shared.Cache, cache.KeyspaceConfig{
		KeyPattern:    "leaderboard/:ID",
		DefaultExpiry: cache.ExpireIn(10 * time.Minute),
	})

	inMemoryLeaderboardMu sync.RWMutex
	inMemoryLeaderboard   *cachedLeaderboardData
)

// InvalidateLeaderboardCache clears cached leaderboard calculation so the next query re-aggregates.
func InvalidateLeaderboardCache(ctx context.Context) {
	inMemoryLeaderboardMu.Lock()
	inMemoryLeaderboard = nil
	inMemoryLeaderboardMu.Unlock()

	if leaderboardCache != nil {
		_, _ = leaderboardCache.Delete(ctx, leaderboardCacheKey{ID: "global"})
	}
}

// CalculateAndCacheLeaderboard performs full database aggregation and updates cache.
func CalculateAndCacheLeaderboard(ctx context.Context) ([]LeaderboardEntry, time.Time, error) {
	rows, err := q().CalculateLeaderboardStats(ctx)
	if err != nil {
		return nil, time.Time{}, err
	}

	now := time.Now().UTC()
	entries := make([]LeaderboardEntry, 0, len(rows))
	for _, r := range rows {
		name := r.Name
		if r.VrchatUsername.Valid && r.VrchatUsername.String != "" {
			name = r.VrchatUsername.String
		}

		var slug *string
		if r.Slug.Valid && r.Slug.String != "" {
			s := r.Slug.String
			slug = &s
		}

		var img *string
		if r.Image.Valid && r.Image.String != "" {
			im := r.Image.String
			img = &im
		}

		var ct *string
		if r.ClassTier != nil {
			if s, ok := r.ClassTier.(string); ok && s != "" {
				ct = &s
			} else if s, ok := r.ClassTier.([]byte); ok && len(s) > 0 {
				str := string(s)
				ct = &str
			}
		}

		entries = append(entries, LeaderboardEntry{
			UserID:                 r.UserID,
			Name:                   name,
			Slug:                   slug,
			Image:                  img,
			ClassTier:              ct,
			TotalPoints:            int(r.TotalPoints),
			AveragePosition:        r.AvgPosition,
			AveragePointsPerSeason: r.AvgPointsPerSeason,
			EventsParticipated:     int(r.EventsParticipated),
			RacesParticipated:      int(r.RacesParticipated),
			Wins:                   int(r.Wins),
		})
	}

	data := &cachedLeaderboardData{
		Entries:      entries,
		CalculatedAt: now,
	}

	inMemoryLeaderboardMu.Lock()
	inMemoryLeaderboard = data
	inMemoryLeaderboardMu.Unlock()

	if leaderboardCache != nil {
		if b, err := json.Marshal(data); err == nil {
			_ = leaderboardCache.Set(ctx, leaderboardCacheKey{ID: "global"}, leaderboardCacheValue{DataJSON: string(b)})
		}
	}

	rlog.Info("Successfully calculated and cached global leaderboard")
	return entries, now, nil
}

func getLeaderboardData(ctx context.Context, forceRecalculate bool) ([]LeaderboardEntry, time.Time, error) {
	if !forceRecalculate {
		inMemoryLeaderboardMu.RLock()
		if inMemoryLeaderboard != nil && time.Since(inMemoryLeaderboard.CalculatedAt) < 10*time.Minute {
			entries := inMemoryLeaderboard.Entries
			ts := inMemoryLeaderboard.CalculatedAt
			inMemoryLeaderboardMu.RUnlock()
			return entries, ts, nil
		}
		inMemoryLeaderboardMu.RUnlock()

		if leaderboardCache != nil {
			if val, err := leaderboardCache.Get(ctx, leaderboardCacheKey{ID: "global"}); err == nil && val.DataJSON != "" {
				var cached cachedLeaderboardData
				if err := json.Unmarshal([]byte(val.DataJSON), &cached); err == nil && time.Since(cached.CalculatedAt) < 10*time.Minute {
					inMemoryLeaderboardMu.Lock()
					inMemoryLeaderboard = &cached
					inMemoryLeaderboardMu.Unlock()
					return cached.Entries, cached.CalculatedAt, nil
				}
			}
		}
	}

	return CalculateAndCacheLeaderboard(ctx)
}

// GetLeaderboard returns global leaderboard rankings with filtering, sorting, and pagination.
// Results are cached by scorecalc for 10 minutes or until invalidated by a score update.
//
//encore:api public method=GET path=/api/leaderboard
func GetLeaderboard(ctx context.Context, p *GetLeaderboardParams) (*LeaderboardResponse, error) {
	entries, calculatedAt, err := getLeaderboardData(ctx, p.ForceRecalculate)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "failed to calculate leaderboard"}
	}

	// Make a copy of entries to sort and assign global ranks before filtering
	allEntries := make([]LeaderboardEntry, len(entries))
	copy(allEntries, entries)

	// Sort all entries according to sortBy criteria
	sortBy := strings.TrimSpace(p.SortBy)
	switch sortBy {
	case "avgPosition":
		// Best average position first (1.0 is better than 2.0). 0 means unplaced.
		sort.SliceStable(allEntries, func(i, j int) bool {
			pi := allEntries[i].AveragePosition
			pj := allEntries[j].AveragePosition
			if pi == 0 && pj == 0 {
				return allEntries[i].TotalPoints > allEntries[j].TotalPoints
			}
			if pi == 0 {
				return false
			}
			if pj == 0 {
				return true
			}
			if pi == pj {
				return allEntries[i].TotalPoints > allEntries[j].TotalPoints
			}
			return pi < pj
		})
	case "avgPointsPerSeason":
		sort.SliceStable(allEntries, func(i, j int) bool {
			if allEntries[i].AveragePointsPerSeason == allEntries[j].AveragePointsPerSeason {
				return allEntries[i].TotalPoints > allEntries[j].TotalPoints
			}
			return allEntries[i].AveragePointsPerSeason > allEntries[j].AveragePointsPerSeason
		})
	default: // "points" or default
		sort.SliceStable(allEntries, func(i, j int) bool {
			if allEntries[i].TotalPoints == allEntries[j].TotalPoints {
				return allEntries[i].AveragePosition < allEntries[j].AveragePosition
			}
			return allEntries[i].TotalPoints > allEntries[j].TotalPoints
		})
	}

	// Assign global rank based on sorted overall standings
	for i := range allEntries {
		allEntries[i].Rank = i + 1
	}

	// Filter
	filtered := make([]LeaderboardEntry, 0, len(allEntries))
	searchLower := strings.ToLower(strings.TrimSpace(p.Search))
	classTierUpper := strings.ToUpper(strings.TrimSpace(p.ClassTier))

	for _, e := range allEntries {
		if searchLower != "" {
			nameMatch := strings.Contains(strings.ToLower(e.Name), searchLower)
			slugMatch := e.Slug != nil && strings.Contains(strings.ToLower(*e.Slug), searchLower)
			if !nameMatch && !slugMatch {
				continue
			}
		}

		if classTierUpper != "" {
			if e.ClassTier == nil || strings.ToUpper(*e.ClassTier) != classTierUpper {
				continue
			}
		}

		filtered = append(filtered, e)
	}

	total := len(filtered)

	// Paginate
	offset := p.Offset
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}

	end := total
	if p.Limit > 0 && offset+p.Limit < total {
		end = offset + p.Limit
	}

	pageEntries := filtered[offset:end]

	return &LeaderboardResponse{
		Entries:      pageEntries,
		Total:        total,
		CalculatedAt: calculatedAt.Format(time.RFC3339),
	}, nil
}

// RecalculateLeaderboard explicitly triggers a leaderboard recalculation and refreshes the cache.
//
//encore:api public method=POST path=/api/leaderboard/recalculate
func RecalculateLeaderboard(ctx context.Context) (*LeaderboardResponse, error) {
	entries, calculatedAt, err := CalculateAndCacheLeaderboard(ctx)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "failed to recalculate leaderboard"}
	}
	return &LeaderboardResponse{
		Entries:      entries,
		Total:        len(entries),
		CalculatedAt: calculatedAt.Format(time.RFC3339),
	}, nil
}
