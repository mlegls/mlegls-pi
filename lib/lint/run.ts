// run: extract and judge what a working tree adds over a ref; print the ranked review queue.
//
//   bun lib/lint/run.ts <repoRoot> <sinceRef> [top=12]
//
// tsconfigs are the root tsconfig.json and every packages/*/tsconfig.json that exists. Output is
// advisory: one line per finding above 0.5, highest first, plus static findings, which need no
// judgment. Nothing here fails; the reader decides what is worth a look.

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { extract } from "./extract";
import { judgeAll, type Finding } from "./judge";

const [rootArg, sinceRef, topArg] = process.argv.slice(2);
if (!rootArg || !sinceRef) throw new Error("usage: run.ts <repoRoot> <sinceRef> [top]");
const root = resolve(rootArg);
const top = topArg ? +topArg : 12;

const tsconfigs = ["tsconfig.json", ...(existsSync(join(root, "packages")) ? readdirSync(join(root, "packages")).map((p) => `packages/${p}/tsconfig.json`) : [])]
  .filter((t) => existsSync(join(root, t)));
if (tsconfigs.length === 0) throw new Error(`no tsconfig.json under ${root}`);

const spans = extract(root, tsconfigs, sinceRef);
const findings = await judgeAll(spans);
const line = (f: Finding, q: string, p: number) => `${p.toFixed(2)} ${f.kind}/${q} ${f.file}:${f.line}  ${f.text.replace(/\s+/g, " ").slice(0, 100)}`;

const ranked = findings
  .flatMap((f) => Object.entries(f.answers).map(([q, p]) => ({ f, q, p })))
  .filter(({ p }) => p >= 0.5)
  .sort((a, b) => b.p - a.p)
  .slice(0, top);
for (const f of findings) if (f.kind === "static" && f.reason && Object.keys(f.answers).length === 0) console.log(`static ${f.file}:${f.line}  ${f.reason}`);
for (const { f, q, p } of ranked) console.log(line(f, q, p));
console.log(`${spans.length} spans judged over ${tsconfigs.join(",")} since ${sinceRef}; ${ranked.length} at or above 0.5`);
