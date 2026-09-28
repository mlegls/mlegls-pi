import { resolve } from "node:path";
import { SourceFile, type createSourceAPI } from "../extensions/exec/source";

type SourceAPI = ReturnType<typeof createSourceAPI>;
interface Excerpt {
	range: { startLine: number; endLine: number };
	source: string;
	partial?: boolean;
	sourceByteStart?: number;
	sourceByteEnd?: number;
}
export interface Retrieval {
	schemaVersion: number;
	root: string;
	introduction: string;
	files: { path: string; excerpts: Excerpt[] }[];
	closing: string;
}

/** Render only verified whole-line evidence with session-owned edit identities. */
export async function renderRetrieval(result: Retrieval, api: SourceAPI): Promise<string> {
	if (result.schemaVersion !== 1) throw new Error("Unsupported jevgrep JSON schema");
	const out = [result.introduction];
	for (const file of result.files) {
		if (!file.excerpts.length) continue;
		let snapshot: SourceFile | undefined;
		let readError: string | undefined;
		try {
			const value = await api.read(resolve(result.root, file.path));
			if (value instanceof SourceFile) snapshot = value;
			else readError = "not a text file";
		} catch (error) { readError = String(error); }
		for (const excerpt of file.excerpts) {
			const { startLine, endLine } = excerpt.range;
			const partial = excerpt.partial || excerpt.sourceByteStart !== undefined;
			// Jevgrep counts the terminal empty split segment; the ledger has no row for it.
			const rawLines = snapshot?.text.split("\n");
			const validRange = Number.isSafeInteger(startLine) && Number.isSafeInteger(endLine) && startLine >= 1 && endLine >= startLine && snapshot && startLine <= snapshot.rows.length && endLine <= rawLines!.length;
			const selection = validRange ? snapshot!.lines(startLine, Math.min(endLine, snapshot!.rows.length)) : undefined;
			if (!partial && selection && rawLines!.slice(startLine - 1, endLine).join("\n") === excerpt.source) {
				out.push(selection.render());
				continue;
			}
			const reason = readError ? `unavailable: ${readError}` : partial ? "partial excerpt; no edit anchors" : "stale excerpt: file no longer matches; reread before editing";
			const fence = "`".repeat(Math.max(3, ...Array.from(excerpt.source.matchAll(/`+/g), m => m[0].length + 1)));
			out.push(`Source block ${JSON.stringify(file.path)} lines ${startLine}-${endLine} [${reason}]:\n${fence}\n${excerpt.source}\n${fence}`);
		}
	}
	out.push(result.closing);
	return out.join("\n\n");
}

export const DEFAULT_SOURCE_BYTES = 8192;
export function retrievalArgs(args: string[]): string[] {
	const end = args.indexOf("--");
	const options = end < 0 ? args : args.slice(0, end);
	const explicit = options.some(arg => arg === "--max-source-bytes" || arg.startsWith("--max-source-bytes="));
	return ["--json", ...(explicit ? [] : ["--max-source-bytes", String(DEFAULT_SOURCE_BYTES)]), ...args];
}
export async function jevgrep(args: string[], source: () => Promise<SourceAPI>) {
	if (!args.length) throw new Error('usage: ab jg "question" [root] [search options]');
	const started = Date.now();
	const child = Bun.spawn([resolve(import.meta.dir, "../bin/jg"), ...retrievalArgs(args)], { stdout: "pipe", stderr: "inherit", stdin: "ignore" });
	const [text, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
	let result: Retrieval;
	try { result = JSON.parse(text); }
	catch { process.stdout.write(text); process.exitCode = code || 1; return; }
	console.log(await renderRetrieval(result, await source()));
	console.error(`jg ${JSON.stringify(args[0])}: ${((Date.now() - started) / 1000).toFixed(1)}s, ${result.files.length} files, exit ${code}`);
	process.exitCode = code;
}
