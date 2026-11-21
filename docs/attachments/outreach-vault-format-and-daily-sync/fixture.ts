import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { git } from "../../../lib/thread/git.ts";

const cli = fileURLToPath(new URL("../../../skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts", import.meta.url));

function seed(path?: string) {
  const root = path ? resolve(path) : mkdtempSync(join(tmpdir(), "outreach-demo-"));
  mkdirSync(root, { recursive: true });
  if (readdirSync(root).length) throw new Error("fixture needs an empty directory: " + root);
  git(root, "init", "-q");

  function note(relative: string, content: string) {
    const file = join(root, "docs/outreach", relative + ".md");
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
  }

  note("hypotheses/salon-organizers", "---\nstatus: active\nstarted: 2026-11-19\nbar: Two organizers invite a trial.\n---\n\nSalon organizers want a living reading list that attendees can edit.\n");
  for (const [slug, name, priority] of [["ren", "Ren", 1], ["tess", "Tess", 2]]) {
    note("people/" + slug,
      "---\nname: " + name + "\nhypothesis: salon-organizers\nstage: candidate\npriority: " + priority +
      "\nchannels:\n  x: \"@" + slug + "-demo\"\n---\n\n## Evidence\n\n> We publish a reading list after every salon.\n\n[Salon announcement](https://example.org/" + slug + ")\n\n## Log\n");
  }
  note("people/ada",
    "---\nname: Ada\nhypothesis: salon-organizers\nstage: messaged\npriority: 1\nchannels:\n  x: \"@ada-demo\"\nlast_contacted: 2026-11-19\n---\n\n## Evidence\n\n> We run a monthly reading salon.\n\n[Salon announcement](https://example.org/ada)\n\n## Log\n\n### 2026-11-19 10:00 · x · outbound\nid: demo-outbound\n\n> Do you share a reading list afterward?\n");
  git(root, "add", "docs");
  git(root, "-c", "user.name=Outreach fixture", "-c", "user.email=fixture@example.org", "commit", "-qm", "Seed demo outreach vault");
  writeFileSync(join(root, ".git/mock-beeper-replies"), "demo-reply-1\n");
  console.log(root);
}

const [command, path, ...flags] = process.argv.slice(2);
if (command === "seed") {
  seed(path);
} else if (path && ["reply", "sync", "offline"].includes(command)) {
  const root = resolve(path);
  const marker = join(root, ".git/mock-beeper-replies");
  if (!existsSync(marker)) throw new Error("not an outreach fixture: " + root);
  if (command === "reply") {
    if (!readFileSync(marker, "utf8").includes("demo-reply-2")) appendFileSync(marker, "demo-reply-2\n");
  } else {
    const token = "outreach-fixture";
    const server = Bun.serve({
      hostname: "127.0.0.1", port: 0,
      fetch(req) {
        const route = new URL(req.url).pathname;
        if (req.headers.get("Authorization") !== "Bearer " + token) return new Response(null, { status: 401 });
        if (route === "/v1/chats") {
          return Response.json({ items: [{
            id: "demo-chat", accountID: "twitter:fixture", network: "Twitter", type: "single",
            participants: { items: [{ id: "fixture:ada", username: "ada-demo" }] },
          }], hasMore: false });
        }
        if (route === "/v1/chats/demo-chat/messages") {
          const replies = readFileSync(marker, "utf8").trim().split("\n");
          return Response.json({ items: [
            ...replies.map((id, i) => ({
              id, timestamp: "2026-11-" + (20 + i) + "T14:00:00.000Z", isSender: false,
              text: i === 0 ? "Yes, we had been looking for a shared list." : "Can we try this at next month's salon?",
            })).reverse(),
            { id: "demo-outbound", timestamp: "2026-11-19T10:00:00.000Z", isSender: true, text: "Do you share a reading list afterward?" },
          ], hasMore: false });
        }
        return new Response(null, { status: 404 });
      },
    });
    const url = server.url.href;
    try {
      if (command === "offline") await server.stop(true);
      const child = Bun.spawn([process.execPath, "--no-env-file", cli, "sync", "--beeper", ...flags], {
        cwd: root,
        env: { ...process.env, BEEPER_API_URL: url, BEEPER_ACCESS_TOKEN: token },
        stdout: "inherit", stderr: "inherit",
      });
      process.exitCode = await child.exited;
    } finally {
      if (command !== "offline") await server.stop(true);
    }
  }
} else {
  throw new Error("usage: fixture.ts seed [empty-directory] | reply <repo> | sync <repo> [--dry-run] | offline <repo>");
}
