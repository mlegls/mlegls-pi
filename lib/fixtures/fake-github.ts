// A stateful fake of the slice of GitHub that lib/tracker-github*.ts uses, installed as a `gh` executable on PATH.
// Reads go through the committed fixture server (docs/attachments/read-github-tracker-snapshots/fake-gh.ts), which serves
// bounded first/last connections like GitHub; mutations edit the JSON state in <dir>/state.json. Faults are scripted in state.faults.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "../../docs/attachments/read-github-tracker-snapshots/fake-gh.ts";

type Row = Record<string, any>;
export interface FakeState {
	viewer: { id: string; login: string };
	repository: { id: string; nameWithOwner: string; url: string };
	labels: { id: string; name: string }[];
	/** Stored issues keep relation ids; connections are materialized per read. */
	issues: Row[];
	next: number;
	/** One entry per gh call: the GraphQL operation or mutation field, "rest <method> <path>", or "rate_limit". */
	calls: string[];
	faults: {
		/** Epoch ms: every call but rate_limit answers like an exhausted budget until then. */
		limitedUntil?: number;
		/** Mutation fields whose next success is applied but whose response is lost (gh exits 70). */
		lose?: string[];
	};
}

export const ROLES = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"];
export const label = (name: string) => ({ id: "L-" + name, name });
export const repository = { id: "R-local", nameWithOwner: "fixture/tracker", url: "https://github.com/fixture/tracker" };

export function issue(number: number, o: Row = {}): Row {
	return {
		id: "I-" + number, databaseId: 1000 + number, number, url: repository.url + "/issues/" + number, state: "OPEN", repository,
		title: "Contract " + number, body: "Body " + number + "\n", stateReason: null, author: { login: "author" }, parentId: null, blockerIds: [],
		labels: [label("ready-for-agent")], assignees: [], comments: [], ...o,
	};
}

export function newState(issues: Row[]): FakeState {
	return {
		viewer: { id: "U-viewer", login: "reader" }, repository,
		labels: [...ROLES.map(label), label("no-drive"), label("p1"), label("p2"), label("p3")], issues,
		next: Math.max(0, ...issues.map(i => i.number)) + 1, calls: [], faults: {},
	};
}

/** Puts a `gh` shim ahead of PATH. Returns the state accessors; restore() undoes the PATH change. */
export function installFakeGh(dir: string, state: FakeState) {
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "state.json");
	const write = (value: FakeState) => writeFileSync(file, JSON.stringify(value));
	write(state);
	writeFileSync(join(dir, "gh"), "#!/bin/sh\nFAKE_GH_STATE=" + JSON.stringify(file) + " exec bun " + JSON.stringify(import.meta.path) + ' "$@"\n');
	chmodSync(join(dir, "gh"), 0o755);
	const path = process.env.PATH;
	process.env.PATH = dir + ":" + path;
	return {
		read: () => JSON.parse(readFileSync(file, "utf8")) as FakeState,
		write,
		/** Calls since the last reset, optionally only those matching a name. */
		calls: (name?: string) => (JSON.parse(readFileSync(file, "utf8")) as FakeState).calls.filter(call => !name || call === name),
		restore: () => { process.env.PATH = path; },
	};
}

function materialize(state: FakeState) {
	const relation = (i: Row) => ({ id: i.id, databaseId: i.databaseId, number: i.number, url: i.url, state: i.state, repository: i.repository });
	const find = (id: string) => state.issues.find(i => i.id === id)!;
	const issues = state.issues.map(({ parentId, blockerIds, ...i }) => ({
		...i, parent: parentId ? relation(find(parentId)) : null,
		subIssues: state.issues.filter(child => child.parentId === i.id).map(relation), blockedBy: blockerIds.map((id: string) => relation(find(id))),
	}));
	return JSON.stringify({ data: { viewer: state.viewer, repository: { ...state.repository, labels: state.labels, issues } } });
}

function mutate(state: FakeState, field: string, input: Row): unknown {
	const find = (id: string) => state.issues.find(i => i.id === id) ?? (() => { throw new Error("no issue " + id); })();
	const users = (ids: string[]) => ids.map(id => ({ id, login: id === state.viewer.id ? state.viewer.login : id }));
	if (field === "createIssue") {
		const number = state.next++;
		const created = issue(number, {
			title: input.title, body: input.body, labels: (input.labelIds ?? []).map((id: string) => state.labels.find(l => l.id === id)),
			parentId: input.parentIssueId ?? null, assignees: users(input.assigneeIds ?? []), author: { login: state.viewer.login },
		});
		state.issues.push(created);
		return { issue: { number } };
	}
	if (field === "updateIssue") {
		const target = find(input.id);
		if (input.title !== undefined) target.title = input.title;
		if (input.body !== undefined) target.body = input.body;
		if (input.labelIds) target.labels = input.labelIds.map((id: string) => state.labels.find(l => l.id === id));
		if (input.assigneeIds) target.assignees = users(input.assigneeIds);
	} else if (field === "closeIssue") Object.assign(find(input.issueId), { state: "CLOSED", stateReason: input.stateReason });
	else if (field === "addComment") {
		const target = find(input.subjectId);
		target.comments.push({ id: "C-" + target.number + "-" + target.comments.length, body: input.body, createdAt: new Date(1_700_000_000_000 + target.comments.length * 1000).toISOString(),
			author: { login: state.viewer.login }, url: target.url + "#c" });
	} else if (field === "removeAssigneesFromAssignable") {
		const target = find(input.assignableId);
		target.assignees = target.assignees.filter((u: Row) => !input.assigneeIds.includes(u.id));
	} else throw new Error("fake gh: unsupported mutation " + field);
	return { clientMutationId: null };
}

function rest(state: FakeState, method: string, path: string, body: Row): void {
	const parts = path.replace(/^repos\/[^/]+\/[^/]+\//, "").split("/");
	const byNumber = (n: string) => state.issues.find(i => i.number === Number(n))!;
	const byDatabaseId = (id: number) => state.issues.find(i => i.databaseId === id)!;
	if (parts[0] === "issues" && parts[2] === "sub_issues" && method === "POST") byDatabaseId(body.sub_issue_id).parentId = byNumber(parts[1]!).id;
	else if (parts[0] === "issues" && parts[2] === "sub_issue" && method === "DELETE") byDatabaseId(body.sub_issue_id).parentId = null;
	else if (parts[0] === "issues" && parts[2] === "dependencies" && method === "POST") byNumber(parts[1]!).blockerIds.push(byDatabaseId(body.issue_id).id);
	else if (parts[0] === "issues" && parts[2] === "dependencies" && method === "DELETE") {
		const target = byNumber(parts[1]!); target.blockerIds = target.blockerIds.filter((id: string) => byDatabaseId(Number(parts[4])).id !== id);
	} else if (parts[0] !== "commits") throw new Error("fake gh: unsupported REST " + method + " " + path);
}

function main() {
	const file = process.env.FAKE_GH_STATE!;
	const state = JSON.parse(readFileSync(file, "utf8")) as FakeState;
	const args = process.argv.slice(2);
	const save = () => writeFileSync(file, JSON.stringify(state));
	const lose = (field: string) => { const at = state.faults.lose?.indexOf(field) ?? -1; if (at < 0) return; state.faults.lose!.splice(at, 1); save(); process.stderr.write("fake gh: connection reset\n"); process.exit(70); };
	const limited = state.faults.limitedUntil !== undefined && Date.now() < state.faults.limitedUntil;
	if (args.includes("rate_limit")) {
		state.calls.push("rate_limit"); save();
		const reset = Math.ceil((state.faults.limitedUntil ?? 0) / 1000);
		const resource = (exhausted: boolean) => ({ limit: 5000, remaining: exhausted && limited ? 0 : 4000, reset });
		process.stdout.write(JSON.stringify({ resources: { core: resource(true), graphql: resource(true) } }));
		return;
	}
	const input = args.includes("-") ? readFileSync(0, "utf8") : undefined;
	const payload = input ? JSON.parse(input) : {};
	const graphql = args.includes("graphql");
	const field = graphql ? payload.query.match(/mutation[^{]*\{\s*(\w+)\(input:/)?.[1] : undefined;
	const name = graphql ? field ?? payload.query.match(/query\s+(\w+)/)[1] : "rest " + args[args.indexOf("--method") + 1] + " " + args.at(-1 - (input ? 2 : 0));
	state.calls.push(name); save();
	if (limited) {
		if (graphql) process.stdout.write(JSON.stringify({ data: null, errors: [{ type: "RATE_LIMITED", message: "API rate limit already exceeded for user ID 1." }] }));
		else process.stdout.write(JSON.stringify({ message: "API rate limit exceeded for user ID 1." }));
		process.stderr.write("gh: API rate limit already exceeded for user ID 1." + (graphql ? "" : " (HTTP 403)") + "\n");
		process.exit(1);
	}
	if (!graphql) {
		const method = args[args.indexOf("--method") + 1]!;
		rest(state, method, args.find(arg => arg.startsWith("repos/"))!, payload);
		save(); process.stdout.write("{}");
		return;
	}
	if (field) {
		const result = mutate(state, field, payload.variables.input);
		save(); lose(field);
		process.stdout.write(JSON.stringify({ data: { [field]: result } }));
		return;
	}
	process.stdout.write(serve(payload, materialize(state)));
}
if (import.meta.main) main();
