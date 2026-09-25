import { expect, test } from "bun:test";
import * as browser from "./browser-runner.ts";
import * as native from "./native.ts";

function model(next: string, showing = 0.1) {
  const requests: any[] = [];
  const server = Bun.serve({ port: 0, async fetch(req) {
    const raw = await req.json() as any, body = raw.input ?? raw;
    requests.push(body);
    const answers = Object.fromEntries(Object.entries(body.questions).map(([id, q]: [string, any]) => {
      if (q.type === "noul") return [id, { type: "noul", noul: showing }];
      const keys = Object.keys(q.criteria);
      if (keys.length > 255) return [id, null];
      const choice = keys.includes(next) ? next : keys.includes("none") ? "none" : keys[0];
      return [id, { type: "choice", choice, probabilities: Object.fromEntries(keys.map(k => [k, k === choice ? 1 : 0])) }];
    }));
    return Response.json({ answers });
  } });
  return { requests, decision: { url: server.url.href, apiKey: "test" }, close: () => server.stop(true) };
}
function page(count = 1) {
  let epoch = 0;
  const actions: any[] = [];
  const ui: browser.UI = {
    async findRoots() { return { details: { windows: [{ app: "page", windowRef: "page" }] } }; },
    async observe() {
      const children = Array.from({ length: count }, (_, i) => ({ ref: "n" + i, role: "button", title: "Button " + i, canPress: true }));
      return { details: { capture: { stateId: "s" + ++epoch }, target: { app: "page" }, outline: { root: { ref: "root", role: "page", children } } } };
    },
    async act(a) { actions.push(a); return { details: { execution: { outcome: "did" } } }; },
  };
  return { ui, actions };
}
const goal = { apps: ["page"], goal: "Open language settings", until: "Language choices are displayed", waitMs: 1, maxWaits: 1 };

test.each([251, 252, 600])("browser considers tail action on %i-control surface within API limit", async count => {
  const m = model("a" + (count - 1)), p = page(count);
  try {
    const e = await browser.step({ ...goal, ...p, decision: m.decision });
    expect(e.status).toBe("continue");
    expect(e.selected?.id).toBe("a" + (count - 1));
    expect(p.actions).toHaveLength(1);
    for (const r of m.requests) for (const q of Object.values(r.questions) as any[]) if (q.type === "choice") expect(Object.keys(q.criteria).length).toBeLessThanOrEqual(255);
    const offered = new Set(m.requests.flatMap(r => Object.keys(r.questions.nominate?.criteria ?? r.questions.next.criteria)));
    for (let i = 0; i < count; i++) expect(offered.has("a" + i)).toBe(true);
  } finally { m.close(); }
});

test("native large surface preserves exact tokens through nomination", async () => {
  const m = model("a599"); let action: any;
  const ui = {
    async list_apps() { return { structuredContent: { apps: [{ name: "page", pid: 7, running: true }] } }; },
    async list_windows() { return { structuredContent: { windows: [{ pid: 7, window_id: 9 }] } }; },
    async get_window_state() { return { structuredContent: { pid: 7, window_id: 9, snapshot_id: "fresh", elements: Array.from({ length: 600 }, (_, i) => ({ role: "AXButton", label: "Button " + i, element_index: i, element_token: "token" + i, actions: ["AXPress"] })) } }; },
    async click(a: any) { action = a; return { structuredContent: {} }; },
  } as unknown as native.UI;
  try {
    const e = await native.step({ ...goal, ui, decision: m.decision });
    expect(e.status).toBe("continue");
    expect(action.element_token).toBe("token599");
    expect(action.snapshot_id).toBe("fresh");
    expect(JSON.stringify(m.requests)).not.toContain("token599");
  } finally { m.close(); }
});

test("browser never turns exhausted waits or showing alone into success", async () => {
  for (const [next, showing] of [["done", 0.2], ["wait", 0.99]] as const) {
    const m = model(next, showing);
    try {
      const r = await browser.run({ ...goal, ...page(), decision: m.decision });
      expect(r.status).toBe("stuck");
    } finally { m.close(); }
  }
});

test("browser verifier overrides model done; recaptures before actions", async () => {
  const m = model("done", 0.99), p = page();
  try {
    const r = await browser.run({ ...goal, ...p, decision: m.decision, verify: () => ({ source: "application", result: "unknown", evidence: "not loaded" }) });
    expect(r.status).toBe("stuck");
    expect(p.actions).toHaveLength(0);
    const done = await browser.step({ ...goal, ...p, verify: () => ({ source: "application", result: "satisfied", evidence: "saved" }) });
    expect(done.completion).toBe("application");
    expect(done.decision).toBeUndefined();
  } finally { m.close(); }
  const act = model("a0"), fresh = page();
  try {
    await browser.step({ ...goal, ...fresh, decision: act.decision, verify: () => ({ source: "driver", result: "unsatisfied", evidence: null }) });
    expect(fresh.actions[0].stateId).toBe("s2");
  } finally { act.close(); }
});

test("browser model state and nominations do not contain hidden inputs or UI echoes", async () => {
  const m = model("done", 0.99), p = page(300);
  const observe = p.ui.observe;
  p.ui.observe = async args => {
    const r = await observe(args);
    r.details.text = 'echo secret"value';
    r.details.outline.root.children[0].title = 'secret"value';
    return r;
  };
  try {
    await browser.step({ ...goal, ...p, decision: m.decision, inputs: { password: 'secret"value' }, hidden: ["password"] });
    expect(JSON.stringify(m.requests)).not.toContain('secret');
    expect(JSON.stringify(m.requests)).toContain('%password%');
  } finally { m.close(); }
});
