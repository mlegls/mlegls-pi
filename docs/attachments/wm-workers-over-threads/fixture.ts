// Disposable first-use setup. Uses the public worker/supervisor surfaces, not a test suite.
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { allThreads, getThread, setCurrentSession } from "../../../lib/thread/registry";
import { abandonThread, listThreads, newThread } from "../../../lib/thread";
import { terminals, zmx } from "../../../lib/thread/zmx";
import { persistHeader } from "../../../lib/thread/sessions";
import { readLive } from "../../../lib/session-meta/live";
import { childSession } from "../../../lib/session/jump";
import { read } from "../../../lib/board/store";

const packagePath = fileURLToPath(new URL("../../../", import.meta.url));
const [action = "help", target] = process.argv.slice(2);
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Fixture = { root: string; cwd: string; project: string; model: string; env: Record<string, string> };
const selectors = (root: string) => ({ XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), ZMX_DIR: join(root, "zmx"), PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "roster") });
function use(env: Record<string, string>) {
  for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_(?:TOPIC|NAME|FOLLOW)|PI_SESSION_.*|AB_THREAD_ID|TMUX(?:_PANE)?|ZMX_SESSION)$/.test(key)) delete process.env[key];
  Object.assign(process.env, env);
}
async function until<T>(get: () => T | Promise<T | undefined>, seconds = 90): Promise<T> {
  for (let i = 0; i < seconds * 2; i++) { const value = await get(); if (value) return value; await sleep(500); }
  throw new Error("Readiness timeout");
}
const latest = (topic: string) => read({ topic, tags: "done | blocked | needs-input | turn-end", limit: 1 }).messages[0];
async function printPi(f: Fixture, file: string, prompt: string) {
  const p = Bun.spawn(["pi", "--approve", "--model", f.model, "--thinking", "off", "--session", file, "--print", prompt], { cwd: f.cwd, env: process.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const live = await until(() => readLive().find(l => l.pid === p.pid));
  const [code, out, err] = await Promise.all([p.exited, new Response(p.stdout).text(), new Response(p.stderr).text()]);
  if (code) throw new Error(err);
  console.log(JSON.stringify({ event: "by-hand-pi", live, out, err }));
}

if (action === "help" || action === "--help") {
  console.log("prepare | worker ROOT | supervisor ROOT | join ROOT | reconcile ROOT | inspect ROOT | cleanup ROOT\nUses local pi authentication, isolated agent/board/thread/zmx state and an owned non-main Git checkout. join drives fresh tools from the package checkout itself; all other actions use the disposable project. All ids/readiness are printed. Reconcile takes several minutes, including a real startup-grace wait.");
  process.exit(0);
}
let f: Fixture;
if (action === "prepare") {
  const persona = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent");
  const settings = JSON.parse(await readFile(join(persona, "settings.json"), "utf8"));
  const root = realpathSync(await mkdtemp("/tmp/wm-thread-"));
  f = { root, project: join(root, "repo"), cwd: join(root, "owner"), model: process.env.PI_FIXTURE_MODEL ?? settings.defaultProvider + "/" + settings.defaultModel, env: selectors(root) };
  await mkdir(f.project);
  git(f.project, "init", "-q", "-b", "main");
  git(f.project, "config", "user.name", "Worker fixture"); git(f.project, "config", "user.email", "fixture@example.invalid");
  git(f.project, "commit", "-q", "--allow-empty", "-m", "fixture");
  git(f.project, "worktree", "add", "-q", "-b", "owner", f.cwd);
  await mkdir(f.env.PI_CODING_AGENT_DIR!);
  if (existsSync(join(persona, "auth.json"))) await symlink(join(persona, "auth.json"), join(f.root, "agent/auth.json"));
  await writeFile(join(f.root, "agent/settings.json"), JSON.stringify({ packages: [packagePath], defaultProvider: settings.defaultProvider, defaultModel: settings.defaultModel, defaultTools: ["+codemode"], quietStartup: true }));
  await mkdir(join(f.root, "roster/roles"), { recursive: true });
  await writeFile(join(f.root, "roster/_common.md"), "You are a disposable fixture worker. Session mode: hacking. Finish only the assignment, commit its files. End with done, blocked or needs-input first. Report on {{topic}}.");
  for (const role of ["implement", "drive", "review", "handle"]) await writeFile(join(f.root, "roster/roles", role + ".md"), "Fixture role: " + role + ".\nUse only the bounded fixture procedure in the stance.");
  const body = "Use codemode and bash for this disposable local fixture; no skills, audits or unrelated edits. For leaf implementation only: if PI_WM_HANDLE ends with implement-1, run sleep 150 before editing (the controller will kill this first worker). Otherwise write leaf.txt containing fixture-ok and commit. For a residual join implementation, children are already integrated: make no changes. Implement reports done with setup: {kind: local git fixture, entrypoint: 'git show HEAD:leaf.txt'}.\nFor leaf drive, verify leaf.txt via git show, write docs/attachments/fixture/index.md with the observed content, commit it; report done with stories: [{story: leaf.txt contains fixture-ok, outcome: held}], evidence: {path: docs/attachments/fixture/index.md, visual: false, shots: []}.\nFor a join drive or review, check leaf.txt then report done with stories: []. For leaf review, check the committed evidence and leaf.txt; make no changes, report the same stories and evidence as the driver. Use a fenced yaml handoff. Do not close issues, integrate, retire or spawn anything.";
  for (const name of ["fixture", "tidy"]) await writeFile(join(f.root, "roster", name + ".md"), "---\nrole: implement, drive, review, handle\nmodel: " + f.model + ":off\n---\n" + body);
  await writeFile(join(root, "fixture.json"), JSON.stringify(f, null, 2));
  console.log(JSON.stringify({ ...f, readiness: "Owned non-main checkout, registered package and auth link prepared", entrypoint: "mise exec -- bun " + import.meta.path + " worker " + root }, null, 2));
  process.exit(0);
}
if (!target) throw new Error("Expected owned fixture root; use help");
const root = realpathSync(resolve(target));
f = JSON.parse(await readFile(join(root, "fixture.json"), "utf8"));
if (f.root !== root || !/^\/(?:private\/)?tmp\/wm-thread-/.test(root) || JSON.stringify(f.env) !== JSON.stringify(selectors(root))) throw new Error("Selectors do not address an owned fixture");
use(f.env);
process.chdir(f.cwd);
const { spawn, wait } = await import("../../../lib/wm");
const { start, campaigns } = await import("../../../lib/reconcile/main");
const { stateFile } = await import("../../../lib/reconcile/reconcile");
if (action === "worker") {
  const w = await spawn({ cwd: f.cwd, run: "worker-fixture", handle: "pi-worker", model: f.model, effort: "off", prompt: "Reply only done bootstrap-ok. Do not use tools." });
  console.log(JSON.stringify({ event: "spawn", worker: w }));
  console.log(JSON.stringify({ event: "first", result: [...(await wait([w], { timeoutMs: 90_000 })).values()] }));
  const before = latest(w.topic)?.id;
  await w.send("Reply only done follow-up-ok. Do not use tools.");
  await sleep(3000);
  console.log(JSON.stringify({ event: "literal-unsubmitted", before, after: latest(w.topic)?.id }));
  await w.send("\r");
  console.log(JSON.stringify({ event: "follow-up", result: [...(await wait([w], { timeoutMs: 90_000 })).values()] }));
  console.log(JSON.stringify({ event: "history", text: await w.capture(25) }));
  const free = SessionManager.create(w.dir);
  await persistHeader(free.getSessionFile()!, free.getSessionId(), w.dir);
  console.log(JSON.stringify({ event: "jump", canonical: (await getThread(w.threadId!))?.sessionFile, returned: await childSession(w.handle, f.cwd), newerFree: free.getSessionFile() }));
  const replacement = SessionManager.create(w.dir);
  await setCurrentSession(w.threadId!, { id: replacement.getSessionId(), file: replacement.getSessionFile()! });
  console.log(JSON.stringify({ event: "jump-current", thread: w.threadId, current: replacement.getSessionFile(), returned: await childSession(w.handle, f.cwd) }));
  await zmx(["kill", w.threadId! + ".agent", "--force"]);
  console.log(JSON.stringify({ event: "agent-killed", result: [...(await wait([w], { timeoutMs: 3000 })).values()] }));
  console.log(JSON.stringify({ event: "keep-close", cleanup: await w.close(true), branch: git(f.cwd, "branch", "--list", w.handle) }));

  const ordinary = await newThread({ cwd: f.cwd, in: f.cwd, launch: { args: ["--approve", "--model", f.model, "--thinking", "off"], prompt: "Reply only done ordinary-ok. Do not use tools." } });
  await until(() => latest("thread/" + ordinary.id));
  await zmx(["kill", ordinary.id + ".agent", "--force"]);
  await printPi(f, ordinary.sessionFile, "Reply only done by-hand-ok. Do not use tools.");
  console.log(JSON.stringify({ event: "ordinary-report", thread: ordinary.id, report: latest("thread/" + ordinary.id), meta: SessionManager.open(ordinary.sessionFile).getEntries().filter(e => e.type === "custom" && e.customType === "session-meta") }));
  const untracked = SessionManager.create(f.cwd);
  await persistHeader(untracked.getSessionFile()!, untracked.getSessionId(), f.cwd);
  await printPi(f, untracked.getSessionFile()!, "Reply only free-ok. Do not use tools.");
  console.log(JSON.stringify({ event: "free-report", session: untracked.getSessionId(), report: latest("thread/" + untracked.getSessionId()), meta: SessionManager.open(untracked.getSessionFile()!).getEntries().filter(e => e.type === "custom" && e.customType === "session-meta") }));
  await abandonThread(ordinary.id);

  const dying = await spawn({ cwd: f.cwd, run: "worker-fixture", handle: "pid-worker", model: f.model, effort: "off", prompt: "Reply only done pid-ready. Do not use tools." });
  await wait([dying], { timeoutMs: 90_000 });
  await dying.observe(await listThreads());
  const live = await until(() => readLive().find(l => l.sessionId === dying.threadId));
  const liveFile = join(root, "state/pi-live", live.pid + ".json");
  await rename(liveFile, liveFile + ".held");
  await dying.observe(await listThreads());
  const missingStatus = await dying.status().catch(error => error.message);
  console.log(JSON.stringify({ event: "alive-without-record", status: missingStatus, result: [...(await wait([dying], { timeoutMs: 1500 })).values()] }));
  await rename(liveFile + ".held", liveFile);
  const corrupt = join(root, "state/pi-live/broken.json");
  await writeFile(corrupt, "invalid json");
  console.log(JSON.stringify({ event: "live-read-failure", result: [...(await wait([dying], { timeoutMs: 1500 })).values()] }));
  await rm(corrupt);
  const good = process.env.ZMX_DIR!;
  await writeFile(join(root, "not-a-directory"), "");
  process.env.ZMX_DIR = join(root, "not-a-directory");
  console.log(JSON.stringify({ event: "backend-failure", result: [...(await wait([dying], { timeoutMs: 1500 })).values()] }));
  process.env.ZMX_DIR = good;
  process.kill(live.pid, "SIGKILL");
  console.log(JSON.stringify({ event: "pid-killed", pid: live.pid, result: [...(await wait([dying], { timeoutMs: 3000 })).values()] }));
  console.log(JSON.stringify({ event: "discard-close", cleanup: await dying.close(), branch: git(f.cwd, "branch", "--list", dying.handle) }));
} else if (action === "supervisor" || action === "join") {
  const prompt = "Session mode: hacking. You are driving a disposable worker fixture from branch owner. Use tools.dispatch, tools.board_read and tools.integrate/retire from the loaded package; do not import the library or invoke another checkout. Run prefix tool-fixture. Dispatch one at a time, using model " + f.model + " effort off and maxConcurrent 1 active []. Worker one named tool-integrate writes integrated.txt containing ok and commits it; its task ends done. Read its fresh done on tool-fixture/tool-integrate, then integrate it (no keep). Worker two tool-keep writes kept.txt and commits, reports done; integrate keep:true, then retire it. Worker three tool-unmerged writes unmerged.txt and commits, reports done; retire without integrating, its branch must be kept. Await reports over the board (not terminal text); do not retire while it is working. You may end intermediate turns to receive reports; your own final response only after all three are handled starts done fixture-dispatch-complete and gives the receipts and integration/retirement results in fenced yaml. No other work.";
  const cwd = action === "join" ? packagePath : f.cwd;
  process.chdir(cwd);
  const inventory = async () => {
    const cli = Bun.spawn([join(packagePath, "bin/ab"), "thread", "ls", "--json"], { cwd, env: process.env, stdout: "pipe", stderr: "pipe" });
    const [code, out, err] = await Promise.all([cli.exited, new Response(cli.stdout).text(), new Response(cli.stderr).text()]);
    if (code) throw new Error(err);
    return { cwd, branch: git(cwd, "branch", "--show-current"), head: git(cwd, "rev-parse", "HEAD"),
      worktrees: git(cwd, "worktree", "list", "--porcelain"), branches: git(cwd, "branch", "--list"),
      cliThreads: JSON.parse(out), zmx: await zmx(["ls"]) };
  };
  const before = await inventory();
  const handle = "join-" + root.split("-").at(-1);
  const joinPrompt = "Session mode: hacking. Drive a single trivial worker using freshly loaded tools.dispatch, tools.board_read and tools.integrate in this checkout, not library imports or another checkout. Run prefix thread-join, handle " + handle + ". model " + f.model + ", effort off, maxConcurrent 1, active []. Worker task: run git commit --allow-empty -m 'Exercise worker thread integration', then report done with its commit SHA; no file edits or other work. Inspect the worker's branch.<handle>.ab-parent and record the dispatcher's current branch: they must match even though this is a non-main checkout. Await its fresh done on thread-join/" + handle + " over the board before integrating (no keep). Do not use terminal text as a report or retire working agents. Final response starts done fixture-join-complete and includes fenced yaml with receipt, parentBranch, worker commit, board report id and integration result. You may end intermediate turns to receive board reports. No unrelated work.";
  const supervisor = await newThread({ cwd, in: cwd, launch: { args: ["--approve", "--model", f.model, "--thinking", "off"], prompt: action === "join" ? joinPrompt : prompt } });
  console.log(JSON.stringify({ event: "driving-pi", id: supervisor.id, cwd, before }));
  const report = await until(() => { const m = latest("thread/" + supervisor.id); return m?.body.startsWith(action === "join" ? "done fixture-join-complete" : "done fixture-dispatch-complete") ? m : undefined; }, 600);
  console.log(JSON.stringify({ event: "tool-dispatch-complete", report, after: await inventory(), files: git(cwd, "ls-tree", "--name-only", "HEAD") }));
  await abandonThread(supervisor.id);
  console.log(JSON.stringify({ event: "driving-pi-retired", after: await inventory() }));
} else if (action === "reconcile") {
  await mkdir(join(f.cwd, "docs/issues"), { recursive: true });
  const project = "repo";
  for (const [slug, parent] of [["fixture-root", ""], ["fixture-nested", "fixture-root"], ["fixture-leaf", "fixture-nested"]]) {
    await writeFile(join(f.cwd, "docs/issues", slug + ".md"), "---\nstage: ticket\nassignee: agent:fixture\nauthor: user:fixture\n" + (parent ? 'part-of: "[[projects/' + project + "/issues/" + parent + ']]"\n' : "") + "---\n\nDisposable first-use fixture. Leaf writes leaf.txt containing fixture-ok; ancestors carry it into owner without changing main.\n");
  }
  git(f.cwd, "add", "docs"); git(f.cwd, "commit", "-qm", "Two-level reconciler fixture");
  const lineage: Record<string, unknown> = {};
  const captureLineage = async () => {
    for (const t of await allThreads()) if (t.worker?.run === "fixture-root" && t.branch) {
      let parent: string; try { parent = git(f.project, "config", "--get", "branch." + t.branch + ".ab-parent"); } catch { continue; }
      lineage[t.id] = { id: t.id, handle: t.worker.handle, branch: t.branch, parent };
    }
    for (const [slug, collector] of Object.entries(campaigns(f.cwd)[0]?.collectors ?? {})) lineage["collector/" + slug] = collector;
    await writeFile(join(root, "lineage.json"), JSON.stringify(lineage, null, 2));
  };
  let daemon = start({ cwd: f.cwd, root: "fixture-root", owner: "mail/fixture", budget: 1 });
  console.log(JSON.stringify({ event: "daemon", ...daemon, state: stateFile(f.cwd, "fixture-root") }));
  const first = await until(() => campaigns(f.cwd)[0]?.chains["fixture-leaf"]?.handle);
  await until(() => readLive().find(l => l.sessionId === first.threadId));
  await captureLineage();
  await zmx(["kill", first.threadId! + ".agent", "--force"]);
  process.kill(daemon.pid, "SIGTERM");
  console.log(JSON.stringify({ event: "forced-exit", worker: first, daemon: daemon.pid }));
  await sleep(125_000); // real startup grace, not edited state
  daemon = start({ cwd: f.cwd, root: "fixture-root", owner: "mail/fixture", budget: 1 });
  console.log(JSON.stringify({ event: "daemon-restart", ...daemon }));
  const state = await until(async () => { await captureLineage(); const s = campaigns(f.cwd)[0]; return s?.finished ? s : undefined; }, 900);
  const records = await allThreads(true);
  console.log(JSON.stringify({ event: "reconciled", state, lineage, workers: records.filter(t => t.worker?.run === "fixture-root").map(t => ({ id: t.id, worker: t.worker, archived: t.archived })), owner: git(f.cwd, "log", "--format=%s"), main: git(f.project, "log", "--format=%s"), terminals: await terminals() }));
} else if (action === "inspect") {
  console.log(JSON.stringify({ fixture: f, threads: (await allThreads(true)).map(t => ({ id: t.id, session: t.sessionId, cwd: t.cwd, worker: t.worker, archived: t.archived })), live: readLive(), terminals: await terminals(), reconcilers: campaigns(f.cwd) }, null, 2));
} else if (action === "cleanup") {
  for (const s of campaigns(f.cwd)) if (s.running && s.pid) process.kill(s.pid, "SIGTERM");
  for (const t of await allThreads()) await abandonThread(t.id, { keepBranch: true });
  for (const terminal of await terminals()) await zmx(["kill", terminal.name, "--force"]);
  const worktrees = git(f.project, "worktree", "list", "--porcelain").split("\n").filter(l => l.startsWith("worktree ")).map(l => l.slice(9));
  process.chdir(packagePath);
  for (const path of worktrees) if (path !== f.project) git(f.project, "worktree", "remove", "--force", path);
  console.log(JSON.stringify({ event: "cleaned", terminals: await terminals(), activeThreads: await allThreads() }));
  await rm(root, { recursive: true, force: true });
} else throw new Error("Unknown action: " + action);
