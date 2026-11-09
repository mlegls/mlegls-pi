import { afterEach, expect, spyOn, test } from "bun:test";
import { Runtime } from "./runtime.js";

const session = { provider: "p-session", id: "foreground" };
const configured = { provider: "p-om", id: "missing" };
const registry = (found: unknown) => ({
	find: () => found,
	getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "k" }),
});
const runtimeWithConfigured = () => {
	const runtime = new Runtime();
	runtime.config.model = configured;
	return runtime;
};

let warn: ReturnType<typeof spyOn> | undefined;
afterEach(() => warn?.mockRestore());

test("headless fallback to the session model names configured and used models on stderr", async () => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
	const result = await runtimeWithConfigured().resolveModel({ model: session, modelRegistry: registry(undefined), hasUI: false });
	expect(result.ok && result.model).toEqual(session);
	expect(warn).toHaveBeenCalledTimes(1);
	const message = String(warn.mock.calls[0]![0]);
	expect(message).toContain("p-om/missing");
	expect(message).toContain("p-session/foreground");
});

test("UI fallback notifies once and does not write to stderr", async () => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
	const notify = spyOn({ notify: (_m: string, _l?: "warning" | "info" | "error") => {} }, "notify");
	await runtimeWithConfigured().resolveModel({ model: session, modelRegistry: registry(undefined), hasUI: true, ui: { notify } });
	expect(notify).toHaveBeenCalledTimes(1);
	expect(String(notify.mock.calls[0]![0])).toContain("p-om/missing");
	expect(notify.mock.calls[0]![1]).toBe("warning");
	expect(warn).not.toHaveBeenCalled();
});

test("an available configured model is used without a warning", async () => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
	const result = await runtimeWithConfigured().resolveModel({ model: session, modelRegistry: registry(configured), hasUI: false });
	expect(result.ok && result.model).toEqual(configured);
	expect(warn).not.toHaveBeenCalled();
});
