// bun run build.ts [--watch]; emits dist/{main.js,manifest.json,styles.css}. Symlink dist as the vault plugin dir.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

async function build() {
  const r = await Bun.build({
    entrypoints: [join(here, "main.ts")], outdir: dist, format: "cjs", target: "browser",
    external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"], sourcemap: "inline", minify: false,
  });
  if (!r.success) { for (const l of r.logs) console.error(l); process.exitCode = 1; return; }
  for (const f of ["manifest.json", "styles.css"]) copyFileSync(join(here, f), join(dist, f));
  console.log(new Date().toLocaleTimeString(), "built");
}

await build();
if (process.argv.includes("--watch")) {
  const { watch } = await import("node:fs");
  let t: ReturnType<typeof setTimeout> | undefined;
  watch(here, { recursive: true }, (_, name) => {
    if (!name || name.startsWith("dist") || name.startsWith("node_modules")) return;
    clearTimeout(t); t = setTimeout(build, 100);
  });
}
