# Attention batch retries and load

The live Attention RPC took 8.94–11.05 s over three calls before the Tracker reload, and 2.43–3.95 s over three calls after (11 projects, six remote in both runs; seven items before, six after; no desk errors). Replay: time `bb plugin rpc call tracker attention --json` with the same set of hosts connected.

In the signed-in desktop app, a fresh visit showed “Loading attention…” and then the inbox. Switching to Issues and back displayed the retained inbox in about a second, including the navigation and browser automation wait. The network trace showed one Attention read per 15-second refresh after the initial load.

A disposable two-desk fixture exercised the reply service with a capturing BB sender. One owner had a decision on one desk and a credential request on the other. With the credential destination blocked, neither reply reached that owner; the other owner received theirs. Making the destination writable and retrying sent one message with both headings and the write notice. The credential went into the dotenv file and did not appear in the message. Resubmitting sent nothing. A stale item also held its sibling's reply. No messages were sent to real agents in this check.

Tracker changes: `2e3d542`, `5612c84` in `bb-plugins`. Plugin build, TypeScript check and live reload passed.
