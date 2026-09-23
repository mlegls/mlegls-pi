import type { JobContext } from "../daemon.ts";

interface TickInput { intervalMs?: number }
interface TickState { ticks: number }

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, ms);
    if (signal.aborted) done();
    else signal.addEventListener("abort", done, { once: true });
  });
}

/** A small restartable job used to exercise the daemon's persistence path. */
export async function run(job: JobContext): Promise<TickState> {
  const suppliedInterval = (job.input as TickInput | null)?.intervalMs;
  const intervalMs = Number.isFinite(suppliedInterval) ? Math.max(50, Number(suppliedInterval)) : 1000;
  let ticks = Number((job.state as TickState | null)?.ticks) || 0;
  while (!job.signal.aborted) {
    ticks++;
    const state = { ticks };
    await job.save(state);
    job.log("tick " + ticks);
    await wait(intervalMs, job.signal);
  }
  return { ticks };
}
