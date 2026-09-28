import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel } from "./kernel";

test("show is verbatim regardless of focus and spills complete oversized output", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "exec-output-test-"));
  const kernel = new Kernel({ cwd, modules: [], ledger: [], persist() {} });
  try {
    const run = async (code: string) => {
      const result = await kernel.execute(code, { query: "irrelevant context" });
      expect(result.error).toBeUndefined();
      return result.output;
    };
    expect(await run('await show("source", {focus:"ignore everything"});')).toBe("source\n");
    expect(await run('await show(Promise.resolve("source"));')).toBe("source\n");
    const original = "界".repeat(20000) + "END";
    for (const method of ["show", "show.raw", "show.large"]) {
      const out = await run(`await ${method}(${JSON.stringify(original)});`);
      expect(out).toContain("[output truncated]");
      expect(out).not.toContain("�");
      const path = /full output: (.+)\. Grep/.exec(out)![1];
      expect(await readFile(path, "utf8")).toBe(original + "\n");
    }
  } finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}, 15000);
