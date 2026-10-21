// Thread share backend: finds a pi thread's session file through bb's thread/identity event, exports it with
// pi --export, and publishes it to ht-ml.app. The update key and any password stay here, in plugin kv.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { compress, create, exportSession, MAX_BODY, newPassword, pi, scanSecrets, UNPUBLISHED, update, type Site } from "./share";

const threadId = z.string().regex(/^[A-Za-z0-9_-]+$/);
const stateSchema = z.object({
	pi: z.boolean(),
	url: z.string().nullable(),
	private: z.boolean(),
	publishedAt: z.number().nullable(),
});
export type ShareState = z.infer<typeof stateSchema>;

export const rpcContract = defineRpcContract({
	states: { input: z.object({ threadIds: z.array(threadId).min(1).max(200) }), output: z.object({ states: z.record(z.string(), stateSchema) }) },
	inspect: { input: z.object({ threadId }), output: z.object({ bytes: z.number(), tooLarge: z.boolean(), imagesOmitted: z.boolean(), secrets: z.array(z.object({ kind: z.string(), count: z.number() })) }) },
	publish: {
		input: z.object({ threadId, mode: z.enum(["public", "private", "republish", "lock"]) }),
		output: z.object({ state: stateSchema, password: z.string().nullable() }),
	},
	password: { input: z.object({ threadId }), output: z.object({ password: z.string().nullable() }) },
	unpublish: { input: z.object({ threadId }), output: z.object({ state: stateSchema }) },
});

interface Share extends Site { password: string | null; publishedAt: number }

export default async function plugin(bb: BbPluginApi) {
	const settings = bb.settings.define({
		pi: { type: "string", label: "pi", description: "Path to the pi binary; empty finds it through your login shell.", default: "" },
	});
	const key = (id: string) => "share:" + id;
	const providers = new Map<string, string | null>();

	async function provider(id: string): Promise<string | null> {
		if (providers.has(id)) return providers.get(id)!;
		let p: string | null = null;
		try { p = ((await bb.sdk.threads.get({ threadId: id })) as { providerId?: string }).providerId ?? null; } catch {}
		providers.set(id, p);
		return p;
	}

	async function state(id: string): Promise<ShareState> {
		const s = await bb.storage.kv.get<Share>(key(id));
		return { pi: (await provider(id)) === "pi", url: s?.url ?? null, private: !!s?.password, publishedAt: s?.publishedAt ?? null };
	}

	/**
	 * The page to upload: pi's export with its session payload gzipped, and its images left out when that alone is
	 * still over ht-ml.app's limit. tooLarge when even that is.
	 */
	function page(raw: string): { html: string; bytes: number; tooLarge: boolean; imagesOmitted: boolean } {
		const size = (html: string) => Buffer.byteLength(JSON.stringify({ html_content: html, password: "x".repeat(16) }));
		const html = compress(raw) ?? raw;
		if (size(html) <= MAX_BODY) return { html, bytes: size(html), tooLarge: false, imagesOmitted: false };
		const lean = compress(raw, { images: false });
		if (!lean) return { html, bytes: size(html), tooLarge: true, imagesOmitted: false };
		return { html: lean, bytes: size(lean), tooLarge: size(lean) > MAX_BODY, imagesOmitted: true };
	}

	async function exportThread(id: string): Promise<string> {
		const thread = (await bb.sdk.threads.get({ threadId: id })) as { providerId?: string; title?: string | null; titleFallback?: string | null };
		if (thread.providerId !== "pi") throw new Error("Only pi threads can be published; this one runs " + (thread.providerId ?? "an unknown provider"));
		const rows = (await bb.sdk.threads.events.list({ threadId: id, types: ["thread/identity"], order: "desc", limit: "1" })) as { data: { providerThreadId?: string } }[];
		const session = rows[0]?.data.providerThreadId;
		if (!session || !/^[A-Za-z0-9._-]+$/.test(session)) throw new Error("This thread has no pi session yet");
		const file = join(bb.server.experimental_dataDir, "pi-bridge-sessions", session + ".jsonl");
		if (!existsSync(file)) throw new Error("No pi session file at " + file);
		const s = await settings.get();
		return exportSession(pi(String(s.pi ?? "")), file, thread.title || thread.titleFallback || "pi thread");
	}

	bb.rpc.register(rpcContract, {
		async states({ threadIds }) {
			const entries = await Promise.all(threadIds.map(async (id) => [id, await state(id)] as const));
			return { states: Object.fromEntries(entries) };
		},
		async inspect({ threadId: id }) {
			const raw = await exportThread(id);
			const { bytes, tooLarge, imagesOmitted } = page(raw);
			return { bytes, tooLarge, imagesOmitted, secrets: scanSecrets(raw) };
		},
		async publish({ threadId: id, mode }) {
			const { html, bytes, tooLarge } = page(await exportThread(id));
			if (tooLarge) throw new Error("The export is " + (bytes / 1048576).toFixed(1) + " MB; ht-ml.app takes at most 6 MB");
			const prior = await bb.storage.kv.get<Share>(key(id));
			let share: Share;
			let password: string | null = null;
			if (mode === "public" || mode === "private") {
				if (prior) throw new Error("Already published at " + prior.url + "; republish or unpublish it");
				password = mode === "private" ? newPassword() : null;
				share = { ...(await create(html, password ?? undefined)), password, publishedAt: Date.now() };
			} else {
				if (!prior) throw new Error("Not published yet");
				// Lock sets a new password; a plain republish leaves ht-ml.app's password (or its absence) alone.
				password = mode === "lock" ? newPassword() : null;
				await update(prior, html, password ?? undefined);
				share = { ...prior, password: password ?? prior.password, publishedAt: Date.now() };
			}
			await bb.storage.kv.set(key(id), share);
			bb.log.info("published " + id + " (" + mode + (share.password ? ", private" : ", public") + "): " + share.url);
			return { state: await state(id), password };
		},
		async password({ threadId: id }) {
			return { password: (await bb.storage.kv.get<Share>(key(id)))?.password ?? null };
		},
		async unpublish({ threadId: id }) {
			const prior = await bb.storage.kv.get<Share>(key(id));
			if (prior) {
				// ht-ml.app has no delete: replace the page with a placeholder behind a password nobody keeps.
				await update(prior, UNPUBLISHED, newPassword());
				await bb.storage.kv.set("retired:" + prior.siteId, { ...prior, password: null, threadId: id, unpublishedAt: Date.now() });
				await bb.storage.kv.delete(key(id));
				bb.log.info("unpublished " + id + ": " + prior.url);
			}
			return { state: await state(id) };
		},
	});
}
