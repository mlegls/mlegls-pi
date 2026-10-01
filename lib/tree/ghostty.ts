// A dedicated Ghostty window: sidebar plus one main zmx client. Stable surface IDs
// keep focus/input/resize out of the user's other windows and tabs.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { listThreads } from "../thread";
import { quote } from "../thread/process";

export const TITLE = "ab tree";
const AB = fileURLToPath(new URL("../../bin/ab", import.meta.url));
const q = (s: string) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const osa = (script: string) => execFileSync("osascript", ["-e", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
export const inGhostty = () => !!process.env.GHOSTTY_RESOURCES_DIR;
export const sidebarTitle = () => TITLE + " " + (process.env.AB_TREE_TOKEN ?? process.pid);

/** Create a fresh two-split window; leave existing terminals untouched. */
export async function openSidebar(): Promise<void> {
	const token = randomUUID();
	// The main terminal waits for an id when empty or when an archived session detaches.
	// It is not an auxiliary shell and cannot accidentally receive a command intended for pi.
	const main = `while :; do printf '\\033]2;ab thread\\007'; printf 'Choose a thread in the sidebar\\n'; read -r id || exit; ${quote(AB)} thread attach "$id"; done`;
	// Threads inherit the launching shell's environment (EDITOR, proxies, mise, …), minus what
	// belongs to that shell's own terminal, multiplexer or pi session.
	const own = /^(TERM|TERM_.*|COLORTERM|TERMINFO|GHOSTTY_.*|ZDOTDIR|WINDOWID|KITTY_.*|WEZTERM_.*|ITERM_.*|TMUX|TMUX_PANE|ZMX_SESSION|ZMX_SESSION_PREFIX|AB_THREAD_ID|AB_TREE_.*|PI_SESSION_ID|PI_SESSION_FILE|PI_BOARD_TOPIC|PI_MODEL|PI_PROVIDER|PI_REASONING_LEVEL|PI_WORKSPACE|PI_CODING_AGENT|AI_AGENT|ORCA_.*|SHLVL|PWD|OLDPWD|_)$/;
	const env = Object.entries(process.env).filter(([key, value]) => value !== undefined && !own.test(key))
		.map(([key, value]) => key + "=" + value);
	env.push("AB_TREE_TOKEN=" + token, "ZMX_TRACK_ENV=" + (process.env.ZMX_TRACK_ENV ?? "DISPLAY,SSH_AUTH_SOCK,SSH_AGENT_PID,SSH_CONNECTION,WINDOWID,XAUTHORITY,KITTY_LISTEN_ON,KITTY_PID,KITTY_WINDOW_ID") + ",AB_TREE_TOKEN");
	osa(`tell application "Ghostty"
	set cfg to new surface configuration
	set initial working directory of cfg to ${q(process.cwd())}
	set environment variables of cfg to {${env.map(q).join(", ")}}
	set command of cfg to ${q("/bin/sh -c " + quote(main))}
	set w to new window with configuration cfg
	set t to focused terminal of selected tab of w
	set mainID to id of t
	set sidecfg to new surface configuration from cfg
	set command of sidecfg to ${q(quote(AB) + " tree ui --sidebar")}
	set environment variables of sidecfg to (environment variables of cfg) & {"AB_TREE_MAIN_TERMINAL=" & mainID, ${q("AB_TREE_TOKEN=" + token)}}
	set side to split t direction left with configuration sidecfg
end tell`);
}

function mainTarget(id = process.env.AB_TREE_MAIN_TERMINAL): string {
	if (!id) throw new Error("No bound main split; launch with ab tree sidebar");
	return `terminal id ${q(id)}`;
}

export function attachMain(id: string): void {
	osa(`tell application "Ghostty"
	input text ${q(id + "\n")} to ${mainTarget()}
end tell`);
}

/** Focus explicitly requested by the user (Escape), not by hover or scrolling. */
export function focusMain(): void { osa(`tell application "Ghostty" to focus ${mainTarget()}`); }

export function resizeSidebar(px: number): void {
	if (!px) return;
	osa(`tell application "Ghostty"
	repeat with x in terminals
		if name of x is ${q(sidebarTitle())} then perform action ${q(`resize_split:${px < 0 ? "left" : "right"},${Math.abs(Math.round(px))}`)} on x
	end repeat
end tell`);
}
