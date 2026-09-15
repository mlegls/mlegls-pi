export type DisplayKind = "source" | "shell" | "terminal" | "text" | "image";
export function register<T extends object>(value: T, kind: DisplayKind): T;
export function format(value: unknown, limit?: number): { text: string; truncated: boolean } | undefined;
export function preview(value: unknown): string;
