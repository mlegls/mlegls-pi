// The sidebar as a Ghostty split next to the terminal running tmux, driven over Ghostty's
// AppleScript dictionary (macOS). The sidebar titles itself "ab tree" so it can be found.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const TITLE = "ab tree";
const AB = fileURLToPath(new URL("../../bin/ab", import.meta.url));
const q = (s: string) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const osa = (script: string) => execFileSync("osascript", ["-e", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Running in a Ghostty terminal directly (not inside tmux). */
export const inGhostty = () => !process.env.TMUX && !!process.env.GHOSTTY_RESOURCES_DIR;

/** Open the sidebar as a split left of the focused terminal of the front Ghostty window. */
export function openSidebar(): void {
	const shell = process.env.SHELL || "/bin/zsh";
	const cmd = `${shell} -ic ${q(`exec ${AB} tree ui --sidebar`).replace(/^"|"$/g, "'")}`;
	osa(`tell application "Ghostty"
	set t to focused terminal of selected tab of front window
	set cfg to new surface configuration
	set command of cfg to ${q(cmd)}
	split t direction left with configuration cfg
end tell`);
}

/** Give the keyboard back to the terminal next to the sidebar (the tmux one if there are several). */
export function focusMain(): void {
	try {
		osa(`tell application "Ghostty"
	set pick to missing value
	repeat with x in terminals of selected tab of front window
		set n to name of x
		if n is not ${q(TITLE)} then
			if pick is missing value or n contains "tmux" then set pick to x
		end if
	end repeat
	if pick is not missing value then focus pick
end tell`);
	} catch {}
}

/** Move the sidebar's divider by `px` (negative: narrower). */
export function resizeSidebar(px: number): void {
	if (!px) return;
	try {
		osa(`tell application "Ghostty"
	repeat with x in terminals of selected tab of front window
		if name of x is ${q(TITLE)} then perform action ${q(`resize_split:${px < 0 ? "left" : "right"},${Math.abs(Math.round(px))}`)} on x
	end repeat
end tell`);
	} catch {}
}
