# Named agent join

Joined code: `90ea92361541ab49ba1a41a752a64ddc380b574e`, 2026-11-12. The runtime, fixture encounter and Concept Engineering setup are present together. No further runtime change was needed. The package README now names the extension, registry, startup selector and attachment behavior, with a link to the runnable guide.

## First use on the joined checkout

Prepared an owned disposable registry with `bun scripts/life-playground.ts prepare-agent`, returning `/tmp/pi-life-Kew5Bi`, life `/pi-life-Kew5Bi`. Its project settings disable notes and register only its own fixture; machine settings are unchanged. Authentication: existing installed pi Anthropic credential; fixture route: `anthropic/claude-haiku-4-5:off`.

Opened the named-agent surface directly:

```sh
bun scripts/life-playground.ts start /tmp/pi-life-Kew5Bi one --model agent/pi-life-Kew5Bi -p 'In one short reply state your name, fixture signal, private skill name and whether note is available. Do not call tools.'
```

The process exited zero after five seconds and answered:

> pi-life-Kew5Bi, copper telescope, fixture-signal, yes.

This is a startup smoke encounter. The independent prompt/tool, isolation, attachment, concurrent-present and BB checks are in the packets below. The process exited, saved fixture trust was removed with `untrust`, and the disposable directory was removed. No resident server, browser, tunnel or container was started.

## Joined acceptance and setup

- [Runtime CLI/RPC and serialized-prompt review](../named-agent-runtime/index.md): soul-first prompt, lesson section, private skills reloaded on each run, notes despite disabled settings, session opt-out, attach/off and model-selection behavior. Existing affected regressions passed in that review (78 tests).
- [Two-terminal and BB encounter](../named-agent-first-use-in-terminal-and-bb/index.md), including [independent drive](../named-agent-first-use-in-terminal-and-bb/drive-6.md): two sessions, shared skill edits, present, model changes, resume/fork, ordinary stance isolation, real BB post-start selection and model catalog.
- [Real Concept Engineering setup and independent encounter](../concept-engineering-named-agent-setup/index.md): copied soul and engineering-taste skill, seven global notes, imported Hermes history with drained summaries and provenance-preserving recall, enabled BB Sunday automation and retained paused Hermes job.

Concept main contains setup commit `76a71eb1ea50cd92618673b857676c9a810be2e1`; system-config contains local registry commit `e35f76e25cc7b93e7f5efe8e94f008911002f7a5`. Both remain ancestors of their respective current checkouts at this join. The Concept setup packet records their landing states and live target selectors.

For independent fixture use, prepare a fresh root from the [guide](../../../extensions/context/life/README.md#named-agent-first-use), then run `bun scripts/life-playground.ts start <root> one --model agent/<fixture>`. The real Beelink entry point is `pi --model agent/concept-engineering` from any checkout, or the Concept BB spawn command in its setup packet. The week-long trial and founder judgment remain with Concept Strategy in the trial issue.

No tests were added or changed. This join changes documentation only; `git diff --check` passed. Full integration checks remain the integration gate.

Visual: false; shots: [].
