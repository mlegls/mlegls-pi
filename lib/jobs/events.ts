// Timing events for comparing schedulers: dataflow (`ab supervise start`, which refills slots as children end
// and wakes the owner on exceptions) against bulk-synchronous (`ab supervise loop`: triage, batch, barrier).
// A stream separate from the loop's ledger, which triage reads back as context: this one is only for offline
// analysis, so it can be as fine-grained as slot occupancy needs. It sits beside the run's command log.
import { appendFileSync } from "node:fs";

export const eventsFile = (commands: string) => commands.replace(/\.commands\.jsonl$/, "") + ".events.jsonl";

export type Trace = (kind: string, fields?: Record<string, unknown>) => void;

export const tracer = (commands: string, base: Record<string, unknown>): Trace => (kind, fields = {}) => {
 // Instrumentation never fails the job it observes.
 try { appendFileSync(eventsFile(commands), JSON.stringify({ at: new Date().toISOString(), ...base, ...fields, kind }) + "\n"); } catch {}
};
