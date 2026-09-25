ab computer "INTENT" --url URL --until TEXT [--headed] [--input NAME=VALUE]...
ab computer "INTENT" --browser ./setup.ts --until TEXT [--input NAME=VALUE]...
ab computer "INTENT" --app NAME|--window PID:WINDOW_ID --until TEXT [--query Q]
ab computer --resume DRIVE [--input NAME=VALUE]... [--budget N]

Common: --budget N (20 actions), --timeout S (300 seconds), --json.

  browser  --url launches an isolated Chromium context using the current project's
           @playwright/test or playwright (1.63+). No desktop window or account is
           borrowed. The context closes when the drive ends. --headed shows it.
           For existing authentication/lifecycle, --browser loads a project module:
           default-export async ({signal}) => ({page, close, verify?}). See
           ~/dev/mlegls-pi/docs/computer.md. The module owns setup and cleanup.
  native   --app must resolve to exactly one on-screen window, otherwise provide
           --window PID:WINDOW_ID. Never guesses an app. Each target needs one writer.
  until    required visible end state, not a control naming the destination.
           An optional browser-module verify callback is authoritative.
  text     --input name=VALUE or quoted spans in INTENT are copied exactly. A bare
           URL or instruction to write a reply is not supplied text. Use --url to
           navigate, or provide the exact string as an input for a field.
  secrets  %name% in INTENT/--until plus --input name=VALUE: hidden from Jev and
           scrubbed from CLI traces/output, including UI echoes. Shell arguments
           are not secret storage; supply credentials through project setup when possible.

Jev selects actions; it does not write text, inspect screenshots, or continuously
watch for transient alerts. Use screenshots/event instrumentation for those checks.
Missing text stops with needs-input. A final snapshot cannot prove an alert never appeared.

Exits 0 on done, 1 on a stopped drive, 2 on setup/usage failure. Progress goes to
stderr; trace JSONL stays under the active ab state directory's computer/.
Native --resume takes fresh observations; inspect before continuing. Browser drives
cannot resume from a closed context: reattach through project setup, do not blindly
replay mutations. Verifiers, action gates and full composition remain available via
lib/computer.ts (also computer.run/step/walk in exec).

example: ab computer --url http://127.0.0.1:4401/ncept/ --input email=dev+clerk_test@example.com --input code=424242 --until 'The signed-in learner home is visible' 'Sign in with the supplied existing account; do not create an account'

example: ab computer --app TextEdit --until 'The document body is exactly Hello' "Replace the document body with 'Hello'"
