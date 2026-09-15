import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { pipe, PipeParam } from "../../lib/pipe";

const DEFAULT_API_URL = "https://api.exa.ai";

interface ExaResult {
	id?: string;
	title?: string;
	url?: string;
	publishedDate?: string;
	author?: string | null;
	text?: string;
	highlights?: string[];
	summary?: string;
}

interface ExaStatus {
	id: string;
	status: "success" | "error";
	source?: "cached" | "crawled";
	error?: { tag?: string; httpStatusCode?: number | null } | null;
}

interface ExaResponse {
	requestId?: string;
	results?: ExaResult[];
	statuses?: ExaStatus[];
	costDollars?: { total?: number };
}

interface ToolDetails {
	requestId?: string;
	resultCount: number;
	costDollars?: number;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

async function exaRequest(path: "/search" | "/contents", body: Record<string, unknown>, signal?: AbortSignal): Promise<ExaResponse> {
	const apiKey = process.env.EXA_API_KEY;
	if (!apiKey) {
		throw new Error("EXA_API_KEY is not set. Create a key at https://dashboard.exa.ai/api-keys.");
	}

	const baseUrl = (process.env.EXA_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
	const response = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": apiKey,
		},
		body: JSON.stringify(body),
		signal,
	});
	const raw = await response.text();
	let payload: Record<string, unknown> = {};
	try {
		payload = raw ? JSON.parse(raw) as Record<string, unknown> : {};
	} catch {
		// Preserve the response text in the diagnostic below.
	}
	if (!response.ok) {
		const message = typeof payload.error === "string" ? payload.error : raw || response.statusText;
		throw new Error(`Exa ${path.slice(1)} failed (${response.status}): ${message}`);
	}
	return payload as ExaResponse;
}

function truncateOutput(text: string): string {
	const result = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
	if (!result.truncated) return text;
	return `${result.content}\n\n[Output truncated: ${result.outputLines} of ${result.totalLines} lines (${formatSize(result.outputBytes)} of ${formatSize(result.totalBytes)})]`;
}

function formatResult(result: ExaResult, index: number): string {
	const lines = [`## ${index + 1}. ${result.title || result.url || result.id || "Untitled"}`];
	if (result.url) lines.push(`URL: ${result.url}`);
	if (result.publishedDate) lines.push(`Published: ${result.publishedDate}`);
	if (result.author) lines.push(`Author: ${result.author}`);
	if (result.highlights?.length) lines.push("", ...result.highlights.map((highlight) => `> ${highlight.replace(/\n/g, "\n> ")}`));
	if (result.summary) lines.push("", result.summary);
	if (result.text) lines.push("", result.text);
	return lines.join("\n");
}

/** `seen`: URLs already rendered in this call; a repeat is listed by title only. */
function formatResponse(title: string, response: ExaResponse, seen?: Set<string>): string {
	const results = response.results ?? [];
	const sections = [`# ${title}`, `Results: ${results.length}`];
	const fresh = results.filter((r) => !r.url || !seen?.has(r.url));
	const repeats = results.filter((r) => r.url && seen?.has(r.url));
	for (const r of fresh) if (r.url) seen?.add(r.url);
	if (fresh.length) sections.push("", fresh.map(formatResult).join("\n\n"));
	if (repeats.length) sections.push("", `Also (shown above): ${repeats.map((r) => r.title || r.url).join("; ")}`);
	const failures = (response.statuses ?? []).filter((status) => status.status === "error");
	if (failures.length) {
		sections.push("", "## Failed URLs", ...failures.map((failure) => {
			const detail = failure.error?.tag ?? failure.error?.httpStatusCode;
			return `- ${failure.id}${detail ? `: ${detail}` : ""}`;
		}));
	}
	if (response.costDollars?.total !== undefined) sections.push("", `Cost: $${response.costDollars.total}`);
	return sections.join("\n");
}

function details(response: ExaResponse): ToolDetails {
	return {
		requestId: response.requestId,
		resultCount: response.results?.length ?? 0,
		costDollars: response.costDollars?.total,
	};
}

const SearchParameters = Type.Object({
	query: Type.Union([Type.String(), Type.Array(Type.String(), { minItems: 1, maxItems: 20 })], {
		description: "Natural-language web search query, or several to run in parallel (one section each; a URL already shown under an earlier query is only named again).",
	}),
	numResults: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: "Number of results. Defaults to 10." })),
	type: Type.Optional(StringEnum(["instant", "fast", "auto", "deep-lite", "deep", "deep-reasoning"] as const, {
		description: "Search mode. Defaults to auto.",
	})),
	category: Type.Optional(StringEnum(["company", "publication", "news", "personal site", "financial report", "people"] as const)),
	includeDomains: Type.Optional(Type.Array(Type.String(), { maxItems: 1200, description: "Only include these domains or domain paths." })),
	excludeDomains: Type.Optional(Type.Array(Type.String(), { maxItems: 1200, description: "Exclude these domains or domain paths." })),
	startPublishedDate: Type.Optional(Type.String({ description: "Only include pages published after this ISO 8601 date." })),
	endPublishedDate: Type.Optional(Type.String({ description: "Only include pages published before this ISO 8601 date." })),
	content: Type.Optional(StringEnum(["highlights", "text", "none"] as const, {
		description: "Content returned with each result. Defaults to token-efficient highlights.",
	})),
	maxCharacters: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000, description: "Maximum content characters per result." })),
	maxAgeHours: Type.Optional(Type.Integer({ minimum: -1, maximum: 720, description: "Maximum cache age. Use 0 for a fresh crawl or -1 for cache only." })),
	pipe: PipeParam,
});

const PageSections = ["header", "navigation", "banner", "body", "sidebar", "footer", "metadata"] as const;
const ContentsParameters = Type.Object({
	urls: Type.Array(Type.String(), { minItems: 1, maxItems: 100, description: "URLs to retrieve." }),
	maxCharacters: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000, description: "Maximum text characters per URL. Defaults to 10000." })),
	verbosity: Type.Optional(StringEnum(["compact", "standard", "full"] as const, {
		description: "Text rendering detail. Defaults to compact.",
	})),
	includeSections: Type.Optional(Type.Array(StringEnum(PageSections), { description: "Only include these semantic page sections." })),
	excludeSections: Type.Optional(Type.Array(StringEnum(PageSections), { description: "Exclude these semantic page sections." })),
	maxAgeHours: Type.Optional(Type.Integer({ minimum: -1, maximum: 720, description: "Maximum cache age. Use 0 for a fresh crawl or -1 for cache only." })),
	pipe: PipeParam,
});

export default function exaExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "exa_search",
		label: "Exa Search",
		description: "Search the web with Exa; `query` may be one query or a list run in parallel. Returns source metadata and query-relevant highlights by default. `pipe` post-processes the rendered output through bash.",
		promptSnippet: "Search the web via Exa (several queries per call).",
		promptGuidelines: ["When researching from several angles, put all the queries in one exa_search call rather than one call each."],
		parameters: SearchParameters,
		async execute(_id, params, signal, onUpdate, ctx) {
			const queries = Array.isArray(params.query) ? params.query : [params.query];
			onUpdate?.({ content: [{ type: "text", text: `Searching Exa for ${queries.map((q) => `“${q}”`).join(", ")}…` }], details: undefined });
			const content = params.content ?? "highlights";
			const contentOptions = content === "none"
				? undefined
				: compactObject({
					[content]: params.maxCharacters === undefined
						? true
						: { maxCharacters: params.maxCharacters },
					maxAgeHours: params.maxAgeHours,
				});
			const responses = await Promise.all(queries.map((query) => exaRequest("/search", compactObject({
				query,
				numResults: params.numResults ?? 10,
				type: params.type ?? "auto",
				category: params.category,
				includeDomains: params.includeDomains,
				excludeDomains: params.excludeDomains,
				startPublishedDate: params.startPublishedDate,
				endPublishedDate: params.endPublishedDate,
				contents: contentOptions,
			}), signal)));
			const seen = new Set<string>();
			let text = responses.map((r, i) => formatResponse(`Search: “${queries[i]}”`, r, seen)).join("\n\n");
			text = params.pipe ? pipe(text, params.pipe, ctx.cwd) : truncateOutput(text);
			const all = responses.reduce<ToolDetails>((d, r) => {
				const x = details(r);
				return { requestId: d.requestId ?? x.requestId, resultCount: d.resultCount + x.resultCount, costDollars: (d.costDollars ?? 0) + (x.costDollars ?? 0) };
			}, { resultCount: 0 });
			return { content: [{ type: "text", text }], details: all };
		},
		renderCall(args, theme) {
			const qs = Array.isArray(args.query) ? args.query : [args.query];
			return new Text(`${theme.fg("toolTitle", theme.bold("Exa search "))}${qs.map((q: string) => theme.fg("accent", `“${q}”`)).join(theme.fg("muted", " · "))}`, 0, 0);
		},
	});

	pi.registerTool({
		name: "exa_contents",
		label: "Exa Contents",
		description: "Retrieve clean page text and metadata for one or more URLs with Exa's Contents API. `pipe` post-processes the rendered output through bash (e.g. `rg -i -C2 pricing`).",
		promptSnippet: "Retrieve or scrape web page contents via Exa.",
		parameters: ContentsParameters,
		async execute(_id, params, signal, onUpdate, ctx) {
			onUpdate?.({ content: [{ type: "text", text: `Retrieving ${params.urls.length} URL${params.urls.length === 1 ? "" : "s"} with Exa…` }], details: undefined });
			const response = await exaRequest("/contents", compactObject({
				urls: params.urls,
				text: compactObject({
					maxCharacters: params.maxCharacters ?? 10000,
					verbosity: params.verbosity ?? "compact",
					includeSections: params.includeSections,
					excludeSections: params.excludeSections,
				}),
				maxAgeHours: params.maxAgeHours,
			}), signal);
			const text = formatResponse("Page contents", response);
			return {
				content: [{ type: "text", text: params.pipe ? pipe(text, params.pipe, ctx.cwd) : truncateOutput(text) }],
				details: details(response),
			};
		},
		renderCall(args, theme) {
			const count = args.urls?.length ?? 0;
			return new Text(`${theme.fg("toolTitle", theme.bold("Exa contents "))}${theme.fg("accent", `${count} URL${count === 1 ? "" : "s"}`)}`, 0, 0);
		},
	});
}
