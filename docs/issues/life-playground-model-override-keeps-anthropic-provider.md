---
stage: "done"
assignee: "agent"
author: "session:pi_013ffa77-2bac-42a6-aa89-021ef57d97f2"
---
While driving [[projects/mlegls-pi/issues/named-agent-runtime]], `bun scripts/life-playground.ts start /tmp/pi-life-fqJX9c two --no-life-env --model agent/pi-life-fqJX9c --mode json -p 'State your name'` warned `Model "agent/pi-life-fqJX9c" not found for provider "anthropic". Using custom model id.` and sent the literal model to Anthropic, which returned 404. The command exited zero despite the provider error.

Workaround observed: add `--provider agent --model pi-life-fqJX9c --no-session`; startup then attached and answered with the registered soul, private skill and note. The RPC set_model path also worked. This observation is about the playground invocation; direct pi CLI shorthand was not measured. The durable fixture guide owner is [[projects/mlegls-pi/issues/named-agent-first-use-in-terminal-and-bb]]. Evidence: [runtime encounter](../../docs/attachments/named-agent-runtime/index.md).

## Result

Fixed in review of named-agent-runtime (commit d99a4999): a caller-supplied --model or --provider replaces the playground default pair, so --model agent/<name> reaches the agent provider; re-driven, answers the soul signal.
