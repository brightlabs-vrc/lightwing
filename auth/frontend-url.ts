import { secret } from "encore.dev/config";

const frontendUrlSecret = secret("FRONTEND_URL");

export function normalizeFrontendUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/\/$/, "");
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

export function getFrontendUrl(): string | undefined {
  const frontendUrlFromEnv = normalizeFrontendUrl(process.env.FRONTEND_URL);
  if (frontendUrlFromEnv) {
    return frontendUrlFromEnv;
  }

  try {
    return normalizeFrontendUrl(frontendUrlSecret());
  } catch {
    return undefined;
  }
}
