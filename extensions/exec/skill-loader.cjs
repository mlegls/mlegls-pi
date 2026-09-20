const { readFile, stat } = require("node:fs/promises");
const { resolve, dirname, join } = require("node:path");

// Match only the original source. Replacement output is never parsed as instructions.
const placeholders = /```!\s*\n?([\s\S]*?)\n?```/g;
const inline = /(?<!\S)!`([^`]+)`/g;

function createSkillLoader(workspace, runShell, register, protect = value => value) {
 workspace = resolve(workspace);
 return async function loadSkill(path) {
  if (typeof path !== "string") throw new TypeError("loadSkill expects a SKILL.md path or directory");
  path = resolve(workspace, path);
  if ((await stat(path)).isDirectory()) path = join(path, "SKILL.md");
  const source = await readFile(path, "utf8");
  const skillDir = dirname(path);
  const matches = [...source.matchAll(placeholders)].map(m => ({ start: m.index, end: m.index + m[0].length, command: m[1] }));
  for (const m of source.matchAll(inline)) {
   if (!matches.some(block => m.index >= block.start && m.index < block.end)) matches.push({ start: m.index, end: m.index + m[0].length, command: m[1] });
  }
  matches.sort((a, b) => a.start - b.start);
  const commands = [];
  let text = "", cursor = 0;
  for (const match of matches) {
   text += source.slice(cursor, match.start);
   let result;
   try {
    result = await runShell(match.command, { cwd: workspace, env: { ...process.env, PI_SKILL_DIR: skillDir, PI_WORKSPACE: workspace } });
   } catch (error) {
    result = { stdout: "", stderr: String(error), exitCode: null, stdoutTruncated: false, stderrTruncated: false };
   }
   commands.push({ command: match.command, ...result });
   text += result.stdout;
   if (result.exitCode !== 0 || result.stderr || result.stdoutTruncated || result.stderrTruncated) {
    text += "\n[skill command exitCode=" + result.exitCode + " stdoutTruncated=" + result.stdoutTruncated + " stderrTruncated=" + result.stderrTruncated + "]\n";
    if (result.stderr) text += "stderr:\n" + result.stderr;
   }
   cursor = match.end;
  }
  text += source.slice(cursor);
  text = "Skill: " + path + "\nPI_SKILL_DIR=" + skillDir + "\nPI_WORKSPACE=" + workspace + "\nRelative skill references resolve from PI_SKILL_DIR; workspace commands run in PI_WORKSPACE.\n\n" + text;
  return protect(register({ path, text, commands, content() { return protect([{ type: "text", text: this.text }]); } }, "text"));
 };
}
module.exports = { createSkillLoader };
