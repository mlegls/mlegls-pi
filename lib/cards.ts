// cards: tile a directory of screenshots into labeled contact sheets so a reviewer
// reads a few images instead of many.
//
//   bun cards.ts <dir> [--per 9] [--cols 3] [--w 480] [--out <dir>/cards]
//
// Prints one line per card: `<card.png>: <shot> <shot> ...` (labels are file stems).
// Needs ImageMagick `montage`.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const FONTS = ["/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"];

export async function cards(dir: string, o: { per?: number; cols?: number; w?: number; out?: string } = {}): Promise<Array<{ card: string; shots: string[] }>> {
	const per = o.per ?? 9, cols = o.cols ?? 3, w = o.w ?? 480;
	const out = resolve(o.out ?? join(dir, "cards"));
	const shots = readdirSync(dir)
		.filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
		.sort()
		.map((f) => resolve(dir, f));
	if (shots.length === 0) return [];
	mkdirSync(out, { recursive: true });
	const font = FONTS.find(existsSync);
	const result: Array<{ card: string; shots: string[] }> = [];
	for (let i = 0; i < shots.length; i += per) {
		const chunk = shots.slice(i, i + per);
		const card = join(out, `${String(i / per + 1).padStart(2, "0")}.png`);
		const argv = ["montage", ...chunk, ...(font ? ["-font", font] : []), "-label", "%t", "-tile", `${cols}x`, "-geometry", `${w}x${w}+8+8`, "-pointsize", "16", "-background", "#222", "-fill", "#eee", card];
		const r = Bun.spawnSync(argv, { cwd: dir, env: { ...process.env, FONTCONFIG_FILE: process.env.FONTCONFIG_FILE ?? "/dev/null" } });
		if (r.exitCode !== 0) throw new Error(`montage failed: ${r.stderr.toString().trim()}`);
		result.push({ card, shots: chunk.map((s) => basename(s, extname(s))) });
	}
	return result;
}

if (import.meta.main) {
	const a = process.argv.slice(2);
	const opt = (n: string) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : undefined; };
	const dir = a.find((x, i) => !x.startsWith("--") && !a[i - 1]?.startsWith("--"));
	if (!dir) { console.error("usage: cards.ts <dir> [--per 9] [--cols 3] [--w 480] [--out DIR]"); process.exit(2); }
	const num = (n: string) => (opt(n) ? Number(opt(n)) : undefined);
	for (const { card, shots } of await cards(dir, { per: num("per"), cols: num("cols"), w: num("w"), out: opt("out") })) console.log(`${card}: ${shots.join(" ")}`);
}
