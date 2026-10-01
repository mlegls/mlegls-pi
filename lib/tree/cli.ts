// ab tree: session views over lib/tree, every pi session with its parent, project and live state.
//   ab tree [-m tree|projects|status] [-a] [--json] [--days N] [--hours N] [QUERY]
//   ab tree ui [--sidebar] [QUERY]   dashboard (tmux popup) or sidebar (Ghostty split)
//   ab tree sidebar                  open the sidebar split
//   ab tree open|park ID | send ID [TEXT]
//   ab timeline [SESSION]   HTML timeline of a session tree (default this session), opened in the browser
import { parseArgs } from "node:util";

const fail = (message: string): never => { console.error(message); process.exit(1); };

export async function tree(args: string[]) {
	if (args[0] === "sidebar") return (await import("./ghostty.ts")).openSidebar();
	if (args[0] === "ui") return (await import("./ui.ts")).ui({ sidebar: args.includes("--sidebar"), query: args.slice(1).filter(a => a !== "--sidebar").join(" ") });
	if (args[0] === "open" || args[0] === "park" || args[0] === "send") {
		const { graph } = await import("./graph.ts");
		const act = await import("./actions.ts");
		const node = [...(await graph()).values()].find(n => n.id === args[1] || n.id.startsWith(args[1] ?? "\0"));
		if (!node) return fail("no session " + args[1]);
		const text = args[0] === "send" ? (args.slice(2).join(" ") || await Bun.stdin.text()) : "";
		const message = args[0] === "open" ? act.open(node) : args[0] === "park" ? act.park(node) : act.send(node, text);
		if (message) fail(message);
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
	if (command !== "tree") fail("usage: ab tree [ui|sidebar|open|park|send] ... | ab timeline [SESSION]");
	await tree(rest);
}
