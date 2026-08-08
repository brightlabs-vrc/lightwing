import { APIError } from "encore.dev/api";

export const ERROR_CODES = {
  EVENT_PARTICIPANT_LIMIT_REACHED: "EVENT_PARTICIPANT_LIMIT_REACHED",
  RACE_PARTICIPANT_LIMIT_REACHED: "RACE_PARTICIPANT_LIMIT_REACHED",
  GRANULAR_USER_RACE_LIMIT_REACHED: "GRANULAR_USER_RACE_LIMIT_REACHED",
  PARTICIPANT_LIMIT_BELOW_CURRENT_ENROLLMENT: "PARTICIPANT_LIMIT_BELOW_CURRENT_ENROLLMENT",
  INVALID_PARTICIPANT_LIMIT: "INVALID_PARTICIPANT_LIMIT",
};

/**
 * Accepts undefined for PATCH omission and null for clearing.
 * Otherwise returns a positive safe integer or throws a typed validation error.
 */
export function parseOptionalPositiveInt(
  value: any,
  fieldName: string
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    throw new APIError(
      "invalid_argument",
      `${fieldName} must be a positive whole number`,
      { code: ERROR_CODES.INVALID_PARTICIPANT_LIMIT, fieldName }
    );
  }

  return parsed;
}

/**
 * Rejects a non-null limit lower than current enrollment.
 */
export function assertLimitCanBeReduced(
  currentCount: number,
  requestedLimit: number | null | undefined,
  errorCode: string,
  message: string
): void {
  if (requestedLimit !== undefined && requestedLimit !== null) {
    if (requestedLimit < currentCount) {
      throw new APIError("failed_precondition", message, {
        code: errorCode,
        limit: requestedLimit,
        currentCount,
      });
    }
  }
}
