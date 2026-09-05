package auth

// EventOwnerType enumerates how an event can be owned.
// Values match the Postgres EventOwnerType enum and the TS comparisons.
type EventOwnerType string

const (
	EventOwnerTypeUser         EventOwnerType = "USER"
	EventOwnerTypeOrganization EventOwnerType = "ORGANIZATION"
)
