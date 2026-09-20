import { run as prepare, type Options } from "./prepare.ts";
export type { Options, Prepared } from "./prepare.ts";

/** New intent → a prepared parent session. */
export const run = (intent: string, options?: Options) => prepare("introduce", intent, options);
