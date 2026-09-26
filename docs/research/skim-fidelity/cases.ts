// Fixed before live judgments. Synthetic boundary cases, not a workload sample.
export const cases = [
  {
    id: "filing-condition",
    task: "Concept is a vault project. Where should I record newly encountered friction?",
    answer: "File a tracker issue, not docs/frictions.md.",
    evidence: ["issues in a vault project (`tracker`), one-liners in `docs/frictions.md` otherwise"],
    text: `# Project documentation

Record decisions near the code they govern. Keep durable observations in the project rather than only in a worker's final response. A report should distinguish reproduced defects from suspicions and should link any existing owner before creating a duplicate.

frictions - Ousterhout symptoms or deferred costs, recorded for later triage. issues in a vault project (\`tracker\`), one-liners in \`docs/frictions.md\` otherwise.

The person encountering the friction owns filing it. Parent consolidation can reconcile duplicates, but it is not a substitute for a durable record. Include the command, observed result and the limits of the investigation.\n`,
  },
  {
    id: "permission-exception",
    task: "A disposable fixture is gone but an unrelated server still listens on its port. May I kill that server?",
    answer: "No. Port occupancy does not establish ownership; only owned fixtures may be stopped.",
    evidence: ["Do not stop an existing server unless this investigation created it.", "A matching port is not proof of ownership."],
    text: `# Process cleanup

Do not stop an existing server unless this investigation created it. A matching port is not proof of ownership. Track fixture process groups when they are created and retain that record through cleanup. If the original fixture has exited and a new process occupies the same port, leave the new process alone.

A probe may launch a disposable backend with fake credentials and a temporary home directory. Wait for readiness before sending signals. Record the target signal and whether it was sent to a leader or to a whole group. Afterwards check both HTTP reachability and surviving descendants. A failed readiness check is not evidence that the production launcher leaked a process.\n`,
  },
  {
    id: "evidence-scope",
    task: "Can we report that SIGTERM cleanup was verified for real terminal shutdown on Windows?",
    answer: "No. Only handler checks and a macOS disposable-process probe passed; those other boundaries were not tested.",
    evidence: ["No Windows run or terminal-close test was performed.", "A passing handler unit test does not establish process-tree cleanup."],
    text: `# Shutdown evidence

Six handler regressions passed. The baseline source made five fail. Typechecking and scoped formatting checks also passed. No Windows run or terminal-close test was performed. A passing handler unit test does not establish process-tree cleanup.

A separate macOS probe used a disposable backend and a detached web command. Patched SIGTERM stopped the owned descendants, while the reversed baseline left listeners alive. Both SIGINT and SIGTERM returned exit code 1 in the patched run. That establishes cleanup at this process boundary, not normalized exit codes, full application behavior or support for uncatchable signals. Already-running CLI processes do not acquire an installed dependency patch.\n`,
  },
  {
    id: "numeric-boundary",
    task: "The configured port is 65536. Is it valid, and may a failed config lookup fall back to the inherited URL?",
    answer: "Invalid; accepted ports are integers 1 through 65535. No inherited fallback.",
    evidence: ["1 <= port && port <= 65535", "Never fall back to an inherited URL"],
    text: `# Local target validation

Accept the cloud port only when Number.isInteger(port) && 1 <= port && port <= 65535. Read the admin key and port together from the config beside the script. Never fall back to an inherited URL when the config is missing, malformed or incomplete. Fail before invoking the destructive import.

Loopback addresses can refer to other checkouts on the same machine. Checking that a hostname is localhost does not identify the owner. The import command must run from the checkout which supplied the config, independently of the caller's working directory. Clear both deployment-key aliases so a command-line client cannot silently select a different target. Tests should intercept selection without executing an import.\n`,
  },
  {
    id: "status-table",
    task: "Which deployments may I migrate now? Return the exact names; pending approval means do not migrate.",
    answer: "Only atlas-dev.",
    evidence: ["| atlas-dev | approved | local |", "| atlas-prod | pending | cloud |", "| atlas-staging | denied | cloud |"],
    text: `# Migration inventory

| Deployment | Approval | Location |
| --- | --- | --- |
| atlas-dev | approved | local |
| atlas-prod | pending | cloud |
| atlas-staging | denied | cloud |

Approval is per deployment, not per project. A local environment still requires approval before migration. A pending row is not approved, and similar names do not confer the same permission. Before execution, compare the selected target with this inventory and record the exact name. This inventory describes the current migration window only. Historical success receipts and general access to the account do not authorize a new migration. Do not expand this operation to additional deployments just because they share a schema.\n`,
  },
  {
    id: "ordering",
    task: "The child passed tests before rebase. Can I fast-forward the owner and close the ticket afterwards?",
    answer: "No. Rebase, test and commit closure on the child first, then fast-forward; persist completion before retiring resources.",
    evidence: ["Rebase the child before running final tests.", "Commit ticket closure on the child before fast-forwarding the owner.", "Persist completion before retiring the worktree."],
    text: `# Supervision completion

Rebase the child before running final tests. Commit ticket closure on the child before fast-forwarding the owner. Persist completion before retiring the worktree. Tests on the old base do not certify the rebased result, and an owner's successful fast-forward is not proof that closure was included.

If preparation fails, keep the owner unchanged and preserve the child's resources for inspection. A missing worktree is an exception to investigate, not permission to mark the task completed. Integration locking coordinates this daemon's operations only; it does not prevent external writers from updating the same branch. Inspect incoming changes and retry without force. Cleanup must not delete the only remaining record of a successful integration.\n`,
  },
  {
    id: "temporal-causality",
    task: "Did the reported 09:46 network interruption cause the failures at 06:23 and 06:52?",
    answer: "Not established; those failures preceded the reported interruption and lack stacks.",
    evidence: ["06:23", "06:52", "09:46", "The retained records contain no stack"],
    text: `# Transport timeline

06:23 UTC: job A records DaemonConnectionError: Connection ended.
06:52 UTC: job B records DaemonConnectionError: Connection ended.
09:46 UTC: the user reports a network interruption.

The retained records contain no stack identifying which socket operation failed or why the connection closed. The later interruption cannot automatically explain already-recorded failures. Nearby EPIPE output establishes another observed error, not a common cause. Owner-notification failures are a separate path: an attempt to notify a busy owner could fail again while reporting a child-loop exception. A repeated owner ID in reports about different children does not show that every child already had an active run.\n`,
  },
  {
    id: "code-branch",
    task: "Given the code below, does a workmux command failure return closed, and when is closed returned?",
    answer: "Command failure throws; closed requires a successfully read list without an open matching target.",
    evidence: ["if (!result.ok) throw new Error(\"workmux unavailable\");", "return target?.is_open ? \"pending\" : \"closed\";"],
    text: `# Target inspection

This function distinguishes unavailable evidence from evidence that a target is closed. Its caller retries errors independently for each worker. A failed command must not become an empty successful list, because that would incorrectly declare every target dead. The return values describe the target, not whether an agent has registered a status record.

async function inspectTarget(name: string) {
  const result = await readWorkmuxList();
  if (!result.ok) throw new Error("workmux unavailable");
  const target = result.targets.find(row => row.name === name);
  return target?.is_open ? "pending" : "closed";
}

An open target without agent status stays pending. Status registration can lag target creation, and a shell target may never register an agent.\n`,
  },
];
