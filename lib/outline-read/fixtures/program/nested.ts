import { area, type Shape } from "./shapes.ts";

export class Bag {
  private items: Shape[] = [];
  add(s: Shape): this {
    this.items.push(s);
    return this;
  }
  total(): number {
    const sum = (a: number, b: number) => a + b;
    return this.items.map(area).reduce(sum, 0);
  }
}

export function api() {
  function measure(s: Shape) { return area(s); }
  return { measure };
}

export const viaApi = api().measure;
