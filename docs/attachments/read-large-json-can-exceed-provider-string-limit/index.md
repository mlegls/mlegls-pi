# Large JSON read: first-use drive

## Predictions before first use

- A single read of two source documents and three JSON receipts, including the 5,000-opening receipt, returns something useful for all five. The big receipt comes back as an outline or bounded excerpt instead of making the whole call fail.
- The large receipt's opening gates and identity should be discoverable without fetching the whole receipt. I expect the response to make clear which part is shown if it is incomplete.

## Setup

Candidate `7ec168b5`, in this worker's checkout. From its root, run `bun docs/attachments/read-large-json-can-exceed-provider-string-limit/try-read.ts`. The handoff says this drives the local codemode read tool with two source files and three synthetic receipts, including a 15.36 MB opening receipt. It uses an offline outline-provider stub, needs no credentials or server, and cleans up its generated files under `.wm`.

## Encounter

- Ran the entry point from the worktree root; it exited 0 in about one second. It reported an opening receipt of 15,358,930 bytes and two successful `read` calls (298 ms and 56 ms).
- The first call returned 50,958 characters. Its preview included the consumer text, the surface export, the import count, and the start of the opening receipt (`passed: true`, first `id: 0`, start of `original`). It ended that receipt with `[output capped; continue with opening.json:87-]`, then showed the metrics receipt. All five files were represented; the large file did not swallow the later file.
- The follow-up returned `opening.json (25005 lines) lines 87-89` and a `member` fingerprint excerpt.

## Expectations and friction

- **Met:** One mixed read returns useful content and bounds the large receipt. The result clearly labels the cap and gives a continuation offset.
- **Met:** The preview exposes the opening gate and first record identity; the follow-up exposes a member excerpt. The replay prints only the beginning and end of the first result, so this recording does not establish whether it contains complete fingerprints.
- No friction encountered in the replay. The provider was stubbed; elapsed time is for the local run only.

## Replay checks

1. Run the entry point above. Accept a successful mixed read with content from the two documents and three receipts, including metrics after the opening receipt, and a cap notice for the opening receipt.
2. Inspect the follow-up. Accept a successful result beginning where the notice directs, with the returned range labeled and member content visible. No live provider or rendered UI is needed.
