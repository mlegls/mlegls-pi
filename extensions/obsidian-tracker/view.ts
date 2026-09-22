import { BasesView, Keymap, Menu, Plugin, TFile, setIcon, type QueryController } from "obsidian";
import { model, type Issue, type Model } from "./model.ts";
import { Graph } from "./graph.ts";

export const MODES = ["tree", "graph", "frontier", "mine", "done", "invalid", "legacy", "all"] as const;
type Mode = (typeof MODES)[number];

const ACTOR_COLOR = { agent: "var(--color-green)", me: "var(--color-blue)", nobody: "var(--text-faint)" };

export class TrackerView extends BasesView {
  type = "tracker";
  private root: HTMLElement;
  private toggled = new Set<string>();
  private graph: Graph | null = null;

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

  // The Base's sort orders siblings and lists; without one, priority then slug (the model's order).
  private order: Map<string, number> = new Map();
  private sorted<T extends Issue>(xs: T[]): T[] {
    if (!this.order.size) return xs;
    const rank = (i: Issue) => this.order.get(i.id) ?? Number.MAX_SAFE_INTEGER;
    return [...xs].sort((a, b) => rank(a) - rank(b));
  }

  onDataUpdated() {
    const mode = this.option<Mode>("mode", "tree");
    const showDone = this.option("showDone", false);
    const includeDeferred = this.option("includeDeferred", false);
    this.toggled = new Set(this.option<string[]>("toggled", []));
    const m = model(this.notes(), { includeDeferred });
    const id = (e: { file: { path: string } }) => e.file.path.replace(/\.md$/, "");
    this.order = this.config.getSort().length ? new Map(this.data.data.map((e, n) => [id(e), n])) : new Map();
    const showProject = new Set(this.data.data.map((e) => id(e).split("/")[1])).size > 1;
    this.root.empty();
    if (mode === "graph") return this.drawGraph(m, new Set(this.data.data.map(id)), showDone);
    this.graph?.stop(); this.graph = null;
    const groups = this.data.groupedData;
    const grouped = groups.length > 1 || groups.some((g) => g.hasKey());
    for (const g of groups) {
      const visible = new Set(g.entries.map(id));
      const keep = (i: Issue) => visible.has(i.id);
      const into = grouped ? this.root.createDiv({ cls: "trk-group" }) : this.root;
      if (grouped) into.createDiv({ cls: "trk-h", text: g.hasKey() ? String(g.key) : "—" });
      if (mode === "tree") {
        const roots = this.sorted(m.roots.filter((i) => !i.legacy && (showDone || !i.subtreeDone) && this.reaches(i, keep, showDone)));
        if (!roots.length) this.empty(into);
        for (const r of roots) this.node(into, r, keep, showDone, showProject, 0);
        continue;
      }
      const pool = mode === "all" ? [...m.issues.values()].filter((i) => !i.legacy && (showDone || !i.subtreeDone)) : m[mode];
      const rows = this.sorted(pool.filter(keep));
      if (!rows.length) this.empty(into);
      for (const i of rows) this.row(into, i, showProject);
    }
    if (!groups.length) this.empty(this.root);
  }

  onunload() { this.graph?.stop(); }

  // Positions live in the Graph across data updates so nodes don't jump; pinned positions persist in the Base.
  private drawGraph(m: Model, visible: Set<string>, showDone: boolean) {
    const nodes = [...m.issues.values()].filter((i) => visible.has(i.id) && !i.legacy && (showDone || !i.subtreeDone));
    this.graph ??= new Graph({
      pinned: this.option<Record<string, [number, number]>>("pinned", {}),
      open: (i, ev) => this.app.workspace.openLinkText(i.id, "", Keymap.isModEvent(ev)),
      hover: (i, ev, el) => this.app.workspace.trigger("hover-link", { event: ev, source: "tracker", hoverParent: this, targetEl: el, linktext: i.id, sourcePath: "" }),
      menu: (i, ev) => this.fileMenu(i, ev),
      pin: (pinned) => this.config.set("pinned", pinned),
      label: (i) => i.slug,
    });
    this.graph.mount(this.root, nodes);
  }

  private fileMenu(i: Issue, ev: MouseEvent) {
    const file = this.app.vault.getAbstractFileByPath(i.id + ".md");
    if (!(file instanceof TFile)) return;
    const menu = new Menu();
    this.app.workspace.trigger("file-menu", menu, file, "tracker");
    menu.showAtMouseEvent(ev);
  }

  private empty(into: HTMLElement) { into.createDiv({ cls: "trk-empty", text: "nothing" }); }

  // A subtree is drawn when any node in it passes the Base's filters.
  private reaches(i: Issue, keep: (i: Issue) => boolean, showDone: boolean, seen = new Set<string>()): boolean {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return keep(i) || i.children.some((c) => (showDone || !c.subtreeDone) && this.reaches(c, keep, showDone, seen));
  }

  private node(parent: HTMLElement, i: Issue, keep: (i: Issue) => boolean, showDone: boolean, showProject: boolean, depth: number) {
    const kids = depth > 50 ? [] : this.sorted(i.children.filter((c) => (showDone || !c.subtreeDone) && this.reaches(c, keep, showDone)));
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
    const meta = (text: string, title?: string, icon?: string) => {
      const s = row.createSpan({ cls: "trk-meta" });
      if (icon) setIcon(s.createSpan({ cls: "trk-icon" }), icon);
      s.appendText(text);
      if (title) s.title = title;
    };
    meta(`p${i.priority ?? "?"}`);
    if (i.unblocksAll > 0) meta(String(i.unblocksAll), "open issues this unblocks", "lucide-arrow-up-from-line");
    if (i.errors.length) meta("invalid", i.errors.join("; "), "lucide-alert-triangle");
    if (i.claimedBy) meta(String(i.claimedBy), undefined, "lucide-pickaxe");
    else if (i.claims.length) meta(`tree ${i.claims.length}`, i.claims.map((n) => `${n.slug}: ${n.claimedBy}`).join("\n"), "lucide-pickaxe");
    if (i.internalDependencies.length) meta(`order ${i.internalDependencies.length}`, "Internal scheduling order\n" + i.internalDependencies.join("\n"), "lucide-corner-down-right");
    if (i.openBlockers.length) meta(String(i.openBlockers.length), "Subtree external dependencies\n" + i.openBlockers.join("\n"), "lucide-pause");
  }

  private link(parent: HTMLElement, i: Issue) {
    const a = parent.createEl("a", { cls: "trk-title internal-link", text: i.slug, href: i.id });
    a.dataset.href = i.id;
    a.addEventListener("click", (ev) => { ev.preventDefault(); this.app.workspace.openLinkText(i.id, "", Keymap.isModEvent(ev)); });
    a.addEventListener("mouseover", (ev) => this.app.workspace.trigger("hover-link", { event: ev, source: "tracker", hoverParent: this, targetEl: a, linktext: i.id, sourcePath: "" }));
    a.addEventListener("contextmenu", (ev) => this.fileMenu(i, ev));
  }
}
