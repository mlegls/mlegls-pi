# dsh skim/run_code first-use verification

Tested revision: `e6d4f7a` (`dsh-skim-run-code-results-verify`).

## Setup and entry point

- Required environment: live headless DeepSeek PTC turn, using `deepseek-official` / `deepseek-flash` and the launching environment's `DEEPSEEK_API_KEY` (present; value not recorded).
- Prepared target: local headless dsh process in this checkout; isolated state at ignored `dsh/.local/headless-home`. No remote deployment or destructive seed. Persona: the default headless agent; provider API-key auth.
- `bun run --cwd dsh setup` completed: frozen install and plugin build succeeded.
- Entry point: `dsh --profile headless --patch "$PWD/dsh/cordis.skim-headless.yml" --patch "$PWD/dsh/provider.deepseek.yml" --json '<prompt>'`, with `PATH="$PWD/dsh/node_modules/.bin:$PATH"`, `DSH_HOME="$PWD/dsh/.local/headless-home"`, and `DSH_TOOLS_MODE=ptc`.
- Observed readiness: live session `session-c9f585ff-6b40-4244-a5f0-8ece9243701b` completed successfully. dsh warned the inherited `all_proxy` SOCKS scheme is unsupported and connected directly. No external process remains.

## Story: oversized run_code result is skimmed and recoverable

Action: prompted the live agent to print marker `SKIM_TRIAL_20260927` plus 12,000 `x` characters. The result exceeded the 4,096-byte budget and returned locator `ing-ab20b16e1d43197b`. A subsequent PTC program called `tools.pull({id})`; observed text length 12,100, marker at the start, and the complete 12,000-character payload in the result. **Outcome: held.**

## Story: explicit skim works inside a program

Action: in a PTC program, called `tools.skim({text: "y".repeat(7000), focus: "count and content"})`. It returned a 196-character omission containing locator `ing-3e67d7968cf5a681`. `tools.pull({id})` returned exactly 7,000 `y` characters. **Outcome: held.** This input exercised the explicit API and locator round-trip; the output was an omission placeholder, not a semantic summary, so this encounter does not establish quality of semantic filtering.

## Evidence and limits

This is a backend/library journey; no UI was rendered, so no screenshots. Live evidence was observed in the headless dsh JSON stream. The agent made one intermediate malformed PTC program (syntax error), corrected it, then completed the pull checks. Locators are scoped to the live agent; restart recovery was not tested. The encounter verified the exact large-result fallback and explicit skim retention/recall behavior, not broader filtering quality.
