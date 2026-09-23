ab computer "INTENT" [--app NAME]... [--window PID:WINDOW_ID]... [--until TEXT] [--input NAME=VALUE]... [--budget N] [--timeout S] [--query Q] [--json]
ab computer --resume DRIVE [--input NAME=VALUE]... [--budget N]

Carries out a natural-language intent in native macOS windows through Cua. Jev
selects each action from the controls it sees; it never writes text.

  window   without --app/--window, Jev picks the on-screen window the intent is about
  until    defaults to "the intent has been carried out"; pass one for fuzzy intents
  text     quoted spans in the intent are typed exactly: ... replace the title with 'Q3 plan'
  secrets  %name% in the intent plus --input name=VALUE: typed but never given to Jev as a value,
           and redacted from output and the trace (password fields show dots; other fields show text)

Exits 0 when done, 1 otherwise with status needs-input|stuck|budget|paused|error and a
resume hint. Text that has to be written (a reply, an email body) is yours to supply:
a drive stops with needs-input rather than inventing it. Progress goes to stderr; the
trace is kept under $AB_STATE/computer. Hooks, verifiers and custom policies are exec's
computer.run.

example: ab computer "in the open TextEdit document, replace the body with 'Hello'"
