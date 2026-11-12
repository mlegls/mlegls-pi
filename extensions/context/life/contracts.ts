// Shared boundaries between the durable life log, presence and the session mechanism.
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export type Kind = "user" | "agent" | "tool" | "echo" | "work" | "self";

/** The copied message before SQLite assigns its position. */
export interface LifeInput {
	kind: Kind;
	text: string;
	date: string;
	/** provider/id at the source message. */
	model: string;
	place: string;
	/** entry:<session>/<entry>#<k> */
	source: string;
}

export interface LifeMessage extends LifeInput {
	/** Zero-based, permanent within the life. */
	pos: number;
}

/** Metadata for converting a session branch to copied messages. */
export interface AppendContext {
	session: string;
	place: string;
	/** The session's model, used until a model entry or assistant message supplies it. */
	model: string;
	selfThreads: readonly string[];
}

export type LifeMessages = (branch: readonly SessionEntry[], context: AppendContext) => LifeInput[];

export interface LifeLog {
	readonly id: string;
	/** The entire committed log in position order. */
	read(): LifeMessage[];
	/** One immediate transaction; skip sources already in this life. Returns the new messages. */
	append(messages: readonly LifeInput[]): LifeMessage[];
}

export interface Manifestation {
	session: string;
	thread?: string;
	sessionFile: string;
	pid: number;
}

/** The id also identifies the life.run record, and is used to end this run. */
export interface LifeRun extends Manifestation {
	id: string;
	time: string;
}

export interface LifePresence {
	start(run: LifeRun): void;
	end(run: string): void;
	/** Stop showing this session as attached; a later start attaches it again. */
	detach(session: string): void;
	hold(session: string, text: string): void;
	/** Threads belonging to this life, for recognizing messages from elsewhere in it. */
	threads(): string[];
	/** Working threads, then open idle threads, including titles, times and holds. */
	snapshot(): Promise<string>;
	/** The sibling's current run, read from its session file without changing it. */
	readRun(thread: string): Promise<SessionEntry[]>;
}
