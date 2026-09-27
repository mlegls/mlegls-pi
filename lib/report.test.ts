import { expect, test } from "bun:test";
import { parse } from "./report.ts";

test("surfaces malformed fenced handoff parse errors", () => {
  const yaml = parse([
    "done",
    "```yaml",
    "plain scalar containing {rows: [2, 3, 5], total: 10}",
    "```",
  ].join("\n"));
  expect(yaml.handoff).toBeNull();
  expect(yaml.handoffError).toContain("Unexpected scalar");
  expect(yaml.body).toContain("plain scalar containing");

  const json = parse("done\n```json\n{\"stories\": ]\n```");
  expect(json.handoffError).toContain("JSON");
});
