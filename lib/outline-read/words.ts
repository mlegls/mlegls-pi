/** Split a whitespace-separated argument list, honoring single and double quotes, so one string field can name several things. */
export function words(input: string): string[] {
	const out: string[] = [];
	let cur = "";
	let quote: string | undefined;
	let had = false;
	for (const ch of input) {
		if (quote) {
			if (ch === quote) quote = undefined;
			else cur += ch;
		} else if (ch === '"' || ch === "'") {
			quote = ch;
			had = true;
		} else if (/\s/.test(ch)) {
			if (cur || had) out.push(cur);
			cur = "";
			had = false;
		} else cur += ch;
	}
	if (cur || had) out.push(cur);
	return out;
}
