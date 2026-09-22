import { BasesView, Keymap, Menu, Plugin, TFile, type QueryController } from "obsidian";
import { model, type Issue, type Model } from "./model.ts";

export const MODES = ["tree", "frontier", "mine", "done", "invalid", "legacy", "all"] as const;
type Mode = (typeof MODES)[number];

const ACTOR_COLOR = { agent: "var(--color-green)", me: "var(--color-blue)", nobody: "var(--text-faint)" };

export class TrackerView extends BasesView {
  type = "tracker";
  private root: HTMLElement;
  private toggled = new Set<string>();

  constructor(controller: QueryController, containerEl: HTMLElement, private plugin: Plugin) {
    super(controller);
    this.root = containerEl.createDiv({ cls: "trk" });
  }

  private option<T>(key: string, fallback: T): T {
    const v = this.config.get(key);
    return v === undefined || v === null ? fallback : (v as T);
  }

  private notes() {
    return this.app.vault.getMarkdownFiles()
      .filter((f) => /^projects\/[^/]+\/issues\/(?:archive\/)?[^/]+\.md$/.test(f.path))
      .map((f) => ({ path: f.path, frontmatter: this.app.metadataCache.getFileCache(f)?.frontmatter }));
  }

  onDataUpdated() {
    const mode = this.option<Mode>("mode", "tree");
    const showDone = this.option("showDone", false);
    const includeDeferred = this.option("includeDeferred", false);
    this.toggled = new Set(this.option<string[]>("toggled", []));
    const m = model(this.notes(), { includeDeferred });
    const visible = new Set(this.data.data.map((e) => e.file.path.replace(/\.md$/, "")));
    const keep = (i: Issue) => visible.has(i.id);
    const showProject = new Set([...visible].map((id) => id.split("/")[1])).size > 1;
    this.root.empty();
    let rows: Issue[];
    if (mode === "tree") {
      const roots = m.roots.filter((i) => !i.legacy && (showDone || !i.subtreeDone) && this.reaches(i, keep, showDone));
      if (!roots.length) this.empty();
      for (const r of roots) this.node(this.root, r, keep, showDone, showProject, 0);
      return;
    } else if (mode === "all") rows = [...m.issues.values()].filter((i) => !i.legacy && (showDone || !i.subtreeDone));
    else rows = m[mode];
    rows = rows.filter(keep);
    if (!rows.length) this.empty();
    for (const i of rows) this.row(this.root, i, showProject);
  }

  private empty() { this.root.createDiv({ cls: "trk-empty", text: "nothing" }); }

  // A subtree is drawn when any node in it passes the Base's filters.
  private reaches(i: Issue, keep: (i: Issue) => boolean, showDone: boolean, seen = new Set<string>()): boolean {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return keep(i) || i.children.some((c) => (showDone || !c.subtreeDone) && this.reaches(c, keep, showDone, seen));
  }

  private node(parent: HTMLElement, i: Issue, keep: (i: Issue) => boolean, showDone: boolean, showProject: boolean, depth: number) {
    const kids = depth > 50 ? [] : i.children.filter((c) => (showDone || !c.subtreeDone) && this.reaches(c, keep, showDone));
    const open = (depth < 2) !== this.toggled.has(i.id);
    const el = parent.createDiv();
    const toggle = createSpan({ cls: "trk-toggle", text: kids.length ? (open ? "▾" : "▸") : "" });
    if (kids.length) toggle.onclick = () => {
      if (this.toggled.has(i.id)) this.toggled.delete(i.id); else this.toggled.add(i.id);
      this.config.set("toggled", [...this.toggled]);
    };
    this.row(el, i, showProject, toggle, !keep(i));
    if (open && kids.length) {
      const sub = el.createDiv({ cls: "trk-tree" });
      for (const c of kids) this.node(sub, c, keep, showDone, showProject, depth + 1);
    }
  }

  private row(parent: HTMLElement, i: Issue, showProject: boolean, extra?: HTMLElement, dim = false) {
    const row = parent.createDiv({ cls: "trk-row" + (i.subtreeDone ? " done" : "") + (dim ? " dim" : "") });
    if (extra) row.appendChild(extra);
    const quiet = i.actor === "nobody";
    const badge = row.createSpan({ cls: "trk-badge", text: i.legacy ? `legacy: ${i.next ?? "unset"}` : `own ${i.ownStage === undefined ? "—" : String(i.ownStage)} · tree ${i.effectiveStage}` });
    badge.style.background = quiet ? "var(--background-secondary)" : ACTOR_COLOR[i.actor];
    badge.style.color = quiet ? "var(--text-muted)" : "var(--text-on-accent)";
    badge.title = i.errors.join("; ") || `assignee: ${i.assignee ?? "unassigned"}`;
    this.link(row, i);
    if (showProject) row.createSpan({ cls: "trk-proj", text: i.project });
    const meta = (text: string, title?: string) => { const s = row.createSpan({ cls: "trk-meta", text }); if (title) s.title = title; };
    meta(`p${i.priority ?? "?"}`);
    if (i.unblocksAll > 0) meta(`⤴${i.unblocksAll}`, "open issues this unblocks");
    if (i.errors.length) meta("⚠ invalid", i.errors.join("; "));
    if (i.claimedBy) meta(`⛏ ${i.claimedBy}`);
    else if (i.claims.length) meta(`⛏ tree ${i.claims.length}`, i.claims.map((n) => `${n.slug}: ${n.claimedBy}`).join("\n"));
    if (i.internalDependencies.length) meta(`↳ order ${i.internalDependencies.length}`, "Internal scheduling order\n" + i.internalDependencies.join("\n"));
    if (i.openBlockers.length) meta(`⏸ ${i.openBlockers.length}`, "Subtree external dependencies\n" + i.openBlockers.join("\n"));
  }

  private link(parent: HTMLElement, i: Issue) {
    const a = parent.createEl("a", { cls: "trk-title internal-link", text: i.slug, href: i.id });
    a.dataset.href = i.id;
    a.addEventListener("click", (ev) => { ev.preventDefault(); this.app.workspace.openLinkText(i.id, "", Keymap.isModEvent(ev)); });
    a.addEventListener("mouseover", (ev) => this.app.workspace.trigger("hover-link", { event: ev, source: "tracker", hoverParent: this, targetEl: a, linktext: i.id, sourcePath: "" }));
    a.addEventListener("contextmenu", (ev) => {
      const file = this.app.vault.getAbstractFileByPath(i.id + ".md");
      if (!(file instanceof TFile)) return;
      const menu = new Menu();
      this.app.workspace.trigger("file-menu", menu, file, "tracker");
      menu.showAtMouseEvent(ev);
    });
  }
}
