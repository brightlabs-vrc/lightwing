package eventmanager

import (
	"encoding/json"
	"fmt"

	"encore.dev/beta/errs"
)

// Participation-limit error codes.
//
// Mirrors ts-legacy/eventmanager/participation-limits.ts ERROR_CODES.
const (
	CodeEventParticipantLimitReached       = "EVENT_PARTICIPANT_LIMIT_REACHED"
	CodeRaceParticipantLimitReached        = "RACE_PARTICIPANT_LIMIT_REACHED"
	CodeGranularUserRaceLimitReached       = "GRANULAR_USER_RACE_LIMIT_REACHED"
	CodeParticipantLimitBelowEnrollment    = "PARTICIPANT_LIMIT_BELOW_CURRENT_ENROLLMENT"
	CodeInvalidParticipantLimit            = "INVALID_PARTICIPANT_LIMIT"
)

// detailsMap is a JSON-serializable error details payload. It implements
// errs.ErrDetails via the marker method so structured codes (e.g.
// EVENT_PARTICIPANT_LIMIT_REACHED with limit/currentCount) reach API clients.
type detailsMap map[string]any

func (detailsMap) ErrDetails() {}

// OptInt is a tri-state integer for create/update payloads: unset (field
// omitted), explicit null (clear the limit), or a positive value.
// It mirrors the TS `number | null | undefined` limit fields.
//
// Mirrors ts-legacy/eventmanager/participation-limits.ts parseOptionalPositiveInt.
type OptInt struct {
	Set   bool
	Value *int
}

// UnmarshalJSON accepts null (clear) or a positive whole number, rejecting
// anything else with an invalid-argument error.
func (o *OptInt) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		o.Set = true
		o.Value = nil
		return nil
	}
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	n, err := parsePositiveInt(raw, "")
	if err != nil {
		return err
	}
	o.Set = true
	o.Value = &n
	return nil
}

// MarshalJSON round-trips the tri-state value.
func (o OptInt) MarshalJSON() ([]byte, error) {
	if !o.Set || o.Value == nil {
		return []byte("null"), nil
	}
	return json.Marshal(*o.Value)
}

// OptString is a tri-state string: unset (omit), explicit null (clear), or a value.
// It mirrors the TS `string | null | undefined` update fields.
type OptString struct {
	Set   bool
	Value *string
}

// UnmarshalJSON accepts null (clear) or a string.
func (o *OptString) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		o.Set = true
		o.Value = nil
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	o.Set = true
	o.Value = &s
	return nil
}

// MarshalJSON round-trips the tri-state value.
func (o OptString) MarshalJSON() ([]byte, error) {
	if !o.Set || o.Value == nil {
		return []byte("null"), nil
	}
	return json.Marshal(*o.Value)
}

// parsePositiveInt mirrors TS Number(value) validation: the value must be a
// positive safe integer, otherwise an InvalidArgument error carrying
// INVALID_PARTICIPANT_LIMIT is returned.
func parsePositiveInt(value any, fieldName string) (int, error) {
	var f float64
	switch n := value.(type) {
	case float64:
		f = n
	case float32:
		f = float64(n)
	case int:
		f = float64(n)
	case int64:
		f = float64(n)
	default:
		return 0, &errs.Error{
			Code:    errs.InvalidArgument,
			Message: fmt.Sprintf("%s must be a positive whole number", fieldName),
			Details: detailsMap{"code": CodeInvalidParticipantLimit, "fieldName": fieldName},
		}
	}
	if f != float64(int64(f)) || f <= 0 || f > 9007199254740991 {
		return 0, &errs.Error{
			Code:    errs.InvalidArgument,
			Message: fmt.Sprintf("%s must be a positive whole number", fieldName),
			Details: detailsMap{"code": CodeInvalidParticipantLimit, "fieldName": fieldName},
		}
	}
	return int(f), nil
}

// ParseOptionalPositiveInt validates an optional limit value: nil means
// unset/cleared (returned as nil, false), otherwise a positive whole number
// is returned. Anything else yields an InvalidArgument error.
//
// Mirrors ts-legacy/eventmanager/participation-limits.ts parseOptionalPositiveInt.
func ParseOptionalPositiveInt(value any, fieldName string) (*int, error) {
	if value == nil {
		return nil, nil
	}
	n, err := parsePositiveInt(value, fieldName)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// AssertLimitCanBeReduced rejects a non-null limit lower than the current
// enrollment with a FailedPrecondition error.
//
// Mirrors ts-legacy/eventmanager/participation-limits.ts assertLimitCanBeReduced.
func AssertLimitCanBeReduced(currentCount, requestedLimit int, errorCode, message string) error {
	if requestedLimit < currentCount {
		return &errs.Error{
			Code:    errs.FailedPrecondition,
			Message: message,
			Details: detailsMap{"code": errorCode, "limit": requestedLimit, "currentCount": currentCount},
		}
	}
	return nil
}
