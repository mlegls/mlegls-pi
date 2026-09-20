# Introduce and advance

Prepare the next parent session rather than asking the parent to spend its opening turn choosing work. Introduce starts from intent; advance starts from recorded scope.

## Use

Reload exec once after installation (`/exec-reset`), then invoke the introduce or advance skill, or call the library:

```ts
state.preparing = introduce.run("Make the deployment workflow less fragile");
notify(state.preparing.then(() => "Session preparation is ready"), "introduce");
// Or: advance.run("deployment"), advance.run() for the current project tracker.
```

After the completion notification:

```ts
state.prepared = await state.preparing;
await show.raw(state.prepared.text);
```

Use the carrying skill or stance and start with the returned first action. The prose assignment includes an objective, workflow, why-now, stopping condition and working context. It may assign concrete work, frame specific user decisions, or explain that nothing is actionable. Suggestions never block continuation or change the parent model. `suggestion`, when present, is optional user/harness advice, deliberately excluded from `text`.

Outside exec, import `run` from `lib/introduce.ts` or `lib/advance.ts`, passing `{ reader: { sessionFile, cwd } }`. The session file is explicit; there is no newest-session guessing.

## Pipeline and policy

1. Autoread broadly within scope, including current intent, tracker state, code, relevant skill instructions and constraints.
2. Jev distinguishes easy selection from knotty selection. Difficulty of implementation is a different question.
3. Easy: the candidate model submits up to five prose directives through the typed `submit_candidates` tool (not JSON in its response); Jev picks one, then independently scores chunks of the broad reading. Relevant context is assembled losslessly. If candidates cannot be constructed or selected without new planning, take the triage path.
4. Hard: route a reasoning model for `session-triage`. Its free-text answer is returned verbatim, with unresolved human questions as the session task. There is no schema, response parser, subsequent Jev approval, or context filtering.

Follow-up readers fork the broad reader with compaction disabled, retaining its evidence rather than repeating parent orientation. They have autoread's read-only tool surface, plus a terminating submission tool for the candidate stage; no claims, edits or worker launches occur. Execution and authorized dispatch belong to the parent.

- [workflows.md](../workflows.md): editable intent, selection and handoff policy, read each invocation.
- [workflows.json](../workflows.json): fixed `autoread` and `session-candidates` model/effort defaults.
- [routing.md](../routing.md): model preferences, including reasoning triage and implementation/supervision roles.

Options: `reader` passes autoread's options; `candidates` and `triage` override their model/effort; `routing` passes router options; `policyPath` overrides workflow policy. `contextThreshold` defaults to 0.2 (favor retaining potentially relevant material). This is not a calibrated confidence threshold on selecting work. Routing/selection failures reject; context scoring failure keeps the full briefing and records a warning. Empty context selection also keeps the full briefing. No automatic retry.

`audit` retains every full reader answer, candidate tool submission and session path, the difficulty and candidate-choice distributions, context scores and warnings. Omitted context is recoverable via `audit.reads[0].text`. The retained audit is not part of the parent-facing directive. Read timeouts apply per reader call; retain the whole preparation promise rather than using exec's default 30-second deadline.

## Verification

Drive both an already-scoped ticket and an ambiguous new request. The former should yield a concrete assignment without redundant orientation; the latter should yield a resolved task or specific discussion questions, not a model-switch prerequisite. Check that preparation leaves the project and source session unchanged. These examples verify the mechanism, not calibrated decision quality across projects.

Observed checks and limits: [2026-09-20 verification](research/session-preparation-2026-09-20.md).
