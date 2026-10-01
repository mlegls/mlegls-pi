// Resolve a worker's current canonical pi history; free sessions in the cwd never compete.
import { workerThread } from "../thread";

export async function childSession(handle: string, cwd: string, _parentFile?: string): Promise<string> {
	const thread = await workerThread(handle, cwd);
	if (!thread) throw new Error("no registered worker " + handle);
	return thread.sessionFile;
}
