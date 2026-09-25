// run: extract and judge what a working tree adds over a ref; print the ranked review queue.
//
//   bun lib/lint/run.ts <repoRoot> <sinceRef> [top=12]
//
// tsconfigs are the root tsconfig.json and every packages/*/tsconfig.json that exists. Output is
// advisory: one line per finding above 0.5, highest first, plus static findings, which need no
// judgment. Nothing here fails; the reader decides what is worth a look.

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { extract } from "./extract";
import { drift } from "./drift";
import { judgeAll, type Finding } from "./judge";

const [rootArg, sinceRef, topArg] = process.argv.slice(2);
if (!rootArg || !sinceRef) throw new Error("usage: run.ts <repoRoot> <sinceRef> [top]");
const root = resolve(rootArg);
const top = topArg ? +topArg : 12;

const tsconfigs = ["tsconfig.json", ...(existsSync(join(root, "packages")) ? readdirSync(join(root, "packages")).map((p) => `packages/${p}/tsconfig.json`) : [])]
  .filter((t) => existsSync(join(root, t)));
if (tsconfigs.length === 0) throw new Error(`no tsconfig.json under ${root}`);

// Agents tend to finish together, and each extract type-checks whole programs (~2.5 GB on a
// mid-size repo), so extraction takes one of JEV_LINT_SLOTS (default 1) machine-wide slots.
async function slot(): Promise<() => void> {
  const dir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "jev-lint", "slots");
  mkdirSync(dir, { recursive: true });
  const slots = Number(process.env.JEV_LINT_SLOTS ?? 1);
  for (;;) {
    for (let i = 0; i < slots; i++) {
      const path = join(dir, String(i));
      try {
        writeFileSync(path, String(process.pid), { flag: "wx" });
        const release = () => { try { unlinkSync(path); } catch {} };
        process.once("exit", release);
        return release;
      } catch {
        try { process.kill(Number(readFileSync(path, "utf8")), 0); } catch { try { unlinkSync(path); } catch {} }
      }
    }
    await Bun.sleep(1000);
  }
}
const release = await slot();
const spans = extract(root, tsconfigs, sinceRef);
release();
Bun.gc(true);
const [findings, drifts] = await Promise.all([judgeAll(spans), drift(root, sinceRef)]);
const line = (f: Finding, q: string, p: number) => `${p.toFixed(2)} ${f.kind}/${q} ${f.file}:${f.line}  ${f.text.replace(/\s+/g, " ").slice(0, 100)}`;

const ranked = findings
  .flatMap((f) => Object.entries(f.answers).map(([q, p]) => ({ f, q, p })))
  .filter(({ p }) => p >= 0.5)
  .sort((a, b) => b.p - a.p)
  .slice(0, top);
for (const f of findings) if (f.kind === "static" && f.reason && Object.keys(f.answers).length === 0) console.log(`static ${f.file}:${f.line}  ${f.reason}`);
for (const { f, q, p } of ranked) console.log(line(f, q, p));
for (const d of drifts.filter((d) => d.p >= 0.4)) console.log(`${d.p.toFixed(2)} drift ${d.note}  contradicted? ${d.statement?.slice(0, 160)}`);
console.log(`${spans.length} spans judged over ${tsconfigs.join(",")} since ${sinceRef}; ${ranked.length} at or above 0.5; ${drifts.length} concept notes checked for drift`);
