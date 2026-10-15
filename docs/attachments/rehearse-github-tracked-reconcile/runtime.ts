// Extend the existing shellBb fixture with an exact live writer PID and stop receipt.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
if (process.argv[2] === "writer") {
  writeFileSync("shell-pid", String(process.pid));
  await Bun.sleep(3_600_000);
} else {
  const args = process.argv.slice(2);
  if (args[0] === "thread" && ["stop", "archive"].includes(args[1])) {
    const file = join(process.env.FAKE_BB_DIR!, "thread-" + args[2] + ".json");
    if (existsSync(file)) {
      const thread = JSON.parse(readFileSync(file, "utf8"));
      const pidFile = join(thread.environment, "shell-pid");
      if (existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, "utf8"));
        let command = "";
        try { command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim(); } catch {}
        if (command.includes(import.meta.path + " writer")) {
          process.kill(pid, "SIGTERM");
          appendFileSync(process.env.REHEARSAL_WRITERS!, JSON.stringify({ at: new Date().toISOString(), stopped: pid, thread: args[2] }) + "\n");
        }
      }
    }
  }
  process.stdout.write(execFileSync(process.env.REHEARSAL_BB!, args, { encoding: "utf8" }));
}
