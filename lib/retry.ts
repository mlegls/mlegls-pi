/** Network failures that a plain retry of worker setup recovers from (flaky Convex lookup, GitHub TLS). */
export const transientNetworkError = (text: string): boolean => /fetch failed|failed to fetch|socket hang up|TLS handshake timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(text);
export const networkRetryDelay = (attempt: number): number => 15_000 * (attempt + 1);
