/** A Playwright page as a computer `UI`: aria snapshot in, getByRole out, so a drive
 * replays through the locator it drove with. The caller owns the browser and the page;
 * nothing here imports Playwright, only the page's methods are used. */
import { createHash } from "node:crypto";
import type { Action, Event, UI, UIResult, Walked } from "../computer.ts";

/** The Playwright `Page` surface used, structurally, so any project's copy of Playwright fits. */
export interface PageLike {
  url(): string;
  title(): Promise<string>;
  locator(selector: string): { ariaSnapshot(): Promise<string>; ariaSnapshotJSON(options: { mode: "ai" }): Promise<unknown> };
  getByRole(role: any, options: { name: string; exact: true }): Locator;
  getByPlaceholder(text: string, options: { exact: true }): Locator;
  screenshot(options?: { path?: string }): Promise<Uint8Array>;
  waitForLoadState(state: "networkidle"): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  mouse: { wheel(dx: number, dy: number): Promise<void> };
}
interface Locator {
  count(): Promise<number>;
  first(): Locator;
  click(options?: { timeout?: number }): Promise<void>;
  fill(text: string): Promise<void>;
  inputValue(): Promise<string>;
}

/** Roles a person acts on by name; the same vocabulary the recorded spec replays with. */
const pressable = ["button", "link", "checkbox", "radio", "switch", "tab", "option", "menuitem", "menuitemcheckbox", "menuitemradio", "treeitem"];
const typable = ["textbox", "searchbox", "combobox", "spinbutton"];
/** Structure a person reads to know where they are; kept as context, never acted on. */
const landmark = new Set(["main", "navigation", "banner", "heading", "dialog", "alert", "status", "region", "form"]);
/** Readable text kept per observation. A transcript grows downward, so the tail is the
 * current step; the head is the stale state that costs accuracy. */
const textLines = 80;

type Aria = { role?: string; name?: string; text?: string; ref?: string; disabled?: boolean; placeholder?: string; value?: string; children?: unknown };
const arias = (value: unknown): Aria[] => Array.isArray(value) ? value.filter(isAria) : isAria(value) ? [value] : [];
const isAria = (value: unknown): value is Aria => typeof value === "object" && value !== null;

export interface Options {
  /** How the caller names this page in `apps`. */
  app?: string;
  /** Settle time after an action before the successor observation. */
  settleMs?: number;
}

export function browser(page: PageLike, options: Options = {}): UI {
  const app = options.app ?? "page";
  let epoch = 0;
  let current = "";
  const observe = async (visual: boolean): Promise<UIResult> => {
    await page.waitForLoadState("networkidle").catch(() => {});
    const json = await page.locator("body").ariaSnapshotJSON({ mode: "ai" });
    const text = await page.locator("body").ariaSnapshot();
    const nodes: any[] = [];
    const lines: string[] = [];
    let n = 0;
    const walk = (aria: Aria, path: string[]) => {
      const role = aria.role ?? "";
      const name = (aria.name ?? "").trim();
      const own = (aria.text ?? "").trim();
      const kids = arias(aria.children);
      const where = path.slice(-2).join(" › ");
      if (landmark.has(role) && (name || role === "main")) lines.push(role + (name ? ' "' + name + '"' : ""));
      if (own && !name && !kids.length) lines.push("text: " + own.slice(0, 160));
      const acts = pressable.includes(role) ? "press" : typable.includes(role) ? "type" : undefined;
      const placeholder = (aria.placeholder ?? "").trim();
      const label = name || own || placeholder;
      if (aria.ref && acts && !aria.disabled && label) {
        const named = Boolean(name || own);
        const locator = named
          ? "page.getByRole(" + JSON.stringify(role) + ", { name: " + JSON.stringify(label) + ", exact: true })"
          : "page.getByPlaceholder(" + JSON.stringify(label) + ", { exact: true })";
        nodes.push({ ref: "n" + n++, role, title: label, description: where || undefined, value: aria.value, locator,
          canPress: acts === "press", isTextInput: acts === "type", canSetValue: acts === "type", aria: aria.ref });
      }
      const next = landmark.has(role) && (name || role === "main") ? [...path, name || role] : path;
      for (const kid of kids) walk(kid, next);
    };
    for (const aria of arias(json)) walk(aria, []);
    const stateId = "s" + ++epoch;
    current = stateId;
    const content: unknown[] = [{ type: "text", text: lines.slice(-textLines).join("\n") }];
    if (visual) content.push({ type: "image", data: Buffer.from(await page.screenshot()).toString("base64"), mimeType: "image/png" });
    return { content, details: { capture: { stateId }, target: { app }, url: page.url(), title: await page.title(), text,
      outline: { root: { ref: "root", role: "page", title: await page.title(), children: [...nodes, { ref: "text", role: "text", text: lines.slice(-textLines) }] } } } };
  };
  /** Resolve a node's locator; `.first()` when the name is ambiguous, as the replay does. */
  const locate = async (node: any) => {
    const named = !node.locator.startsWith("page.getByPlaceholder");
    const found: Locator = named ? page.getByRole(node.role, { name: node.title, exact: true }) : page.getByPlaceholder(node.title, { exact: true });
    const count = await found.count();
    return { locator: count > 1 ? found.first() : found, count, source: node.locator + (count > 1 ? ".first()" : "") };
  };
  let last: UIResult | undefined;
  return {
    async findRoots() { return { details: { windows: [{ app, windowRef: "page", title: await page.title() }] } }; },
    async observe({ mode }) { last = await observe(mode === "visual"); return last; },
    async act({ stateId, actions }) {
      if (stateId !== current) return { isError: true, content: [{ type: "text", text: "Stale observation " + stateId }] };
      const outline = last?.details?.outline;
      const execution: { outcome: "did" | "didnt" | "unknown"; error?: unknown } = { outcome: "did" };
      try {
        for (const action of actions as Action[]) {
          const node = nodes(outline?.root).find(n => n.ref === action.ref);
          if (!node) throw new Error("No node " + action.ref);
          if (action.action === "scroll") { await page.mouse.wheel(0, action.scrollY ?? 500); continue; }
          const { locator, count } = await locate(node);
          if (!count) throw new Error("No locator for " + node.locator);
          if (action.action === "press") await locator.click({ timeout: 15_000 });
          else await fill(page, locator, action.text ?? "");
        }
      } catch (error) {
        execution.outcome = "didnt";
        execution.error = error instanceof Error ? error.message : String(error);
      }
      await page.waitForTimeout(options.settleMs ?? 600);
      const after = await observe(false);
      last = after;
      return { ...after, details: { ...after.details, execution } };
    },
  };
}
const nodes = (node: any): any[] => node ? [node, ...(node.children ?? []).flatMap(nodes)] : [];

/** A field that re-mounts as it loads can drop what was just typed, so typing is done only
 * once the field holds it. The recorded spec's `toPass` block is the same rule under the runner. */
async function fill(page: PageLike, locator: Locator, text: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await locator.fill(text);
    await page.waitForTimeout(800);
    if ((await locator.inputValue()) === text) return;
  }
  throw new Error("the field did not keep what was typed into it");
}

/** Lines of the aria snapshot present after an action and not before. */
export function appeared(event: Event): string[] {
  const before: string = event.observations.at(-1)?.details?.text ?? "";
  const after: string = event.outcome?.details?.text ?? "";
  const had = new Set(before.split("\n").map(l => l.trim()));
  return after.split("\n").filter(l => l.trim() && !had.has(l.trim())).slice(0, 12);
}

const camel = (s: string) => s.replace(/[^a-z0-9]+(.)/gi, (_, c: string) => c.toUpperCase());

/** The walk as a Playwright block a reviewer asserts into: one comment per step, each action
 * as the locator it was driven through, and what appeared as commented candidates. Asserts nothing. */
export function spec(story: string, guide: string, steps: readonly { label: string; expect: string }[], walked: readonly Walked[], inputs: Record<string, string> = {}): string {
  const lines = [
    "// Recorded from " + guide + " for " + story + ".",
    "// Jev chose each action once; what this block checks is what a reviewer wrote",
    "// into it. Re-drive a failing step to re-record only that block.",
    'import { expect, type Page } from "@playwright/test";',
    'import drive from "../drives/' + story + '";',
    "",
    "export async function " + camel(story) + "(page: Page): Promise<void> {",
  ];
  walked.forEach((w, i) => {
    lines.push("  // " + (i + 1) + ". " + w.label + ": " + (steps[i]?.expect ?? "") + (w.status === "done" ? "" : " [" + w.status + "]"));
    for (const event of w.trace) {
      const replay = event.selected?.replay;
      if (!replay || event.status === "error" || event.status === "denied") continue;
      const filled = /^(.*)\.fill\((".*")\)$/.exec(replay);
      if (filled) {
        const key = Object.entries(inputs).find(([, v]) => v === JSON.parse(filled[2]!))?.[0];
        const value = key ? 'drive.inputs[' + JSON.stringify(key) + ']' : filled[2];
        lines.push("  await expect(async () => {", "    await " + filled[1] + ".fill(" + value + ");", "    await expect(" + filled[1] + ").toHaveValue(" + value + ");", "  }).toPass();");
      } else lines.push("  await " + replay + ";");
      for (const line of appeared(event).slice(0, 4)) lines.push("  // appeared: " + line.trim());
    }
  });
  lines.push("}", "");
  return lines.join("\n");
}

/** What the reviewer reads against the story's checks, one row per action. */
export function sheet(story: string, walked: readonly Walked[]): string {
  const rows = ["# " + story, ""];
  walked.forEach((w, i) => {
    rows.push("## " + (i + 1) + ". " + w.label + " — " + w.status + (w.contested ? " (contested)" : ""));
    for (const e of w.trace) {
      const s = e.selected;
      const shown = e.showing === undefined ? "" : " showing " + e.showing.toFixed(2);
      rows.push("- " + (s ? s.description + " (" + (e.decision?.p ?? 0).toFixed(2) + ")" : e.status + (e.reason ? ": " + e.reason : "")) + shown);
      for (const line of s ? appeared(e) : []) rows.push("  - appeared: " + line.trim());
    }
    rows.push("");
  });
  return rows.join("\n");
}
