// Timeline of a session tree: one lane per session with its segments (model, tool, and the gap
// kinds from profile.ts), plus a "you" lane of your turns across every interactive session, so an
// "asked" gap shows whether you were away or busy elsewhere.
//   bun lib/timeline.ts [SESSION] [--days N] [--out FILE]   writes HTML (default ~/.cache/profile/) and prints its path
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { humanTurns, profileWithGraph, type Profile } from "./profile";

interface Lane { id: string; depth: number; label: string; cost: number; segments: Profile["segments"] }

export async function timeline(ref?: string, days = 30): Promise<string> {
	const { profile: root, nodes } = await profileWithGraph(ref, days);
	const lanes: Lane[] = [];
	const walk = (p: Profile, depth: number) => {
		lanes.push({ id: p.id, depth, label: p.id.slice(-8) + (p.agent ? " [" + p.agent + "]" : "") + " " + p.title.replace(/\s+/g, " ").slice(0, 70), cost: p.cost, segments: p.segments });
		for (const c of [...p.children].sort((a, b) => a.start - b.start)) walk(c, depth + 1);
	};
	walk(root, 0);
	const from = Math.min(...lanes.flatMap(l => l.segments.map(s => s.s)), root.start);
	const to = Math.max(...lanes.flatMap(l => l.segments.map(s => s.e)), root.end);
	const tree = new Set(lanes.map(l => l.id));
	const you = humanTurns(nodes, from, to).map(h => ({ ...h, here: tree.has(h.session), session: h.session.slice(-8) }));
	const data = { title: root.title.replace(/\s+/g, " ").slice(0, 100), id: root.id, from, to, lanes, you };
	return HTML.replace("__DATA__", () => JSON.stringify(data).replace(/</g, "\\u003c"));
}

const HTML = String.raw`<!doctype html><meta charset="utf-8"><title>timeline</title>
<style>
body{margin:0;font:12px ui-monospace,Menlo,monospace;background:#111;color:#ddd}
header{position:sticky;top:0;z-index:2;background:#111;padding:8px 12px;border-bottom:1px solid #333;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header b{color:#fff} .k{display:inline-flex;gap:4px;align-items:center;margin-right:8px} .k i{width:10px;height:10px;display:inline-block}
#wrap{display:grid;grid-template-columns:340px minmax(0,1fr)}
#labels div,#rows .row{height:16px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid #1c1c1c}
#labels{border-right:1px solid #333} #labels div{padding-right:6px}
#scroll{overflow-x:auto;position:relative} #axis{height:18px;position:relative;border-bottom:1px solid #333}
#axis span{position:absolute;top:2px;color:#888;font-size:10px;border-left:1px solid #333;padding-left:2px}
.row{position:relative} .row div{position:absolute;top:2px;height:12px;min-width:1px}
.you div{top:1px;height:14px;width:2px;background:#fff} .you div.else{background:#777}
.you .on{background:#fff2!important;width:auto}
#tip{position:fixed;pointer-events:none;background:#222;border:1px solid #555;padding:6px 8px;max-width:520px;white-space:pre-wrap;display:none;z-index:3}
button{background:#222;color:#ddd;border:1px solid #444;padding:2px 8px}
</style>
<header><b id="ttl"></b><span id="keys"></span><span>zoom <button id="zo">-</button> <button id="zi">+</button> (ctrl-wheel)</span></header>
<div id="wrap"><div id="labels"><div style="height:18px;border-bottom:1px solid #333"></div></div><div id="scroll"><div id="axis"></div><div id="rows"></div></div></div>
<div id="tip"></div>
<script>
const D = __DATA__;
const C = {model:"#4caf50",tool:"#ff9800",asked:"#e53935",idle:"#333",stall:"#fff",parent:"#7e57c2",board:"#1e88e5",other:"#555"};
const fmt = ms => ms<6e4?(ms/1e3).toFixed(0)+"s":ms<36e5?(ms/6e4).toFixed(1)+"m":(ms/36e5).toFixed(1)+"h";
const clock = t => new Date(t).toLocaleString([], {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
document.getElementById("ttl").textContent = D.id.slice(-8)+" "+D.title+" · "+clock(D.from)+" → "+clock(D.to)+" ("+fmt(D.to-D.from)+")";
document.getElementById("keys").innerHTML = Object.entries(C).map(([k,c])=>'<span class="k"><i style="background:'+c+';outline:1px solid #555"></i>'+k+'</span>').join("")+'<span class="k"><i style="background:#fff"></i>you (this tree)</span><span class="k"><i style="background:#777"></i>you (elsewhere)</span>';
let pxPerMs = 0;
const scroll = document.getElementById("scroll"), rows = document.getElementById("rows"), axis = document.getElementById("axis"), labels = document.getElementById("labels"), tip = document.getElementById("tip");
const lbl = (txt, title, depth) => { const d = document.createElement("div"); d.textContent = "  ".repeat(depth) + txt; d.title = title; d.style.paddingLeft = (4 + depth*10) + "px"; labels.appendChild(d); };
lbl("you", "your turns across all interactive sessions", 0);
for (const l of D.lanes) lbl(l.label + " $" + l.cost.toFixed(2), l.id, l.depth);
function render() {
  const W = Math.max(scroll.clientWidth, (D.to - D.from) * pxPerMs);
  const x = t => (t - D.from) * pxPerMs;
  rows.style.width = axis.style.width = W + "px";
  // axis: pick a tick step giving >=90px
  const steps = [6e4,3e5,9e5,18e5,36e5,72e5,108e5,216e5,432e5,864e5];
  const step = steps.find(s => s*pxPerMs >= 90) || 864e5;
  let ax = ""; for (let t = Math.ceil(D.from/step)*step; t <= D.to; t += step) ax += '<span style="left:'+x(t)+'px">'+clock(t)+'</span>';
  axis.innerHTML = ax;
  let h = '<div class="row you">';
  // active periods: your turns within 10 min of each other
  let a = null, b = null;
  const flush = () => { if (a !== null) h += '<div class="on" style="left:'+x(a)+'px;width:'+Math.max(2,x(b+12e4)-x(a))+'px"></div>'; };
  for (const y of D.you) { if (a === null || y.t - b > 6e5) { flush(); a = y.t; } b = y.t; }
  flush();
  D.you.forEach((y, i) => h += '<div class="'+(y.here?"":"else")+'" data-y="'+i+'" style="left:'+x(y.t)+'px"></div>');
  h += "</div>";
  D.lanes.forEach((l, li) => {
    h += '<div class="row">';
    l.segments.forEach((s, si) => { const w = (s.e - s.s) * pxPerMs; if (w < 0.3 && s.k !== "stall") return;
      h += '<div data-l="'+li+'" data-s="'+si+'" style="left:'+x(s.s)+'px;width:'+Math.max(1,w)+'px;background:'+C[s.k]+'"></div>'; });
    h += "</div>";
  });
  rows.innerHTML = h;
}
function zoom(f, cx) {
  const rel = (scroll.scrollLeft + cx) / pxPerMs;
  pxPerMs *= f; render(); scroll.scrollLeft = rel * pxPerMs - cx;
}
pxPerMs = scroll.clientWidth / (D.to - D.from); render();
document.getElementById("zi").onclick = () => zoom(2, scroll.clientWidth/2);
document.getElementById("zo").onclick = () => zoom(0.5, scroll.clientWidth/2);
scroll.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - scroll.getBoundingClientRect().left); }, {passive:false});
rows.addEventListener("mousemove", e => {
  const t = e.target, ds = t.dataset; let txt = "";
  if (ds.y !== undefined) { const y = D.you[+ds.y]; txt = clock(y.t) + " you in " + y.session + (y.here ? "" : " (elsewhere)") + "\n" + y.text; }
  else if (ds.l !== undefined) { const s = D.lanes[+ds.l].segments[+ds.s]; txt = s.k + " " + fmt(s.e - s.s) + "  " + clock(s.s) + " → " + clock(s.e) + (s.note ? "\n\n" + s.note : ""); }
  if (!txt) { tip.style.display = "none"; return; }
  tip.textContent = txt; tip.style.display = "block";
  tip.style.left = Math.min(e.clientX + 12, innerWidth - 540) + "px"; tip.style.top = (e.clientY + 14) + "px";
});
rows.addEventListener("mouseleave", () => tip.style.display = "none");
</script>
`;

if (import.meta.main) {
	const args = process.argv.slice(2);
	const flag = (f: string) => { const i = args.indexOf(f); return i < 0 ? undefined : args.splice(i, 2)[1]; };
	const days = Number(flag("--days") ?? 30), out = flag("--out");
	const html = await timeline(args[0], days);
	const dir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "profile");
	const file = out ?? join(dir, "timeline-" + (args[0] ?? process.env.PI_SESSION_ID ?? "session").slice(-8) + ".html");
	mkdirSync(dir, { recursive: true });
	writeFileSync(file, html);
	console.log(file);
}
