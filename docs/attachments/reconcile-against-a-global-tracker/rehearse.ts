// Parent join: reuse the integrated children's owned, self-cleaning fixtures.
import { join } from "node:path";

const scripts = {
  vault: ["../global-vault-tracker-backend/rehearse.ts"],
  runtime: ["../reconcile-with-global-tracker-and-landing-ledger/rehearse.ts", "all"],
  instructions: ["../reconcile-with-global-tracker-and-landing-ledger/rehearse.ts", "sparse"],
};
const mode = process.argv[2] ?? "all";
if (process.argv.length > 3 || (mode !== "all" && !Object.hasOwn(scripts, mode))) {
  console.error("Use all|vault|runtime|instructions");
  process.exit(2);
}
const selected = mode === "all" ? ["vault", "runtime"] as const : [mode as keyof typeof scripts];
for (const name of selected) {
  const [script, ...args] = scripts[name];
  console.log("GLOBAL JOIN start " + name);
  const child = Bun.spawn([process.execPath, join(import.meta.dir, script), ...args], { stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code !== 0) process.exit(code);
  console.log("GLOBAL JOIN complete " + name);
}
