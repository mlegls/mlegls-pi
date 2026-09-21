// Exa HTTP client shared by the `exa_search`/`exa_contents` tools and the exec
// services adapter. Keeping request construction and response typing here means
// both callers see the same metadata (`requestId`, `statuses`, `costDollars`).

const DEFAULT_API_URL = "https://api.exa.ai";

export interface ExaResult {
	id?: string;
	title?: string;
	url?: string;
	publishedDate?: string;
	author?: string | null;
	text?: string;
	highlights?: string[];
	summary?: string;
}

export interface ExaStatus {
	id: string;
	status: "success" | "error";
	source?: "cached" | "crawled";
	error?: { tag?: string; httpStatusCode?: number | null } | null;
}

export interface ExaResponse {
	requestId?: string;
	results?: ExaResult[];
	statuses?: ExaStatus[];
	costDollars?: { total?: number };
}

export type ExaSearchType = "instant" | "fast" | "auto" | "deep-lite" | "deep" | "deep-reasoning";
export type ExaCategory = "company" | "publication" | "news" | "personal site" | "financial report" | "people";
export type ExaContent = "highlights" | "text" | "none";
export type ExaVerbosity = "compact" | "standard" | "full";
export type ExaSection = "header" | "navigation" | "banner" | "body" | "sidebar" | "footer" | "metadata";

export interface ExaSearchOptions {
	query: string;
	numResults?: number;
	type?: ExaSearchType;
	category?: ExaCategory;
	includeDomains?: string[];
	excludeDomains?: string[];
	startPublishedDate?: string;
	endPublishedDate?: string;
	content?: ExaContent;
	maxCharacters?: number;
	maxAgeHours?: number;
}

export interface ExaContentsOptions {
	urls: string[];
	maxCharacters?: number;
	verbosity?: ExaVerbosity;
	includeSections?: ExaSection[];
	excludeSections?: ExaSection[];
	maxAgeHours?: number;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

async function request(path: "/search" | "/contents", body: Record<string, unknown>, signal?: AbortSignal): Promise<ExaResponse> {
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

export async function search(options: ExaSearchOptions, signal?: AbortSignal): Promise<ExaResponse> {
	const content = options.content ?? "highlights";
	const contentOptions = content === "none"
		? undefined
		: compactObject({
			[content]: options.maxCharacters === undefined ? true : { maxCharacters: options.maxCharacters },
			maxAgeHours: options.maxAgeHours,
		});
	return request("/search", compactObject({
		query: options.query,
		numResults: options.numResults ?? 10,
		type: options.type ?? "auto",
		category: options.category,
		includeDomains: options.includeDomains,
		excludeDomains: options.excludeDomains,
		startPublishedDate: options.startPublishedDate,
		endPublishedDate: options.endPublishedDate,
		contents: contentOptions,
	}), signal);
}

export async function contents(options: ExaContentsOptions, signal?: AbortSignal): Promise<ExaResponse> {
	return request("/contents", compactObject({
		urls: options.urls,
		text: compactObject({
			maxCharacters: options.maxCharacters ?? 10000,
			verbosity: options.verbosity ?? "compact",
			includeSections: options.includeSections,
			excludeSections: options.excludeSections,
		}),
		maxAgeHours: options.maxAgeHours,
	}), signal);
}
