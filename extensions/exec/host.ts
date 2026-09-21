import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Host modules are explicit installers, never kernel import side effects. */
export interface HostModule {
	install(host: ExtensionAPI): void | Promise<void>;
}

export interface HostModuleError { path: string; error: string }

/** One installation per Pi extension instance, independent of kernel generations. */
export function createHostModuleLoader(host: ExtensionAPI) {
	const installed = new Map<string, Promise<void>>();
	return async function load(directory: string): Promise<HostModuleError[]> {
		const errors: HostModuleError[] = [];
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (!entry.isDirectory()) continue;
			const path = join(directory, entry.name, "host.ts");
			try {
				try { if (!(await stat(path)).isFile()) continue; }
				catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
				let pending = installed.get(path);
				if (!pending) {
					pending = (async () => {
						// Pi's module loader supplies TypeScript support and host SDK identity.
						const module: HostModule = await import(path);
						if (typeof module.install !== "function") throw new Error("Host module must export install(host)");
						await module.install(host);
					})();
					installed.set(path, pending);
				}
				await pending;
			} catch (error) {
				// Keep other capabilities usable; do not retry partially installed modules.
				errors.push({ path, error: String(error) });
			}
		}
		return errors;
	};
}
