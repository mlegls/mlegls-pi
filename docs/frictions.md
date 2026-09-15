# Frictions

- `exec` moves operations below pi's tool-event boundary. Extensions that intercept `read`/`bash` (notably pi-better-skills' dynamic placeholders, skill references, and path rewriting) cannot see the inner calls. For now exec reads raw skill source and uses explicit paths; a shared operation middleware or an explicit skill-loading capability would avoid duplicating those integrations. Accepted for the first kernel experiment. Next: simplify.
