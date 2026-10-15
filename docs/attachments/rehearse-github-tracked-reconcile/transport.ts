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
// What one tracker read page covered: kind, node count, the connection's totalCount, whether more follows, and issue node ids.
function connectionPage(data: any) {
  const repository = data?.data?.repository, node = data?.data?.node;
  const kind = repository?.issues ? "issues" : repository?.labels ? "labels" : "connection";
  const page = repository?.issues ?? repository?.labels ?? (node && Object.values(node)[0]) as any;
  return { kind, issueCount: page?.nodes?.length, totalCount: page?.totalCount, more: page?.pageInfo?.hasNextPage,
    ...(kind === "issues" ? { ids: page?.nodes?.map((n: any) => n.id) } : {}) };
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
