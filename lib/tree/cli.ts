// ab tree: session views over lib/tree, every pi session with its parent, project and live state.
//   ab tree [-m tree|projects|status] [-a] [--json] [--days N] [--hours N] [QUERY]
//   ab tree ui [--sidebar] [QUERY]   thread tree; no tmux dashboard
//   ab tree sidebar                  open the sidebar split
//   ab tree app                      build and open the native thread app (apps/threads)
//   ab tree do new|fork|merge|continue|abandon|seen [--id ID] [--sibling] [--name BRANCH] [--project Q]   app action, JSON result
//   ab tree open ID | send ID [TEXT]   thread attach / send
//   ab timeline [SESSION]   HTML timeline of a session tree (default this session), opened in the browser
import { parseArgs } from "node:util";

const fail = (message: string): never => { console.error(message); process.exit(1); };

export async function tree(args: string[]) {
	if (args[0] === "sidebar") return (await import("./ghostty.ts")).openSidebar();
	if (args[0] === "app") return (await import("./app.ts")).launchApp();
	if (args[0] === "do") return (await import("./app.ts")).perform(args.slice(1));
	if (args[0] === "ui") return (await import("./ui.ts")).ui({ sidebar: args.includes("--sidebar"), query: args.slice(1).filter(a => a !== "--sidebar").join(" ") });
	if (args[0] === "open" || args[0] === "send") {
		const { attachThread, sendThread } = await import("../thread");
		const id = args[1];
		if (!id) return fail("supply a thread id");
		if (args[0] === "open") await attachThread(id);
		else await sendThread(id, (args.slice(2).join(" ") || await Bun.stdin.text()) + "\r");
		return;
	}
	const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
		mode: { type: "string", short: "m", default: "tree" }, all: { type: "boolean", short: "a" },
		json: { type: "boolean" }, days: { type: "string" }, hours: { type: "string" } } });
	const { graph } = await import("./graph.ts");
	const view = await import("./view.ts");
	const nodes = await graph({ days: values.days ? Number(values.days) : undefined });
	const mode = values.mode as "tree" | "projects" | "status";
	if (!["tree", "projects", "status"].includes(mode)) fail("mode must be tree, projects or status");
	const rows = view.rows(nodes, mode, { query: positionals.join(" "), all: values.all, hours: values.hours ? Number(values.hours) : undefined });
	if (values.json) for (const r of rows) console.log(JSON.stringify(r.kind === "header" ? r : { ...r, node: { ...r.node, children: undefined, lastText: undefined } }));
	else for (const r of rows) console.log(view.line(r));
}

if (import.meta.main) {
	const [command, ...rest] = process.argv.slice(2);
	if (command === "timeline") { const { openTimeline } = await import("../timeline.ts"); console.log(await openTimeline(rest[0])); process.exit(0); }
	if (command !== "tree") fail("usage: ab tree [ui|sidebar|open|send] ... | ab timeline [SESSION]");
	await tree(rest);
}
