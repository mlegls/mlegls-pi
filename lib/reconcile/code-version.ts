import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export interface CodeVersion { root: string; fingerprint: string }
export const CODE_CHECK_MS = 60_000;
const packageRoot = resolve(import.meta.dir, "../..");

/** Content and names, not mtimes: a checkout/merge that restores the same code is not a new version. */
export function fingerprint(root = packageRoot): string {
	const files: string[] = [];
	const visit = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(path);
		}
	};
	visit(join(root, "lib"));
	visit(join(root, "extensions/supervision"));
	const hash = createHash("sha256");
	for (const file of files.sort()) {
		const content = readFileSync(file);
		hash.update(relative(root, file) + "\0" + content.length + "\0");
		hash.update(content);
	}
	return hash.digest("hex");
}

// Capture while the modules are loading, not when a later tick first asks.
export const loadedCode: CodeVersion = { root: packageRoot, fingerprint: fingerprint() };

export class CodeMonitor {
	private checked = Date.now();
	private disk = loadedCode.fingerprint;
	changed(): boolean {
		if (Date.now() - this.checked >= CODE_CHECK_MS) {
			this.disk = fingerprint(loadedCode.root);
			this.checked = Date.now();
		}
		return this.disk !== loadedCode.fingerprint;
	}
}

/** Missing versions are pre-notice processes; do not claim they loaded today's code. */
export function codeStatus(version?: CodeVersion) {
	let stale = true;
	try { stale = !version || fingerprint(version.root) !== version.fingerprint; } catch { /* The loaded checkout may be gone. */ }
	return { codeVersion: version ?? null, stale };
}
