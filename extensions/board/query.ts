// Board query language.
//
// topic: slash-separated path with globs. `*` matches one segment, `**` any run
// of segments (including none). `compile/*/unit-a`, `review/**`.
//
// tags: boolean expression over tag names. `done | (blocked & !retry)`.
// Operators by precedence: `!` > `&` > `|`. `,` is an alias for `&`.
// Tag names may contain `[A-Za-z0-9_:./@-]`, so `kind:decision` is one tag.
// Empty expression matches everything. A tag-name array means AND; `[]` is unrestricted.

export type TagExpr =
	| { op: "tag"; name: string }
	| { op: "not"; expr: TagExpr }
	| { op: "and"; exprs: TagExpr[] }
	| { op: "or"; exprs: TagExpr[] }
	| { op: "all" };

const TAG_CHARS = /[A-Za-z0-9_:./@-]/;

type Token = { kind: "tag"; name: string } | { kind: "!" | "&" | "|" | "(" | ")" };

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const ch = source[i]!;
		if (ch === " " || ch === "\t" || ch === "\n") {
			i++;
		} else if (ch === "!" || ch === "&" || ch === "|" || ch === "(" || ch === ")") {
			tokens.push({ kind: ch });
			i++;
		} else if (ch === ",") {
			tokens.push({ kind: "&" });
			i++;
		} else if (TAG_CHARS.test(ch)) {
			let j = i;
			while (j < source.length && TAG_CHARS.test(source[j]!)) j++;
			tokens.push({ kind: "tag", name: source.slice(i, j) });
			i = j;
		} else {
			throw new Error(`tag query: unexpected ${JSON.stringify(ch)} at ${i}`);
		}
	}
	return tokens;
}

export function parseTags(source: string | readonly string[] | undefined): TagExpr {
	if (Array.isArray(source)) {
		if (!source.length) return { op: "all" };
		if (!source.every((tag) => typeof tag === "string" && /^[A-Za-z0-9_:./@-]+$/.test(tag)))
			throw new Error("tag query: array items must be tag names ([A-Za-z0-9_:./@-]+), not expressions");
		const exprs = source.map((name) => ({ op: "tag" as const, name }));
		return exprs.length === 1 ? exprs[0]! : { op: "and", exprs };
	}
	if (!source || source.trim() === "") return { op: "all" };
	const tokens = tokenize(source);
	let pos = 0;
	const peek = () => tokens[pos];
	const take = () => tokens[pos++];

	function primary(): TagExpr {
		const token = take();
		if (!token) throw new Error("tag query: unexpected end");
		if (token.kind === "tag") return { op: "tag", name: token.name };
		if (token.kind === "!") return { op: "not", expr: primary() };
		if (token.kind === "(") {
			const inner = or();
			const close = take();
			if (!close || close.kind !== ")") throw new Error("tag query: expected )");
			return inner;
		}
		throw new Error(`tag query: unexpected ${token.kind}`);
	}
	function and(): TagExpr {
		const exprs = [primary()];
		while (peek()?.kind === "&") {
			take();
			exprs.push(primary());
		}
		return exprs.length === 1 ? exprs[0]! : { op: "and", exprs };
	}
	function or(): TagExpr {
		const exprs = [and()];
		while (peek()?.kind === "|") {
			take();
			exprs.push(and());
		}
		return exprs.length === 1 ? exprs[0]! : { op: "or", exprs };
	}

	const expr = or();
	if (pos < tokens.length) throw new Error(`tag query: trailing ${tokens[pos]!.kind}`);
	return expr;
}

export function evalTags(expr: TagExpr, tags: readonly string[]): boolean {
	switch (expr.op) {
		case "all":
			return true;
		case "tag":
			return tags.includes(expr.name);
		case "not":
			return !evalTags(expr.expr, tags);
		case "and":
			return expr.exprs.every((e) => evalTags(e, tags));
		case "or":
			return expr.exprs.some((e) => evalTags(e, tags));
	}
}

export function matchTopic(pattern: string | undefined, topic: string): boolean {
	if (!pattern || pattern === "**") return true;
	const p = pattern.split("/");
	const t = topic.split("/");
	// Standard globstar backtracking over segments.
	function go(pi: number, ti: number): boolean {
		while (pi < p.length) {
			const seg = p[pi]!;
			if (seg === "**") {
				if (pi === p.length - 1) return true;
				for (let k = ti; k <= t.length; k++) if (go(pi + 1, k)) return true;
				return false;
			}
			if (ti >= t.length) return false;
			if (seg !== "*" && seg !== t[ti]) return false;
			pi++;
			ti++;
		}
		return ti === t.length;
	}
	return go(0, 0);
}

export interface Query {
	topic?: string;
	tags?: string | readonly string[];
}

export function compileQuery(query: Query): (topic: string, tags: readonly string[]) => boolean {
	const expr = parseTags(query.tags);
	return (topic, tags) => matchTopic(query.topic, topic) && evalTags(expr, tags);
}
