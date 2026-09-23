import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel } from "./kernel";

// The live focused read initially lost its options at the VM boundary. Exercise the public
// show surface with a recording ingress adapter, not a same-realm call to the renderer.
test("focus crosses the exec VM boundary, supplements context, and leaves raw/variadic reads intact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "exec-focus-"));
  await mkdir(join(cwd, ".pi/exec"), { recursive: true });
  await writeFile(join(cwd, ".pi/exec/ingress.ts"),
    'export function create() { return { filter(text, query, budget, focus) { return JSON.stringify({text, query, focus}); }, pull(id) { return "original:" + id; } }; }');
  const kernel = new Kernel({ cwd, modules: [], ledger: [], persist() {} });
  const run = async (code: string, query = "implicit context") => {
    const result = await kernel.execute(code, { query });
    expect(result.error).toBeUndefined();
    return result.output;
  };
  try {
    expect(JSON.parse(await run('await show(Promise.resolve("source"), {focus:"cancellation"});')))
      .toEqual({text:"source", query:"implicit context", focus:"cancellation"});
    expect(JSON.parse(await run('await show("source", {focus:"architecture"});', "")))
      .toEqual({text:"source", query:"", focus:"architecture"});
    expect(JSON.parse(await run('await show("source");')))
      .toEqual({text:"source", query:"implicit context"});
    expect(JSON.parse(await run('await show.large("source", {focus:"editing"});')))
      .toEqual({text:"source", query:"implicit context", focus:"editing"});
    expect(await run('await show("source", "trailing string");', "")).toBe("source trailing string\n");
    expect(await run('await show({focus:"literal single object"});', "")).toContain("literal single object");
    expect(await run('await show.raw("source", {focus:"literal object"});')).toBe("source { focus: 'literal object' }\n");
    expect(await run('await show.pull("ing-original");')).toBe("original:ing-original\n");
    expect(JSON.parse(await run('await show({content(){return [{type:"text", text:"content block"}]}}, {focus:"blocks"});')))
      .toEqual({text:"content block", query:"implicit context", focus:"blocks"});
  } finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}, 15000);
