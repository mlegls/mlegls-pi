import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";

export interface SkimJob { text: string; rate: 0.25 | 0.5 | 0.75 }

const worker = fileURLToPath(new URL("./skim-worker.py", import.meta.url));
const directory = join(homedir(), ".cache", "mlegls-pi");
const socket = () => process.env.PI_SKIM_SOCKET ?? join(directory, "skim.sock");

function request(jobs: SkimJob[], path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const connection = createConnection(path);
    let buffer = "";
    let done = false;
    const finish = (error?: Error, outputs?: string[]) => {
      if (done) return;
      done = true;
      connection.destroy();
      if (error) reject(error);
      else resolve(outputs!);
    };
    connection.setTimeout(15000, () => finish(new Error("LLMLingua exceeded 15 seconds")));
    connection.on("connect", () => connection.write(JSON.stringify(jobs) + "\n"));
    connection.on("error", error => finish(error));
    connection.on("end", () => finish(new Error("LLMLingua connection closed")));
    connection.on("data", (data: Buffer) => {
      buffer += data.toString("utf8");
      if (Buffer.byteLength(buffer) > 1024 * 1024) return finish(new Error("LLMLingua response exceeded 1 MiB"));
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, end));
        if (response.error) throw new Error(response.error);
        if (!Array.isArray(response.outputs) || response.outputs.length !== jobs.length ||
            response.outputs.some((s: unknown) => typeof s !== "string" || !s.trim())) {
          throw new Error("Invalid LLMLingua response");
        }
        finish(undefined, response.outputs);
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
  });
}

/** One model per user, shared by all pi sessions. The daemon owns its socket and startup lock. */
export function createCompressor() {
  let disposed = false;
  return {
    async compress(jobs: SkimJob[]): Promise<string[]> {
      if (!jobs.length) return [];
      if (disposed) throw new Error("LLMLingua compressor disposed");
      const path = socket();
      try { return await request(jobs, path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "ECONNREFUSED") throw error;
      }
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const child = spawn("uv", ["run", "--no-project", "--offline", "--python", "3.12", "--script", worker, "--serve"], {
        detached: true, stdio: "ignore", env: { ...process.env, PI_SKIM_SOCKET: path },
      });
      child.on("error", () => {}); // A missing uv surfaces as the connection timeout below.
      child.unref();
      // Racing sessions may all try to start it; the daemon's flock elects one owner.
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (disposed) throw new Error("LLMLingua compressor disposed");
        await new Promise(resolve => setTimeout(resolve, 100));
        try { return await request(jobs, path); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "ECONNREFUSED") throw error;
        }
      }
      throw new Error("LLMLingua daemon did not start within 15 seconds");
    },
    dispose() { disposed = true; },
  };
}
