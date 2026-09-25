import { expect, test } from "bun:test";
import { redact } from "./redact.ts";

test("redaction survives quotes, newlines, nested UI echoes and JSON serialization", () => {
    const key = 'key"with\nnewline';
    const result = redact({ input: key, observation: ["echo " + key], [key]: "value" }, { key }, ["key"]);
    expect(JSON.parse(JSON.stringify(result))).toEqual({ input: "%key%", observation: ["echo %key%"], "%key%": "value" });
});
