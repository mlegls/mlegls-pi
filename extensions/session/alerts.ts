import type { TerminalAlertKind, TerminalSnapshot } from "./tmux";
import { TmuxTerminalManager } from "./tmux";

const ALERT_CAPTURE_LINES = 2_000;
const DEFAULT_POLL_MS = 250;

export interface SessionAlert {
	kind: TerminalAlertKind;
	snapshot: TerminalSnapshot;
	literal?: string;
	matchedLine?: string;
}

type AlertHandler = (alert: SessionAlert) => void | Promise<void>;

export class SessionAlertMonitor {
	private active = false;
	private rescanRequested = false;
	private timer?: ReturnType<typeof setTimeout>;

	constructor(
		private readonly manager: TmuxTerminalManager,
		private readonly onAlert: AlertHandler,
		private readonly pollMs = DEFAULT_POLL_MS,
	) {}

	start(): void {
		this.rescanRequested = true;
		if (this.active) return;
		this.active = true;
		this.schedule(0);
	}

	stop(): void {
		this.active = false;
		this.rescanRequested = false;
		if (this.timer) clearTimeout(this.timer);
		this.timer = undefined;
	}

	async scanOnce(): Promise<void> {
		await this.scan(() => true);
	}

	private schedule(delay: number): void {
		this.timer = setTimeout(() => void this.tick(), delay);
		this.timer.unref?.();
	}

	private async tick(): Promise<void> {
		this.rescanRequested = false;
		let hasPendingAlerts = true;
		try {
			hasPendingAlerts = await this.scan(() => this.active);
		} catch (error) {
			if (this.active) console.error("session alert scan failed:", error);
		} finally {
			if (this.active && (hasPendingAlerts || this.rescanRequested)) this.schedule(this.pollMs);
			else this.active = false;
		}
	}

	private async scan(shouldContinue: () => boolean): Promise<boolean> {
		let hasPendingAlerts = false;
		const sessions = await this.manager.list();
		for (const summary of sessions) {
			if (!shouldContinue()) return hasPendingAlerts;
			const outputAlert = summary.alerts?.output;
			const exitAlert = summary.alerts?.exit;
			const hasOutputAlert = outputAlert?.state === "armed";
			const hasExitAlert = exitAlert?.state === "armed";
			if (!hasOutputAlert && !hasExitAlert) continue;
			hasPendingAlerts = true;
			if (!hasOutputAlert && summary.status !== "exited") continue;

			const snapshot = await this.manager.view({ id: summary.id, lines: ALERT_CAPTURE_LINES });
			if (outputAlert?.state === "armed" && snapshot.output.includes(outputAlert.literal)) {
				const matchedLine = snapshot.output.split("\n").find((line) => line.includes(outputAlert.literal));
				await this.emit({ kind: "output", snapshot, literal: outputAlert.literal, matchedLine }, shouldContinue);
			}
			if (exitAlert?.state === "armed" && snapshot.status === "exited") {
				await this.emit({ kind: "exit", snapshot }, shouldContinue);
			}
		}
		return hasPendingAlerts;
	}

	private async emit(alert: SessionAlert, shouldContinue: () => boolean): Promise<void> {
		if (!shouldContinue()) return;
		const claimed = await this.manager.claimAlert(alert.snapshot.id, alert.kind);
		if (!claimed) return;
		if (!shouldContinue()) {
			await this.manager.rearmAlert(alert.snapshot.id, alert.kind);
			return;
		}
		try {
			await this.onAlert(alert);
		} catch (error) {
			await this.manager.rearmAlert(alert.snapshot.id, alert.kind);
			throw error;
		}
	}
}
