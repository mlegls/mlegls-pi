import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface SkimJob { text: string; rate: 0.25 | 0.5 | 0.75 }

/** Lazy, serialized JSON-lines worker. It inherits the exec process group so reset kills it. */
export function createCompressor() {
  let child: ChildProcessWithoutNullStreams | undefined;
  let pending: { resolve: (value: string[]) => void; reject: (error: Error) => void } | undefined;
  let buffer = "", diagnostics = "";
  let workerPid: number | undefined, disposed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const stop = (error: Error) => {
    const old = child;
    child = undefined;
    const request = pending;
    pending = undefined;
    if (workerPid) { try { process.kill(workerPid, "SIGKILL"); } catch { /* already exited */ } }
    workerPid = undefined;
    old?.stdin.destroy();
    old?.kill("SIGKILL");
    request?.reject(error);
  };
  const start = () => {
    const process = spawn("uv", ["run", "--no-project", "--offline", "--python", "3.12", "--script", fileURLToPath(new URL("./skim-worker.py", import.meta.url))], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child = process;
    process.stdout.setEncoding("utf8");
    process.stderr.setEncoding("utf8");
    buffer = ""; diagnostics = "";
    process.stderr.on("data", data => { if (child === process) diagnostics = (diagnostics + data).slice(-4096); });
    process.on("error", error => { if (child === process) stop(error); });
    process.stdin.on("error", error => { if (child === process) stop(error); });
    process.on("exit", (code, signal) => {
      if (child === process) stop(new Error("LLMLingua exited (" + (signal ?? code) + "): " + diagnostics));
    });
    process.stdout.on("data", data => {
      if (child !== process) return;
      buffer += data;
      if (Buffer.byteLength(buffer) > 1024 * 1024) { stop(new Error("LLMLingua response exceeded 1 MiB")); return; }
      while (buffer.includes("\n")) {
        const end = buffer.indexOf("\n");
        try {
          const response = JSON.parse(buffer.slice(0, end));
          buffer = buffer.slice(end + 1);
          if (Number.isInteger(response.ready) && response.ready > 0) { workerPid = response.ready; continue; }
          if (response.error) throw new Error(response.error);
          if (!pending || !Array.isArray(response.outputs) || response.outputs.some((s: unknown) => typeof s !== "string" || !s.trim())) throw new Error("Invalid LLMLingua response");
          const request = pending;
          pending = undefined;
          request.resolve(response.outputs);
        } catch (error) { stop(error instanceof Error ? error : new Error(String(error))); return; }
      }
    });
  };
  return {
    compress(jobs: SkimJob[]): Promise<string[]> {
      if (!jobs.length) return Promise.resolve([]);
      const result = queue.then(async () => {
        if (disposed) throw new Error("LLMLingua worker disposed");
        if (!child) start();
        let timer: ReturnType<typeof setTimeout>;
        try {
          const outputs = await new Promise<string[]>((resolve, reject) => {
            pending = { resolve, reject };
            timer = setTimeout(() => stop(new Error("LLMLingua exceeded 15 seconds")), 15000);
            child!.stdin.write(JSON.stringify(jobs) + "\n");
          });
          if (outputs.length !== jobs.length) { stop(new Error("LLMLingua result count mismatch")); throw new Error("LLMLingua result count mismatch"); }
          return outputs;
        } finally { clearTimeout(timer!); }
      });
      queue = result.catch(() => {});
      return result;
    },
    dispose() { disposed = true; stop(new Error("LLMLingua worker disposed")); },
  };
}
