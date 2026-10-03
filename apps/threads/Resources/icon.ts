// Draws the Threads app icon: three plies twist down, then unply into three strands (the spawn tree).
// bun apps/threads/Resources/icon.ts → AppIcon.icns beside this file (needs resvg; iconutil ships with macOS).
// The SVG is printed to stdout for previewing.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const dir = new URL(".", import.meta.url).pathname;
const colors = ["#ff7a59", "#ffd166", "#4cc9c0"];
const top = 60, split = 500, bottom = 790, cx = 512, amp = 50, k = 2 * Math.PI / 190;
const phase = [0, 1, 2].map(i => i * 2 * Math.PI / 3);
// Each strand fans out to the side it's already on at the split, so none cross while unplying.
const spread: number[] = [];
[0, 1, 2].sort((a, b) => Math.sin(k * split + phase[a]) - Math.sin(k * split + phase[b])).forEach((i, r) => spread[i] = [-210, 0, 210][r]);

type Seg = { x1: number; y1: number; x2: number; y2: number; z: number; i: number };
const segs: Seg[] = [];
for (let i = 0; i < 3; i++) {
	let prev: { x: number; y: number; z: number } | undefined;
	for (let y = top; y <= bottom; y += 2.5) {
		const th = k * y + phase[i];
		const t = y <= split ? 0 : Math.min(1, (y - split) / (bottom - split - 70));
		const e = t * t * (3 - 2 * t);
		const x = cx + amp * (1 - e) * Math.sin(th) + spread[i] * e, z = Math.cos(th) * (1 - e);
		if (prev) segs.push({ x1: prev.x, y1: prev.y, x2: x, y2: y, z: (z + prev.z) / 2, i });
		prev = { x, y, z };
	}
}
segs.sort((a, b) => a.z - b.z); // painter's order: strands behind are drawn first, and darker
const shade = (hex: string, f: number) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * f | 0},${((n >> 8) & 255) * f | 0},${(n & 255) * f | 0})`; };
const f = (n: number) => n.toFixed(1);
const strands = segs.map(s => `<line x1="${f(s.x1)}" y1="${f(s.y1)}" x2="${f(s.x2)}" y2="${f(s.y2)}" stroke="${shade(colors[s.i], 0.6 + 0.2 * (s.z + 1))}" stroke-width="40" stroke-linecap="round"/>`).join("");

// macOS grid: an 824 squircle body centred on a 1024 canvas, with the system's drop shadow baked in.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262b38"/><stop offset="1" stop-color="#11141b"/></linearGradient>
<clipPath id="body"><rect x="100" y="100" width="824" height="824" rx="186"/></clipPath>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".28"/></filter></defs>
<rect x="100" y="100" width="824" height="824" rx="186" fill="url(#bg)" filter="url(#shadow)"/>
<g clip-path="url(#body)">${strands}</g>
<rect x="100.5" y="100.5" width="823" height="823" rx="186" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="2"/>
</svg>
`;
const tmp = mkdtempSync(tmpdir() + "/threads-icon-");
writeFileSync(tmp + "/icon.svg", svg);
process.stdout.write(svg);
const set = tmp + "/AppIcon.iconset";
spawnSync("mkdir", [set]);
for (const n of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) {
	const r = spawnSync("resvg", ["-w", String(n * scale), tmp + "/icon.svg", `${set}/icon_${n}x${n}${scale === 2 ? "@2x" : ""}.png`], { stdio: "inherit" });
	if (r.status !== 0) throw new Error("resvg failed");
}
const r = spawnSync("iconutil", ["-c", "icns", set, "-o", dir + "AppIcon.icns"], { stdio: "inherit" });
rmSync(tmp, { recursive: true });
if (r.status !== 0) throw new Error("iconutil failed");
