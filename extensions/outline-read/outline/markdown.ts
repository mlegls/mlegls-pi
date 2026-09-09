/** Markdown outline source: ATX headings nested by level, fenced code ignored. */
import { extname } from "node:path";
import type { OutlineNode, OutlineSource } from "./types";

const EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);

export function outlineMarkdown(text: string): OutlineNode[] {
	const lines = text.split("\n");
	const roots: OutlineNode[] = [];
	const stack: { level: number; node: OutlineNode }[] = [];
	let fence: string | undefined;

	const close = (level: number, endLine: number) => {
		while (stack.length && stack[stack.length - 1].level >= level) {
			const { node } = stack.pop()!;
			node.endLine = endLine;
			node.body = node.body && node.body.startLine <= endLine ? { ...node.body, endLine } : undefined;
		}
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
		if (fenceMatch) {
			if (!fence) fence = fenceMatch[1];
			else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = undefined;
			continue;
		}
		if (fence) continue;
		const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (!heading) continue;
		const level = heading[1].length;
		close(level, i);
		const node: OutlineNode = {
			name: heading[2],
			kind: `h${level}`,
			startLine: i + 1,
			endLine: lines.length,
			body: { startLine: i + 2, endLine: lines.length },
			children: [],
		};
		const parent = stack[stack.length - 1]?.node;
		(parent ? parent.children : roots).push(node);
		stack.push({ level, node });
	}
	close(0, lines.length);
	return roots;
}

export const markdownSource: OutlineSource = {
	name: "markdown",
	supports: (path) => EXTENSIONS.has(extname(path).toLowerCase()),
	async outline(_path, text) {
		return outlineMarkdown(text);
	},
};
