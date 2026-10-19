// Pieces both pages share: the Discuss dialog (a new thread with issues or campaign elements mentioned), the project in
// view, and the empty state.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { experimental_NewThreadComposer as NewThreadComposer, experimental_usePluginId, useBbNavigate, useRpc, useSdk } from "@get-bb/plugin-sdk/app";
import type { rpcContract, TrackerProject } from "./server";
import { MENTION_PROVIDER, title } from "./model";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";

/** Something a Discuss thread mentions: an issue, or a department, campaign or promise from the Campaigns page. */
export interface Target { provider: string; id: string; label: string }
export const issueTarget = (slug: string): Target => ({ provider: MENTION_PROVIDER, id: slug, label: slug });

export function DiscussDialog({ projectId, targets, heading, description, onOpenChange, onRemove }: { projectId: string; targets: Target[]; heading?: string; description?: string; onOpenChange: (open: boolean) => void; onRemove?: (id: string) => void }) {
	const sdk = useSdk();
	const navigate = useBbNavigate();
	const pluginId = experimental_usePluginId();
	const [focus, setFocus] = useState(1);
	useEffect(() => { const t = setTimeout(() => setFocus((n) => n + 1), 50); return () => clearTimeout(t); }, []);
	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{heading ?? "Discuss " + (targets.length === 1 ? title(targets[0].label) : targets.length + " issues")}</DialogTitle>
					<DialogDescription>{description ?? "A new thread with " + (targets.length === 1 ? "this issue" : "these issues") + " mentioned; the agent receives each one's contract, state and subtree."}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-wrap gap-1.5">
					{targets.map((t) => (
						<span key={t.provider + t.id} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs">
							{t.provider === MENTION_PROVIDER ? "#" : "!"}{t.label}
							{targets.length > 1 && onRemove ? <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onRemove(t.id)} aria-label={"Remove " + t.label}><Icon name="X" className="size-3" /></button> : null}
						</span>
					))}
				</div>
				<div>
					<NewThreadComposer
						layout="document"
						defaultProjectId={projectId}
						focusRequest={focus}
						draftKey={"discuss:" + projectId}
						placeholder="What do you want to work out?"
						onSubmit={async (request) => {
							const input = withMentions(request.input, targets, projectId, pluginId);
							const issues = targets.filter((t) => t.provider === MENTION_PROVIDER).map((t) => t.id);
							const campaigns = targets.filter((t) => t.provider !== MENTION_PROVIDER).map((t) => t.id);
							const created = await sdk.threads.spawn({ ...request, input, pluginMetadata: { role: "discuss", issues, campaigns } });
							onOpenChange(false);
							navigate.toThread(created.id);
						}}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

type PromptInput = { type: string; text?: string; mentions?: { start: number; end: number; resource: unknown }[] };
/** Prefix the first text input with one plugin mention pill per target, serialized as the composer serializes them. */
function withMentions<T>(input: T[], targets: Target[], projectId: string, pluginId: string): T[] {
	let text = "";
	const mentions: { start: number; end: number; resource: unknown }[] = [];
	for (const t of targets) {
		const start = text.length;
		text += "@" + t.label;
		mentions.push({ start, end: text.length, resource: { kind: "plugin", pluginId, icon: null, itemId: t.provider + ":" + projectId + "/" + t.id, label: t.label } });
		text += " ";
	}
	text += "\n\n";
	const items = input as unknown as PromptInput[];
	const at = items.findIndex((i) => i.type === "text");
	if (at < 0) return [{ type: "text", text: text.trimEnd(), mentions } as unknown as T, ...input];
	const first = items[at];
	const shifted = { ...first, text: text + (first.text ?? ""), mentions: [...mentions, ...(first.mentions ?? []).map((m) => ({ ...m, start: m.start + text.length, end: m.end + text.length }))] };
	return items.map((x, n) => (n === at ? shifted : x)) as unknown as T[];
}

/** The tracked projects and the one in view: the route's, else the last one viewed on either page. */
export function useProject(routeProjectId: string | null) {
	const rpc = useRpc<typeof rpcContract>();
	const pluginId = experimental_usePluginId();
	const [projects, setProjects] = useState<TrackerProject[] | null>(null);
	const lastKey = pluginId + ":last-project";
	useEffect(() => { rpc.call("projects").then((r) => setProjects(r.projects), () => setProjects([])); }, [rpc]);
	const projectId = routeProjectId ?? (projects ? (projects.find((p) => p.id === localStorage.getItem(lastKey)) ?? projects[0])?.id ?? null : null);
	useEffect(() => { if (projectId) localStorage.setItem(lastKey, projectId); }, [projectId, lastKey]);
	return { projects, projectId };
}

export function Empty({ children }: { children: ReactNode }) {
	return <div role="status" className="m-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</div>;
}
