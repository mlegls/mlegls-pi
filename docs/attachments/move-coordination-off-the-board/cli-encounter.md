# CLI discovery continuation

After writing predictions, invoked `bun lib/reconcile/main.ts --help` from the worker checkout. Observed exit 1, `ERR_PARSE_ARGS_UNKNOWN_OPTION`, internal stack trace. Invoking `bun lib/reconcile/main.ts` instead prints start/run/stop/status/resolve/constrain syntax and exits 2. The documented CLI surface is reachable; no operation was started. Friction recorded globally as [[projects/mlegls-pi/issues/reconcile-cli-help-rejects-help]].

Readiness does not yet establish a safe live-run seed. The open setup question is not a claim of failed bb delivery.
