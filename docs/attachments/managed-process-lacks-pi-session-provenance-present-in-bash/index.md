# Managed process session provenance — first use

## Prediction before first use

In a fresh Pi session, print `$PI_SESSION_ID` through `bash`, then start the same command through `process` and wait for its output. I expect both results to contain the same nonempty ID without supplying a literal. That is the value a managed tracker command would expand in its author argument; the tracker itself is not needed for this check.

## Drive

Ran the Pi CLI recipe in [the setup handoff](implementation.md) against pi-processes `f133d8fc77d85c29e935aad243ec4769a4753eda`. The checkout already had its dependencies. A fresh ephemeral Pi with the candidate extension and existing model login returned results from all three tool calls. No servers or tracker writes were needed.

The first run printed matching values with a trailing period: Pi copied sentence punctuation into both shell commands. For the replay, in the handoff prompt replace `First call bash with command:` with `First call bash with the exact command between BEGIN and END (exclude delimiters and add no punctuation): BEGIN` and put ` END` immediately before the period following `"$PI_SESSION_ID"`. The other steps are unchanged.

## Outcome and replay check

**Held.** With the delimited prompt, `bash` printed a nonempty `PI_SESSION_ID`; `process start` ran the same `printf` and `process wait` showed exit success and the identical UUID (`01a1ff32-9c0a-740b-aca9-af85742ef50f`). Compare the two tool results directly; accept identical nonempty IDs, with only the shell expansion in each command and no appended punctuation. Both CLI runs exited and left no service running.

## Review

The setup handoff now uses the delimited prompt from the successful replay verbatim. In pi-processes `f133d8fc`, each start reads the ID from its calling session and overrides only that key in the spawned shell’s environment. Review reran all five affected test files: 130 passed. The loaded pi-processes checkout still needs the code commit; landing the evidence alone leaves the old behavior in place.
