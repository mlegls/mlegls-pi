import { run as prepare, type Options } from "./prepare.ts";
export type { Options, Prepared } from "./prepare.ts";

/** Recorded scope → one prepared session; omission means the current project tracker. */
export const run = (scope = "the current project tracker", options?: Options) => prepare("advance", scope, options);
