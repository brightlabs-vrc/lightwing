import { Topic } from "encore.dev/pubsub";

export interface ScoreCalcProjection {
  eventId: string;
  entries: Array<{
    userId: string;
    points: number;
  }>;
}

export interface ScoreCalcRequested {
  version: 1;
  jobId: string;
  eventId: string;
  generation: number;
  requestedAt: string;
}

export interface ScoreCalcCompleted {
  version: 1;
  jobId: string;
  eventId: string;
  generation: number;
  computedAt: string;
  result: ScoreCalcProjection;
  resultChecksum: string;
}

export interface ScoreCalcFailed {
  version: 1;
  jobId: string;
  eventId: string;
  generation: number;
  failedAt: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}

export const scoreCalcRequestedTopic = new Topic<ScoreCalcRequested>("scorecalc-requested", {
  deliveryGuarantee: "at-least-once",
});

export const scoreCalcCompletedTopic = new Topic<ScoreCalcCompleted>("scorecalc-completed", {
  deliveryGuarantee: "at-least-once",
});

export const scoreCalcFailedTopic = new Topic<ScoreCalcFailed>("scorecalc-failed", {
  deliveryGuarantee: "at-least-once",
});
