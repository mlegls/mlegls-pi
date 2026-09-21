import { expect, test } from "bun:test";
import { inspect } from "node:util";
import { chunk, create } from "./ingress.ts";

// A rendered list is judged one record at a time, so a receipt dump can lose its irrelevant entries without slicing one in half.
test("records of a rendered array become one chunk each, losslessly, labeled by their first field", () => {
  const value = { workers: Array.from({ length: 4 }, (_, i) => ({ id: "w" + i, resource: { nested: { deep: [1, 2] } } })) };
  for (const text of [inspect(value, { depth: 5 }), JSON.stringify(value, null, 2)]) {
    const chunks = chunk(text);
    expect(chunks.map(c => c.text).join("")).toBe(text);
    expect(chunks.slice(1).map(c => c.label.replace(/["',]/g, ""))).toEqual(["id: w0", "id: w1", "id: w2", "id: w3"]);
  }
  expect(chunk("# A\n\npara\n\n# B\n\npara\n").map(c => c.label)).toEqual(["# A", "para", "# B", "para"]);
});

// Under the byte cap nothing changes; over it, the least relevant pages go before the tail is truncated.
test("a display budget drops the least relevant pages first and never those at .8 or above", async () => {
  const sections = ["a", "b", "c", "d"].map((s, i) => "# s" + i + "\n" + s.repeat(3000) + "\n\n");
  const text = sections.join("");
  const ps = [0.3, 0.9, 0.25, 0.5];
  const events: { pages: { label: string; kept: boolean }[] }[] = [];
  const ingress = create({ score: async cs => cs.map(c => ps[Number(c.label.slice(3))]), record: e => { if (e.type === "filter") events.push(e); } });
  expect(await ingress.filter(text, "q")).toBe(text);
  const out = await ingress.filter(text, "q", 7000);
  expect(events[1].pages.map(p => p.kept)).toEqual([false, true, false, true]);
  expect(out).toContain("2/4 chunks omitted");
  expect(await ingress.filter(text, "q", 1)).not.toContain("[omitted " + events[1].pages[1]);
  expect(events[2].pages.map(p => p.kept)).toEqual([false, true, false, false]);
});
