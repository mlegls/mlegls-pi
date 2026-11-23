// Drive the reconciler's actual launch with fake BB and an owned local Git repository.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { git } from "../../../lib/reconcile/checks.ts";
import { prepare, until } from "../../../lib/reconcile/setup-fixture.ts";

export async function replay(change: "recordings" | "css") {
 const env = { ...process.env };
 const f = await prepare();
 try {
  const commit = (path: string, files: string[]) => {
   git(path, "add", "--", ...files);
   git(path, "commit", "-qm", change);
  };
  for (const name of ["reviewer", "visual-reviewer"]) {
   writeFileSync(join(f.root, "agents", name + ".md"), "---\nrole: review\n---\nOffline shell worker.\n");
  }
  const config = ".pi/reconcile.json";
  mkdirSync(join(f.repo, dirname(config)), { recursive: true });
  copyFileSync(join(import.meta.dir, "reconcile.json"), join(f.repo, config));
  commit(f.repo, [config]);

  const implement = await f.ready("implement");
  const file = change === "css" ? "theme/example.css" : "docs/replay.md";
  mkdirSync(join(implement.path, dirname(file)), { recursive: true });
  writeFileSync(join(implement.path, file), change === "css" ? ":root { color: blue; }\n" : "# Re-record the same screen\n");
  commit(implement.path, [file]);
  f.report({ entry: "bun app.ts" });

  const drive = await f.ready("drive");
  const path = "docs/attachments/replay.md", shot = "docs/attachments/screen.png";
  mkdirSync(join(drive.path, dirname(path)), { recursive: true });
  writeFileSync(join(drive.path, path), "# Visual evidence\n\n[Screen](screen.png)\n");
  writeFileSync(join(drive.path, shot), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRfoAAAAASUVORK5CYII=", "base64"));
  commit(drive.path, [path, shot]);
  f.turn("done\n\n```json\n" + JSON.stringify({ stories: [{ story: "The driver saw the screen", outcome: "held" }],
   evidence: { path, visual: true, shots: [shot] } }) + "\n```");

  const review = await f.ready("review");
  return await until(() => f.state()?.log.find(line => line.includes("launched " + review.handle + " (review,")));
 } finally {
  try { await f.close(); } finally { process.env = env; }
 }
}

if (import.meta.main) {
 const change = process.argv[2];
 if (change !== "recordings" && change !== "css") throw new Error("Use recordings or css");
 console.log(await replay(change));
}
