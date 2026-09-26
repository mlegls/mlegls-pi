import { parseArgs } from "node:util";
import { recall } from "../lib/memory.ts";

export function memory(args: string[]) {
	const [verb, ...rest] = args;
	if (verb !== "recall") throw new Error("usage: ab memory recall ID... [--offset N] [--limit N] [--session FILE --leaf ID]");
	const { values, positionals: ids } = parseArgs({ args: rest, allowPositionals: true, options: {
		offset: { type: "string" }, limit: { type: "string" }, session: { type: "string" }, leaf: { type: "string" },
	} });
	console.log(recall({ ids, offset: values.offset === undefined ? undefined : Number(values.offset),
		limit: values.limit === undefined ? undefined : Number(values.limit), sessionFile: values.session, leafId: values.leaf }));
}
