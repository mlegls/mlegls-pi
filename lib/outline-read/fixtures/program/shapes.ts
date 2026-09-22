// Shapes: a fixture for program.test.ts.

type Circle = { kind: "circle"; r: number };
type Rect = { kind: "rect"; w: number; h: number };
export type Shape = Circle | Rect; // sum

export function area(s: Shape): number {
  return s.kind === "circle" ? Math.PI * s.r * s.r : s.w * s.h;
}

/** Perimeter, for symmetry. */
export function perimeter(s: Shape): number {
  return s.kind === "circle" ? 2 * Math.PI * s.r : 2 * (s.w + s.h);
}

export const unit: Rect = { kind: "rect", w: 1, h: 1 };
