import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync } from "node:fs";
import * as path from "node:path";

const COMMANDS = ["pi", "claude", "codex", "node", "bun", "npm", "uv", "python", "python3", "pip", "mise", "nix", "brew"];

function detectProjectTools(root: string): string[] {
	const groups: Array<[string, string[]]> = [
		["JavaScript", ["bun.lock", "bun.lockb", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "deno.lock"]],
		["Python", ["uv.lock", "pyproject.toml", "poetry.lock", "Pipfile", "requirements.txt"]],
		["Environment", ["mise.toml", ".mise.toml", "flake.nix", "shell.nix", "devbox.json"]],
	];

	return groups.flatMap(([label, files]) => {
		const found = files.filter((file) => existsSync(path.join(root, file)));
		return found.length > 0 ? [`${label}: ${found.join(", ")}`] : [];
	});
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("env", {
		description: "Show project tooling and command provenance",
		handler: async (_args, ctx) => {
			const gitRoot = await pi.exec("git", ["rev-parse", "--show-toplevel"], { timeout: 3000 });
			const root = gitRoot.code === 0 ? gitRoot.stdout.trim() : ctx.cwd;
			const project = detectProjectTools(root);
			const resolutions = await Promise.all(
				COMMANDS.map(async (command) => {
					const result = await pi.exec("/usr/bin/which", ["-a", command], { timeout: 3000 });
					const paths = result.code === 0
						? [...new Set(result.stdout.split("\n").map((item) => item.trim()).filter(Boolean))]
						: [];
					return paths.length > 0 ? `${command}: ${paths.join(" | ")}` : `${command}: not found`;
				}),
			);

			const text = [
				`Root: ${root}`,
				...(project.length > 0 ? project : ["Project tooling: no recognized lockfiles or environment files"]),
				"",
				...resolutions,
			].join("\n");
			ctx.ui.notify(text, "info");
		},
	});
}
