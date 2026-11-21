import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts", import.meta.url));
const cwd = mkdtempSync(join(tmpdir(), "tracker-stdin-"));
const slug = "stdin-replay";
const original = "Original contract.\n";
const revised = "Revised contract.\n";

function run(cmd: string[], stdin?: Buffer) {
  const result = Bun.spawnSync(cmd, { cwd, stdin, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`${cmd.join(" ")}: exit ${result.exitCode}`);
}

try {
  run(["git", "init", "--quiet"]);
  run(["git", "config", "user.name", "Tracker Replay"]);
  run(["git", "config", "user.email", "tracker-replay@example.invalid"]);
  run(["git", "commit", "--quiet", "--allow-empty", "-m", "Initialize replay vault"]);
  mkdirSync(join(cwd, "docs/issues"), { recursive: true });
  run([process.execPath, cli, "create", slug, "--fields", '{"stage":"idea","author":"user:replay"}', "--body-file", "-"], Buffer.from(original));

  function showContract() {
    run([process.execPath, cli, "text", slug]);
    run(["git", "log", "-1", "--format=HEAD %h %s"]);
  }

  console.log(`\nSeed (Bun ${Bun.version}):`);
  showContract();

  const update = [process.execPath, cli, "update", slug, "--body-file", "-"];
  console.log("\nHistorical caller: Bun FileSink.end(body)");
  const child = Bun.spawn(update, { cwd, stdin: "pipe", stdout: "inherit", stderr: "inherit" });
  // FileSink.end takes no payload, unlike Node's Writable.end.
  Reflect.apply(child.stdin.end, child.stdin, [revised]);
  console.log(`update exit: ${await child.exited}`);
  showContract();

  console.log("\nCaller supplies the body as spawn stdin:");
  run(update, Buffer.from(revised));
  showContract();
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
