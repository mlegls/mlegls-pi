---
stage: done
assignee: agent
author: "session:01a0eb62-7f66-748e-ac66-737a03bb0dea"
---

`chrome-devtools-axi` tooling friction (owner: `~/dev/mlegls-pi`). In the [[projects/concept/attachments/adopt-the-mmon-co-patch-and-mission-on-first-sign-in/index|first-use drive]], named session `adopt-the-mmon-co-patch-and-mission-on-first-sign-in-drive`, `fill @ref '<Go plan text>'` on the Session's `textarea[name="message"]` displayed that value in the snapshot, but **Send** stayed disabled; on a later render the field reset to empty. `type '<text>'` at the focused field enabled Send, while `chrome-devtools-axi run` → `page.fill('textarea[name="message"]', '<exact text>')` replaced the value and enabled Send. Repro: fresh Session; snapshot → fill its textbox by ref → snapshot/button state → cause re-render; then repeat by CSS selector inside `run`. No application repair was attempted. Investigate whether UID fill differs from CSS fill in input/change dispatch or whether a race replaces the controlled textarea's value; a successful fill should persist and enable Send under the same conditions.

Related in this tracker: [[projects/mlegls-pi/issues/archive/chrome-devtools-axi-fill-does-not-enable-controlled-session-send]].

disposition, 2026-09-30: duplicate of upstream https://github.com/kunchenguid/chrome-devtools-axi/issues/156 (fill on a React controlled textarea doesn't update app state).
