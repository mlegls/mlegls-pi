import { expect, test } from "bun:test";
import { create, prose, type Event, type Judgment } from "./ingress.ts";
import encounter from "../extensions/exec/fixtures/ingress-retention.json";

// Actual exec show/read encounters; replay the recorded service boundaries offline.
test("five-level exec encounters replay with exact pulls and byte accounting", async () => {
  for (const reading of encounter.encounters) {
    const event = reading.events.find(e => e.type === "filter")!;
    const events: Event[] = [];
    const reader = create({
      judge: async (chunks, query, focus) => {
        expect(query).toBe(reading.query);
        expect(focus).toBe(reading.focus);
        expect(chunks.map(c => c.text)).toEqual(event.pages.map(p => p.text));
        return event.pages.map(p => p.judgment) as Judgment[];
      },
      compress: async jobs => {
        const compressed = event.pages.filter(p => p.representation === "tokens");
        expect(jobs.map(j => j.text)).toEqual(compressed.map(p => p.text.replace(/^#{1,6} .*\n?/gm, "")));
        expect(jobs.map(j => Number(j.rate))).toEqual(compressed.map(p => ({cues: .25, skim50: .5, skim75: .75})[p.mode]!));
        return compressed.map(p => p.preview!);
      },
      record: e => events.push(e),
    });
    try {
      const out = await reader.filter(encounter.source, reading.query, 16384, reading.focus);
      expect(out + "\n").toBe(reading.result.output);
      expect(Buffer.byteLength(out)).toBe(event.outputBytes);
      expect(Buffer.byteLength(out)).toBeLessThan(Buffer.byteLength(encounter.source));
      for (const id of out.match(/ing-[a-f0-9]+/g) ?? []) expect(encounter.source).toContain(reader.pull(id));
      if (reading.focus === "Peripheral topic cues only") {
        expect(out.match(/keyword cues; not assertions/g)).toHaveLength(4);
        for (const pull of encounter.pulls) expect(reader.pull(pull.id) + "\n").toBe(pull.result.output);
      }
      if (reading.focus.startsWith("Exact acknowledgement")) {
        expect(out).toContain("Retry only if the server has not acknowledged the write.");
        expect(out).toContain("A timeout does not prove that the write failed.");
      }
      expect(events.some(e => e.type === "compression-unavailable")).toBe(false);
    } finally { reader.dispose(); }
  }
  expect(encounter.raw.output).toBe(encounter.source + "\n");
});

// First local startup exceeded its deadline. Reuse its real browsed source and choices.
test("unavailable compression leaves exact recoverable excerpts instead of broken skims", async () => {
  const reading = encounter.encounters[0];
  const event = reading.events.find(e => e.type === "filter")!;
  const events: Event[] = [];
  const reader = create({
    judge: async () => event.pages.map(p => p.judgment) as Judgment[],
    compress: async () => { throw new Error("LLMLingua exceeded 15 seconds"); },
    record: e => events.push(e),
  });
  try {
    const out = await reader.filter(encounter.source, reading.query);
    expect(events[0].type).toBe("compression-unavailable");
    expect(out).toContain("exact excerpt, not complete");
    expect(out).not.toContain("keyword cues");
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(Buffer.byteLength(encounter.source));
    for (const id of out.match(/ing-[a-f0-9]+/g) ?? []) expect(encounter.source).toContain(reader.pull(id));
  } finally { reader.dispose(); }
});

// The first drive falsely classified a prose line ending with a semicolon as code.
test("the reading-policy prose reaches LLMLingua; anchored evidence does not", () => {
  const pages = encounter.encounters[0].events.find(e => e.type === "filter")!.pages;
  expect(prose(pages.find(p => p.label === "# reading-policy")!.text)).toBe(true);
  expect(prose("/src/a.ts:\n1 abcd│export function cancel() {\n2 efgh│return true;\n3 ijkl│}\n")).toBe(false);
});
