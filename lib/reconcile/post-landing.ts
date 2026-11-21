import type { ReviewedResult } from "./tracker-state";

const triggers = ["target-ci", "target-deploy", "target-publish", "target-mirror"] as const;
export const POST_LANDING = "post-landing checks";

export interface PostLandingCheck {
	id: string;
	story: string;
	trigger: typeof triggers[number] | "legacy";
	check: string;
	verdicts?: PostLandingVerdict[];
}
export interface PostLandingVerdict {
	outcome: "passed" | "failed";
	evidence: string;
	by: string;
	at: string;
}

/** A review can select gates from the ticket's contract; it cannot turn an
 * ordinary review check into a target-triggered obligation by renaming it. */
export function selectPostLanding(handoff: Record<string, unknown>, declared: unknown): PostLandingCheck[] | string {
	const stories = handoff.stories as { story: string; outcome: string }[];
	const missing = new Set(stories.filter(story => story.outcome === "unobservable").map(story => story.story));
	if (!missing.size || stories.some(story => story.outcome === "failed"))
		return "Post-landing gates cover unobservable stories only. Failed stories block landing.";
	if (!Array.isArray(declared) || !declared.length || !declared.every(gate => gate && typeof gate.id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(gate.id)
		&& typeof gate.story === "string" && gate.story.trim() && triggers.includes(gate.trigger)
		&& typeof gate.check === "string" && gate.check.trim()) || new Set(declared.map(gate => gate.id)).size !== declared.length)
		return "An open ticket needs valid declared `post-landing` gates for work triggered only by the target (CI, deploy, publication or mirror). Checks possible in the review checkout belong in review.";
	const gates = (declared as PostLandingCheck[]).filter(gate => missing.has(gate.story));
	const selected = handoff.postLanding;
	if (!Array.isArray(selected) || !gates.length || selected.length !== gates.length || !gates.every(gate => selected.includes(gate.id))
		|| [...missing].some(story => !gates.some(gate => gate.story === story)))
		return "List exactly the declared gate IDs covering every unobservable story in `postLanding`. Checks possible in the review checkout belong in review.";
	return gates.map(({ id, story, trigger, check }) => ({ id, story, trigger, check }));
}

/** Already accepted by an older reconciler, but still awaiting target close. */
export function adoptLegacyPostLanding(result: ReviewedResult): ReviewedResult {
	const checks = result.handoff.postLanding;
	if (result.postLanding || !Array.isArray(checks) || !checks.length
		|| !checks.every((check): check is string => typeof check === "string" && !!check.trim())) return result;
	const unique = [...new Set(checks.map(check => check.trim()))];
	const pending = "\n\n**Pending post-landing checks**\n\n" + unique.map(check => "- " + check.replace(/\r?\n/g, "\n  ")).join("\n");
	if (!result.summary.endsWith(pending)) return result;
	return { ...result, summary: result.summary.slice(0, -pending.length),
		postLanding: unique.map((check, i) => ({
			id: "legacy-" + (i + 1), trigger: "legacy", check, story: "Previously deferred review",
		})),
	};
}

export const outstandingChecks = (result: ReviewedResult) =>
	(result.postLanding ?? []).filter(gate => gate.verdicts?.at(-1)?.outcome !== "passed");

export function postLandingSummary(gates: PostLandingCheck[]): string {
	return gates.map(gate => {
		const verdicts = gate.verdicts ?? [];
		return `- ${gate.id} (${gate.trigger}; ${verdicts.at(-1)?.outcome ?? "pending"}): ${gate.check.replace(/\r?\n/g, "\n  ")}` +
			verdicts.map(v => `\n  - ${v.outcome} by @thread:${v.by} at ${v.at}: ${v.evidence.replace(/\r?\n/g, "\n    ")}`).join("");
	}).join("\n");
}
