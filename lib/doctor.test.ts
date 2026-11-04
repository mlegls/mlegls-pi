import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnose } from "./doctor.ts";

function host(infisicalNames: string[], prompts?: string) {
	const home = mkdtempSync(join(tmpdir(), "doctor-"));
	const settings = join(home, "settings.json");
	writeFileSync(settings, "{}");
	return diagnose({
		home, settings, which: () => true,
		run: async command => command[0] === "bb"
			? { ok: true, stdout: JSON.stringify({ variables: [], inheritedVariables: [] }) }
			: { ok: command[0] === "gh", stdout: "" },
		infisical: async () => new Set(infisicalNames),
		prompts,
	});
}

test("an agent prompt not re-rendered after its source changed is a gap", async () => {
	const prompts = mkdtempSync(join(tmpdir(), "prompts-"));
	mkdirSync(join(prompts, "generated/pi"), { recursive: true });
	writeFileSync(join(prompts, "universal.md"), "new\n");
	writeFileSync(join(prompts, "pi.md"), "pi\n");
	writeFileSync(join(prompts, "generated/pi/APPEND_SYSTEM.md"), "old\n\npi\n");
	expect((await host(["SENTRY_AUTH_TOKEN"], prompts)).map(g => g.name)).toEqual(["pi/APPEND_SYSTEM.md"]);
	writeFileSync(join(prompts, "generated/pi/APPEND_SYSTEM.md"), "new\n\npi\n");
	expect(await host(["SENTRY_AUTH_TOKEN"], prompts)).toEqual([]);
});

test("a credential held in Infisical closes the gap", async () => {
	expect(await host(["SENTRY_AUTH_TOKEN"])).toEqual([]);
});

test("a credential missing everywhere names Infisical as a remedy", async () => {
	const gaps = await host([]);
	expect(gaps.map(g => g.name)).toEqual(["SENTRY_AUTH_TOKEN"]);
	expect(gaps[0]?.remedy).toContain("Infisical (secret-management prod/concept)");
});
