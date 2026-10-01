// Timeline of a session tree: one lane per session with its segments (model, tool, and the gap
// kinds from profile.ts), plus a "you" lane of your turns across every interactive session, so an
// "blocked" gap shows whether you were away or busy elsewhere.
//   ab timeline [SESSION]                                   writes HTML under ~/.cache/profile/, opens it, prints its path
//   bun lib/timeline.ts [SESSION] [--days N] [--out FILE] [--fast]   same; --out writes there without opening;
//                                                           --fast skips the decider (profile.ts judgeWaits)
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { humanTurns, profileWithGraph, type Profile } from "./profile";
import { contextFile, elideSettings, judgePurposes, strip, type Context } from "./context";

interface Lane { id: string; depth: number; label: string; cost: number; segments: Profile["segments"]; ctx?: Context }

export async function timeline(ref?: string, days = 30, options: { judge?: boolean } = {}): Promise<string> {
	const { profile: root, nodes } = await profileWithGraph(ref, days, options);
	const lanes: Lane[] = [];
	const walk = (p: Profile, depth: number) => {
		lanes.push({ id: p.id, depth, label: p.id.slice(-8) + (p.agent ? " [" + p.agent + "]" : "") + " " + p.title.replace(/\s+/g, " ").slice(0, 70), cost: p.cost, segments: p.segments });
		for (const c of [...p.children].sort((a, b) => a.start - b.start)) walk(c, depth + 1);
	};
	walk(root, 0);
	// Context composition per lane, for the bento view (click a lane label).
	const elide = await elideSettings().catch(() => undefined);
	for (const l of lanes) { const n = nodes.get(l.id); try { if (n) l.ctx = contextFile(n.file, l.id, elide); } catch {} }
	if (options.judge !== false) await judgePurposes(lanes.flatMap(l => l.ctx ? [l.ctx] : []));
	for (const l of lanes) if (l.ctx) l.ctx = strip(l.ctx);
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
#labels div[data-i]{cursor:pointer} #labels div[data-i]:hover{color:#fff} #labels div.sel{background:#2a2a2a;color:#fff}
#bento{position:fixed;left:0;right:0;bottom:0;height:48vh;background:#151515;border-top:1px solid #444;display:none;flex-direction:column;z-index:2}
#bento .bar{padding:6px 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #333}
#bento .bar input[type=range]{width:260px} #bento .on{background:#444;color:#fff}
#bmap{position:relative;flex:1;margin:6px 12px 10px} #bmap div{position:absolute;box-sizing:border-box;border:1px solid #151515;overflow:hidden;font-size:10px;line-height:12px;padding:1px 3px;color:#000c}
#bmap div.g{border:2px solid #151515;background:none!important;pointer-events:none;color:#fff;font-weight:bold;text-shadow:0 0 3px #000;padding:2px 4px;z-index:1}
body.open #wrap{padding-bottom:48vh}
</style>
<header><b id="ttl"></b><span id="keys"></span><span>zoom <button id="zo">-</button> <button id="zi">+</button> (ctrl-wheel)</span><span style="color:#aaa">click a session for its context</span></header>
<div id="wrap"><div id="labels"><div style="height:18px;border-bottom:1px solid #333"></div></div><div id="scroll"><div id="axis"></div><div id="rows"></div></div></div>
<div id="bento"><div class="bar"><b id="bttl"></b><span><button id="bnow">in window</button> <button id="bheld">token &times; calls held</button></span><span id="bcall">call <input type="range" id="bslide" min="0"> <span id="bcn"></span></span><span id="bkeys"></span><button id="bx">close</button></div><div id="bmap"></div></div>
<div id="tip"></div>
<script>
const D = __DATA__;
const C = {model:"#4caf50",tool:"#ff9800",blocked:"#e53935",offered:"#f48fb1",idle:"#333",stall:"#fff",parent:"#7e57c2",board:"#1e88e5",process:"#00acc1",other:"#555"};
const fmt = ms => ms<6e4?(ms/1e3).toFixed(0)+"s":ms<36e5?(ms/6e4).toFixed(1)+"m":(ms/36e5).toFixed(1)+"h";
const clock = t => new Date(t).toLocaleString([], {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
document.getElementById("ttl").textContent = D.id.slice(-8)+" "+D.title+" · "+clock(D.from)+" → "+clock(D.to)+" ("+fmt(D.to-D.from)+")";
document.getElementById("keys").innerHTML = Object.entries(C).map(([k,c])=>'<span class="k"><i style="background:'+c+';outline:1px solid #555"></i>'+k+'</span>').join("")+'<span class="k"><i style="background:#fff"></i>you (this tree)</span><span class="k"><i style="background:#777"></i>you (elsewhere)</span>';
let pxPerMs = 0;
const scroll = document.getElementById("scroll"), rows = document.getElementById("rows"), axis = document.getElementById("axis"), labels = document.getElementById("labels"), tip = document.getElementById("tip");
const lbl = (txt, title, depth, i) => { const d = document.createElement("div"); d.textContent = "  ".repeat(depth) + txt; d.title = title; d.style.paddingLeft = (4 + depth*10) + "px"; if (i !== undefined) d.dataset.i = i; labels.appendChild(d); };
lbl("you", "your turns across all interactive sessions", 0);
D.lanes.forEach((l, i) => lbl(l.label + " $" + l.cost.toFixed(2), l.id + (l.ctx ? " · click for context" : ""), l.depth, l.ctx ? i : undefined));
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
rows.addEventListener("click", e => { const l = e.target.dataset.l ?? e.target.closest(".row")?.querySelector("[data-l]")?.dataset.l; if (l !== undefined && D.lanes[+l].ctx) openBento(+l); });
// ---- bento: one lane's context, cells grouped by purpose (squarified treemap)
const P = {system:"#9e9e9e",user:"#fff59d",summary:"#bcaaa4",message:"#90a4ae",orient:"#64b5f6",discuss:"#fff176",plan:"#ce93d8",edit:"#81c784",verify:"#4db6ac",debug:"#ff8a65",coordinate:"#7986cb",noise:"#e57373",other:"#616161"};
const B = {lane:null, mode:"now", call:0};
const tk = n => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"k":String(n);
function squarify(items, x, y, w, h) {
  const out = [], total = items.reduce((s,i)=>s+i.v,0); if (!total || w<=0 || h<=0) return out;
  const scale = w*h/total; let rest = items;
  while (rest.length) {
    const short = Math.min(w,h); let row = [], best = Infinity, s = 0;
    for (const it of rest) { const s2 = s + it.v*scale, r = [...row, it];
      const worst = Math.max(...r.map(i => { const a = i.v*scale; return Math.max(short*short*a/(s2*s2), s2*s2/(short*short*a)); }));
      if (worst > best) break; best = worst; row = r; s = s2; }
    rest = rest.slice(row.length);
    const thick = s/short; let off = 0;
    for (const it of row) { const len = it.v*scale/thick; out.push(w>=h ? {it,x,y:y+off,w:thick,h:len} : {it,x:x+off,y,w:len,h:thick}); off += len; }
    if (w>=h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
  }
  return out;
}
const bento = document.getElementById("bento"), bmap = document.getElementById("bmap"), bslide = document.getElementById("bslide");
function drawBento() {
  const l = D.lanes[B.lane], x = l.ctx, held = B.mode === "held";
  document.getElementById("bnow").className = held ? "" : "on"; document.getElementById("bheld").className = held ? "on" : "";
  document.getElementById("bcall").style.display = held ? "none" : "";
  const EL = 25, at = (c, k) => c.born<=k && k<c.died ? (c.elided!==undefined && k>=c.elided ? EL : c.tok) : 0;
  const hold = c => c.elided===undefined ? c.tok*(c.died-c.born) : c.tok*(c.elided-c.born) + EL*(c.died-c.elided);
  const cells = x.cells.map((c,i) => ({c, i, v: held ? hold(c) : at(c, B.call)})).filter(o => o.v > 0);
  const groups = {}; for (const o of cells) (groups[o.c.purpose] ??= []).push(o);
  const gs = Object.entries(groups).map(([p, its]) => ({p, its: its.sort((a,b)=>b.v-a.v), v: its.reduce((s,o)=>s+o.v,0)})).sort((a,b)=>b.v-a.v);
  const total = gs.reduce((s,g)=>s+g.v,0);
  document.getElementById("bcn").textContent = (B.call+1) + "/" + x.calls.length + " · window " + tk(x.calls[B.call]||0) + (x.compactions.includes(B.call) ? " · just compacted" : "") + (x.compactions.length ? " · compactions at " + x.compactions.map(c=>c+1).join(",") : "");
  document.getElementById("bkeys").innerHTML = gs.map(g => '<span class="k"><i style="background:'+(P[g.p]||"#777")+'"></i>'+g.p+' '+tk(g.v)+' '+(100*g.v/total).toFixed(0)+'%</span>').join("");
  const W = bmap.clientWidth, H = bmap.clientHeight; let h = "";
  for (const g of squarify(gs, 0, 0, W, H)) {
    for (const r of squarify(g.it.its, g.x, g.y, g.w, g.h)) { const c = r.it.c;
      h += '<div data-c="'+r.it.i+'" style="left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px;background:'+(P[c.purpose]||"#777")+(c.elided!==undefined?';background-image:repeating-linear-gradient(45deg,#0004 0 3px,transparent 3px 7px)':'')+'">'+(r.w>60&&r.h>14?c.label.replace(/[<&]/g, ch => ch=="<"?"&lt;":"&amp;"):"")+'</div>'; }
    if (g.w > 40 && g.h > 16) h += '<div class="g" style="left:'+g.x+'px;top:'+g.y+'px;width:'+g.w+'px;height:'+g.h+'px">'+g.it.p+'</div>';
  }
  bmap.innerHTML = h;
}
function openBento(i) {
  B.lane = i; const x = D.lanes[i].ctx; B.call = x.calls.length - 1;
  bslide.max = Math.max(0, x.calls.length - 1); bslide.value = B.call;
  document.getElementById("bttl").textContent = D.lanes[i].label.slice(0, 60);
  [...labels.children].forEach(d => d.classList.toggle("sel", d.dataset.i == i));
  bento.style.display = "flex"; document.body.classList.add("open"); drawBento();
}
labels.addEventListener("click", e => { const d = e.target.closest("[data-i]"); if (d) openBento(+d.dataset.i); });
bslide.oninput = () => { B.call = +bslide.value; drawBento(); };
document.getElementById("bnow").onclick = () => { B.mode = "now"; drawBento(); };
document.getElementById("bheld").onclick = () => { B.mode = "held"; drawBento(); };
document.getElementById("bx").onclick = () => { bento.style.display = "none"; document.body.classList.remove("open"); };
addEventListener("resize", () => { if (B.lane !== null && bento.style.display !== "none") drawBento(); });
bmap.addEventListener("mousemove", e => {
  const d = e.target.dataset; if (d.c === undefined) { tip.style.display = "none"; return; }
  const c = D.lanes[B.lane].ctx.cells[+d.c];
  tip.textContent = c.purpose + (c.p ? " " + c.p.toFixed(2) : "") + " · " + c.k + " · " + tk(c.tok) + " tok, calls " + (c.born+1) + "→" + c.died + (c.elided!==undefined ? ", elided at " + (c.elided+1) + " (cold cache)" : "") + ", held " + tk(c.elided===undefined ? c.tok*(c.died-c.born) : c.tok*(c.elided-c.born) + 25*(c.died-c.elided)) + "\n" + c.label + (c.preview ? "\n\n" + c.preview : "");
  tip.style.display = "block"; tip.style.left = Math.min(e.clientX + 12, innerWidth - 540) + "px"; tip.style.top = Math.max(0, e.clientY - 120) + "px";
});
bmap.addEventListener("mouseleave", () => tip.style.display = "none");
</script>
`;

/** Write the timeline under ~/.cache/profile and open it in the browser; returns the file. */
export async function openTimeline(ref?: string, days = 30, out?: string, options: { judge?: boolean } = {}): Promise<string> {
	const html = await timeline(ref, days, options);
	const dir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "profile");
	const file = out ?? join(dir, "timeline-" + (ref ?? process.env.PI_SESSION_ID ?? "session").slice(-8) + ".html");
	mkdirSync(dir, { recursive: true });
	writeFileSync(file, html);
	if (!out) Bun.spawn(["open", file], { stdio: ["ignore", "ignore", "ignore"] });
	return file;
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	const flag = (f: string) => { const i = args.indexOf(f); return i < 0 ? undefined : args.splice(i, 2)[1]; };
	const days = Number(flag("--days") ?? 30), out = flag("--out");
	const fast = args.includes("--fast"); if (fast) args.splice(args.indexOf("--fast"), 1);
	console.log(await openTimeline(args[0], days, out, { judge: !fast }));
}
