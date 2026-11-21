# Worker commit hooks at integration

From the project checkout, run `bun docs/attachments/check-worker-rules-at-integration/integrate.ts`. Add `--hooks-path` to run the same journey with a worker-local `core.hooksPath` override instead of `--no-verify`. The script creates a throwaway local Git repository with a collector, a sparse worker checkout and a stand-in BB inbox. It deletes them when it exits; no service or credentials are needed.

In both runs, the bad commit was refused even though a later commit had fixed the final tree. The parent ref stayed put, the worker stayed on its branch, and the worker inbox received the hook's output. Rewriting the rejected commit let the branch land. A clean follow-on commit landed too.

The tracker directory was absent on disk in both worker checkouts. The tracker paths were still present in the Git tree: sparse checkout controls what is materialized, so a provider with Git or canonical-checkout access can still read the tracker.
