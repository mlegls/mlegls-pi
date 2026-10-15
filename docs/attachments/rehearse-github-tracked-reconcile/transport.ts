// Observational gh proxy. Delegation is unchanged except the explicitly armed lost-response cut.
import { appendFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const input = args.includes("-") ? readFileSync(0, "utf8") : undefined;
let payload: any = {};
try { payload = JSON.parse(input ?? "{}"); } catch {}
const query = payload.query ?? args.find(a => /^(query|mutation) /.test(a)) ?? "";
const operation = query.match(/(?:query|mutation)\s+(\w+)/)?.[1]
  ?? (args.includes("graphql") ? "PRGraphQL" : "REST");
const field = query.match(/\{\s*(\w+)\s*\(input:/)?.[1];
const started = new Date().toISOString();
// Counts only: certify every required end-page union without recording contracts.
function connectionPage(data: any) {
  const repo = data?.data?.repository;
  const checks: { locator: string; total: number; unique: number; complete: boolean }[] = [];
  const union = (object: any, field: string, locator: string) => {
    const first = object?.[field + "First"], last = object?.[field + "Last"];
    const nodes = new Map<string, any>();
    for (const node of [...(first?.nodes ?? []), ...(last?.nodes ?? [])]) if (node?.id) nodes.set(node.id, node);
    const total = first?.totalCount ?? -1, more = total > 100;
    checks.push({ locator, total, unique: nodes.size, complete: total >= 0 && total === last?.totalCount && nodes.size === total
      && first?.nodes?.length === Math.min(total,100) && last?.nodes?.length === Math.min(total,100)
      && first?.pageInfo?.hasPreviousPage === false && first?.pageInfo?.hasNextPage === more
      && last?.pageInfo?.hasNextPage === false && last?.pageInfo?.hasPreviousPage === more });
    return [...nodes.values()];
  };
  const issues = union(repo, "issues", "repository.issues");
  union(repo, "labels", "repository.labels");
  for (const issue of issues) for (const field of ["subIssues", "blockedBy", "labels", "assignees", "comments"])
    union(issue, field, "#" + issue.number + "." + field);
  return { kind: "issues", issueCount: issues.length, totalCount: repo?.issuesFirst?.totalCount, more: false,
    ids: issues.map(n => n.id), connections: { checked: checks.length, complete: checks.filter(c => c.complete).length,
      incomplete: checks.filter(c => !c.complete) } };
}
const result = spawnSync(process.env.REHEARSAL_GH!, args, { input, encoding: "utf8", maxBuffer: 64 << 20 });
let data: any;
try { data = JSON.parse(result.stdout ?? "{}"); } catch {}
appendFileSync(process.env.REHEARSAL_CALLS!, JSON.stringify({ at: started, pid: process.pid, ppid: process.ppid,
  operation, kind: query.trimStart().startsWith("mutation") ? "mutation" : query ? "query" : "rest",
  ...(query ? {} : { method: args.includes("--method") ? args[args.indexOf("--method")+1] : "GET",
    endpoint: args.find(a=>a.startsWith("repos/")) }),
  ...(field ? { field } : {}), status: result.status,
  ...(/^Tracker(Snapshot|Issues|Labels|Connection)$/.test(operation) ? connectionPage(data) : {}),
  ...(field === "addComment" ? { subject: payload.variables?.input?.subjectId } : {}),
  ...(field === "closeIssue" ? { subject: payload.variables?.input?.issueId, reason: payload.variables?.input?.stateReason } : {}),
}) + "\n");
if (result.status === 0 && operation === "TrackerCreate" && existsSync(process.env.REHEARSAL_LOSS!)) {
  unlinkSync(process.env.REHEARSAL_LOSS!);
  appendFileSync(process.env.REHEARSAL_CALLS!, JSON.stringify({ at: new Date().toISOString(), operation: "DeliberateLostCreateResponse",
    number: data?.data?.createIssue?.issue?.number }) + "\n");
  process.stderr.write("deliberate lost successful create response (native publication already succeeded)\n");
  process.exit(70);
}
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
