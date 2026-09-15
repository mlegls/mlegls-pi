// UI-only invocation observations. Never render values or follow user accessors.
const { inspect, types } = require("node:util");
const MAX_ENTRIES = 64;
const PREVIEW_BYTES = 4096;
const TOTAL_PREVIEW_BYTES = 48 * 1024; // Leave room for entry metadata in a 64 KiB snapshot.

function preview(value) {
	let nodes = 0;
	const seen = new WeakSet();
	function plain(value, depth = 0) {
		if (typeof value === "string") return value.slice(0, 4096).replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "[image data omitted]").replace(/[A-Za-z0-9+/]{128,}={0,2}/g, "[base64 omitted]") + (value.length > 4096 ? "…" : "");
		if (typeof value === "function") return "[Function]";
		if (!value || typeof value !== "object") return value;
		if (types.isProxy(value)) return "[Proxy]";
		if (types.isPromise(value)) return "[Promise]";
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
	try { return inspect(plain(value), { depth: 5, colors: false, customInspect: false, getters: false, maxStringLength: 4096, breakLength: 120 }).replace(/\[Object: null prototype\] /g, ""); }
	catch { return "[preview unavailable]"; }
}

function createTrace(cell, send) {
	const trace = { entries: [], omitted: 0, truncated: false, finished: false };
	let bytes = 0;
	function bounded(value) {
		const text = preview(value);
		const limit = Math.min(PREVIEW_BYTES, TOTAL_PREVIEW_BYTES - bytes);
		// JSON escaping, not just UTF-8 text, counts against the snapshot budget.
		let result = text;
		if (Buffer.byteLength(JSON.stringify(result)) > limit) {
			trace.truncated = true;
			let low = 0, high = Math.min(text.length, limit);
			while (low < high) {
				const mid = Math.ceil((low + high) / 2);
				if (Buffer.byteLength(JSON.stringify(text.slice(0, mid) + "…")) <= limit) low = mid;
				else high = mid - 1;
			}
			result = limit >= 5 ? text.slice(0, low) + "…" : "";
		}
		bytes += Buffer.byteLength(JSON.stringify(result));
		return result;
	}
	function update() { send({ type: "trace", id: cell.id, trace }); }
	return {
		finish() { trace.finished = true; update(); },
		wrap(name, fn) {
			return function (...args) {
				// Retained work belongs to its original cell, even during a later execution.
				if (trace.finished) return Reflect.apply(fn, this, args);
				if (trace.entries.length >= MAX_ENTRIES) { trace.omitted++; trace.truncated = true; update(); return Reflect.apply(fn, this, args); }
				const entry = { id: trace.entries.length + 1, name, args: bounded(args), state: "pending", startedAt: Date.now() };
				trace.entries.push(entry);
				update();
				function settle(state, value) {
					if (trace.finished) return;
					entry.state = state;
					entry.durationMs = Date.now() - entry.startedAt;
					entry[state === "error" ? "error" : "result"] = bounded(value);
					update();
				}
				try {
					const result = Reflect.apply(fn, this, args);
					if (types.isPromise(result)) Promise.prototype.then.call(result, value => settle("ok", value), error => settle("error", error));
					else settle("ok", result);
					return result;
				} catch (error) { settle("error", error); throw error; }
			};
		},
	};
}
module.exports = { createTrace };
