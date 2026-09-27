import { expect, test } from "bun:test";
import { trimImages } from "./images.ts";
const image = () => ({ type: "image", mimeType: "image/png", data: "a".repeat(1000) });
const bytes = (x: unknown) => Buffer.byteLength(JSON.stringify(x));

test("oldest images go first; paths, latest image and original history survive", () => {
	const context = { systemPrompt: "instructions", messages: [
		{ role: "toolResult", content: [{ type: "text", text: "/tmp/old.png" }, image()] },
		{ role: "user", content: [image()] },
	] };
	const original = JSON.stringify(context);
	const result = trimImages(context, bytes(context) - 500);
	expect(result.messages[0].content[0].text).toBe("/tmp/old.png");
	expect(result.messages[0].content[1].type).toBe("text");
	expect(result.messages[1]).toBe(context.messages[1]);
	expect(bytes(result)).toBeLessThanOrEqual(bytes(context) - 500);
	expect(JSON.stringify(context)).toBe(original);
	expect(trimImages(result, bytes(context) - 500)).toBe(result);
});

test("counts UTF-8, tools and system overhead; removes latest images if necessary", () => {
	const context = { systemPrompt: "奀".repeat(500), tools: [{ description: "x".repeat(500) }], messages: [{ role: "user", content: [image(), image()] }] };
	const result = trimImages(context, 2500);
	expect(result.messages[0].content.every((c: any) => c.type === "text")).toBe(true);
	expect(bytes(result)).toBeLessThanOrEqual(2500);
});

test("small requests are untouched and text-only overflow is not truncated", () => {
	const context = { messages: [{ role: "user", content: "hello" }] };
	expect(trimImages(context)).toBe(context);
	expect(trimImages(context, 1).messages).toEqual(context.messages);
});
