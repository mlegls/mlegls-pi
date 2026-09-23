import { expect, test } from "bun:test";
import { inspect } from "node:util";
import { chunk, create, excerpts, type Event, type Judgment } from "./ingress.ts";
import encounter from "../extensions/exec/fixtures/ingress-reading.json";

// Receipt dumps stay record-shaped; headings no longer become separately discarded paragraphs.
test("records and sections remain lossless reading units", () => {
  const value = { workers: Array.from({ length: 4 }, (_, i) => ({ id: "w" + i, resource: { nested: { deep: [1, 2] } } })) };
  for (const text of [inspect(value, { depth: 5 }), JSON.stringify(value, null, 2)]) {
    const chunks = chunk(text);
    expect(chunks.map(c => c.text).join("")).toBe(text);
    expect(chunks.slice(1).map(c => c.label.replace(/["',]/g, ""))).toEqual(["id: w0", "id: w1", "id: w2", "id: w3"]);
  }
  const text = "# A\n\npara\n\n## B\n\npara\n";
  expect(chunk(text).map(c => c.label)).toEqual(["# A", "## B"]);
  expect(chunk(text)[1].context).toEqual(["# A", "## B"]);
  const source = "/src/a.ts:\n1 abcd│/** description */\n2 efgh│export function cancel() {\n3 ijkl│  return true;\n4 mnop│}\n";
  expect(chunk(source).map(c => c.text).join("")).toBe(source);
  expect(chunk(source)[1].text).toContain("/** description */\n2 efgh│export function cancel()");
});

// Live Jev encounter: identical source, architecture reading vs inspection before editing.
test("recorded focused reads retain exact evidence or fallback excerpts when compression fails", async () => {
  for (const reading of encounter.readings) {
    const events: Event[] = [];
    const reader = create({ judge: async (chunks, query, focus) => {
      expect(query).toBe(encounter.query);
      expect(focus).toBe(reading.focus);
      expect(chunks.length).toBe(reading.judgments.length);
      return reading.judgments.map(j => ({ ...j, mode: j.mode === "skim" ? "skim50" : j.mode,
        dist: { verbatim: j.dist.verbatim, skim75: 0, skim50: j.dist.skim, cues: 0, omit: j.dist.omit } })) as Judgment[];
    }, compress: async () => { throw new Error("compression unavailable for historical excerpt replay"); }, record: e => events.push(e) });
    const out = await reader.filter(encounter.source, encounter.query, 16384, reading.focus);
    const event = events.find(e => e.type === "filter")!;
    if (event.type !== "filter") throw new Error("missing decision record");
    expect(event.pages.map(p => p.text).join("")).toBe(encounter.source);
    expect(event.outputBytes).toBe(Buffer.byteLength(out));
    expect(event.outputBytes).toBeLessThanOrEqual(event.inputBytes);
    if (reading.focus.startsWith("inspect")) {
      expect(out).toBe(encounter.source);
    } else {
      expect(event.outputBytes).toBeLessThan(event.inputBytes / 2);
      expect(out).toContain("[skim; exact excerpt");
      for (const page of event.pages.filter(p => p.mode === "skim50")) {
        expect(out).toContain(excerpts(page.text)[page.judgment.excerpt]);
        expect(reader.pull(page.id)).toBe(page.text);
      }
      // The actual budget probe kept exact evidence and displaced peripheral sketches instead.
      const bounded = await reader.filter(encounter.source, encounter.query, 1000, reading.focus);
      expect(Buffer.byteLength(bounded)).toBeLessThan(Buffer.byteLength(out));
      const boundedEvent = events.findLast(e => e.type === "filter");
      if (boundedEvent?.type !== "filter") throw new Error("missing budget record");
      expect(boundedEvent.pages.some(p => p.reason === "budget")).toBe(true);
      for (const page of event.pages.filter(p => p.mode === "verbatim")) expect(bounded).toContain(page.text);
    }
  }
});

// The old renderer spent more describing a missing heading than retaining it.
test("tiny headings stay, omitted runs share a recoverable handle, exact evidence survives budget pressure", async () => {
  const text = "# Runtime\n\n## Related\n\n## Cancellation\n\n" + "Abort must terminate the subprocess group.\n".repeat(20)
    + "\n## History\n\n" + "An older transport is no longer used.\n".repeat(20)
    + "\n## Archive\n\n" + "The original prototype ran in another process.\n".repeat(20);
  const reader = create({ judge: async cs => cs.map(c => {
    const exact = c.label.includes("Cancellation");
    return { mode: exact ? "verbatim" : "omit", dist: { verbatim: exact ? 1 : 0, skim75: 0, skim50: 0, cues: 0, omit: exact ? 0 : 1 }, excerpt: 0 };
  }) });
  const out = await reader.filter(text, "inspect cancellation", 600);
  expect(out).toContain("# Runtime\n\n## Related\n\n## Cancellation");
  expect(out).toContain("Abort must terminate the subprocess group.\n".repeat(20));
  const ids = out.match(/ing-[a-f0-9]+/g)!;
  expect(ids).toHaveLength(1);
  expect(reader.pull(ids[0])).toBe(chunk(text).slice(3).map(c => c.text).join(""));
  expect(Buffer.byteLength(out)).toBeLessThan(Buffer.byteLength(text));
});

// Reading must remain possible when the decision service fails.
test("failure preserves original evidence, while diffs and tiny output bypass judgments", async () => {
  const events: Event[] = [];
  const reader = create({ judge: async () => { throw new Error("offline"); }, record: e => events.push(e) });
  const text = encounter.source;
  expect(await reader.filter(text, "q")).toEndWith(text);
  expect(events[0].type).toBe("unavailable");
  expect(await reader.filter("small", "q")).toBe("small");
  expect(await reader.filter("diff --git a/file b/file\n" + text, "q")).toBe("diff --git a/file b/file\n" + text);
  expect(events).toHaveLength(1);
});
