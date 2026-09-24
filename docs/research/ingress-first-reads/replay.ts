// Replay recorded bash-tool ingress judgments against the current fidelity question.
// Specimens are read from local pi session logs (never copied into the repo):
//   bun docs/research/ingress-first-reads/replay.ts [runs]
// Prints recorded vs replayed modes per specimen; judgments only, no compression.
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { judge, type Chunk, type Mode } from "../../../lib/ingress.ts";

// [session id prefix, filter-event index within the session, what the reading needed]
const SPECIMENS: [string, number, "exact" | "skim"][] = [
	["2026-09-24T01-46-34-160Z", 0, "exact"], // pwd; git status; ls -la; rg chrome
	["2026-09-24T06-58-52-996Z", 0, "exact"], // pwd; ls -la; find calc.ts
	["2026-09-24T07-18-35-016Z", 0, "exact"], // ls; git log
	["2026-09-24T07-18-35-016Z", 1, "exact"], // cat two READMEs the agent cloned to read
	["2026-09-24T07-05-04-311Z", 0, "exact"], // git log; ls docs/issues
	["2026-09-23T13-42-33-432Z", 5, "exact"], // read back design.md just written
	["2026-09-24T12-49-32-899Z", 1, "exact"], // grep -rl; ls
	["2026-09-24T02-26-45-522Z", 25, "exact"], // grep -n over src for a list of definitions
	["2026-09-23T13-42-33-432Z", 1, "skim"], // exa-cli search results
	["2026-09-23T13-42-33-432Z", 2, "skim"], // exa-cli search results
	["2026-09-24T01-46-34-160Z", 1, "skim"], // 41 KB pgrep/ls dump
	["2026-09-24T12-49-32-899Z", 2, "skim"], // 41 KB session scan
];

const root = join(homedir(), ".pi/agent/sessions");
const files = readdirSync(root).flatMap(d => { try { return readdirSync(join(root, d)).map(f => join(root, d, f)); } catch { return []; } });
function specimen(prefix: string, index: number) {
	const file = files.find(f => f.includes(prefix) && f.endsWith(".jsonl"))!;
	const events = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l))
		.filter(e => e.type === "custom" && e.customType === "exec-ingress" && e.data.type === "filter").map(e => e.data);
	const d = events[index];
	return { query: d.query as string, chunks: d.pages.map((p: any) => ({ text: p.text, label: p.label, context: p.context })) as Chunk[], recorded: d.pages.map((p: any) => p.mode as Mode), bytes: d.inputBytes as number };
}

const runs = Number(process.argv[2] ?? 2);
const kept = (modes: Mode[], chunks: Chunk[]) => Math.round(100 * chunks.reduce((n, c, i) => n + c.text.length * ({ verbatim: 1, skim75: .75, skim50: .5, cues: .25, omit: 0 })[modes[i]], 0) / chunks.reduce((n, c) => n + c.text.length, 0));
for (const [prefix, index, need] of SPECIMENS) {
	const s = specimen(prefix, index);
	const cell = s.query.split("Current exec cell:\n")[1]?.split("\n")[0].slice(0, 60);
	const replays: string[] = [];
	for (let r = 0; r < runs; r++) { const j = await judge(s.chunks, s.query); const m = j.map(x => x.mode); replays.push(kept(m, s.chunks) + "% " + summary(m)); }
	console.log([need.padEnd(5), String(s.bytes).padStart(6) + "B", "recorded " + kept(s.recorded, s.chunks) + "% " + summary(s.recorded), "replay " + replays.join(" | "), cell].join("  "));
}
function summary(modes: Mode[]) { const c: Record<string, number> = {}; for (const m of modes) c[m] = (c[m] ?? 0) + 1; return Object.entries(c).map(([k, v]) => v > 1 ? k + "×" + v : k).join(","); }
