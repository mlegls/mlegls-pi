/** Transient setup failures formerly retried by reconciler launch; setup now runs after admission. */
export const transientNetworkError = (text: string): boolean => /fetch failed|failed to fetch|socket hang up|TLS handshake timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(text);
export const networkRetryDelay = (attempt: number): number => 15_000 * (attempt + 1);
