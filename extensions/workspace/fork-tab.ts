import { rm, writeFile } from "node:fs/promises";
import { SessionManager, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export type Run = (command: string, args: string[]) => Promise<string>;

export async function openForkTab(ctx: ExtensionCommandContext, name: string, run: Run, pane = process.env.TMUX_PANE) {
	if (!pane) throw new Error("/fork-tab requires tmux");
	await ctx.waitForIdle();
	const source = ctx.sessionManager.getSessionFile();
	if (!source) throw new Error("/fork-tab requires a persisted session");
	// Resolve from this pane, not whichever session a client has most recently selected.
	const session = (await run("tmux", ["display-message", "-p", "-t", pane, "#{session_id}"])).trim();
	if (!session) throw new Error("Cannot resolve the current tmux session");
	let cwd = ctx.cwd;
	if (name) {
		const result = JSON.parse(await run("cyber-mux", ["worktree", "add", `--branch=${name}`, "--format", "json"]));
		if (typeof result.root !== "string" || !result.root) throw new Error("cyber-mux returned no worktree root");
		cwd = result.root;
		ctx.ui.notify(`Worktree: ${cwd}`, "info");
	}
	const fork = SessionManager.create(cwd, undefined, { parentSession: source });
	const file = fork.getSessionFile()!;
	try {
		// Snapshot the live branch: the last entry on disk need not be the current /tree position.
		await writeFile(file, [fork.getHeader(), ...ctx.sessionManager.getBranch()].map(e => JSON.stringify(e)).join("\n") + "\n", { flag: "wx" });
		// Multiple command arguments make tmux exec directly, without shell interpolation.
		await run("tmux", ["new-window", "-t", `${session}:`, "-c", cwd, "-n", name || "pi-fork", "--", "pi", "--session", file]);
	} catch (error) {
		await rm(file, { force: true });
		throw error;
	}
}

export function registerForkTab(pi: ExtensionAPI) {
	pi.registerCommand("fork-tab", {
		description: "Fork into a new tmux window: /fork-tab [new-worktree-name]",
		handler: async (args, ctx) => {
			try {
				await openForkTab(ctx, args.trim(), async (command, argv) => {
					const result = await pi.exec(command, argv, { cwd: ctx.cwd });
					if (result.code !== 0) throw new Error(result.stderr.trim() || `${command} exited ${result.code}`);
					return result.stdout;
				});
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
