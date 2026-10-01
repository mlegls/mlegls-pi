# Sidebar bridge first use

Implementation `faa6e58`, starting from `c4312ef`. Local macOS, Ghostty, Bun 1.4.2 and Cua 0.30.4; no authentication. The disposable setup creates its own git fixture with a child worktree, 24 parked session files, UI/cache/board directories and a tmux server with 20 free sessions. It does not use the personal tmux client, agent files or board. The setup and its Ghostty instance were stopped after trying them.

## Entry point

From the checkout containing this change:

```sh
bun run setup
# Root typechecking also needs the separately packaged plugin's locked types:
bun install --frozen-lockfile --cwd extensions/obsidian-tracker
surface="$(pwd)/docs/attachments/tree-sidebar-bridge-fixes/first-use.sh"
root=/tmp/sidebar-bridge-drive
"$surface" seed "$root" # requires a new directory
cua-driver launch_app "$(bun -e '
const [s,r]=process.argv.slice(1);
console.log(JSON.stringify({bundle_id:"com.mitchellh.ghostty",creates_new_application_instance:true,
additional_arguments:["--focus-follows-mouse=true","--command=/bin/sh "+s+" main "+r,
"--initial-command=/bin/sh "+s+" sidebar "+r]}));' "$surface" "$root")"
```

This is the launch command tried here: the initial surface runs `ab tree ui --sidebar`; subsequent surfaces attach the private tmux main terminal. Once the new instance has an addressable window, create a right split through Cua's native Ghostty menu. If the hidden launch remains blank, a human must reveal that instance or authorize a guarded foreground action before driving it. Do not operate a different Ghostty instance.

Cleanup after closing the owned Ghostty instance:

```sh
"$surface" stop "$root"
```

The fixture intentionally suppresses the legacy resize/focus-main AppleScript helpers, which address Ghostty's front window rather than a new isolated instance. [Owner](../../issues/sidebar-ghostty-helpers-target-the-front-window.md).

## Observed

**Before:** workspace wheel input called `navSession` → `switchTo`; status/tree wheel input called `handleKey(j/k)` → `navAgent` → `open`. Selection could therefore open sessions without a click/Enter. The dashboard also passed `dbl || true`, so every click on an already selected row acted as a double-click.

**After, private pty:** [first-use output](pty-first-use.txt), 38 columns × 12 rows. Sent real stdin sequences to the committed CLI, with a second pty attached as the isolated tmux main client:

- Any-motion (`1003`, SGR button 35) over the child showed `[merge] [new]`, without creating a session.
- Clicking `[merge]` showed the existing confirmation; Escape canceled it. No merge was executed.
- Wheel moved the viewport; the session set and main client's session stayed unchanged. Returning the viewport and pressing Enter opened the selected child, not the hovered free session.
- Status and project-tree wheel input did not resume parked agents. Quit disabled `1003`.

**Ghostty trial:** the owned hidden instance started the CLI, but exposed no AXWindow after two observations; its [capture](hidden-ghostty.png) was blank, not a rendered sidebar. [Bounded observation](hidden-ghostty-ax.json). Background Cmd-Q was refused; Cua then killed the owned instance and fresh window discovery returned zero windows. Native scroll, hover and split focus are **not yet observed**. [Tooling owner](../../issues/cua-hidden-ghostty-has-no-addressable-window.md).

**Configuration:** `~/.config/system-config/.config/ghostty/config` has `focus-follows-mouse=true`, committed there as `17a318c` and deployed only to the Ghostty config directory with the repository's rsync copy strategy. `ghostty +show-config` reads back `focus-follows-mouse = true`. Ghostty documents that this only focuses splits within the already focused window, not background windows. The user's running instance was not reloaded.

**Checks:** [root typecheck](typecheck.txt) exits 0 after preparing the plugin's existing locked dependencies. [Regressions](regressions.txt): 9/9 tree tests pass with a longer timeout; the full run has 166 passing, 2 skipped and one timeout, which passed alone with unchanged assertions. [Host-load owner](../../issues/host-load-times-out-existing-regressions.md), [setup owner](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md). No permanent acceptance tests were added; no other project lint is defined.

## Danger

**Door:** two-way for navigation/config; the existing merge action remains a confirmed workmux merge, not recursive archive.
**Blast radius:** sidebar. Wheel behavior also changes in the dashboard: it now scrolls the viewport instead of changing selection. Source delta before setup/evidence: +24 lines net, no new dependency or module.
