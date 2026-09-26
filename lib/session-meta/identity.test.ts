import { expect, test } from "bun:test";
import { resolveSession } from "./identity";

test("session identity is distinct from its delivery address", () => {
	const id = "00000000-0000-7000-8000-0000168492b9";
	expect(resolveSession(id, [])).toBe(id);
	expect(resolveSession("session/" + id, [])).toBe(id);
	expect(resolveSession("mail/168492b9", [id])).toBe(id);
	expect(resolveSession("mail/168492b9", [])).toBeUndefined();
	expect(resolveSession("mail/168492b9", [id, "11111111-0000-7000-8000-0000168492b9"])).toBeUndefined();
});
