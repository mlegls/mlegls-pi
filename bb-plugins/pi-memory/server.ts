// Pi Memory: read-only views of mlegls-pi's records store, for people. Notes logs
// (extensions/context/notes.ts) and lives (extensions/context/life) are both append-only logs
// compressed into power-of-two blocks; the page shows what an agent wakes to and opens blocks
// down to their notes or messages.
//
// The store's code is bun-only (bun:sqlite) and lives in the mlegls-pi checkout, so each call
// runs ./read.ts there with bun and returns its JSON.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const exec = promisify(execFile);

const line = z.object({ lo: z.number(), hi: z.number(), text: z.string(), ts: z.string().optional(), summarized: z.boolean() });
export type NoteLine = z.infer<typeof line>;
const node = z.object({ first: z.number(), n: z.number(), text: z.string(), built: z.boolean(), date: z.string().optional(), stub: z.boolean() });
export type LifeLine = z.infer<typeof node>;
const message = z.object({ pos: z.number(), kind: z.string(), text: z.string(), date: z.string(), model: z.string(), place: z.string(), source: z.string() });
export type LifeMessage = z.infer<typeof message>;

export const rpcContract = defineRpcContract({
	index: {
		input: z.null(),
		output: z.object({
			notes: z.array(z.object({ log: z.string(), label: z.string(), count: z.number(), last: z.string() })),
			lives: z.array(z.object({ id: z.string(), label: z.string(), messages: z.number(), last: z.string() })),
		}),
	},
	notes: {
		input: z.object({ log: z.string() }),
		output: z.object({ log: z.string(), label: z.string(), count: z.number(), budget: z.number(), wake: z.array(line), notes: z.array(line) }),
	},
	notesZoom: {
		input: z.object({ log: z.string(), lo: z.number().int(), hi: z.number().int() }),
		output: z.object({ block: z.string(), lines: z.array(line) }),
	},
	life: {
		input: z.object({ id: z.string() }),
		output: z.object({
			id: z.string(), T: z.number(), b: z.number(), savedUpTo: z.number(), view: z.array(node),
			places: z.array(z.object({ session: z.string(), thread: z.string().optional(), time: z.string(), ended: z.boolean(), hold: z.string() })),
		}),
	},
	lifeZoom: {
		input: z.object({ id: z.string(), first: z.number().int(), n: z.number().int() }),
		output: z.object({ lines: z.array(node).optional(), message: message.optional() }),
	},
});

const here = dirname(fileURLToPath(import.meta.url));

export default async function plugin(bb: BbPluginApi) {
	const settings = bb.settings.define({
		checkout: { type: "string", label: "mlegls-pi checkout (empty: this plugin's own, else ~/dev/mlegls-pi)", default: "" },
		bun: { type: "string", label: "bun executable (empty: search PATH and the usual installs)", default: "" },
		store: { type: "string", label: "Records store directory, as PI_BOARD_DIR (empty: the default)", default: "" },
	});
	const s = await settings.get();
	const script = [s.checkout && join(s.checkout, "bb-plugins/pi-memory/read.ts"), join(here, "read.ts"), join(here, "../read.ts"), join(homedir(), "dev/mlegls-pi/bb-plugins/pi-memory/read.ts")]
		.find((p) => p && existsSync(p) && existsSync(join(dirname(p), "../../lib/records/store.ts")));
	const bun = s.bun || [join(homedir(), ".local/share/mise/shims/bun"), join(homedir(), ".bun/bin/bun")].find(existsSync) || "bun";

	async function read(...args: string[]): Promise<any> {
		if (!script) throw new Error("No mlegls-pi checkout with bb-plugins/pi-memory/read.ts; set the checkout setting.");
		const env = { ...process.env, ...(s.store ? { PI_BOARD_DIR: s.store } : {}) };
		try {
			const { stdout } = await exec(bun, [script, ...args], { cwd: dirname(script), env, maxBuffer: 64 << 20, timeout: 60_000 });
			return JSON.parse(stdout);
		} catch (error: any) {
			throw new Error((error.stderr?.trim().split("\n").at(-1)) || error.message);
		}
	}

	bb.rpc.register(rpcContract, {
		index: () => read("index"),
		notes: ({ log }) => read("notes", log),
		notesZoom: ({ log, lo, hi }) => read("notes-zoom", log, lo + "-" + (hi - 1)),
		life: ({ id }) => read("life", id),
		lifeZoom: ({ id, first, n }) => read("life-zoom", id, String(first), String(n)),
	});
	bb.log.info("loaded: " + JSON.stringify({ script, bun }));
}
