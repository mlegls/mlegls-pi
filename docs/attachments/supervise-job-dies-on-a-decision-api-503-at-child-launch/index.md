# First-use drive: Decision API outage during supervised launch

Tested revision: `276b103` (before this packet). Surface: `ab supervise start <ticket>` and `ab supervise status <ticket>` from the owning checkout. The implementer supplied no running deployment: local CLI workflow, owning Pi session, `JEV_API_KEY` or Cloudflare credentials, ready ticket without seed. Predictions below were written **before invoking the product**, from the ticket and the user-facing `README.md` / `ab supervise --help` only.

## Predictions before first use

1. **Transient 503 or network loss on child launch.** I expect a ready ticket's `ab supervise start` to retry a failed Decision API launch classification with backoff (or skip it if advisory), then advance the child without failing the entire job. I expect `status` to show forward progress or completion, not a dead job. Not yet checked.
2. **Persistent 5xx or network loss.** I expect the job to pause rather than end permanently, with one legible “Decision API unavailable” notice, and a subsequent `ab supervise start <ticket>` after recovery to resume. Not yet checked.
3. **402 credits exhausted.** I expect no retries, one “Decision API unavailable” report, and a resumable job when credits return. Not yet checked.
4. **Advisory residual lint.** If a child reaches a residual lint during a Decision API outage, I expect the lint to say unavailable without blocking its handoff or the supervision job. Not yet checked.

## Setup and encounter

Pending. No test data or API failure injection was specified by the setup handoff; distinguish actual transport observation from inferred behavior.

## Frictions, expectations and replayable checks

Pending first use.
