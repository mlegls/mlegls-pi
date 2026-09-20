---
name: git-guardrails-claude-code
description: "Use when asked to block dangerous Git commands in Claude Code."
---

Install [scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh) as a PreToolUse hook. When a command matches, Claude is told it lacks authority to run it.

1. Ask scope: this project (`.claude/settings.json` + `.claude/hooks/`) or all projects (`~/.claude/settings.json` + `~/.claude/hooks/`).
2. Copy the script to the target hooks dir, `chmod +x`.
3. Merge into the settings file's `hooks.PreToolUse` (don't overwrite other settings):

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
             }
           ]
         }
       ]
     }
   }
   ```

   (Global: `"~/.claude/hooks/block-dangerous-git.sh"`.)

4. Ask whether to add/remove patterns from the blocked list; edit the copied script accordingly.
5. Verify: `echo '{"tool_input":{"command":"git push origin main"}}' | <path-to-script>` exits 2 with a BLOCKED message on stderr.
