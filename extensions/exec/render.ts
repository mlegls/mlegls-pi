import { stripVTControlCharacters } from "node:util";
import { highlightCode, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Container, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { KernelTrace } from "./kernel";

type Details = { trace?: KernelTrace; error?: string; diagnostics?: string };
type RowState = { execSummary?: string };
type Renderer = ToolDefinition<any, Details, RowState>;

// Treat all kernel previews and explicit output as text, never terminal commands.
function plain(value: string): string {
	return stripVTControlCharacters(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "").replace(/\t/g, "    ");
}

class SafeText extends Text {
	render(width: number): string[] {
		if (width < 1) return [];
		return super.render(width).map((line) => truncateToWidth(line, width, ""));
	}
}

export const renderCall: NonNullable<Renderer["renderCall"]> = (_args, theme, context) => ({
	invalidate() {},
	render(width) {
		if (width < 1) return [];
		// The host invokes the call hook before the result hook. Read shared state
		// at component render time so the header uses this update's trace.
		const summary = context.state.execSummary ?? (context.executionStarted ? "… running" : context.argsComplete ? "queued" : "receiving code…");
		return [truncateToWidth(theme.fg("toolTitle", theme.bold("exec")) + " " + summary, width, "…")];
	},
});

export const renderResult: NonNullable<Renderer["renderResult"]> = (result, { expanded, isPartial }, theme, context) => {
	const details = result.details;
	const trace = details?.trace;
	const entries = Array.isArray(trace?.entries) ? trace.entries : [];
	const counts = new Map<string, number>();
	for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
	const operations = [...counts].map(([name, count]) => plain(name).replace(/\n/g, " ") + (count > 1 ? " ×" + count : ""));
	const failed = entries.filter((entry) => entry.state === "error" || entry.state === "interrupted").length;
	const pending = entries.filter((entry) => entry.state === "pending").length;
	const error = context.isError || Boolean(details?.error);
	const status = isPartial ? theme.fg("warning", "…") : error ? theme.fg("error", "✗") : theme.fg("success", "✓");
	const images = result.content.filter((block) => block.type === "image").length;
	const hasOutput = result.content.some((block) => block.type === "text" && block.text !== "(no output)" && block.text !== details?.error) || images > 0;
	if (!operations.length) operations.push(trace ? (hasOutput ? "output" : isPartial ? "running" : "no operations") : "trace unavailable");
	if (trace?.omitted) operations.push("+" + trace.omitted + " omitted");
	if (failed) operations.push(failed + " failed");
	if (pending) operations.push(pending + " pending" + (trace?.finished ? " at cell end" : ""));
	if (images) operations.push(images + (images === 1 ? " image" : " images"));
	context.state.execSummary = status + " " + operations.join(" · ");

	const container = new Container();
	if (!expanded) {
		container.addChild({
			invalidate() {},
			render(width: number) {
				if (width < 1) return [];
				const lines: string[] = [];
				const line = (text: string) => lines.push(truncateToWidth(plain(text), width, "…"));
				const preview = (text: string) => {
					const rows = plain(text).trimEnd().split("\n");
					for (const row of rows.slice(0, 2)) line("  " + row);
					if (rows.length > 3) line("  … " + (rows.length - 3) + " more preview lines");
				};
				for (const entry of entries.slice(0, 8)) {
					const state = entry.state === "ok" ? "✓" : entry.state === "pending" ? "…" : "✗";
					line(state + " " + entry.name + "  " + (entry.args ?? "").replace(/\s+/g, " "));
					if (entry.error || entry.result) preview(entry.error || entry.result!);
				}
				if (entries.length > 8 || trace?.omitted) line("… " + (Math.max(0, entries.length - 8) + (trace?.omitted ?? 0)) + " more operations; expand");
				if (details?.error) preview(details.error);
				if (!entries.length) for (const block of result.content) {
					if (block.type === "text" && block.text !== "(no output)") { preview(block.text); break; }
				}
				return lines;
			},
		});
		return container;
	}
	const add = (text: string) => container.addChild(new SafeText(text, 0, 0));
	const heading = (text: string) => add(theme.fg("muted", text));
	if (entries.length) {
		heading("Operations (automatic trace)");
		for (const entry of entries) {
			const state = entry.state === "pending" && trace?.finished ? "pending at cell end" : entry.state;
			const duration = entry.durationMs === undefined ? "" : " · " + Math.round(entry.durationMs) + "ms";
			add(theme.fg(entry.state === "error" || entry.state === "interrupted" ? "error" : "accent", plain(entry.id + ". " + entry.name + " · " + state + duration)));
			if (entry.args) add("args: " + plain(entry.args));
			if (entry.result !== undefined) add("result: " + plain(entry.result));
			if (entry.error) add(theme.fg("error", plain(entry.error)));
		}
	} else {
		heading(trace ? "No traced operations" : "Operation trace unavailable (saved result)");
	}
	if (trace?.truncated || trace?.omitted) heading("Trace previews bounded" + (trace.omitted ? "; " + trace.omitted + " operations omitted" : ""));

	if (details?.error) {
		heading("Cell error");
		add(theme.fg("error", plain(details.error)));
	}
	if (details?.diagnostics) {
		heading("Process / interrupted-shell diagnostics (UI only; use show for model output)");
		add(plain(details.diagnostics));
	}
	heading(trace ? "Output (show / console.log)" : "Output");
	for (const block of result.content) {
		if (block.type === "text" && block.text !== details?.error) add(plain(block.text));
		// ToolExecutionComponent appends native images independently of these hooks.
		if (block.type === "image") heading("[image: " + plain(block.mimeType) + "; native preview below when enabled]");
	}
	const code = (context.args as { code?: unknown } | undefined)?.code;
	if (typeof code === "string" && code) {
		heading("Source TypeScript");
		add(highlightCode(plain(code), "typescript").join("\n"));
	}
	return container;
};
