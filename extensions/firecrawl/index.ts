/**
 * Firecrawl Extension
 *
 * Registers tools for web scraping, searching, crawling, site mapping,
 * AI-powered extraction, and browser interaction via the Firecrawl SDK (v2 client).
 *
 * Tools:
 *   - firecrawl_scrape:   Scrape a single page to markdown
 *   - firecrawl_search:   Web search with optional full-page content
 *   - firecrawl_map:      Discover URLs on a site
 *   - firecrawl_crawl:    Crawl multiple pages from a starting URL
 *   - firecrawl_extract:  AI-powered structured data extraction (agent)
 *   - firecrawl_interact: Interact with a scraped page (click, fill, navigate)
 *
 * Setup:
 *   export FIRECRAWL_API_KEY=fc-...
 *
 * Optional:
 *   export FIRECRAWL_API_URL=https://api.firecrawl.dev  (default)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import Firecrawl from "@mendable/firecrawl-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient(): InstanceType<typeof Firecrawl> {
	const apiKey = process.env.FIRECRAWL_API_KEY;
	if (!apiKey) {
		throw new Error(
			"FIRECRAWL_API_KEY environment variable is not set. " +
				"Get an API key at https://www.firecrawl.dev and set it via: " +
				"export FIRECRAWL_API_KEY=fc-...",
		);
	}
	return new Firecrawl({
		apiKey,
		apiUrl: process.env.FIRECRAWL_API_URL ?? undefined,
	});
}

function truncateResult(text: string): string {
	const truncation = truncateHead(text, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});
	if (truncation.truncated) {
		return (
			truncation.content +
			`\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines ` +
			`(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`
		);
	}
	return text;
}

// ---------------------------------------------------------------------------
// Detail types
// ---------------------------------------------------------------------------

interface ScrapeDetails {
	url: string;
	title?: string;
	statusCode?: number;
	wordCount?: number;
	scrapeId?: string;
}

interface SearchDetails {
	query: string;
	resultCount: number;
	scraped: boolean;
}

interface MapDetails {
	url: string;
	linkCount: number;
}

interface CrawlDetails {
	url: string;
	status: string;
	pagesScraped: number;
	total?: number;
	creditsUsed?: number;
}

interface ExtractDetails {
	prompt: string;
	model?: string;
	creditsUsed?: number;
}

interface InteractDetails {
	scrapeId: string;
	action: string;
	hasOutput: boolean;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// Track last scrape ID for interact convenience
	let lastScrapeId: string | undefined;

	// ── firecrawl_scrape ──────────────────────────────────────────────────

	pi.registerTool({
		name: "firecrawl_scrape",
		label: "Firecrawl Scrape",
		description:
			"Scrape a single web page and return its content as markdown. " +
			"Handles JavaScript-rendered pages, anti-bot protection, and dynamic content. " +
			"Use for reading documentation, articles, or any web page. " +
			"Returns a scrape ID that can be used with firecrawl_interact for page interaction.",
		promptSnippet:
			"Scrape a web page to markdown via Firecrawl (requires FIRECRAWL_API_KEY)",
		promptGuidelines: [
			"Use firecrawl_scrape for web pages — it handles JS rendering, SPAs, and anti-bot protection. Use curl for APIs, JSON endpoints, and raw HTTP requests.",
			"Firecrawl escalation: search (no URL yet) → scrape (have URL) → map+scrape (need a specific subpage on a large site) → crawl (need many pages) → interact (need clicks/forms/login). Start with the simplest tool that fits.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "URL to scrape" }),
			onlyMainContent: Type.Optional(
				Type.Boolean({
					description:
						"Extract only the main content, excluding nav/footer/sidebar. Defaults to true.",
				}),
			),
			includeTags: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Only include content from these HTML tags (e.g. ['article', 'main'])",
				}),
			),
			excludeTags: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Exclude content from these HTML tags (e.g. ['nav', 'footer'])",
				}),
			),
			waitFor: Type.Optional(
				Type.Number({
					description:
						"Wait this many milliseconds for JS to render before scraping",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			const client = getClient();

			onUpdate?.({
				content: [{ type: "text", text: `Scraping ${params.url}...` }],
			});

			const result = await client.scrape(params.url, {
				formats: ["markdown"],
				onlyMainContent: params.onlyMainContent ?? true,
				includeTags: params.includeTags,
				excludeTags: params.excludeTags,
				waitFor: params.waitFor,
			});

			const markdown: string = result.markdown ?? "No content returned.";
			const metadata = result.metadata ?? {};
			const scrapeId = (metadata as any).scrapeId ?? (metadata as any).jobId;

			if (scrapeId) {
				lastScrapeId = scrapeId;
			}

			const resultText = truncateResult(markdown);

			const details: ScrapeDetails = {
				url: params.url,
				title: metadata.title,
				wordCount: markdown.split(/\s+/).length,
				scrapeId,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🔥 scrape "));
			text += theme.fg("accent", args.url);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as ScrapeDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "🔥 Scraping..."), 0, 0);
			}

			if (!details) {
				return new Text(theme.fg("error", "Scrape failed"), 0, 0);
			}

			let text = theme.fg("success", "✓");
			if (details.title) {
				text += ` ${theme.fg("fg", details.title)}`;
			}
			if (details.wordCount) {
				text += theme.fg(
					"dim",
					` · ${details.wordCount.toLocaleString()} words`,
				);
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 40);
					for (const line of lines) {
						text += `\n${theme.fg("fg", line)}`;
					}
					const totalLines = content.text.split("\n").length;
					if (totalLines > 40) {
						text += `\n${theme.fg("dim", `... ${totalLines - 40} more lines`)}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// ── firecrawl_search ──────────────────────────────────────────────────

	pi.registerTool({
		name: "firecrawl_search",
		label: "Firecrawl Search",
		description:
			"Search the web and optionally scrape full page content from results. " +
			"Returns search results with titles, URLs, and descriptions. " +
			"With scrape enabled, also returns full markdown content for each result. " +
			"Use when you don't have a specific URL yet and need to find pages.",
		promptSnippet:
			"Web search with optional full-page content via Firecrawl (requires FIRECRAWL_API_KEY)",
		promptGuidelines: [
			"Use firecrawl_search when you need to find specific pages or sources to work with. Use perplexity_search when you just want a quick answer.",
			"Enable scrape option to get full page content with search results — avoids needing separate firecrawl_scrape calls.",
			"For searching within a specific site, use firecrawl_map with search parameter instead.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Search query" }),
			limit: Type.Optional(
				Type.Number({
					description: "Maximum number of results (default 5)",
				}),
			),
			scrape: Type.Optional(
				Type.Boolean({
					description:
						"Also scrape full page content for each result (default false). Costs more credits but avoids re-scraping.",
				}),
			),
			tbs: Type.Optional(
				Type.String({
					description:
						"Time-based search filter: qdr:h (hour), qdr:d (day), qdr:w (week), qdr:m (month), qdr:y (year)",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			const client = getClient();

			onUpdate?.({
				content: [
					{ type: "text", text: `Searching: "${params.query}"...` },
				],
			});

			const searchParams: Record<string, any> = {
				limit: params.limit ?? 5,
			};
			if (params.tbs) searchParams.tbs = params.tbs;
			if (params.scrape) {
				searchParams.scrapeOptions = {
					formats: ["markdown"],
					onlyMainContent: true,
				};
			}

			const result = await client.search(params.query, searchParams);

			if (!result.success) {
				throw new Error(
					`Firecrawl search failed: ${(result as any).error || "unknown error"}`,
				);
			}

			const webResults = (result as any).data ?? [];

			let resultText = `# Search: "${params.query}"\n\nResults: ${webResults.length}\n`;

			for (const [i, item] of webResults.entries()) {
				const title = item.title ?? item.metadata?.title ?? "Untitled";
				const url = item.url ?? item.metadata?.sourceURL ?? "";
				const description =
					item.description ?? item.metadata?.description ?? "";

				resultText += `\n## ${i + 1}. ${title}\n**URL:** ${url}\n`;
				if (description) {
					resultText += `${description}\n`;
				}
				if (params.scrape && item.markdown) {
					resultText += `\n${item.markdown}\n`;
				}
			}

			resultText = truncateResult(resultText);

			const details: SearchDetails = {
				query: params.query,
				resultCount: webResults.length,
				scraped: !!params.scrape,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🔍 search "));
			text += theme.fg("accent", `"${args.query}"`);
			if (args.scrape) {
				text += theme.fg("dim", " +scrape");
			}
			if (args.tbs) {
				text += theme.fg("dim", ` tbs=${args.tbs}`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as SearchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "🔍 Searching..."), 0, 0);
			}

			if (!details) {
				return new Text(theme.fg("error", "Search failed"), 0, 0);
			}

			let text = theme.fg(
				"success",
				`✓ ${details.resultCount} results`,
			);
			if (details.scraped) {
				text += theme.fg("dim", " (with content)");
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 50);
					for (const line of lines) {
						if (line.startsWith("## ")) {
							text += `\n${theme.fg("accent", line)}`;
						} else if (line.startsWith("**URL:**")) {
							text += `\n${theme.fg("dim", line)}`;
						} else {
							text += `\n${theme.fg("fg", line)}`;
						}
					}
					const totalLines = content.text.split("\n").length;
					if (totalLines > 50) {
						text += `\n${theme.fg("dim", `... ${totalLines - 50} more lines`)}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// ── firecrawl_map ─────────────────────────────────────────────────────

	pi.registerTool({
		name: "firecrawl_map",
		label: "Firecrawl Map",
		description:
			"Discover URLs on a website. Returns a list of pages found via sitemap and crawling. " +
			"Use to understand site structure before scraping specific pages, or to find " +
			"a specific page on a large site using the search parameter.",
		promptSnippet:
			"Discover URLs on a website via Firecrawl (requires FIRECRAWL_API_KEY)",
		promptGuidelines: [
			"Use firecrawl_map to discover pages on a site before deciding which to scrape.",
			"Use the search parameter to find specific pages within a large site.",
			"Combine firecrawl_map with firecrawl_scrape: map first to find relevant URLs, then scrape them.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "Base URL or domain to map" }),
			search: Type.Optional(
				Type.String({
					description: "Filter discovered URLs by keyword relevance",
				}),
			),
			limit: Type.Optional(
				Type.Number({
					description: "Maximum number of URLs to return (default 100)",
				}),
			),
			includeSubdomains: Type.Optional(
				Type.Boolean({ description: "Include subdomains in results" }),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			const client = getClient();

			onUpdate?.({
				content: [{ type: "text", text: `Mapping ${params.url}...` }],
			});

			const result = await client.map(params.url, {
				search: params.search,
				limit: params.limit ?? 100,
				includeSubdomains: params.includeSubdomains,
			});

			const links = result.links ?? [];
			const urls = links.map((l: any) =>
				typeof l === "string" ? l : l.url ?? l,
			);

			let resultText: string;
			if (urls.length === 0) {
				resultText = "No URLs discovered.";
			} else {
				resultText = `Found ${urls.length} URLs:\n\n${urls.join("\n")}`;
			}

			resultText = truncateResult(resultText);

			const details: MapDetails = {
				url: params.url,
				linkCount: urls.length,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🗺️  map "));
			text += theme.fg("accent", args.url);
			if (args.search) {
				text += theme.fg("dim", ` search="${args.search}"`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as MapDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "🗺️  Mapping..."), 0, 0);
			}

			if (!details) {
				return new Text(theme.fg("error", "Map failed"), 0, 0);
			}

			let text = theme.fg("success", `✓ ${details.linkCount} URLs found`);

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 50);
					for (const line of lines) {
						if (line.startsWith("http")) {
							text += `\n${theme.fg("accent", line)}`;
						} else {
							text += `\n${theme.fg("fg", line)}`;
						}
					}
					const totalLines = content.text.split("\n").length;
					if (totalLines > 50) {
						text += `\n${theme.fg("dim", `... ${totalLines - 50} more URLs`)}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// ── firecrawl_crawl ───────────────────────────────────────────────────

	pi.registerTool({
		name: "firecrawl_crawl",
		label: "Firecrawl Crawl",
		description:
			"Crawl a website starting from a URL, following links to scrape multiple pages. " +
			"Returns markdown content for each page. Use for ingesting documentation sites or " +
			"multi-page content. The SDK handles async polling automatically.",
		promptSnippet:
			"Crawl multiple pages from a website via Firecrawl (requires FIRECRAWL_API_KEY)",
		promptGuidelines: [
			"Use firecrawl_crawl for multi-page ingestion (e.g. docs sites). For single pages, prefer firecrawl_scrape.",
			"firecrawl_crawl may take time for large sites. Set a reasonable limit to avoid very long waits.",
			"Use includePaths to scope the crawl — don't crawl an entire site when you only need one section.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "Starting URL to crawl from" }),
			limit: Type.Optional(
				Type.Number({
					description:
						"Maximum number of pages to crawl (default 10, max 100)",
				}),
			),
			maxDepth: Type.Optional(
				Type.Number({
					description:
						"Maximum link depth from the starting URL (default 2)",
				}),
			),
			includePaths: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Only crawl URLs matching these glob patterns (e.g. ['/docs/*'])",
				}),
			),
			excludePaths: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Skip URLs matching these glob patterns (e.g. ['/blog/*'])",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			const client = getClient();
			const limit = Math.min(params.limit ?? 10, 100);

			onUpdate?.({
				content: [
					{
						type: "text",
						text: `Starting crawl of ${params.url} (limit: ${limit})...`,
					},
				],
			});

			const result = await client.crawl(params.url, {
				limit,
				maxDepth: params.maxDepth,
				includePaths: params.includePaths,
				excludePaths: params.excludePaths,
				scrapeOptions: {
					formats: ["markdown"],
					onlyMainContent: true,
				},
			});

			const pages = result.data ?? [];

			// Assemble results
			let resultText = `# Crawl Results: ${params.url}\n\nPages scraped: ${pages.length}\n`;

			for (const page of pages) {
				const pageUrl =
					page.metadata?.url ?? (page as any).url ?? "unknown";
				const pageTitle = page.metadata?.title ?? pageUrl;
				const markdown = page.markdown ?? "";
				resultText += `\n---\n## ${pageTitle}\n**URL:** ${pageUrl}\n\n${markdown}\n`;
			}

			resultText = truncateResult(resultText);

			const details: CrawlDetails = {
				url: params.url,
				status: result.status,
				pagesScraped: pages.length,
				total: result.total,
				creditsUsed: result.creditsUsed,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🕷️  crawl "));
			text += theme.fg("accent", args.url);
			if (args.limit) {
				text += theme.fg("dim", ` (limit: ${args.limit})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as CrawlDetails | undefined;

			if (isPartial) {
				const content = result.content[0];
				const progress =
					content?.type === "text" ? content.text : "Crawling...";
				return new Text(theme.fg("warning", `🕷️  ${progress}`), 0, 0);
			}

			if (!details) {
				return new Text(theme.fg("error", "Crawl failed"), 0, 0);
			}

			let text = theme.fg(
				"success",
				`✓ ${details.pagesScraped} pages crawled`,
			);
			if (details.creditsUsed) {
				text += theme.fg("dim", ` · ${details.creditsUsed} credits`);
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 60);
					for (const line of lines) {
						if (line.startsWith("## ")) {
							text += `\n${theme.fg("accent", line)}`;
						} else if (line.startsWith("**URL:**")) {
							text += `\n${theme.fg("dim", line)}`;
						} else {
							text += `\n${theme.fg("fg", line)}`;
						}
					}
					const totalLines = content.text.split("\n").length;
					if (totalLines > 60) {
						text += `\n${theme.fg("dim", `... ${totalLines - 60} more lines`)}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// ── firecrawl_extract ─────────────────────────────────────────────────

	pi.registerTool({
		name: "firecrawl_extract",
		label: "Firecrawl Extract",
		description:
			"AI-powered autonomous data extraction. The agent navigates sites and extracts " +
			"structured data as JSON. Use when you need structured data from complex multi-page " +
			"sites, or when manual scraping would require navigating many pages. " +
			"More powerful than simple scraping for multi-page structured extraction. " +
			"Takes 2-5 minutes for complex extractions.",
		promptSnippet:
			"AI-powered structured data extraction via Firecrawl agent (requires FIRECRAWL_API_KEY)",
		promptGuidelines: [
			"Use firecrawl_extract for structured data extraction from complex sites (pricing tables, product listings, etc.).",
			"Provide a JSON schema for predictable, structured output. Without it, the agent returns freeform data.",
			"For simple single-page extraction, prefer firecrawl_scrape — it's faster and cheaper.",
			"Agent runs consume more credits than simple scrapes. Set maxCredits to cap spending.",
		],
		parameters: Type.Object({
			prompt: Type.String({
				description:
					"What to extract (e.g. 'extract all pricing tiers', 'get product listings')",
			}),
			urls: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Starting URLs for the agent. If omitted, agent discovers pages from the prompt.",
				}),
			),
			schema: Type.Optional(
				Type.String({
					description:
						"JSON schema string for structured output (e.g. '{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"}}}')",
				}),
			),
			model: Type.Optional(
				StringEnum(["spark-1-mini", "spark-1-pro"] as const, {
					description:
						"Model to use: spark-1-mini (faster/cheaper) or spark-1-pro (more capable). Default: spark-1-mini.",
				}),
			),
			maxCredits: Type.Optional(
				Type.Number({
					description: "Maximum credits to spend on this extraction",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			const client = getClient();

			onUpdate?.({
				content: [
					{
						type: "text",
						text: `Starting extraction: "${params.prompt}"...`,
					},
				],
			});

			const agentParams: Record<string, any> = {
				prompt: params.prompt,
			};
			if (params.urls) agentParams.urls = params.urls;
			if (params.schema) {
				try {
					agentParams.schema = JSON.parse(params.schema);
				} catch {
					throw new Error(
						`Invalid JSON schema: ${params.schema}`,
					);
				}
			}
			if (params.model) agentParams.model = params.model;
			if (params.maxCredits) agentParams.maxCredits = params.maxCredits;

			const result = await client.agent(agentParams);

			if (!result.success) {
				throw new Error(
					`Firecrawl extract failed: ${(result as any).error || "unknown error"}`,
				);
			}

			let resultText: string;
			if (result.data) {
				resultText =
					typeof result.data === "string"
						? result.data
						: JSON.stringify(result.data, null, 2);
			} else {
				resultText = "No data returned.";
			}

			resultText = truncateResult(resultText);

			const details: ExtractDetails = {
				prompt: params.prompt,
				model: result.model ?? params.model,
				creditsUsed: result.creditsUsed,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🤖 extract "));
			text += theme.fg("accent", `"${args.prompt}"`);
			if (args.model) {
				text += theme.fg("dim", ` (${args.model})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as ExtractDetails | undefined;

			if (isPartial) {
				return new Text(
					theme.fg("warning", "🤖 Extracting..."),
					0,
					0,
				);
			}

			if (!details) {
				return new Text(theme.fg("error", "Extraction failed"), 0, 0);
			}

			let text = theme.fg("success", "✓ extracted");
			if (details.model) {
				text += theme.fg("dim", ` · ${details.model}`);
			}
			if (details.creditsUsed) {
				text += theme.fg("dim", ` · ${details.creditsUsed} credits`);
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 50);
					for (const line of lines) {
						text += `\n${theme.fg("fg", line)}`;
					}
					const totalLines = content.text.split("\n").length;
					if (totalLines > 50) {
						text += `\n${theme.fg("dim", `... ${totalLines - 50} more lines`)}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// ── firecrawl_interact ────────────────────────────────────────────────

	pi.registerTool({
		name: "firecrawl_interact",
		label: "Firecrawl Interact",
		description:
			"Interact with a previously scraped page in a live browser session. " +
			"Click buttons, fill forms, navigate flows, scroll, and extract data " +
			"using natural language prompts or code. Requires a prior firecrawl_scrape call. " +
			"Use when content requires interaction: clicks, form fills, pagination, login, " +
			"or when scrape failed to get all content. " +
			"Call with action 'stop' to end the session when done.",
		promptSnippet:
			"Interact with a scraped page via Firecrawl browser session (requires FIRECRAWL_API_KEY)",
		promptGuidelines: [
			"Always firecrawl_scrape first — firecrawl_interact requires a scrape ID from a previous scrape.",
			"Use firecrawl_interact when scrape can't get the content (behind clicks, forms, pagination, login).",
			"Use action 'stop' to free resources when done interacting with a page.",
			"Never use firecrawl_interact for web searches — use firecrawl_search instead.",
		],
		parameters: Type.Object({
			action: StringEnum(
				["prompt", "code", "stop"] as const,
				{
					description:
						"Action type: 'prompt' for natural language, 'code' for code execution, 'stop' to end session",
				},
			),
			instruction: Type.Optional(
				Type.String({
					description:
						"For 'prompt': natural language instruction (e.g. 'Click the login button'). " +
						"For 'code': code to execute in the browser session.",
				}),
			),
			language: Type.Optional(
				StringEnum(["python", "node", "bash"] as const, {
					description:
						"Language for code execution (default: bash). Only used with action 'code'.",
				}),
			),
			scrapeId: Type.Optional(
				Type.String({
					description:
						"Scrape job ID to interact with. Defaults to the last scrape.",
				}),
			),
			timeout: Type.Optional(
				Type.Number({
					description:
						"Execution timeout in seconds (default 30, max 300)",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			const client = getClient();
			const jobId = params.scrapeId ?? lastScrapeId;

			if (!jobId) {
				throw new Error(
					"No scrape ID available. Use firecrawl_scrape first to scrape a page, " +
						"then use firecrawl_interact to interact with it.",
				);
			}

			if (params.action === "stop") {
				onUpdate?.({
					content: [
						{ type: "text", text: "Stopping interaction session..." },
					],
				});

				await client.stopInteraction(jobId);

				return {
					content: [
						{
							type: "text",
							text: `Interaction session stopped for scrape ${jobId}.`,
						},
					],
					details: {
						scrapeId: jobId,
						action: "stop",
						hasOutput: false,
					} as InteractDetails,
				};
			}

			if (!params.instruction) {
				throw new Error(
					"instruction is required for 'prompt' and 'code' actions.",
				);
			}

			onUpdate?.({
				content: [
					{
						type: "text",
						text: `Interacting with page (${params.action})...`,
					},
				],
			});

			const interactParams: Record<string, any> = {
				timeout: params.timeout ?? 30,
			};

			if (params.action === "prompt") {
				interactParams.prompt = params.instruction;
			} else {
				interactParams.code = params.instruction;
				interactParams.language = params.language ?? "bash";
			}

			const result = await client.interact(jobId, interactParams);

			let resultText = "";
			if (result.output) resultText += result.output;
			if (result.stdout) resultText += (resultText ? "\n" : "") + result.stdout;
			if (result.stderr)
				resultText += (resultText ? "\n" : "") + `STDERR: ${result.stderr}`;
			if (result.result) resultText += (resultText ? "\n" : "") + result.result;

			if (!resultText) {
				resultText = result.success
					? "Interaction completed (no output)."
					: "Interaction failed.";
			}

			resultText = truncateResult(resultText);

			const details: InteractDetails = {
				scrapeId: jobId,
				action: params.action,
				hasOutput: !!resultText,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🖱️  interact "));
			if (args.action === "stop") {
				text += theme.fg("warning", "stop");
			} else {
				text += theme.fg(
					"accent",
					args.instruction
						? `"${args.instruction.slice(0, 60)}${args.instruction.length > 60 ? "..." : ""}"`
						: args.action,
				);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as InteractDetails | undefined;

			if (isPartial) {
				return new Text(
					theme.fg("warning", "🖱️  Interacting..."),
					0,
					0,
				);
			}

			if (!details) {
				return new Text(
					theme.fg("error", "Interaction failed"),
					0,
					0,
				);
			}

			let text: string;
			if (details.action === "stop") {
				text = theme.fg("success", "✓ session stopped");
			} else {
				text = theme.fg("success", `✓ ${details.action}`);
			}

			if (expanded && details.hasOutput) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 30);
					for (const line of lines) {
						text += `\n${theme.fg("fg", line)}`;
					}
					const totalLines = content.text.split("\n").length;
					if (totalLines > 30) {
						text += `\n${theme.fg("dim", `... ${totalLines - 30} more lines`)}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});
}
