// Browser lifecycle belongs to Playwright or the project's setup, not desktop discovery.
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { browser, type PageLike } from "../lib/computer/browser.ts";
import { run, type Options as DriveOptions } from "../lib/computer/browser-runner.ts";
import { redact } from "../lib/computer/redact.ts";

export interface BrowserSession {
    page: PageLike;
    close(): Promise<void>;
    verify?: DriveOptions["verify"];
}
export interface Options {
    module?: string; url?: string; headed?: boolean;
    goal: string; until: string; inputs: Record<string, string>; hidden: string[];
    maxSteps: number; timeoutMs: number; dir: string; json?: boolean;
    decision?: DriveOptions["decision"];
}

export async function openBrowser(options: Pick<Options, "module" | "url" | "headed">, signal: AbortSignal): Promise<BrowserSession> {
    signal.throwIfAborted();
    if (options.module) {
        const setup = await import(pathToFileURL(options.module).href);
        if (typeof setup.default !== "function") throw new Error("--browser module must default-export async ({signal}) => ({page, close, verify?})");
        return setup.default({ signal });
    }
    const url = new URL(options.url!);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("--url requires an http(s) application URL");
    const require = createRequire(resolve("package.json"));
    let playwright: any;
    for (const name of ["@playwright/test", "playwright"]) {
        try { playwright = require(name); break; } catch (error: any) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
    }
    if (!playwright) throw new Error("Run from a project with Playwright installed, or use --browser ./setup.ts with the project's existing browser setup");
    const instance = await playwright.chromium.launch({ headless: !options.headed });
    try {
        const context = await instance.newContext();
        const page = await context.newPage();
        const onAbort = () => { void instance.close().catch(() => {}); };
        signal.addEventListener("abort", onAbort, { once: true });
        const close = async () => { signal.removeEventListener("abort", onAbort); await instance.close(); };
        if (signal.aborted) { await close(); signal.throwIfAborted(); }
        try {
            await page.goto(url.href, { waitUntil: "domcontentloaded" });
            return { page, close };
        } catch (error) { await close(); throw error; }
    } catch (error) { await instance.close(); throw error; }
}

export async function driveBrowser(options: Options) {
    const signal = AbortSignal.timeout(options.timeoutMs);
    const hide = <T>(value: T): T => redact(value, options.inputs, options.hidden);
    const trace = join(options.dir, new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 6) + ".browser.jsonl");
    writeFileSync(trace, JSON.stringify(hide({ surface: "browser", module: options.module, url: options.url, goal: options.goal, until: options.until })) + "\n");
    let session: BrowserSession | undefined;
    try {
        session = await openBrowser(options, signal);
        if (!session?.page || typeof session.close !== "function") throw new Error("Browser setup must return {page, close, verify?}; setup owns cleanup if it fails before returning");
        signal.throwIfAborted();
        if (typeof session.page.locator("body").ariaSnapshotJSON !== "function") throw new Error("This browser adapter requires Playwright ariaSnapshotJSON (1.63+); use the project's current Playwright via --browser ./setup.ts");
        const result = await run({ ui: browser(session.page), apps: ["page"], goal: options.goal, until: options.until,
            inputs: options.inputs, hidden: options.hidden, resolveInput: () => undefined,
            verify: session.verify, signal, maxSteps: options.maxSteps, timeoutMs: options.timeoutMs, decision: options.decision,
            onEvent(event) {
                appendFileSync(trace, JSON.stringify(hide(event)) + "\n");
                console.error(hide("step " + event.index + ": " + (event.selected?.description ?? event.status) + (event.reason ? " (" + event.reason + ")" : "")));
            },
        });
        const last = result.trace.at(-1)!;
        const summary = hide({ status: result.status, reason: last.reason, completion: last.completion, url: session.page.url(),
            actions: result.trace.filter(e => e.outcome).length, trace,
            ...(result.status === "done" ? {} : { help: "Inspect the trace. This browser is closed after the drive; use project setup to reattach to an owned page, never blindly replay mutations." }),
        });
        console.log(options.json ? JSON.stringify(summary, null, 2) : Object.entries(summary).filter(([, v]) => v !== undefined).map(([k, v]) => k + ": " + v).join("\n"));
        process.exitCode = result.status === "done" ? 0 : 1;
    } catch (error) {
        const reason = hide(error instanceof Error ? error.message : String(error));
        appendFileSync(trace, JSON.stringify({ status: "error", reason }) + "\n");
        throw new Error(reason + "\ntrace: " + trace);
    } finally {
        await session?.close?.();
    }
}
