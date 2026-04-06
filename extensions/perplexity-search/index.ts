/**
 * Perplexity Search Extension
 *
 * Registers a `perplexity_search` tool that the LLM can call to search the web
 * via Perplexity's Sonar API. Returns answers with citations.
 *
 * Setup:
 *   export PERPLEXITY_API_KEY=pplx-...
 *
 * Add to your shell profile (~/.zshrc, ~/.bashrc, etc.) or use direnv.
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

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

const SearchParams = Type.Object({
	query: Type.String({ description: "The search query" }),
	detail: StringEnum(["concise", "detailed"] as const, {
		description: "Response detail level. Use 'concise' for quick facts, 'detailed' for in-depth research.",
		default: "concise",
	}),
});

interface Citation {
	url: string;
	title?: string;
}

interface SearchDetails {
	query: string;
	model: string;
	citations: Citation[];
	usage?: { prompt_tokens: number; completion_tokens: number };
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "perplexity_search",
		label: "Perplexity Search",
		description:
			"Search the web using Perplexity AI's Sonar model. Returns an AI-synthesized answer with citations. " +
			"Use for current events, documentation lookups, factual questions, or any query requiring up-to-date web information.",
		promptSnippet: "Search the web for current information using Perplexity AI (requires PERPLEXITY_API_KEY)",
		promptGuidelines: [
			"Use perplexity_search for quick factual answers, 'what is X?', or current events — it returns a synthesized answer, not raw pages.",
			"Prefer perplexity_search over firecrawl_search when you want a direct answer rather than a list of pages to read.",
			"Prefer 'concise' detail level for quick factual lookups; use 'detailed' for research or complex topics.",
		],
		parameters: SearchParams,

		async execute(_toolCallId, params, signal) {
			const apiKey = process.env.PERPLEXITY_API_KEY;
			if (!apiKey) {
				throw new Error(
					"PERPLEXITY_API_KEY environment variable is not set. " +
						"Get an API key at https://www.perplexity.ai/settings/api and set it via: " +
						"export PERPLEXITY_API_KEY=pplx-...",
				);
			}

			const { query, detail } = params;

			// Pick model based on detail level
			const model = detail === "detailed" ? "sonar-pro" : "sonar";

			const systemPrompt =
				detail === "detailed"
					? "You are a thorough research assistant. Provide comprehensive, well-structured answers with specific details, examples, and context. Cite your sources."
					: "You are a concise research assistant. Provide brief, accurate answers. Cite your sources.";

			const body = {
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: query },
				],
				// Return search results inline
				return_related_questions: false,
			};

			const response = await fetch(PERPLEXITY_API_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => "");
				throw new Error(
					`Perplexity API error ${response.status}: ${errorBody || response.statusText}`,
				);
			}

			const data = await response.json();

			const answer: string = data.choices?.[0]?.message?.content ?? "No results returned.";
			const rawCitations: string[] = data.citations ?? [];
			const usage = data.usage;

			// Build citations list
			const citations: Citation[] = rawCitations.map((url: string, i: number) => ({
				url,
				title: `[${i + 1}]`,
			}));

			// Format the output for the LLM
			let resultText = answer;

			if (citations.length > 0) {
				resultText += "\n\nSources:";
				for (const [i, cite] of citations.entries()) {
					resultText += `\n[${i + 1}] ${cite.url}`;
				}
			}

			// Truncate if needed (unlikely for search but good practice)
			const truncation = truncateHead(resultText, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			if (truncation.truncated) {
				resultText = truncation.content;
				resultText += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
			}

			const details: SearchDetails = {
				query,
				model,
				citations,
				usage,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		// Custom rendering of the tool call
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("🔍 search "));
			text += theme.fg("accent", `"${args.query}"`);
			if (args.detail === "detailed") {
				text += theme.fg("warning", " (detailed)");
			}
			return new Text(text, 0, 0);
		},

		// Custom rendering of the tool result
		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as SearchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "🔍 Searching..."), 0, 0);
			}

			if (!details) {
				return new Text(theme.fg("error", "No results"), 0, 0);
			}

			// Header line
			let text = theme.fg("success", `✓ ${details.model}`);
			if (details.citations.length > 0) {
				text += theme.fg("dim", ` · ${details.citations.length} sources`);
			}
			if (details.usage) {
				text += theme.fg("dim", ` · ${details.usage.completion_tokens} tokens`);
			}

			if (expanded) {
				// Show the answer text
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n");
					for (const line of lines) {
						if (line.startsWith("[") && line.includes("http")) {
							// Citation line
							text += `\n${theme.fg("accent", line)}`;
						} else {
							text += `\n${theme.fg("fg", line)}`;
						}
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});
}
