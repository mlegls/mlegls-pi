#!/usr/bin/env bun

import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDocument, isAlias, isMap, isScalar, visit } from "yaml";
import { checkout, git } from "../../../../../../../lib/thread/git.ts";
import { BeeperOffline, fromBeeper, fromGmail, handle, type Entry, type Import } from "./sources.ts";

const stages = ["candidate", "messaged", "replied", "active", "dropped"] as const;
const verdicts = ["open", "confirm", "kill"] as const;
const statuses = ["active", "confirmed", "killed", "paused"] as const;
const sources = { beeper: fromBeeper, gmail: fromGmail };
type Source = keyof typeof sources;
type SyncState = Record<Source, string | null> & { errors: string[] };

function optionalRead<T>(read: () => T, fallback: T): T {
  try { return read(); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

function readSync(path: string): SyncState {
  const data = optionalRead(() => JSON.parse(readFileSync(path, "utf8")), {});
  return {
    beeper: data.beeper ?? null,
    gmail: data.gmail ?? null,
    errors: data.errors ?? [],
  };
}

function atomicWrite(path: string, text: string, mode: number) {
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    writeFileSync(temp, text, { mode, flag: "wx" });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

function string(v: unknown, key: string): string {
  if (typeof v !== "string" || !v.trim() || /[\r\n]/.test(v)) throw new Error(key + " must be a non-empty one-line string");
  return v.trim();
}

function date(v: unknown, key: string): string | null {
  if (v === undefined) return null;
  const s = string(v, key);
  const time = Date.parse(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== s) {
    throw new Error(key + " must be a valid YYYY-MM-DD date");
  }
  return s;
}

function enumValue<T extends string>(v: unknown, key: string, values: readonly T[]): T {
  if (!values.includes(v as T)) throw new Error(key + " must be one of " + values.join(", "));
  return v as T;
}

function mapping(v: unknown, key: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(key + " must be a mapping");
  return v as Record<string, unknown>;
}

function record(root: string, path: string) {
  const file = join(root, path);
  const source = readFileSync(file, "utf8");
  const front = source.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m);
  if (!front || front.index !== 0) throw new Error("missing YAML frontmatter");
  const doc = parseDocument(front[1], { strict: true, uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length) throw doc.errors[0] ?? doc.warnings[0];
  if (!isMap(doc.contents)) throw new Error("frontmatter must be a mapping");
  visit(doc, {
    Node(_, node) {
      if (isAlias(node) || node.tag) throw new Error("YAML aliases and explicit tags are not supported");
    },
    Pair(_, pair) {
      if (!isScalar(pair.key) || typeof pair.key.value !== "string" || pair.key.value === "<<") {
        throw new Error("YAML keys must be strings; merge keys are not supported");
      }
    },
  });
  return {
    slug: basename(path, ".md"), path, file, doc,
    fields: mapping(doc.toJS({ maxAliasCount: 0 }), "frontmatter"),
    body: source.slice(front[0].length),
  };
}

function hypothesis(r: ReturnType<typeof record>) {
  date(r.fields.started, "started");
  return {
    slug: r.slug, path: r.path,
    status: enumValue(r.fields.status, "status", statuses),
    bar: r.fields.bar === undefined ? "" : string(r.fields.bar, "bar"),
    summary: r.body.replace(/^#+[ \t]+.*$/gm, "").trim().split(/\r?\n[ \t]*\r?\n/, 1)[0].replace(/\s+/g, " "),
  };
}

type LogEntry = { minute: string; direction: Entry["direction"]; id: string | null };

function log(body: string) {
  const header = /^## Log[ \t]*\r?$/m.exec(body);
  if (!header) return { entries: [] as LogEntry[], end: body.length, exists: false };
  const start = header.index + header[0].length;
  const tail = body.slice(start);
  const next = /^##? [^\n]*/m.exec(tail);
  const section = tail.slice(0, next?.index ?? tail.length);
  const entries = Array.from(section.matchAll(/^### (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · [^\r\n]+ · (inbound|outbound)[ \t]*\r?$(?:\n[ \t]*\r?)*?(?:\n[ \t]*id:[ \t]*(\S+)[ \t]*\r?$)?/gm),
    ([, minute, direction, id]): LogEntry => ({ minute, direction: direction as Entry["direction"], id: id ?? null }));
  return { entries, end: start + section.length, exists: true };
}

function lastByTime(entries: LogEntry[], direction?: Entry["direction"]): LogEntry | undefined {
  let latest: LogEntry | undefined;
  for (const entry of entries) {
    if ((!direction || entry.direction === direction) && (!latest || entry.minute >= latest.minute)) latest = entry;
  }
  return latest;
}

function contact(r: ReturnType<typeof record>) {
  const f = r.fields;
  const raw = f.hypothesis === undefined ? [] : Array.isArray(f.hypothesis) ? f.hypothesis : [f.hypothesis];
  const channels = Object.fromEntries(Object.entries(mapping(f.channels, "channels")).map(([key, value]) => {
    if (!/^[a-z][a-z0-9_-]*$/.test(key)) throw new Error("invalid channel " + key);
    const s = string(value, "channels." + key);
    if (!handle(key, s)) throw new Error("empty handle for channels." + key);
    return [key, s];
  }));
  const priority = f.priority;
  if (priority !== undefined && priority !== 1 && priority !== 2 && priority !== 3 && priority !== 4) {
    throw new Error("priority must be 1, 2, 3 or 4");
  }
  return {
    slug: r.slug, path: r.path,
    name: string(f.name, "name"),
    hypotheses: [...new Set(raw.map(v => string(v, "hypothesis")))],
    stage: enumValue(f.stage, "stage", stages),
    verdict: f.verdict === undefined ? "open" as const : enumValue(f.verdict, "verdict", verdicts),
    priority: priority ?? null, channels,
    lastContacted: date(f.last_contacted, "last_contacted"),
    lastReply: date(f.last_reply, "last_reply"),
    nextFollowup: date(f.next_followup, "next_followup"),
  };
}

function load(root: string) {
  function read<T>(kind: string, parse: (r: ReturnType<typeof record>) => T) {
    const dir = "docs/outreach/" + kind;
    return optionalRead(() => readdirSync(join(root, dir), { withFileTypes: true }), [])
      .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
      .map(entry => entry.name).sort().map(name => {
        const path = dir + "/" + name;
        try {
          const r = record(root, path);
          if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(r.slug)) throw new Error("invalid slug");
          return { record: r, value: parse(r) };
        } catch (err) {
          throw new Error(path + ": " + message(err));
        }
      });
  }
  const hypotheses = read("hypotheses", hypothesis).map(r => r.value);
  const slugs = new Set(hypotheses.map(h => h.slug));
  const people = read("people", contact);
  const seen = new Map<string, string>();
  for (const { value: person } of people) {
    for (const h of person.hypotheses) {
      if (!slugs.has(h)) throw new Error(person.path + ": unknown hypothesis " + h);
    }
    for (const [channel, value] of Object.entries(person.channels)) {
      const key = channel + ":" + handle(channel, value);
      if (seen.has(key)) throw new Error(person.path + ": duplicate " + channel + " handle also in " + seen.get(key));
      seen.set(key, person.path);
    }
  }
  return { hypotheses, people };
}

function snapshot(vault: ReturnType<typeof load>, root: string, lastSync: SyncState) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const people = vault.people.map(({ record: r, value: p }) => {
    const { entries } = log(r.body);
    const latest = lastByTime(entries);
    const outbound = lastByTime(entries, "outbound");
    const replied = p.stage === "replied" || (latest?.direction === "inbound"
      && (!p.lastContacted || latest.minute.slice(0, 10) > p.lastContacted
        || (outbound?.minute.slice(0, 10) === p.lastContacted && latest.minute >= outbound.minute)));
    const due = p.stage !== "candidate" && p.stage !== "dropped" && p.nextFollowup && p.nextFollowup <= today;
    return {
      ...p,
      queueReason: replied ? "replied" : due ? "due" : null,
      queueHash: createHash("sha256").update(JSON.stringify([
        p.stage, p.lastReply, p.nextFollowup, entries.length, entries.at(-1)?.id ?? null,
      ])).digest("hex"),
    };
  });
  return { schemaVersion: 1, root, repo: basename(root), at: now.getTime(), lastSync, hypotheses: vault.hypotheses, people };
}

function apply(root: string, imports: Import[], dryRun: boolean) {
  const current = new Map(load(root).people.map(p => [p.value.slug, p]));
  // Plan all writes before publishing so a bad source record can't partially mutate the vault.
  const changes: { file: string; text: string }[] = [];
  let count = 0;
  for (const batch of imports) {
    const row = current.get(batch.contact.slug);
    if (!row || JSON.stringify(row.value.channels) !== JSON.stringify(batch.contact.channels)) {
      throw new Error(batch.contact.slug + ": channels changed during sync; retry");
    }
    const { record: r, value: p } = row;
    const prior = log(r.body);
    const ids = new Set(prior.entries.map(e => e.id));
    const entries = batch.entries.map(entry => {
      if (!entry.id || /\s/.test(entry.id)) throw new Error("invalid source message ID");
      return { ...entry, at: new Date(entry.at).toISOString() };
    }).sort((a, b) => a.at.localeCompare(b.at)).filter(entry => {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    });
    const pin = batch.chatID && !p.channels.beeper_chat_id;
    if (!entries.length && !pin) continue;
    if (pin) {
      if ([...current.values()].some(other => other.value.channels.beeper_chat_id === batch.chatID)) {
        throw new Error(p.slug + ": chat ID already assigned; check channels");
      }
      r.doc.setIn(["channels", "beeper_chat_id"], batch.chatID);
    }

    let stage = p.stage;
    let lastContacted = p.lastContacted;
    let lastReply = p.lastReply;
    let lastOutbound = lastByTime(prior.entries, "outbound")?.minute ?? "";
    const appended = [];
    for (const entry of entries) {
      const day = entry.at.slice(0, 10);
      const minute = entry.at.slice(0, 16).replace("T", " ");
      if (entry.direction === "inbound") {
        if (!lastReply || day > lastReply) lastReply = day;
        if ((stage === "candidate" || stage === "messaged") && (!lastContacted || day >= lastContacted) && minute >= lastOutbound) stage = "replied";
      } else {
        if (!lastContacted || day > lastContacted) lastContacted = day;
        if (minute > lastOutbound) lastOutbound = minute;
        if (stage === "candidate") stage = "messaged";
      }
      const quoted = entry.text.trim().split(/\r?\n/).map(line => "> " + line).join("\n");
      appended.push("### " + minute + " · " + entry.channel + " · " + entry.direction + "\nid: " + entry.id + "\n\n" + quoted);
    }
    if (stage !== p.stage) r.doc.set("stage", stage);
    if (lastContacted !== p.lastContacted) r.doc.set("last_contacted", lastContacted);
    if (lastReply !== p.lastReply) r.doc.set("last_reply", lastReply);
    const before = r.body.slice(0, prior.end);
    const after = r.body.slice(prior.end);
    const gap = /\r?\n\r?\n$/.test(before) ? "" : /\r?\n$/.test(before) ? "\n" : "\n\n";
    const body = appended.length
      ? before + gap + (prior.exists ? "" : "## Log\n\n") + appended.join("\n\n") + "\n" + (after ? "\n" + after : "")
      : r.body;
    changes.push({ file: r.file, text: "---\n" + r.doc.toString({ lineWidth: 0 }) + "---\n" + body });
    count += entries.length;
  }
  if (!dryRun) {
    for (const change of changes) atomicWrite(change.file, change.text, statSync(change.file).mode & 0o777);
  }
  return { messages: count, records: changes.length };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function sync(root: string, statePath: string, selected: Source[], dryRun: boolean) {
  let failed = false;
  for (const source of selected) {
    let errorNote: string | undefined;
    let changed = false;
    try {
      const contacts = load(root).people.map(row => row.value);
      const imports = await sources[source](contacts);
      const { messages, records } = apply(root, imports, dryRun);
      changed = records > 0;
      if (changed || dryRun) console.log(source + (dryRun ? " would import " : " imported ") + messages + " message(s) across " + records + " record(s)");
    } catch (err) {
      errorNote = source + ": " + message(err);
      console.error(errorNote);
      if (!(err instanceof BeeperOffline)) failed = true;
    }
    if (!dryRun) {
      const state = readSync(statePath);
      state.errors = state.errors.filter(err => !err.startsWith(source + ":"));
      if (errorNote) state.errors.push(errorNote);
      else state[source] = new Date().toISOString();
      atomicWrite(statePath, JSON.stringify(state, null, 2) + "\n", 0o600);
    }
  }
  if (failed) process.exitCode = 1;
}

async function main([command, ...args]: string[]) {
  const expected = command === "snapshot" ? ["--json"] : command === "check" ? []
    : command === "sync" ? ["--beeper", "--gmail", "--dry-run"] : undefined;
  if (!expected || args.some(a => !expected.includes(a)) || (command === "snapshot" && !args.includes("--json"))) {
    throw new Error("usage: outreach.ts snapshot --json | check | sync [--beeper] [--gmail] [--dry-run]");
  }
  const cwd = process.cwd();
  const root = checkout(cwd).project;
  const statePath = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "outreach-sync.json");
  if (command === "sync") {
    const explicit = (["beeper", "gmail"] as const).filter(source => args.includes("--" + source));
    await sync(root, statePath, explicit.length ? explicit : ["beeper", "gmail"], args.includes("--dry-run"));
  } else {
    const vault = load(root);
    if (command === "snapshot") console.log(JSON.stringify(snapshot(vault, root, readSync(statePath))));
    else console.log("outreach: " + vault.hypotheses.length + " hypotheses, " + vault.people.length + " people");
  }
}

try { await main(process.argv.slice(2)); }
catch (error) { console.error(message(error)); process.exitCode = 1; }
