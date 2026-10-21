import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { compress, retitle, scanSecrets } from "./share";

describe("compress", () => {
	const payload = Buffer.from(JSON.stringify({ entries: Array(200).fill({ text: "hello" }) })).toString("base64");
	const reader = "\n const base64 = document.getElementById('session-data').textContent;\n go(base64);\n";
	const html = '<html><head><script id="session-data" type="application/json">' + payload + "</script>"
		+ "<script>/* lib */</script></head><body><script>" + reader + "</script></body></html>";

	test("gzips the session payload and defers pi's reader behind a loader", () => {
		const out = compress(html)!;
		const gz = /<script id="session-data" type="application\/json">([^<]+)<\/script>/.exec(out)![1]!;
		expect(gunzipSync(Buffer.from(gz, "base64")).toString("base64")).toBe(payload);
		expect(out).toContain('<script type="text/plain" id="thread-share-main">' + reader + "</script><script>(async()=>");
		expect(out).toContain("<script>/* lib */</script>");
		expect(out.length).toBeLessThan(html.length);
	});

	test("leaves an export of another shape alone", () => {
		expect(compress("<html><script>data()</script></html>")).toBeNull();
	});
});

describe("retitle", () => {
	test("replaces pi's title with the escaped thread title and marks the page noindex", () => {
		const out = retitle("<html><head><title>Session Export</title></head></html>", 'fix <b> & "quote" $&');
		expect(out).toContain("<title>fix &lt;b&gt; &amp; &quot;quote&quot; $&amp;</title>");
		expect(out).toContain('<head><meta name="robots" content="noindex">');
		expect(out).not.toContain("Session Export");
	});
});

describe("scanSecrets", () => {
	test("counts distinct credential-shaped strings by kind", () => {
		const key = "ghp_" + "a".repeat(36);
		const found = scanSecrets(key + " " + key + " AKIA" + "ABCDEFGHIJKLMNOP" + " sk-ant-" + "x".repeat(30));
		expect(found).toEqual([{ kind: "Anthropic key", count: 1 }, { kind: "GitHub token", count: 1 }, { kind: "AWS access key", count: 1 }]);
	});
	test("finds nothing in ordinary text", () => {
		expect(scanSecrets("the skill-based task-runner uses sk-learn")).toEqual([]);
	});
});
