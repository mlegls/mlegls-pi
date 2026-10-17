/**
 * Build an artboard canvas for review in Lavish.
 *
 *   bun <skill>/scripts/canvas.ts <layout.json> [--out dir]
 *
 * Writes canvas.html, canvas.css and assets/ into --out (default: beside the layout); file
 * frames resolve against the layout. "storybook" may name environment variables as
 * ${NAME}, read from the environment or the nearest .env above the working directory. Every frame is captured in
 * a headless browser and copied in as static DOM under its own stylesheets, scoped to its
 * frame, so Lavish annotates real elements. A frame is a hand-written HTML file or a
 * Storybook story. Run from a directory whose node_modules has @playwright/test
 * (or set ARTBOARD_PLAYWRIGHT to its path).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type Frame = {
  name: string;
  file?: string;
  story?: string;
  globals?: Record<string, string>;
  selector?: string;
  style?: string;
  viewport?: [number, number];
  at?: [number, number];
};
type Page = { title: string; notes?: string[]; frames: Frame[] };
type Layout = { storybook?: string; pages: Page[] };
// base: the stylesheet's own URL, which its relative url()s resolve against.
type Rule = { hoist: boolean; text: string; base: string };
type Taken = {
  chain: { tag: string; attrs: [string, string][]; body: boolean }[];
  html: string;
  width: number;
  height: number;
  background: string;
  rules: Rule[];
  base: string;
};

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const outArg = outFlag >= 0 ? args.splice(outFlag, 2)[1] : undefined;
const layoutPath = resolve(args[0] ?? "layout.json");
const layout: Layout = JSON.parse(readFileSync(layoutPath, "utf8"));
const layoutDir = dirname(layoutPath);
const outDir = resolve(outArg ?? layoutDir);
const assetDir = resolve(outDir, "assets");

function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const file = resolve(dir, ".env");
    if (existsSync(file)) {
      const match = new RegExp("^" + name + "=(.*)$", "m").exec(readFileSync(file, "utf8"));
      if (match) return match[1]?.trim().replace(/^["']|["']$/g, "");
    }
    if (dirname(dir) === dir) return undefined;
  }
}
const storybook = (layout.storybook ?? "http://127.0.0.1:6006").replace(/\$\{(\w+)\}/g, (whole, name: string) => {
  const value = envValue(name);
  if (!value) throw new Error("storybook names " + whole + ", which is not set");
  return value;
});
mkdirSync(assetDir, { recursive: true });

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const attrs = (pairs: [string, string][], extra: Record<string, string> = {}) => {
  const merged = new Map(pairs);
  for (const [key, value] of Object.entries(extra))
    merged.set(key, key === "style" ? (merged.get(key) ?? "") + ";" + value : value);
  return [...merged].map(([key, value]) => " " + key + '="' + escapeAttr(value) + '"').join("");
};
const hash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 10);

// The canvas is a different viewport from the one a frame was drawn in, so viewport
// units become the pixels they resolved to.
function freezeViewport(css: string, [width, height]: [number, number]): string {
  return css.replace(/(-?\d*\.?\d+)[dsl]?v([hw])\b/g, (_, n: string, axis: string) => {
    const px = (Number(n) * (axis === "h" ? height : width)) / 100;
    return String(Math.round(px * 100) / 100) + "px";
  });
}

const fetched = new Map<string, string>();
async function localAsset(url: string): Promise<string> {
  const known = fetched.get(url);
  if (known) return known;
  // Named by content, not URL: a file edited in place under the same name must reach the canvas.
  let bytes: Buffer;
  if (url.startsWith("file:")) bytes = readFileSync(fileURLToPath(url));
  else {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetching " + url + ": " + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const file = createHash("sha1").update(bytes).digest("hex").slice(0, 10) + (extname(new URL(url).pathname) || ".bin");
  const target = resolve(assetDir, file);
  if (!existsSync(target)) writeFileSync(target, bytes);
  fetched.set(url, "assets/" + file);
  return "assets/" + file;
}
async function localiseUrls(text: string, base: string): Promise<string> {
  const pattern = /url\((['"]?)([^'")]+)\1\)|(\bsrc=")([^"]+)"/g;
  const urls = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const raw = match[2] ?? match[4] ?? "";
    if (!/^(data:|#|about:|blob:)/.test(raw)) urls.add(raw);
  }
  const map = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (raw) => {
      try {
        map.set(raw, await localAsset(new URL(raw.replace(/&amp;/g, "&"), base).href));
      } catch (error) {
        console.error("kept " + raw + ": " + (error as Error).message);
      }
    }),
  );
  return text.replace(pattern, (whole, quote: string, cssUrl: string, srcAttr: string, srcUrl: string) => {
    const raw = cssUrl ?? srcUrl;
    const local = map.get(raw);
    if (!local) return whole;
    return cssUrl !== undefined ? "url(" + quote + local + quote + ")" : srcAttr + local + '"';
  });
}

function requirePlaywright() {
  const from = process.env.ARTBOARD_PLAYWRIGHT ?? resolve(process.cwd(), "package.json");
  return createRequire(from)("@playwright/test") as typeof import("@playwright/test");
}

async function capture(browser: import("@playwright/test").Browser, frame: Frame): Promise<Taken> {
  const viewport = frame.viewport ?? [1440, 900];
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  try {
    if (frame.story) {
      const origin = storybook;
      const query = new URLSearchParams({ id: frame.story, viewMode: "story" });
      const globals = Object.entries(frame.globals ?? {}).map(([k, v]) => k + ":" + v);
      if (globals.length) query.set("globals", globals.join(";"));
      await page.goto(origin + "/iframe.html?" + query.toString());
      await page.waitForSelector("#storybook-root > *", { timeout: 30_000 });
    } else if (frame.file) {
      await page.goto(pathToFileURL(resolve(layoutDir, frame.file)).href);
    } else throw new Error(frame.name + " has neither file nor story");
    if (frame.style) await page.addStyleTag({ content: frame.style });
    await page.evaluate(() => document.fonts.ready);
    // Let entrance timers, fonts and scroll-to-latest settle.
    await page.waitForTimeout(frame.story ? 1500 : 300);
    return await page.evaluate((selector) => {
      const target = selector ? document.querySelector(selector) : document.body;
      if (!(target instanceof HTMLElement)) throw new Error("No element matches " + selector);
      const whole = target === document.body;
      for (const element of target.querySelectorAll("*")) {
        if (element.scrollTop || element.scrollLeft)
          element.setAttribute("data-scroll", element.scrollTop + "," + element.scrollLeft);
        if (element instanceof HTMLTextAreaElement) element.textContent = element.value;
        else if (element instanceof HTMLInputElement) {
          element.setAttribute("value", element.value);
          element.toggleAttribute("checked", element.checked);
        }
        if (element instanceof HTMLImageElement && element.currentSrc) {
          element.setAttribute("src", element.currentSrc);
          element.removeAttribute("srcset");
        }
      }
      for (const script of target.querySelectorAll("script")) script.remove();
      const box = target.getBoundingClientRect();
      const width = whole ? innerWidth : box.width;
      const height = whole ? innerHeight : box.height;
      let background = "";
      for (let element: Element | null = target; element; element = element.parentElement) {
        const color = getComputedStyle(element).backgroundColor;
        if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) {
          background = color;
          break;
        }
      }
      const pairs = (element: Element): [string, string][] =>
        [...element.attributes].map((attribute): [string, string] => [attribute.name, attribute.value]);
      const chain = [];
      const top = whole ? document.body : target.parentElement;
      for (let element = top; element && element !== document.documentElement; element = element.parentElement)
        chain.unshift({ tag: element === document.body ? "div" : element.tagName.toLowerCase(), attrs: pairs(element), body: element === document.body });
      if (!whole) target.style.setProperty("width", width + "px");
      if (!whole) target.style.setProperty("height", height + "px");

      // The page's root and body become the frame and its body wrapper.
      const mapSelector = (text: string) =>
        text
          .replace(/(^|[\s,>+~(])(?::root|html)(?=$|[\s,>+~.:#[)])/g, "$1:scope")
          .replace(/(^|[\s,>+~(])body(?=$|[\s,>+~.:#[)])/g, "$1[data-body]");
      const rules: { hoist: boolean; text: string; base: string }[] = [];
      const walk = (list: CSSRuleList) => {
        for (const rule of list) {
          if (rule instanceof CSSStyleRule) rule.selectorText = mapSelector(rule.selectorText);
          if ("cssRules" in rule && !(rule instanceof CSSKeyframesRule)) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        let list: CSSRuleList;
        try {
          list = sheet.cssRules;
        } catch {
          continue;
        }
        walk(list);
        for (const rule of list) {
          const hoist =
            rule instanceof CSSFontFaceRule ||
            rule instanceof CSSKeyframesRule ||
            rule instanceof CSSImportRule ||
            rule.constructor.name === "CSSPropertyRule" ||
            rule.constructor.name === "CSSLayerStatementRule" ||
            rule.constructor.name === "CSSNamespaceRule";
          rules.push({ hoist, text: rule.cssText, base: sheet.href ?? location.href });
        }
      }
      return { chain, html: whole ? target.innerHTML : target.outerHTML, width, height, background, rules, base: location.href };
    }, frame.selector ?? (frame.story ? "#storybook-root > *" : ""));
  } finally {
    await page.close();
  }
}

const { chromium } = requirePlaywright();
// File frames link sibling stylesheets; without this flag a file: sheet's rules are unreadable.
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const frames = layout.pages.flatMap((page) => page.frames.map((frame) => ({ page, frame })));
const taken = new Map<Frame, Taken>();
try {
  await Promise.all(
    frames.map(async ({ frame }) => {
      taken.set(frame, await capture(browser, frame));
      console.error("captured " + frame.name);
    }),
  );
} finally {
  await browser.close();
}

const hoisted = new Set<string>();
const groups = new Map<string, string>();
const figures: string[] = [];
const alone: [string, string][] = [];
const heads: string[] = [];
const outline: string[] = [];
let pageTop = 0;
for (const page of layout.pages) {
  const pageKey = slug(page.title);
  let left = 0;
  let tallest = 0;
  const items: string[] = [];
  for (const frame of page.frames) {
    const key = pageKey + "--" + slug(frame.name);
    const got = taken.get(frame);
    if (!got) continue;
    const viewport = frame.viewport ?? [1440, 900];
    for (const rule of got.rules) if (rule.hoist) hoisted.add(await localiseUrls(rule.text, rule.base));
    const scoped = (
      await Promise.all(
        got.rules.filter((rule) => !rule.hoist).map((rule) => localiseUrls(freezeViewport(rule.text, viewport), rule.base)),
      )
    ).join("\n");
    const group = hash(scoped);
    groups.set(group, scoped);
    const width = Math.round(got.width);
    const height = Math.round(got.height);
    let inner = await localiseUrls(got.html, got.base);
    const whole = got.chain.at(-1)?.body && !frame.selector && !frame.story;
    for (const wrapper of [...got.chain].reverse()) {
      const extra: Record<string, string> = wrapper.body ? { "data-body": "" } : {};
      extra.style = wrapper.body && whole ? "width:100%;height:100%;margin:0;overflow:hidden" : "display:contents";
      inner = "<" + wrapper.tag + attrs(wrapper.attrs, extra) + ">" + inner + "</" + wrapper.tag + ">";
    }
    const [x, y] = frame.at ?? [left, pageTop];
    left += width + 96;
    tallest = Math.max(tallest, height);
    figures.push(
      '<figure class="canvas-frame" id="' + key + '" data-page="' + pageKey + '" data-x="' + x + '" data-y="' + y +
        '" style="left:' + x + "px;top:" + y + 'px">' +
        '<figcaption class="canvas-caption" data-drag="screen" data-lavish-action title="Drag to move; double-click to enter">' +
        escapeText(frame.name) + " <span>" + width + "×" + height + "</span>" +
        '<a class="canvas-open" href="frame-' + key + '.html" target="_blank" rel="noopener" data-lavish-action title="Open alone in a new tab">↗</a></figcaption>' +
        '<div class="canvas-surface" data-frame="' + key + '" data-css="' + group + '" style="width:' + width + "px;height:" + height + "px" +
        (got.background ? ";background:" + got.background : "") + '">' + inner + "</div></figure>",
    );
    // The same frame alone, at full size, for opening in a tab of its own.
    alone.push([
      "frame-" + key + ".html",
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + escapeText(frame.name) + "</title>" +
        '<link rel="stylesheet" href="canvas.css"><style>body{margin:0;background:#e8e8e8}</style></head><body>' +
        '<div class="canvas-surface" data-css="' + group + '" style="position:relative;overflow:hidden;margin:0 auto;width:' + width + "px;height:" + height + "px" +
        (got.background ? ";background:" + got.background : ";background:#fff") + '">' + inner + "</div></body></html>",
    ]);
    items.push('<li><button type="button" data-go="' + key + '">' + escapeText(frame.name) + "</button></li>");
  }
  pageTop += tallest + 320;
  heads.push(
    '<section class="canvas-page" data-page="' + pageKey + '"><header class="canvas-page-head" data-drag="page" data-lavish-action title="Drag to move the page; double-click to fit it"><h2>' +
      escapeText(page.title) + "</h2>" +
      (page.notes ?? []).map((note) => '<p class="canvas-note">' + escapeText(note) + "</p>").join("") +
      "</header></section>",
  );
  outline.push(
    '<li><button type="button" data-go="' + pageKey + '">' + escapeText(page.title) + "</button><ul>" + items.join("") + "</ul></li>",
  );
}

const imports = [...hoisted].filter((rule) => rule.startsWith("@import"));
const css = [
  ...imports,
  ...[...hoisted].filter((rule) => !rule.startsWith("@import")),
  ...[...groups].map(([group, text]) => '@scope ([data-css="' + group + '"]) {\n' + text + "\n}"),
].join("\n");
writeFileSync(resolve(outDir, "canvas.css"), css);
for (const [file, page] of alone) writeFileSync(resolve(outDir, file), page);
const runtime = readFileSync(new URL("./canvas-runtime.js", import.meta.url), "utf8");
const chrome = readFileSync(new URL("./canvas-chrome.css", import.meta.url), "utf8");
const html = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  "<title>Artboard</title>",
  '<link rel="stylesheet" href="canvas.css">',
  "<style>\n" + chrome + "</style></head>",
  '<body data-layout="' + hash(JSON.stringify(layout)) + '">',
  '<div class="canvas-viewport"><div class="canvas-ground" data-lavish-action></div><div class="canvas-world">',
  ...heads,
  ...figures,
  "</div></div>",
  '<nav class="canvas-nav"><ul><li><button type="button" data-go="all">All frames</button></li>' + outline.join("") + "</ul></nav>",
  '<div class="canvas-tools"><button type="button" data-back hidden>← Back</button><button type="button" data-zoom-out>−</button><span data-zoom></span><button type="button" data-zoom-in>+</button><button type="button" data-reset title="Return frames to the layout">Reset</button><button type="button" data-save>Save arrangement</button></div>',
  '<div class="canvas-help">Scroll to pan · pinch or ⌘-scroll to zoom · drag empty canvas to pan · drag a caption to move · double-click a caption to enter · Esc to leave</div>',
  "<script>" + runtime + "</script>",
  "</body></html>",
].join("\n");
writeFileSync(resolve(outDir, "canvas.html"), html);
console.log(resolve(outDir, "canvas.html"));
