# Independent drive predictions

- Recovery: the saved title encounters the occupied path. After the path is moved aside, the same title starts with `workerHead` exactly equal to `integrated` and distinct from `enclosing`. Its Git tree contains `direct.txt` and `joined.txt`, and `landingBranch` remains `collector`.
- Fresh join: with no interrupted attempt, the join starts on the same kind of integrated node head and sees both deliveries. Its landing branch is still `collector`.

## Review replay

Recovery hit the expected collision but timed out waiting for the worker on the first run. With the fixture's wait ceiling raised from 15 to 90 seconds, recovery and fresh completed in 12 seconds combined. The worker HEAD exactly matched the integrated HEAD (`5090c69d` recovered, `aef0f504` fresh). Both trees contained `direct.txt` and `joined.txt`; both workers targeted `collector`. The existing launch-recovery and resume checks also passed (4/4).
