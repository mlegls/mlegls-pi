import { run as prepare, type Options } from "./prepare.ts";
export type { Options, Prepared } from "./prepare.ts";

/** Where things stand and which session to enter next; no execution assignment. */
export const run = (scope = "the current project tracker", options?: Options) => prepare("orient", scope, options);
