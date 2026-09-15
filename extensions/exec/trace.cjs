// UI-only invocation observations. Never render values or follow user accessors.
const { types } = require("node:util");
const { format, preview } = require("./passive.cjs");
const MAX_ENTRIES = 64;
const PREVIEW_BYTES = 4096;
const TOTAL_PREVIEW_BYTES = 48 * 1024; // Leave room for entry metadata in a 64 KiB snapshot.

function createTrace(cell, send, formatResult = (_name, value, limit) => format(value, limit)) {
	const trace = { entries: [], omitted: 0, truncated: false, finished: false };
	let bytes = 0;
	function bounded(value, name, args = false) {
		let formatted;
		try { if (name) formatted = formatResult?.(name, value, PREVIEW_BYTES); } catch { /* Passive fallback only. */ }
		if (formatted?.truncated || (typeof value === "string" && value.length > PREVIEW_BYTES) || (args && (value.length > 12 || value.some(v => typeof v === "string" && v.length > PREVIEW_BYTES)))) trace.truncated = true;
		const text = formatted ? preview(formatted.text) : args ? value.slice(0, 12).map(preview).join(", ") + (value.length > 12 ? ", …" : "") : preview(value);
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
	let timer, lastSent = 0;
	function flush() {
		clearTimeout(timer); timer = undefined;
		lastSent = Date.now();
		send({ type: "trace", id: cell.id, trace });
	}
	function update() {
		if (Date.now() - lastSent >= 30) flush();
		else if (!timer) timer = setTimeout(flush, 30).unref();
	}
	return {
		finish() { trace.finished = true; flush(); },
		wrap(name, fn) {
			return function (...args) {
				// Retained work belongs to its original cell, even during a later execution.
				if (trace.finished) return Reflect.apply(fn, this, args);
				if (trace.entries.length >= MAX_ENTRIES) { trace.omitted++; trace.truncated = true; update(); return Reflect.apply(fn, this, args); }
				const entry = { id: trace.entries.length + 1, name, args: bounded(args, undefined, true), state: "pending", startedAt: Date.now() };
				trace.entries.push(entry);
				update();
				function settle(state, value) {
					if (trace.finished) return;
					entry.state = state;
					entry.durationMs = Date.now() - entry.startedAt;
					entry[state === "error" ? "error" : "result"] = bounded(value, state === "ok" ? name : undefined);
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
