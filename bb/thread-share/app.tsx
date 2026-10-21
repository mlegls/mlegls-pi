// Thread share frontend: one entry in every pi thread's actions menu. Unpublished: publish publicly or behind a
// password. Published: copy or open the link, copy the password, republish the current transcript, add a password,
// or unpublish.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { definePluginApp, experimental_copyToClipboard, experimental_THREAD_ACTION_GROUPS, useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract, ShareState } from "./server";

type Rpc = ReturnType<typeof useRpc<typeof rpcContract>>;
interface Data { states: ReadonlyMap<string, ShareState>; set(id: string, s: ShareState): void; rpc: Rpc }

function useShareStates({ threadIds }: { threadIds: readonly string[] }): Data {
	const rpc = useRpc<typeof rpcContract>();
	const [states, setStates] = useState<ReadonlyMap<string, ShareState>>(new Map());
	const asked = useRef(new Set<string>());
	useEffect(() => {
		const missing = threadIds.filter((id) => !asked.current.has(id));
		if (!missing.length) return;
		for (const id of missing) asked.current.add(id);
		for (let at = 0; at < missing.length; at += 200) {
			const batch = missing.slice(at, at + 200);
			rpc.call("states", { threadIds: batch }).then(
				(r) => setStates((prev) => { const next = new Map(prev); for (const [id, s] of Object.entries(r.states)) next.set(id, s); return next; }),
				() => { for (const id of batch) asked.current.delete(id); },
			);
		}
	}, [threadIds, rpc]);
	const set = useCallback((id: string, s: ShareState) => setStates((prev) => new Map(prev).set(id, s)), []);
	return useMemo(() => ({ states, set, rpc }), [states, set, rpc]);
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const kb = (n: number) => (n >= 1 << 20 ? (n / (1 << 20)).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

async function copy(text: string, what: string) {
	if (await experimental_copyToClipboard({ text })) toast.success("Copied " + what);
	else toast.error("Couldn't copy " + what + ": " + text);
}

async function publish(data: Data, threadId: string, mode: "public" | "private" | "republish" | "lock") {
	const working = toast.loading(mode === "lock" ? "Adding a password…" : "Exporting the transcript…");
	try {
		const { bytes, tooLarge, imagesOmitted, secrets } = await data.rpc.call("inspect", { threadId });
		toast.dismiss(working);
		if (tooLarge) { toast.error("Too large to publish", { description: "The compressed export is " + kb(bytes) + "; ht-ml.app takes at most 6 MB." }); return; }
		const audience = mode === "public" ? "PUBLIC: anyone with the link can read it, and ht-ml.app can't delete it later."
			: mode === "private" ? "behind a generated password."
			: mode === "lock" ? "with a new password. Copies cached while it was public may stay readable for a few minutes."
			: "in place, at the same link and with the same access.";
		const found = secrets.length
			? "\n\nIt contains text that looks like credentials: " + secrets.map((s) => s.count + " × " + s.kind).join(", ") + "."
			: "";
		const ok = window.confirm(
			"Upload this thread's full transcript (" + kb(bytes) + ") to ht-ml.app " + audience
			+ "\n\nIt includes every prompt, tool call, command output and file content in the session."
			+ (imagesOmitted ? " Its images are left out: with them it would exceed ht-ml.app's 6 MB limit." : "") + found,
		);
		if (!ok) return;
		const busy = toast.loading("Publishing…");
		try {
			const r = await data.rpc.call("publish", { threadId, mode });
			data.set(threadId, r.state);
			toast.dismiss(busy);
			if (r.state.url) await experimental_copyToClipboard({ text: r.password ? r.state.url + "\npassword: " + r.password : r.state.url });
			toast.success(mode === "republish" ? "Republished" : "Published", {
				description: (r.state.url ?? "") + (r.password ? "\npassword: " + r.password : "") + "\nCopied to the clipboard.",
				duration: 15_000,
			});
		} catch (e) { toast.dismiss(busy); throw e; }
	} catch (e) { toast.dismiss(working); toast.error("Publish failed", { description: message(e) }); }
}

async function unpublish(data: Data, threadId: string) {
	if (!window.confirm("Unpublish this thread? ht-ml.app has no delete, so the page is replaced with a placeholder behind a password nobody keeps; the link stays dead.")) return;
	try {
		const r = await data.rpc.call("unpublish", { threadId });
		data.set(threadId, r.state);
		toast.success("Unpublished");
	} catch (e) { toast.error("Unpublish failed", { description: message(e) }); }
}

export default definePluginApp((app) => {
	app.slots.experimental_threadAction<Data>({
		id: "publish",
		title: "Publish to ht-ml.app",
		icon: "Globe",
		group: experimental_THREAD_ACTION_GROUPS.open,
		order: 90,
		useData: useShareStates,
		item: ({ thread, data }) => {
			const s = data.states.get(thread.id);
			if (!s?.pi) return null;
			if (!s.url) return {
				label: "Publish to ht-ml.app",
				icon: "Globe",
				choices: {
					heading: "Publish transcript",
					hint: "Uploads pi's HTML export of the whole session.",
					items: [
						{ id: "public", label: "Public link", icon: "Globe" },
						{ id: "private", label: "With a password", icon: "Lock" },
					],
				},
				run: ({ value }) => publish(data, thread.id, value === "private" ? "private" : "public"),
			};
			const url = s.url;
			return {
				label: "Published",
				detail: (s.private ? "Password · " : "Public · ") + new Date(s.publishedAt ?? 0).toLocaleString(),
				icon: "Globe",
				choices: {
					heading: url.replace(/^https?:\/\//, ""),
					items: [
						{ id: "copy", label: "Copy link", icon: "Copy" },
						...(s.private ? [{ id: "password", label: "Copy password", icon: "Lock" }] : []),
						{ id: "open", label: "Open page", icon: "ExternalLink" },
						{ id: "republish", label: "Republish current transcript", icon: "Globe" },
						...(s.private ? [] : [{ id: "lock", label: "Add a password", icon: "Lock" }]),
						{ id: "unpublish", label: "Unpublish", icon: "Trash2" },
					],
				},
				run: async ({ value }) => {
					if (value === "copy") return copy(url, "link");
					if (value === "open") { window.open(url, "_blank", "noopener"); return; }
					if (value === "password") {
						const { password } = await data.rpc.call("password", { threadId: thread.id });
						return password ? copy(password, "password") : void toast.error("No password stored for this page");
					}
					if (value === "republish" || value === "lock") return publish(data, thread.id, value);
					if (value === "unpublish") return unpublish(data, thread.id);
				},
			};
		},
	});
});
