// Extend the existing shellBb fixture with an exact live writer PID and stop receipt.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
if (process.argv[2] === "writer") {
  writeFileSync("shell-pid", String(process.pid));
  await Bun.sleep(3_600_000);
} else {
  const args = process.argv.slice(2);
  if (args[0] === "thread" && args[1] === "spawn") {
    const cwd = args[args.indexOf("--environment") + 1];
    const { allThreads } = await import("../../../lib/thread/registry.ts");
    const { getTracker } = await import("../../../lib/tracker.ts");
    const { githubProject } = await import("../../../lib/tracker-github-snapshot.ts");
    const { loadJournal } = await import("../../../lib/tracker-github-state.ts");
    const thread = (await allThreads(true)).find(t => t.cwd === cwd)!;
    const slug = /^(gh-\d+)-(?:implement|refine|drive|review)-/.exec(thread.worker!.handle)?.[1];
    if (slug) {
      const run = thread.worker!.run, project = githubProject(cwd)!;
      const fields = getTracker(cwd, {run, inflight:false}).fields(slug);
      const native = JSON.parse(execFileSync("gh", ["api", "repos/" + project.repository + "/issues/" + slug.slice(3)], {encoding:"utf8"}));
      const receipt = loadJournal(project, run).issues[slug];
      if (fields["claimed-by"] !== "reconcile:" + run || !native.assignees.some((u:any) => u.login === "mlegls") || receipt?.claim?.claimedBy !== "reconcile:" + run)
        throw new Error("Native/private claim missing before shell worker launch: " + slug);
      appendFileSync(process.env.REHEARSAL_WRITERS! + ".launches", JSON.stringify({at:new Date().toISOString(),beforeLaunch:true,
        issue:slug,run,handle:thread.worker!.handle,thread:thread.id,state:native.state,assignees:native.assignees.map((u:any)=>u.login),receipt:receipt.claim}) + "\n");
    }
  }
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
