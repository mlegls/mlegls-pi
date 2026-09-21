/** One structural unit of a file: a definition, heading, or section. */
export interface OutlineNode {
	name: string;
	/** Source-specific kind: function, method, class, heading, section... */
	kind: string;
	/** 1-indexed inclusive line range of the whole node. */
	startLine: number;
	endLine: number;
	/**
	 * 1-indexed inclusive line range of the elidable body, if any. Lines
	 * outside the body but inside the node (signature, closing brace) are
	 * kept when the body is elided. Absent when the node has no body
	 * distinct from itself (markdown headings, constants).
	 */
	body?: { startLine: number; endLine: number };
	children: OutlineNode[];
}

export interface OutlineSource {
	name: string;
	supports(path: string): boolean;
	/** Return null when this source cannot outline the file after all. */
	outline(path: string, text: string, signal?: AbortSignal): Promise<OutlineNode[] | null>;
}

/** Nest a flat list by line containment. Ties keep the wider node as parent. */
export function nest(flat: OutlineNode[]): OutlineNode[] {
	const sorted = [...flat].sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
	const roots: OutlineNode[] = [];
	const stack: OutlineNode[] = [];
	for (const node of sorted) {
		while (stack.length && stack[stack.length - 1].endLine < node.endLine) stack.pop();
		const parent = stack[stack.length - 1];
		if (parent && parent.startLine <= node.startLine && node.endLine <= parent.endLine) {
			if (parent.startLine === node.startLine && parent.endLine === node.endLine) continue;
			parent.children.push(node);
		} else {
			roots.push(node);
		}
		stack.push(node);
	}
	return roots;
}
