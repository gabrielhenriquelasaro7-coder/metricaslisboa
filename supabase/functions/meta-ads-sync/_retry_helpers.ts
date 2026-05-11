// Shared helpers for parsing Meta API rate-limit signals.
// Extracted into its own module so it can be unit-tested in isolation.

export const MAX_RETRY_AFTER_MS = 180_000; // 3 min cap

/**
 * Parse a standard HTTP `Retry-After` header. Supports both delta-seconds
 * (e.g. "60") and HTTP-date (e.g. "Wed, 21 Oct 2026 07:28:00 GMT").
 * Returns null when the value is missing or unparseable.
 */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.min(parseInt(trimmed, 10) * 1000, MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(trimmed);
  if (!isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
  }
  return null;
}

/**
 * Parse Meta's `X-Business-Use-Case-Usage` / `X-App-Usage` / `X-Ad-Account-Usage`
 * JSON payload and extract the maximum `estimated_time_to_regain_access`
 * (returned in minutes) found anywhere in the structure.
 */
export function parseUsageHeader(headerValue: string | null): number | null {
  if (!headerValue) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(headerValue);
  } catch {
    return null;
  }
  let maxEstimated = 0;
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.estimated_time_to_regain_access === 'number') {
        maxEstimated = Math.max(maxEstimated, obj.estimated_time_to_regain_access);
      }
      Object.values(obj).forEach(visit);
    }
  };
  visit(parsed);
  if (maxEstimated > 0) return Math.min(maxEstimated * 60_000, MAX_RETRY_AFTER_MS);
  return null;
}
