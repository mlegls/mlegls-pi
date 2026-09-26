import { expect, test } from "bun:test";
import { placeholders, quoted } from "./computer.ts";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("quoted spans become inputs named by their text; apostrophes inside words are not quotes", () => {
	expect(quoted("don't touch it, replace the title with 'Q3 plan' and the body with \"it's done\"")).toEqual({ "Q3 plan": "Q3 plan", "it's done": "it's done" });
	expect(quoted("type “smart” and `code`")).toEqual({ smart: "smart", code: "code" });
	expect(quoted("no literals here")).toEqual({});
});

test("placeholders name hidden inputs once each", () => {
	expect(placeholders("log in as %user% with %pass%, then greet %user%")).toEqual(["user", "pass"]);
});

test("CLI refuses implicit desktop targeting and requires a completion condition", async () => {
    for (const [args, message] of [
        [["Open the app", "--until", "The page is visible"], "Native drives require"],
        [["Open the app", "--app", "Chrome"], "Supply --until"],
        [["Open the app", "--url", "http://localhost"], "require INTENT and --until"],
        [["Open the app", "--url", "http://localhost", "--app", "Chrome", "--until", "Ready"], "not --resume/--app"],
    ] as const) {
        const proc = Bun.spawn(["bun", resolve("ab/main.ts"), "computer", ...args], { stdout: "pipe", stderr: "pipe" });
        const text = await new Response(proc.stderr).text();
        expect(await proc.exited).toBe(2);
        expect(text).toContain(message);
    }
});

test.each([false, true])("project browser setup is cleaned up on completion or observation error (%s)", async broken => {
    const dir = mkdtempSync(join(tmpdir(), "computer-cli-test-"));
    const marker = join(dir, "closed");
    const module = join(dir, "setup.ts");
    writeFileSync(module, `
        import { writeFileSync } from 'node:fs';
        export default async () => ({
            page: {
                url: () => 'http://test/', title: async () => 'Ready', waitForLoadState: async () => {},
                locator: () => ({ ariaSnapshot: async () => 'Ready', ariaSnapshotJSON: async () => { ${broken ? "throw new Error('observation broke')" : "return [{role:'heading',name:'Ready'}]"} } }),
            },
            verify: async () => ({source:'application',result:'satisfied',evidence:'Ready'}),
            close: async () => writeFileSync(${JSON.stringify(marker)}, 'closed'),
        });
    `);
    try {
        const proc = Bun.spawn(["bun", resolve("ab/main.ts"), "computer", "--browser", module, "--until", "Ready", "--json", "Inspect the ready page"], {
            env: { ...process.env, AB_SESSION_STATE: dir }, stdout: "pipe", stderr: "pipe",
        });
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        expect(await proc.exited).toBe(broken ? 1 : 0);
        expect(readFileSync(marker, "utf8")).toBe("closed");
        const result = JSON.parse(stdout);
        expect(result.status).toBe(broken ? "error" : "done");
        if (!broken) expect(result.completion).toBe("application");
        else expect(stderr).toContain("observation broke");
        const rows = readFileSync(result.trace, "utf8").trim().split("\n").map(s => JSON.parse(s));
        expect(rows[0].surface).toBe("browser");
        expect(rows.at(-1).status).toBe(result.status);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("browser CLI does not offer a resolver it cannot call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "computer-input-test-"));
    const module = join(dir, "setup.ts");
    const requests: any[] = [];
    const server = Bun.serve({ port: 0, async fetch(req) {
        const raw = await req.json() as any, body = raw.input ?? raw;
        requests.push(body);
        return Response.json({ answers: {
            next: { type: "choice", choice: "needs-input", probabilities: Object.fromEntries(Object.keys(body.questions.next.criteria).map(k => [k, k === "needs-input" ? 1 : 0])) },
            showing: { type: "noul", noul: 0 },
        } });
    } });
    writeFileSync(module, `export default async () => ({
        page: {
            url: () => 'http://fixture.invalid/', title: async () => 'Sign in',
            waitForLoadState: async () => {},
            locator: () => ({ ariaSnapshot: async () => '- textbox "Email"', ariaSnapshotJSON: async () => [{role:'textbox',name:'Email'}] }),
        }, close: async () => {},
    });`);
    try {
        const options = { module, goal: "Sign in", until: "Account is visible", inputs: {}, hidden: [], maxSteps: 1, timeoutMs: 5000, dir, json: true, decision: { url: server.url.href, apiKey: "test" } };
        const script = `import {driveBrowser} from ${JSON.stringify(resolve("ab/computer-browser.ts"))}; await driveBrowser(${JSON.stringify(options)});`;
        const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        expect(await proc.exited).toBe(1);
        expect(stderr).not.toContain("error");
        expect(JSON.parse(stdout).status).toBe("needs-input");
        expect(requests).toHaveLength(1);
        expect(requests[0].state.textResolverAvailable).toBe(false);
        expect(Object.values(requests[0].questions.next.criteria).join(" ")).not.toContain("parent text resolver");
        expect(requests[0].questions.next.instructions).toContain("wait for the intended field");
    } finally { server.stop(true); rmSync(dir, { recursive: true, force: true }); }
});
