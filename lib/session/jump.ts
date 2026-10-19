// Resolve a worker's current pi session file from its bb thread; free sessions in the cwd never compete.
import { findWorker } from "../dispatch";
import { bbSessionFile } from "../thread/bb";

export async function childSession(handle: string, cwd: string, _parentFile?: string): Promise<string> {
	const worker = await findWorker(handle, cwd);
	if (!worker) throw new Error("no registered worker " + handle);
	return bbSessionFile(worker.bb);
}
