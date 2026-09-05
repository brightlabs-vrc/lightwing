package scorecalc

import (
	"encore.dev/pubsub"
)

// Score calculation event types.
//
// Mirrors ts-legacy/scorecalc/events.ts. Field names and JSON tags match the
// TS interfaces so cross-service payloads interoperate.
type ScoreCalcRequested struct {
	Version     int    `json:"version"`
	JobID       string `json:"jobId"`
	EventID     string `json:"eventId"`
	Generation  int    `json:"generation"`
	RequestedAt string `json:"requestedAt"`
}

type ScoreCalcCompleted struct {
	Version        int         `json:"version"`
	JobID          string      `json:"jobId"`
	EventID        string      `json:"eventId"`
	Generation     int         `json:"generation"`
	ComputedAt     string             `json:"computedAt"`
	Result         ScoreCalcProjection `json:"result"`
	ResultChecksum string      `json:"resultChecksum"`
}

type ScoreCalcFailed struct {
	Version      int    `json:"version"`
	JobID        string `json:"jobId"`
	EventID      string `json:"eventId"`
	Generation   int    `json:"generation"`
	FailedAt     string `json:"failedAt"`
	ErrorCode    string `json:"errorCode"`
	ErrorMessage string `json:"errorMessage"`
	Retryable    bool   `json:"retryable"`
}

// ScoreCalcStatusEvent reports calculation lifecycle for external consumers.
type ScoreCalcStatusEvent struct {
	EventID   string   `json:"eventId"`
	UserIDs   []string `json:"userIds"`
	Status    string   `json:"status"`
	Timestamp string   `json:"timestamp"`
}

var (
	ScoreCalcRequestedTopic = pubsub.NewTopic[ScoreCalcRequested]("scorecalc-requested", pubsub.TopicConfig{
		DeliveryGuarantee: pubsub.AtLeastOnce,
	})
	ScoreCalcCompletedTopic = pubsub.NewTopic[ScoreCalcCompleted]("scorecalc-completed", pubsub.TopicConfig{
		DeliveryGuarantee: pubsub.AtLeastOnce,
	})
	ScoreCalcFailedTopic = pubsub.NewTopic[ScoreCalcFailed]("scorecalc-failed", pubsub.TopicConfig{
		DeliveryGuarantee: pubsub.AtLeastOnce,
	})
	ScoreCalcStatusTopic = pubsub.NewTopic[ScoreCalcStatusEvent]("score-calc-status", pubsub.TopicConfig{
		DeliveryGuarantee: pubsub.AtLeastOnce,
	})
)
