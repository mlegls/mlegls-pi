import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnose } from "./doctor.ts";

function host(infisicalNames: string[]) {
	const home = mkdtempSync(join(tmpdir(), "doctor-"));
	const settings = join(home, "settings.json");
	writeFileSync(settings, "{}");
	return diagnose({
		home, settings, which: () => true,
		run: async command => command[0] === "bb"
			? { ok: true, stdout: JSON.stringify({ variables: [], inheritedVariables: [] }) }
			: { ok: command[0] === "gh", stdout: "" },
		infisical: async () => new Set(infisicalNames),
	});
}

test("a credential held in Infisical closes the gap", async () => {
	expect(await host(["SENTRY_AUTH_TOKEN"])).toEqual([]);
});

test("a credential missing everywhere names Infisical as a remedy", async () => {
	const gaps = await host([]);
	expect(gaps.map(g => g.name)).toEqual(["SENTRY_AUTH_TOKEN"]);
	expect(gaps[0]?.remedy).toContain("Infisical (secret-management prod/concept)");
});
