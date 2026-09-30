---
stage: done
author: session:2026-09-26T15-00-39-644Z_01a0de3b-8c5c-7535-8e04-baa96522996d
---

`ingressContext` keeps only the first 4,000 characters of the current command. A long heredoc followed by a read-back can lose the read-back operation while retaining the text being written. Both bash and exec use this context builder. The fidelity policy says read-backs should be verbatim, but the judge may not see that a read-back was requested.

Reproduced with the existing September 23 `design.md` specimen: the 4,439-character command ends with `ls -l design.md; sed -n '1,110p' design.md`; the recorded query stops inside the heredoc at character 4,000. Two current replays skim the introduction and atlas section. Supplying the full command, or adding an explicit verification focus, retains all five chunks verbatim in both runs. This is a bounded counterfactual for one specimen, not proof that truncation explains all read-back mistakes.

[Runnable local replay, distributions and scope](../research/skim-fidelity/README.md). Keep verification intent visible without indiscriminately forwarding arbitrarily large write payloads. No remedy was implemented in this audit. Related semantic damage remains owned by [[projects/mlegls-pi/issues/archive/skims-drop-the-conditions-in-instructions]].

## Resolution

`bcc484c` keeps both the command prefix and suffix within the same 4,000-character allowance, so trailing read-back operations reach the judge. A regression test covers a long write followed by a read. This fixes context construction, not the separate semantic-fidelity problem.
