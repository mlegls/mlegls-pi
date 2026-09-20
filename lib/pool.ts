// Fraction of this provider's ceiling consumed; replace with the usage reader.
export function usage(_provider: string): number { return 0; }

// Usage and ceiling must share units; normalized usage has ceiling 1.
export function effectiveCost(listCost: number, used: number, ceiling = 1) {
  return used >= ceiling ? Infinity : listCost / (1 - used / ceiling);
}
