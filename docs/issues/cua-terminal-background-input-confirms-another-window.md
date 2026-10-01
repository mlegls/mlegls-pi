---
stage: idea
author: session:01a0f7e9-02ec-7596-8bda-36fd838eb7cc
---

During [[projects/mlegls-pi/issues/thread-commands-in-pi]] driving, cua-driver 0.30.4 background `type_text` and `press_key` addressed Terminal pid 59823/window 19087, but that window did not change. Both returned confirmed; another Terminal window (19073) was also open. Exact-window fresh snapshots showed the intended free session retained the same footer and blank composer. Repeating only after fresh readback, with `delivery_mode: foreground` and the same exact window, visibly started a new session and promoted it.

Owner: cua-driver. Observation does not prove where the initial input landed; its confirmation was insufficient to establish exact-window delivery. Workaround: foreground exact-window delivery followed by fresh state. [Encounter](../attachments/thread-commands-in-pi/drive.md).
