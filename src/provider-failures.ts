export type ProviderFailureKind =
  "quota_exhausted" | "temporarily_unavailable" | "authentication" | "invalid_request" | "unknown";

const QUOTA_PATTERNS = [
  /usage limit/i,
  /rate limit/i,
  /quota (?:exceeded|exhausted)/i,
  /too many requests/i,
  /credit balance/i,
  /reached (?:your|the) limit/i,
  /tokens? (?:exhausted|limit)/i,
];
const UNAVAILABLE_PATTERNS = [
  /connection refused/i,
  /service unavailable/i,
  /temporarily unavailable/i,
  /overloaded/i,
  /capacity/i,
  /timed? out/i,
];
const AUTH_PATTERNS = [
  /not authenticated/i,
  /login required/i,
  /authentication failed/i,
  /unauthorized/i,
  /invalid (?:api )?key/i,
];
const INVALID_REQUEST_PATTERNS = [
  /invalid request/i,
  /malformed/i,
  /unsupported (?:model|option|transport)/i,
  /unknown model/i,
];

export function classifyProviderFailure(error: unknown): ProviderFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (QUOTA_PATTERNS.some((pattern) => pattern.test(message))) return "quota_exhausted";
  if (UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return "temporarily_unavailable";
  }
  if (AUTH_PATTERNS.some((pattern) => pattern.test(message))) return "authentication";
  if (INVALID_REQUEST_PATTERNS.some((pattern) => pattern.test(message))) {
    return "invalid_request";
  }
  return "unknown";
}

export function shouldFallbackProviderFailure(error: unknown): boolean {
  const kind = classifyProviderFailure(error);
  return kind === "quota_exhausted" || kind === "temporarily_unavailable";
}

export function nextFallbackProfileId(
  currentProfileId: string,
  fallbackProfileIds: string[],
  attemptedProfileIds: string[]
): string | null {
  const attempted = new Set([...attemptedProfileIds, currentProfileId]);
  return fallbackProfileIds.find((profileId) => !attempted.has(profileId)) ?? null;
}
