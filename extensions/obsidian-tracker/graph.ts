// Force-directed SVG of the issue network. Solid arrows run blocker to dependent; dashed lines join
// execution child to parent. Drag pins, double-click unpins, click opens. Colour follows the actor.
import type { Issue } from "./model.ts";

const NS = "http://www.w3.org/2000/svg";
const ACTOR_COLOR = { agent: "var(--color-green)", me: "var(--color-blue)", nobody: "var(--text-faint)" };

type Pos = { x: number; y: number; vx: number; vy: number; fixed: boolean };
type Edge = { from: string; to: string; kind: "part" | "blocks" };
type Hooks = {
  pinned: Record<string, [number, number]>;
  open: (i: Issue, ev: MouseEvent) => void;
  hover: (i: Issue, ev: MouseEvent, el: Element) => void;
  menu: (i: Issue, ev: MouseEvent) => void;
  pin: (pinned: Record<string, [number, number]>) => void;
  label: (i: Issue) => string;
};

export class Graph {
  private W = 900; private H = 600; private scale = 1;
  private pos = new Map<string, Pos>();
  private alpha = 1;
  private raf = 0;
  private drag: { id: string; moved: boolean; sx: number; sy: number } | null = null;
  private svg!: SVGSVGElement;
  private nodes: Issue[] = [];
  private edges: Edge[] = [];
  private els = new Map<string, { g: SVGGElement; circle: SVGCircleElement }>();
  private lines: { el: SVGLineElement; e: Edge }[] = [];

  constructor(private hooks: Hooks) {
    for (const [id, [x, y]] of Object.entries(hooks.pinned)) this.pos.set(id, { x, y, vx: 0, vy: 0, fixed: true });
  }

  mount(root: HTMLElement, nodes: Issue[]) {
    this.stop();
    this.nodes = nodes;
    const scale = this.scale = Math.max(1, Math.sqrt(nodes.length / 40));
    this.W = Math.round(900 * scale); this.H = Math.round(600 * scale);
    const ids = new Set(nodes.map((n) => n.id));
    this.edges = [];
    for (const n of nodes) {
      if (n.partOf && ids.has(n.partOf)) this.edges.push({ from: n.id, to: n.partOf, kind: "part" });
      for (const b of n.blockedBy) if (ids.has(b)) this.edges.push({ from: b, to: n.id, kind: "blocks" });
    }
    for (const n of nodes) {
      if (this.pos.has(n.id)) continue;
      const parent = n.partOf ? this.pos.get(n.partOf) : undefined;
      this.pos.set(n.id, { x: (parent?.x ?? this.W / 2) + (Math.random() - 0.5) * 120, y: (parent?.y ?? this.H / 2) + (Math.random() - 0.5) * 120, vx: 0, vy: 0, fixed: false });
    }

    const bar = root.createDiv({ cls: "trk-bar" });
    const shake = bar.createEl("button", { text: "shake" });
    shake.onclick = () => { for (const p of this.pos.values()) p.fixed = false; this.hooks.pin({}); this.alpha = 1; this.reheat(); };
    bar.createSpan({ cls: "trk-meta", text: `${nodes.length} nodes · ${this.edges.length} edges · drag pins, double-click unpins` });

    this.svg = root.createSvg("svg", { cls: "trk-graph", attr: { viewBox: `0 0 ${this.W} ${this.H}`, preserveAspectRatio: "xMidYMid meet" } });
    const marker = this.svg.createSvg("defs").createSvg("marker", { attr: { id: "trk-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" } });
    marker.createSvg("path", { attr: { d: "M0,0 L10,5 L0,10 z", fill: "var(--text-muted)" } });

    this.lines = this.edges.map((e) => {
      const el = this.svg.createSvg("line", { attr: e.kind === "part"
        ? { stroke: "var(--background-modifier-border)", "stroke-dasharray": "3 3" }
        : { stroke: "var(--text-muted)", "stroke-width": "1.5", "marker-end": "url(#trk-arrow)" } });
      return { el, e };
    });
    this.els.clear();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const linked = new Set(this.edges.flatMap((e) => [e.from, e.to]));
    for (const n of nodes) {
      const g = this.svg.createSvg("g", { cls: linked.has(n.id) ? ["trk-node"] : ["trk-node", "lone"] });
      g.createSvg("title").textContent = `${n.project}/${n.slug}\nown ${n.ownStage ?? "—"} · tree ${n.effectiveStage} · ${n.actor} · p${n.priority ?? "?"} · unblocks ${n.unblocksAll}`;
      const circle = g.createSvg("circle", { attr: { r: String(this.r(n)), fill: n.subtreeDone ? "var(--background-modifier-border)" : ACTOR_COLOR[n.actor], "stroke-width": "1.5", opacity: n.subtreeDone ? "0.5" : "1" } });
      const t = g.createSvg("text", { attr: { y: String(this.r(n) + 11), "text-anchor": "middle", "font-size": "10", fill: "var(--text-muted)" } });
      t.textContent = this.hooks.label(n);
      g.addEventListener("pointerdown", (ev) => { ev.preventDefault(); const p = this.point(ev); this.drag = { id: n.id, moved: false, sx: p.x, sy: p.y }; this.svg.setPointerCapture(ev.pointerId); });
      g.addEventListener("dblclick", () => { this.pos.get(n.id)!.fixed = false; this.savePins(); this.reheat(); });
      g.addEventListener("mouseover", (ev) => this.hooks.hover(n, ev, g));
      g.addEventListener("contextmenu", (ev) => this.hooks.menu(n, ev));
      this.els.set(n.id, { g, circle });
    }
    this.svg.addEventListener("pointermove", (ev) => {
      if (!this.drag) return;
      const p = this.point(ev), q = this.pos.get(this.drag.id)!;
      if (Math.hypot(p.x - this.drag.sx, p.y - this.drag.sy) > 3) this.drag.moved = true;
      if (this.drag.moved) { q.x = p.x; q.y = p.y; q.fixed = true; this.reheat(); }
    });
    const up = (ev: PointerEvent) => {
      const d = this.drag; this.drag = null;
      if (!d) return;
      if (d.moved) this.savePins(); else this.hooks.open(byId.get(d.id)!, ev);
    };
    this.svg.addEventListener("pointerup", up);
    this.svg.addEventListener("pointercancel", up);
    this.alpha = 1;
    this.reheat();
  }

  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private r(n: Issue) { return 5 + 2.5 * Math.sqrt(n.unblocksAll); }

  private point(ev: MouseEvent) {
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(this.svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }

  private savePins() {
    const pinned: Record<string, [number, number]> = {};
    for (const [id, p] of this.pos) if (p.fixed) pinned[id] = [Math.round(p.x), Math.round(p.y)];
    this.hooks.pin(pinned);
  }

  private reheat() {
    this.alpha = Math.max(this.alpha, 0.6);
    if (this.raf) return;
    const step = () => {
      this.tick();
      this.draw();
      this.raf = this.alpha > 0.02 ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }

  private tick() {
    const pos = this.pos, nodes = this.nodes, s = this.scale;
    for (const n of nodes) { const p = pos.get(n.id)!; p.vx = p.vy = 0; }
    for (let a = 0; a < nodes.length; a++) {
      const pa = pos.get(nodes[a].id)!;
      for (let b = a + 1; b < nodes.length; b++) {
        const pb = pos.get(nodes[b].id)!;
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        const d2 = dx * dx + dy * dy || 1;
        const f = 6000 * s * s * s / (d2 * Math.sqrt(d2));
        dx *= f; dy *= f;
        pa.vx += dx; pa.vy += dy; pb.vx -= dx; pb.vy -= dy;
      }
    }
    for (const e of this.edges) {
      const a = pos.get(e.from)!, b = pos.get(e.to)!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = (e.kind === "blocks" ? 110 : 70) * s;
      const k = (e.kind === "blocks" ? 0.06 : 0.03) * (d - rest) / d;
      a.vx += dx * k; a.vy += dy * k; b.vx -= dx * k; b.vy -= dy * k;
    }
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      p.vx += (this.W / 2 - p.x) * 0.02; p.vy += (this.H / 2 - p.y) * 0.02;
      if (p.fixed) continue;
      p.x = Math.max(20, Math.min(this.W - 20, p.x + p.vx * this.alpha));
      p.y = Math.max(20, Math.min(this.H - 20, p.y + p.vy * this.alpha));
    }
    this.alpha *= 0.985;
  }

  private draw() {
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    for (const { el, e } of this.lines) {
      const a = this.pos.get(e.from)!, b = this.pos.get(e.to)!;
      let x2 = b.x, y2 = b.y;
      if (e.kind === "blocks") {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, rb = this.r(byId.get(e.to)!) + 2;
        x2 -= (dx / d) * rb; y2 -= (dy / d) * rb;
      }
      el.setAttr("x1", a.x); el.setAttr("y1", a.y); el.setAttr("x2", x2); el.setAttr("y2", y2);
    }
    for (const [id, { g, circle }] of this.els) {
      const p = this.pos.get(id)!;
      g.setAttr("transform", `translate(${p.x},${p.y})`);
      circle.setAttr("stroke", p.fixed ? "var(--text-normal)" : "var(--background-primary)");
    }
  }
}
