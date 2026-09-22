/** Native Cua driving and the separate Playwright recording surface. */
import * as native from "./computer/native.ts";
import * as playwright from "./computer/browser-runner.ts";
export { browser, spec, sheet, appeared } from "./computer/browser.ts";
export type { UI, UIResult, UIResponse, Options, Event, Candidate, Action, Status, Step, Walked, Verification } from "./computer/native.ts";
export type { Options as BrowserOptions, Event as BrowserEvent } from "./computer/browser-runner.ts";

export function step(options: native.Options, history?: readonly native.Event[]): Promise<native.Event>;
export function step(options: playwright.Options, history?: readonly playwright.Event[]): Promise<playwright.Event>;
export function step(options: native.Options | playwright.Options, history: readonly any[] = []) {
 return "list_apps" in options.ui ? native.step(options as native.Options, history) : playwright.step(options as playwright.Options, history);
}
export function run(options: native.Options): ReturnType<typeof native.run>;
export function run(options: playwright.Options): ReturnType<typeof playwright.run>;
export function run(options: native.Options | playwright.Options) {
 return "list_apps" in options.ui ? native.run(options as native.Options) : playwright.run(options as playwright.Options);
}
export function walk(steps: readonly native.Step[], options: Omit<native.Options,"goal"|"until">): ReturnType<typeof native.walk>;
export function walk(steps: readonly playwright.Step[], options: Omit<playwright.Options,"goal"|"until">): ReturnType<typeof playwright.walk>;
export function walk(steps: readonly native.Step[], options: Omit<native.Options,"goal"|"until"> | Omit<playwright.Options,"goal"|"until">) {
 return "list_apps" in options.ui ? native.walk(steps, options as Omit<native.Options,"goal"|"until">) : playwright.walk(steps, options as Omit<playwright.Options,"goal"|"until">);
}
