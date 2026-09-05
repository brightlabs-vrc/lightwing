package eventmanager

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"encore.dev/beta/errs"
)

// Race grades and scoring tables.
//
// Mirrors ts-legacy/eventmanager/scoring.ts.
type RaceGrade string

const (
	RaceGradeOP   RaceGrade = "OP"
	RaceGradeGIII RaceGrade = "GIII"
	RaceGradeGII  RaceGrade = "GII"
	RaceGradeGI   RaceGrade = "GI"
)

var raceGrades = []RaceGrade{RaceGradeOP, RaceGradeGIII, RaceGradeGII, RaceGradeGI}

// GradeScoringTable maps finishing positions (1-10) to points.
type GradeScoringTable struct {
	Points    map[int]int
	AutoDefer bool
}

// EventScoringTables holds one table per grade.
type EventScoringTables map[RaceGrade]GradeScoringTable

func defaultTable(points map[int]int, autoDefer bool) GradeScoringTable {
	return GradeScoringTable{Points: points, AutoDefer: autoDefer}
}

// DefaultScoringTables returns a fresh copy of the standard tables.
func DefaultScoringTables() EventScoringTables {
	return EventScoringTables{
		RaceGradeOP:   defaultTable(map[int]int{1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1}, true),
		RaceGradeGIII: defaultTable(map[int]int{1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1}, false),
		RaceGradeGII:  defaultTable(map[int]int{1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1}, false),
		RaceGradeGI:   defaultTable(map[int]int{1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}, false),
	}
}

// toPointsNumber mirrors TS Number(val): accepts numerics and numeric
// strings ("" and whitespace parse as 0, like Number), requiring a
// non-negative integer. Booleans follow Number(true) === 1.
func toPointsNumber(v any) (int, bool) {
	switch n := v.(type) {
	case float64:
		if n < 0 || n != math.Trunc(n) {
			return 0, false
		}
		return int(n), true
	case float32:
		return toPointsNumber(float64(n))
	case int:
		if n < 0 {
			return 0, false
		}
		return n, true
	case int64:
		if n < 0 {
			return 0, false
		}
		return int(n), true
	case bool:
		if n {
			return 1, true
		}
		return 0, true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(n), 64)
		if err != nil {
			return 0, false
		}
		return toPointsNumber(f)
	case json.Number:
		return toPointsNumber(string(n))
	default:
		return 0, false
	}
}

// truthy mirrors TS Boolean(val) for decoded JSON values.
func truthy(v any) bool {
	switch n := v.(type) {
	case nil:
		return false
	case bool:
		return n
	case string:
		return n != ""
	case float64:
		return n != 0
	case int:
		return n != 0
	default:
		return true
	}
}

func validGrade(s string) bool {
	switch RaceGrade(s) {
	case RaceGradeOP, RaceGradeGIII, RaceGradeGII, RaceGradeGI:
		return true
	}
	return false
}

// ValidateCustomScoringTables validates a custom scoring tables payload
// (decoded JSON: grade -> position -> points, plus optional autoDefer).
// Returns InvalidArgument errors mirroring the TS APIError messages.
func ValidateCustomScoringTables(input any) (EventScoringTables, error) {
	obj, ok := input.(map[string]any)
	if !ok || obj == nil {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "Custom scoring tables must be an object"}
	}
	tables := EventScoringTables{}
	for _, grade := range raceGrades {
		raw, ok := obj[string(grade)]
		if !ok {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: fmt.Sprintf("Custom scoring table for grade %s is missing or not an object", grade)}
		}
		table, ok := raw.(map[string]any)
		if !ok || table == nil {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: fmt.Sprintf("Custom scoring table for grade %s is missing or not an object", grade)}
		}
		gt := GradeScoringTable{Points: map[int]int{}}
		for pos := 1; pos <= 10; pos++ {
			val, present := table[strconv.Itoa(pos)]
			if !present || val == nil {
				return nil, &errs.Error{Code: errs.InvalidArgument, Message: fmt.Sprintf("Custom scoring table for grade %s is missing value for position %d", grade, pos)}
			}
			parsed, ok := toPointsNumber(val)
			if !ok {
				return nil, &errs.Error{Code: errs.InvalidArgument, Message: fmt.Sprintf("Custom scoring table for grade %s position %d must be a non-negative integer", grade, pos)}
			}
			gt.Points[pos] = parsed
		}
		if b, ok := table["autoDefer"].(bool); ok {
			gt.AutoDefer = b
		} else if v, present := table["autoDefer"]; present && v != nil {
			gt.AutoDefer = truthy(v)
		} else {
			gt.AutoDefer = grade == RaceGradeOP
		}
		tables[grade] = gt
	}
	return tables, nil
}

// asCustomMap normalizes decoded custom-tables values (map, JSON bytes, or
// JSON string) to a map. Anything else yields nil.
func asCustomMap(v any) map[string]any {
	switch t := v.(type) {
	case map[string]any:
		return t
	case []byte:
		var m map[string]any
		if err := json.Unmarshal(t, &m); err != nil {
			return nil
		}
		return m
	case string:
		var m map[string]any
		if err := json.Unmarshal([]byte(t), &m); err != nil {
			return nil
		}
		return m
	default:
		return nil
	}
}

// GetActiveScoringTable selects the table for a mode + grade, or nil when
// none applies. Custom-table validation failures fall back to nil,
// mirroring the TS try/catch.
func GetActiveScoringTable(scoringRulesMode string, customScoringTables any, grade string) *GradeScoringTable {
	if !validGrade(grade) {
		return nil
	}
	g := RaceGrade(grade)
	if scoringRulesMode == "CUSTOM" && truthy(customScoringTables) {
		if m := asCustomMap(customScoringTables); m != nil {
			if validated, err := ValidateCustomScoringTables(m); err == nil {
				if t, ok := validated[g]; ok {
					t := t
					return &t
				}
			}
			return nil
		}
		return nil
	}
	t := DefaultScoringTables()[g]
	return &t
}

// IsAutoDeferGrade reports whether a grade auto-defers under an event config.
func IsAutoDeferGrade(scoringRulesMode string, customScoringTables any, grade string) bool {
	if !validGrade(grade) {
		return false
	}
	g := RaceGrade(grade)
	if scoringRulesMode == "CUSTOM" && truthy(customScoringTables) {
		if m := asCustomMap(customScoringTables); m != nil {
			if enabled, ok := m["autoDeferEnabled"].(bool); ok && !enabled {
				return false
			}
			if gm, ok := m[string(g)].(map[string]any); ok {
				if b, ok := gm["autoDefer"].(bool); ok {
					return b
				}
			}
		}
	}
	t := DefaultScoringTables()[g]
	return t.AutoDefer
}

// Result statuses that always resolve to 0 points.
var zeroPointStatuses = map[string]bool{
	"DSQ": true, "DNF": true, "DNS": true, "DEFERRED": true,
}

// ResolvePoints maps a finishing position to points under event rules.
// DSQ/DNF/DNS/DEFERRED and out-of-range positions resolve to 0.
func ResolvePoints(scoringRulesMode string, customScoringTables any, grade string, position *int, resultStatus string) int {
	if zeroPointStatuses[resultStatus] {
		return 0
	}
	if position == nil || *position < 1 || *position > 10 {
		return 0
	}
	table := GetActiveScoringTable(scoringRulesMode, customScoringTables, grade)
	if table == nil {
		return 0
	}
	return table.Points[*position]
}
