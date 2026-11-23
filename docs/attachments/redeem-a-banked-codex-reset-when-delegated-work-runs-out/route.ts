// Drive the registered stance router against an isolated quota account, WHAM and BB.
import type { ExtensionAPI, ExtensionContext, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { register } from "../../../extensions/stances/index";
import { workerExecution } from "../../../lib/worker-execution";

const root = mkdtempSync(join(tmpdir(), "codex-reset-drive-"));
const model = { provider: "openai", id: "fixture-model" };
const fallback = { provider: "zai", id: "fixture-fallback" };
const accountId = "fixture-account";
const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const credits = [
	{ id: "later", reset_type: "codex_rate_limits", status: "available", expires_at: future(48) },
	{ id: "earlier", reset_type: "codex_rate_limits", status: "available", expires_at: future(24) },
];
const requests: unknown[] = [];
const asFixture = new Set(credits.map(c => c.id));
const args = process.argv.slice(2);
const readings = args.filter(a => !a.startsWith("--"));
const native = args.includes("--native");

try {
	Object.assign(process.env, { CODEX_HOME: root, XDG_STATE_HOME: root, BB_CLI: join(root, "bb"), PATH: root + ":" + process.env.PATH,
		FIXTURE_QUOTA: join(root, "quota.json"), FIXTURE_PUSH: join(root, "push.log") });
	if (args.includes("--interactive")) { delete process.env.PI_WM_RUN; delete process.env.PI_WM_HANDLE; }
	else Object.assign(process.env, { PI_WM_RUN: "fixture", PI_WM_HANDLE: "worker" });
	writeFileSync(join(root, "auth.json"), JSON.stringify({ tokens: { access_token: "fixture-token", account_id: accountId } }));
	writeFileSync(join(root, "quota-axi"), '#!/bin/sh\nexec /bin/cat "$FIXTURE_QUOTA"\n', { mode: 0o755 });
	writeFileSync(join(root, "bb"), [
		"#!/bin/sh",
		"case \"$1 $2\" in",
		"  'provider list') echo '[{\"id\":\"codex\",\"available\":true}]' ;;",
		"  'provider models') echo '[{\"id\":\"fixture-model\"}]' ;;",
		"  'project list') echo '[]' ;;",
		"  'project create') echo '{\"id\":\"fixture-project\"}' ;;",
		"  'push-notifications send') printf '%s\\n' \"$*\" >> \"$FIXTURE_PUSH\" ;;",
		"  *) exit 1 ;;",
		"esac\n",
	].join("\n"), { mode: 0o755 });
	globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const headers = new Headers(init?.headers);
		const endpoint = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
		if (headers.get("chatgpt-account-id") !== accountId || headers.get("authorization") !== "Bearer fixture-token")
			throw new Error("Unexpected fixture account headers");
		if (url === endpoint && init?.method === "GET") {
			requests.push({ method: "GET", path: new URL(url).pathname });
			return Response.json({ credits: credits.filter(c => asFixture.has(c.id)) });
		}
		if (url === endpoint + "/consume" && init?.method === "POST") {
			const body = JSON.parse(String(init.body));
			requests.push({ method: "POST", path: new URL(url).pathname, body });
			return Response.json({ code: asFixture.delete(body.credit_id) ? "reset" : "no_credit" });
		}
		throw new Error("No fixture response for " + url);
	}, { preconnect() {} });
	const routes: Parameters<ExtensionAPI["registerVirtualModel"]>[0][] = [];
	register({ registerVirtualModel: route => routes.push(route) } as ExtensionAPI, "stance", [{ name: "fixture", list: [
		{ model: "openai/fixture-model", effort: "high" }, { model: "zai/fixture-fallback", effort: "high" },
	] }]);
	const ctx = { modelRegistry: { find: (provider: string) => provider === model.provider ? model : fallback, hasConfiguredAuth: () => true } } as unknown as ExtensionContext;
	const resetsAt = future(12);
	const refreshedAt = new Date().toISOString();
	console.log("ready: fixture Codex auth, quota-axi, WHAM and BB; external requests disabled");
	for (const reading of readings.length ? readings : ["1", "0", "0"]) {
		const remaining = Number(reading);
		if (!Number.isFinite(remaining) || remaining < 0 || remaining > 100) throw new Error("Pass remaining percentages from 0 to 100");
		writeFileSync(process.env.FIXTURE_QUOTA!, JSON.stringify({ providers: [{ provider: "codex", state: { stale: false, refreshedAt }, account: { accountId }, windows: [
			{ id: "weekly", kind: "weekly", percentRemaining: remaining, resetsAt, pace: { timeRemainingPercent: 50 } },
		] }] }));
		const route = native
			? (await workerExecution({ project: process.cwd(), agent: { name: "fixture", routing: "codex/fixture-model:high", body: "", roles: [] } })).providerId
			: (await routes[0].route({ reason: "user" } as ModelRouteRequest, ctx)).model.provider;
		console.log(JSON.stringify({ remaining, route, requests: requests.splice(0) }));
	}
	try { console.log(readFileSync(process.env.FIXTURE_PUSH!, "utf8").trim()); }
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
} finally {
	rmSync(root, { recursive: true, force: true });
}
