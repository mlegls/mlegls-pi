import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const endpoint = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
export interface ResetCredit { id: string; expiresAt: number }
export interface CodexAuth { accountId: string; headers: Record<string, string> }

export function codexAuth(): CodexAuth | undefined {
	try {
		const { tokens } = JSON.parse(readFileSync(join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"), "utf8"));
		if (typeof tokens?.access_token !== "string" || !tokens.access_token || typeof tokens.account_id !== "string" || !tokens.account_id) return;
		return { accountId: tokens.account_id, headers: { authorization: "Bearer " + tokens.access_token, "chatgpt-account-id": tokens.account_id } };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("allocation: could not read Codex auth");
	}
}

async function request(auth: CodexAuth, body?: object) {
	const response = await fetch(endpoint + (body ? "/consume" : ""), {
		method: body ? "POST" : "GET", headers: { ...auth.headers, ...(body && { "content-type": "application/json" }) },
		body: body && JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(body ? 10_000 : 5_000),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

export async function resetCredits(auth: CodexAuth): Promise<ResetCredit[]> {
	try {
		const { credits } = await request(auth);
		return credits.flatMap((c: { id: string; status: string; reset_type: string; expires_at: string | null }) => {
			if (c.status !== "available" || c.reset_type !== "codex_rate_limits" || !c.id) return [];
			const expiresAt = c.expires_at === null ? Infinity : Date.parse(c.expires_at);
			return expiresAt > Date.now() ? [{ id: c.id, expiresAt }] : [];
		});
	} catch (error) {
		console.error("allocation: Codex reset credits unreadable: " + (error as Error).message);
		return [];
	}
}

export interface ResetWindow { id: string; resetsAt: number; refreshedAt: number }
const stateDir = () => join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "mlegls-pi", "codex-resets");

// One deterministic request ID per account and window, shared between hosts using the same login.
function requestId(auth: CodexAuth, w: ResetWindow) {
	const bytes = createHash("sha256").update(JSON.stringify(["codex-window-reset", auth.accountId, w.id, w.resetsAt])).digest();
	bytes[6] = (bytes[6]! & 0x0f) | 0x80; // UUIDv8
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	const hex = bytes.toString("hex", 0, 16);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function notify(title: string, body: string) {
	console.error(`allocation: ${title}: ${body}`);
	return new Promise<void>(resolve => execFile(process.env.BB_CLI || "bb", ["push-notifications", "send", "--title", title, "--body", body], { timeout: 5_000 }, error => {
		if (error) console.error("allocation: BB reset notification failed");
		resolve();
	}));
}

/** Claim every exhausted window before spending: a reset can clear several at once. quota-axi can
 *  reuse the pre-reset snapshot for a minute, so keep the result alongside the window identity. */
export async function redeemReset(auth: CodexAuth, exhausted: ResetWindow[], credit?: ResetCredit): Promise<"reset" | "recent" | false> {
	const ids = exhausted.map(w => requestId(auth, w));
	const files = ids.map(id => join(stateDir(), id));
	const claimed: string[] = [];
	const attempt = { creditId: credit?.id, attemptedAt: Date.now(), windows: exhausted.map(({ id, resetsAt }) => ({ id, resetsAt })) };
	try {
		if (files.length && files.every((file, i) => {
			try { return JSON.parse(readFileSync(file, "utf8")).redeemedAt > exhausted[i].refreshedAt; }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; return false; }
		})) return "recent";
		if (!credit || !files.length) return false;
		mkdirSync(stateDir(), { recursive: true });
		for (const file of files) {
			writeFileSync(file, JSON.stringify(attempt), { flag: "wx", mode: 0o600 });
			claimed.push(file);
		}
	} catch (error) {
		for (const file of claimed) {
			try { rmSync(file, { force: true }); } catch {}
		}
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") console.error("allocation: could not record Codex reset attempt: " + (error as Error).message);
		return false;
	}

	let code: string, transient = false;
	try {
		// codex-rs/backend-client/src/client/rate_limit_resets.rs (account/rateLimitResetCredit/consume).
		({ code } = await request(auth, { redeem_request_id: ids[0], credit_id: credit.id }));
	} catch (error) {
		code = (error as Error).message;
		transient = !code.startsWith("HTTP 4") || code === "HTTP 429";
	}
	if (transient) {
		// No answer (network, timeout, 429, 5xx): release the claim so a later launch retries. The request ID is
		// the idempotency key, so a retry can't redeem a second credit for the same windows.
		for (const file of claimed) {
			try { rmSync(file, { force: true }); } catch {}
		}
		console.error("allocation: Codex reset request failed, will retry: " + code);
		return false;
	}
	const label = exhausted.map(w => `${w.id} (${new Date(w.resetsAt).toISOString()})`).join(", ");
	const result = JSON.stringify({ ...attempt, code, ...(code === "reset" && { redeemedAt: Date.now() }) });
	for (const file of claimed) {
		try {
			writeFileSync(file + ".new", result, { mode: 0o600 });
			renameSync(file + ".new", file);
		} catch { console.error("allocation: could not record Codex reset result"); }
	}
	if (code !== "reset") {
		await notify("Codex reset did not complete", `Credit ${credit.id} for ${label}: ${code ?? "unknown outcome"}.`);
		return false;
	}
	await notify("Redeemed a banked Codex reset", `Credit ${credit.id} reset ${label} for waiting delegated work.`);
	return "reset";
}
