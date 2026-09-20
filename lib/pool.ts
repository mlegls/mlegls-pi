// Fraction of the provider’s routing ceiling consumed; absent telemetry is unknown.
export function usage(provider: string, snapshot: Record<string, number | null> = {}): number | null {
  return snapshot[provider] ?? null;
}

// Usage and ceiling must share units; normalized usage has ceiling 1.
export function effectiveCost(listCost: number, used: number, ceiling = 1) {
  return used >= ceiling ? Infinity : listCost / (1 - used / ceiling);
}
