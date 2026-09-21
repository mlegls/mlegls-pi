// board: CLI over the shared log. not the PATH `board` binary.
//
//   bun lib/board.ts cursor
//   bun lib/board.ts send <topic> [--tag t]... [--body b] [--data json]
//   bun lib/board.ts read [--topic glob] [--tags expr] [--limit n] [--fields full|meta] [--body-chars n]
//   bun lib/board.ts list [--topic glob]
//   bun lib/board.ts wait --topic glob [--tags expr] --from-offset n [--timeout ms]
//
// Snapshot cursor before spawn; wait requires --from-offset.

import { basename } from "node:path";
import { logSize, meta, read, send, topics, waitFor } from "./board/store";

export { logSize, meta, read, readFrom, send, topics, waitFor } from "./board/store";
export type { Message, Meta, Numbered, ReadOptions, TopicSummary } from "./board/store";

if (import.meta.main) {
	const [cmd, ...rest] = process.argv.slice(2);
	const flags = (name: string) => {
		const out: string[] = [];
		for (let i = 0; i < rest.length; i++) if (rest[i] === `--${name}` && rest[i + 1] !== undefined) out.push(rest[++i]!);
		return out;
	};
	const opt = (name: string) => flags(name)[0];
	const nat = (name: string, raw: string | undefined): number | undefined => {
		if (raw === undefined) return undefined;
		if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error(`--${name} must be a nonnegative integer`);
		return Number(raw);
	};
	const pos = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));
	const need = (v: string | undefined, n: string) => {
		if (!v) throw new Error(`${n} required`);
		return v;
	};
	const print = (v: unknown) => console.log(JSON.stringify(v, null, 2));
	const from = { name: process.env.PI_BOARD_NAME ?? basename(process.cwd()), cwd: process.cwd() };
	switch (cmd) {
		case "cursor":
			print({ offset: logSize() });
			break;
		case "send": {
			const data = opt("data");
			print(send({
				topic: need(pos[0], "topic"),
				body: opt("body") ?? "",
				tags: flags("tag"),
				data: data !== undefined ? JSON.parse(data) : undefined,
				from,
			}));
			break;
		}
		case "read": {
			const fields = opt("fields") ?? "full";
			if (fields !== "full" && fields !== "meta") throw new Error("fields must be full or meta");
			const bodyChars = nat("body-chars", opt("body-chars"));
			const { messages, omitted, total } = read({
				topic: opt("topic"),
				tags: opt("tags"),
				limit: nat("limit", opt("limit")),
			});
			print({
				messages: fields === "meta" ? messages.map((m) => meta(m, bodyChars ?? 120)) : messages,
				omitted,
				total,
			});
			break;
		}
		case "list":
			print({ topics: topics(opt("topic")) });
			break;
		case "wait": {
			const fromOffset = nat("from-offset", opt("from-offset"));
			if (fromOffset === undefined) throw new Error("--from-offset required (bun lib/board.ts cursor before spawn)");
			const hit = await waitFor(
				{ topic: need(opt("topic"), "topic"), tags: opt("tags") },
				{ fromOffset, timeoutMs: nat("timeout", opt("timeout")) },
			);
			if (!hit) process.exit(1);
			print(hit);
			break;
		}
		default:
			console.error("usage: bun lib/board.ts cursor\n       bun lib/board.ts send <topic> [--tag t]... [--body b] [--data json]\n       bun lib/board.ts read [--topic glob] [--tags expr] [--limit n] [--fields full|meta] [--body-chars n]\n       bun lib/board.ts list [--topic glob]\n       bun lib/board.ts wait --topic glob [--tags expr] --from-offset n [--timeout ms]");
			process.exit(2);
	}
}
