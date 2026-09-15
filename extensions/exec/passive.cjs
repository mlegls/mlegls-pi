// Trusted value kinds are registered by producers, never discovered through user methods.
const { inspect, types } = require("node:util");
const regexpSource = Object.getOwnPropertyDescriptor(RegExp.prototype, "source").get;
const regexpFlags = [["hasIndices", "d"], ["global", "g"], ["ignoreCase", "i"], ["multiline", "m"], ["dotAll", "s"], ["unicode", "u"], ["unicodeSets", "v"], ["sticky", "y"]].map(([key, flag]) => [Object.getOwnPropertyDescriptor(RegExp.prototype, key)?.get, flag]);
const kinds = new WeakMap();
function register(value, kind) { kinds.set(value, kind); return value; }
function field(value, key) {
 if (!value || typeof value !== "object" || types.isProxy(value)) return;
 const d = Object.getOwnPropertyDescriptor(value, key);
 return d && "value" in d ? d.value : undefined;
}
// Bounds work as well as output; only primitive fields and own data descriptors are read.
function format(value, limit = 16 * 1024) {
 const kind = kinds.get(value);
 if (!kind || types.isProxy(value)) return;
 let text = "", truncated = false, visited = 0, used = 0;
 function add(part) {
  if (typeof part !== "string") return;
  const room = Math.max(0, limit - used);
  const prefix = part.slice(0, room);
  const bytes = Buffer.from(prefix);
  let end = Math.min(room, bytes.length);
  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
  text += bytes.subarray(0, end).toString(); used += end;
  if (part.length > prefix.length || bytes.length > end) truncated = true;
 }
 const full = () => used >= limit || ++visited > Math.max(32, limit);
 if (kind === "source") {
  const rows = field(value, "rows"), count = field(rows, "length");
  let path, line = 0;
  for (let i = 0; i < count; i++) {
   if (full()) { truncated = true; break; }
   const row = field(rows, String(i));
   const nextPath = field(row, "path"), anchor = field(row, "anchor"), nextLine = field(row, "line"), body = field(row, "text");
   if (typeof nextPath !== "string" || typeof anchor !== "string" || typeof nextLine !== "number" || typeof body !== "string") continue;
   if (path !== nextPath) { if (text) add("\n"); add(nextPath); add(":"); path = nextPath; line = 0; }
   if (line && nextLine > line + 1) add("\n    ⋯");
   add("\n" + nextLine + " " + anchor.slice(0, 80) + "│"); add(body); line = nextLine;
  }
  if (!count) add("(no matches)");
  if (field(value, "complete") === false) add("\n[incomplete: explicit search limit reached]");
 } else if (kind === "shell") {
  const code = field(value, "exitCode");
  add("[exitCode=" + (typeof code === "number" ? code : "?") );
  for (const stream of ["stdout", "stderr"]) if (field(value, stream + "Truncated") === true) add(" " + stream + "Truncated=true");
  add("]");
  for (const stream of ["stdout", "stderr"]) { const body = field(value, stream); if (typeof body === "string" && body) { add("\n" + stream + ":\n"); add(body); } }
 } else if (kind === "terminal") {
  function terminal(v, depth = 0) {
   if (full() || depth > 5) { truncated = true; return; }
   if (Array.isArray(v) && !types.isProxy(v)) {
    const count = field(v, "length");
    if (!count) add("(no terminals)");
    for (let i = 0; i < count; i++) { if (full()) { truncated = true; break; } if (i) add("\n\n"); terminal(field(v, String(i)), depth + 1); }
   } else if (field(v, "snapshots")) {
    add(preview({ mode: field(v,"mode"), changed: field(v,"changed"), timedOut: field(v,"timedOut") })); add("\n"); terminal(field(v,"snapshots"), depth + 1);
   } else if (typeof field(v,"output") === "string") {
    const parts = [field(v,"id"), field(v,"status"), "cursor=" + preview(field(v,"cursor"))].map(x => typeof x === "string" ? x : preview(x));
    if (field(v,"exitCode") !== undefined) parts.push("exitCode=" + preview(field(v,"exitCode")));
    if (field(v,"timedOut") === true) parts.push("timedOut=true");
    add("[" + parts.join(" ") + "]\n"); add(field(v,"output"));
   } else add(preview(v));
  }
  terminal(value);
 } else if (kind === "text") add(field(value,"text"));
 else if (kind === "image") add(field(value,"note"));
 else return;
 return { text, truncated };
}
function preview(value) {
	let nodes = 0;
	const seen = new WeakSet();
	function plain(value, depth = 0) {
		if (typeof value === "string") return value.slice(0, 4096).replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "[image data omitted]").replace(/[A-Za-z0-9+/]{128,}={0,2}/g, "[base64 omitted]") + (value.length > 4096 ? "…" : "");
		if (typeof value === "function") return "[Function]";
		if (!value || typeof value !== "object") return value;
		if (types.isProxy(value)) return "[Proxy]";
		if (types.isPromise(value)) return "[Promise]";
		if (types.isRegExp(value)) return "/" + plain(regexpSource.call(value)) + "/" + regexpFlags.filter(([get]) => get?.call(value)).map(([, flag]) => flag).join("");
		if (ArrayBuffer.isView(value) || types.isAnyArrayBuffer(value)) return "[binary data omitted]";
		if (seen.has(value)) return "[Circular]";
		if (depth >= 3 || ++nodes > 80) return "[…]";
		seen.add(value);
		const out = Array.isArray(value) ? [] : Object.create(null);
		let count = 0;
		for (const key of Object.getOwnPropertyNames(value)) {
			if (Array.isArray(out) && key === "length") continue;
			if (++count > 12) { out["…"] = "more fields"; break; }
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			const label = key.slice(0, 80);
			out[label] = /^(data|base64)$/i.test(key) ? "[data omitted]" : descriptor && "value" in descriptor ? plain(descriptor.value, depth + 1) : "[Accessor]";
		}
		return out;
	}
	try { if (typeof value === "string" || types.isRegExp(value)) return plain(value); return inspect(plain(value), { depth: 5, colors: false, customInspect: false, getters: false, maxStringLength: 4096, breakLength: 120 }).replace(/\[Object: null prototype\] /g, ""); }
	catch { return "[preview unavailable]"; }
}


module.exports = { register, format, preview };
