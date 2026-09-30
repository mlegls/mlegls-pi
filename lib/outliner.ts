import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMap, parseDocument, stringify } from 'yaml';
import { blockAt, writeBack, type Block } from './vault.ts';

export type Section = 'plans' | 'fleeting' | 'efforts';
export type TrackerIssue = {
  slug: string;
  file?: string;
  stage: string | null;
  effectiveStage?: string | null;
  claimed: boolean;
  claimedBy?: string[];
  archived: boolean;
  legacy?: boolean;
  partOf?: string | null;
};
export type IssueLink = { target: string; repo: string; slug: string; archivedLink: boolean; issue?: TrackerIssue };
export type Bullet = {
  path: string;
  directory: string;
  repo: string;
  section: Section;
  line: number;
  indent: string;
  text: string;
  tags: string[];
  links: IssueLink[];
  issue?: IssueLink;
  parentLine?: number;
  done: boolean;
};
export type TreeNode = TrackerIssue & { children: TreeNode[] };
export type Outliner = {
  note: string;
  repo: string;
  directory: string;
  text: string;
  bullets: Bullet[];
  sections: Record<Section, Bullet[]>;
  tree: TreeNode[];
  issues: TrackerIssue[];
  orphans: TrackerIssue[];
};
export type IssueDraft = {
  title: string;
  body: string;
  slug?: string;
  stage?: 'idea' | 'goal' | 'spec' | 'ticket';
  assignee?: string;
  priority?: 1 | 2 | 3 | 4;
};

const vault = () => process.env.TRACKER_VAULT ?? join(homedir(), 'obsidian');
const tracker = fileURLToPath(new URL('../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts', import.meta.url));
const sectionNames = new Set<Section>(['plans', 'fleeting', 'efforts']);
let lastLoaded: Outliner | undefined;

function expanded(path: string) {
  return resolve(path.replace(/^~(?=$|\/)/, homedir()));
}
function repoName(value: string) {
  return value.replace(/\\/g, '/').replace(/\/$/, '').split('/').at(-1)!.replace(/\.git$/, '');
}
function issueRepo(target: string) {
  const m = target.match(/^projects\/([^/]+)\/issues\/(archive\/)?([^/]+)$/);
  return m && { repo: m[1], slug: m[3], archivedLink: !!m[2] };
}
function issueLinks(text: string) {
  const result: Array<{ target: string; repo: string; slug: string; archivedLink: boolean }> = [];
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split('|', 1)[0].split('#', 1)[0].trim();
    const parsed = issueRepo(target);
    if (parsed) result.push({ target, ...parsed });
  }
  return result;
}
function metadata(text: string) {
  const fm = text.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m);
  if (!fm || fm.index !== 0) return {};
  const doc = parseDocument(fm[1], { uniqueKeys: true, merge: false });
  if (doc.errors.length || doc.warnings.length) throw new Error(`Invalid outliner frontmatter: ${[...doc.errors, ...doc.warnings].map(e => e.message).join('; ')}`);
  if (!isMap(doc.contents)) throw new Error('Outliner frontmatter must be a mapping');
  const value = doc.toJS() as Record<string, unknown>;
  return {
    repo: typeof value.repo === 'string' ? value.repo.trim() : undefined,
    directory: typeof value.directory === 'string' ? value.directory.trim() : undefined,
  };
}
function findNote(project: string) {
  const value = expanded(project);
  if (existsSync(value) && !value.endsWith('.md')) return { directory: value, note: undefined as string | undefined };
  if (existsSync(value) && value.endsWith('.md')) return { directory: undefined as string | undefined, note: value };
  const pathLike = project.startsWith('/') || project.startsWith('~') || project.startsWith('.');
  const candidate = pathLike ? (value.endsWith('.md') ? value : value + '.md') : join(vault(), project.endsWith('.md') ? project : project + '.md');
  if (!existsSync(candidate)) throw new Error(`No outliner note: ${candidate}`);
  return { directory: undefined as string | undefined, note: candidate };
}
function findProjectNote(directory: string, repo: string) {
  const root = vault();
  if (!existsSync(root)) return undefined;
  const wanted = expanded(directory);
  for (const name of readdirSync(root)) {
    if (!name.endsWith('.md')) continue;
    const note = join(root, name);
    const text = readFileSync(note, 'utf8');
    const fm = metadata(text);
    if ((fm.repo && repoName(fm.repo) === repo) || (fm.directory && expanded(fm.directory) === wanted)) return note;
    const links = issueLinks(text);
    if (new Set(links.map(link => link.repo)).size === 1 && links[0]?.repo === repo) return note;
  }
  const byName = join(root, repo + '.md');
  return existsSync(byName) ? byName : undefined;
}
function runTracker(directory: string, command: 'tree' | 'snapshot') {
  const args = command === 'snapshot' ? [tracker, 'snapshot', '--json'] : [tracker, 'tree'];
  const p = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' });
  if (p.error || p.status !== 0) throw new Error(`issues.ts ${command} failed in ${directory}: ${(p.stderr || p.error?.message || p.stdout).trim()}`);
  return p.stdout;
}
function parseIssues(directory: string): TrackerIssue[] {
  const snapshot = JSON.parse(runTracker(directory, 'snapshot')) as {
    issues: Array<Record<string, any>>;
    legacy: Array<Record<string, any>>;
  };
  const issues: TrackerIssue[] = snapshot.issues.map(row => {
    const claims = (row.claims ?? []).filter((claim: any) => claim.slug === row.slug).map((claim: any) => claim.claimedBy);
    return {
      slug: row.slug,
      file: row.file,
      stage: row.ownStage,
      effectiveStage: row.effectiveStage,
      claimed: claims.length > 0,
      ...(claims.length ? { claimedBy: claims } : {}),
      archived: !!row.archived,
      partOf: row.partOf,
    };
  });
  const issueRoot = existsSync(join(directory, 'docs', 'issues')) ? join(directory, 'docs', 'issues') : join(directory, 'issues');
  for (const row of snapshot.legacy ?? []) {
    issues.push({
      slug: row.slug,
      file: join(issueRoot, ...(row.archived ? ['archive'] : []), row.slug + '.md'),
      stage: `legacy:${row.next}`,
      claimed: !!row.claimedBy,
      ...(row.claimedBy ? { claimedBy: [row.claimedBy] } : {}),
      archived: !!row.archived,
      legacy: true,
      partOf: row.partOf,
    });
  }
  return issues;
}
function trackerTree(directory: string, issues: TrackerIssue[]): TreeNode[] {
  const bySlug = new Map(issues.map(issue => [issue.slug, { ...issue, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const line of runTracker(directory, 'tree').split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^( *)([^\s]+)\s+\[/);
    if (!match) continue;
    const node = bySlug.get(match[2]);
    if (!node) continue;
    const depth = Math.floor(match[1].length / 2);
    stack.length = depth;
    if (depth && stack[depth - 1]) stack[depth - 1].children.push(node);
    else roots.push(node);
    stack[depth] = node;
  }
  const seen = new Set<string>();
  const collect = (nodes: TreeNode[]) => { for (const node of nodes) { seen.add(node.slug); collect(node.children); } };
  collect(roots);
  for (const node of bySlug.values()) if (!seen.has(node.slug)) roots.push(node);
  return roots;
}
function outlinerProject(project: string, directoryOverride?: string) {
  const found = findNote(project);
  const directory = directoryOverride ? expanded(directoryOverride) : found.directory;
  const note = found.note ?? (directory ? findProjectNote(directory, repoName(directory)) : undefined);
  if (!note) throw new Error(`No vault outliner note for ${directory}`);
  const text = readFileSync(note, 'utf8');
  const fm = metadata(text);
  const links = issueLinks(text);
  const projectDirectory = directory ?? (fm.directory ? expanded(fm.directory) : undefined);
  const linkedRepos = [...new Set(links.map(link => link.repo))];
  const repo = fm.repo ? repoName(fm.repo) : linkedRepos.length === 1 ? linkedRepos[0] : projectDirectory ? repoName(projectDirectory) : undefined;
  if (!repo) throw new Error(`${note} needs frontmatter repo/directory or links to exactly one project tracker`);
  const resolvedDirectory = projectDirectory ?? expanded(join(homedir(), 'dev', repo));
  if (!existsSync(resolvedDirectory)) throw new Error(`Project directory does not exist: ${resolvedDirectory}`);
  return { note, text, repo, directory: resolvedDirectory };
}
function listBullets(note: string, notePath: string, directory: string, repo: string, issues: Map<string, TrackerIssue>): Bullet[] {
  const lines = note.split(/\r?\n/);
  const found: Bullet[] = [];
  const parents: Array<{ indent: number; line: number }> = [];
  let section: Section | undefined;
  let fence = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0] === fence) fence = ''; continue; }
    if (fence) continue;
    const heading = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const name = heading[1].trim().toLowerCase() as Section;
      section = sectionNames.has(name) ? name : undefined;
      parents.length = 0;
      continue;
    }
    if (!section) continue;
    const item = line.match(/^([ \t]*)(?:[-+*]|\d+[.)]) +\S.*$/);
    if (!item) continue;
    const indent = item[1];
    const width = indent.replace(/\t/g, '    ').length;
    while (parents.length && parents.at(-1)!.indent >= width) parents.pop();
    const parentLine = parents.at(-1)?.line;
    const block = blockAt(note, i + 1);
    const links = issueLinks(line).map(link => ({ ...link, ...(link.repo === repo ? { issue: issues.get(link.slug) } : {}) }));
    const tags = [...line.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)\b/gu)].map(match => match[1]).filter(tag => tag.toLowerCase() !== 'done');
    found.push({
      path: notePath,
      directory,
      repo,
      section,
      line: i + 1,
      indent,
      text: block.text,
      tags: [...new Set(tags)],
      links,
      ...(links.length === 1 ? { issue: links[0] } : {}),
      ...(parentLine ? { parentLine } : {}),
      done: /(?:^|\s)#done\b/i.test(line),
    });
    parents.push({ indent: width, line: i + 1 });
  }
  return found;
}

export function load(project: string, directory?: string): Outliner {
  const resolved = outlinerProject(project, directory);
  const issues = parseIssues(resolved.directory);
  const bySlug = new Map(issues.map(issue => [issue.slug, issue]));
  const bullets = listBullets(resolved.text, resolved.note, resolved.directory, resolved.repo, bySlug);
  const linked = new Set(issueLinks(resolved.text).filter(link => link.repo === resolved.repo).map(link => link.slug));
  const sections: Record<Section, Bullet[]> = { plans: [], fleeting: [], efforts: [] };
  for (const bullet of bullets) if (bullet.parentLine === undefined) sections[bullet.section].push(bullet);
  const result: Outliner = {
    note: resolved.note,
    repo: resolved.repo,
    directory: resolved.directory,
    text: resolved.text,
    bullets,
    sections,
    tree: trackerTree(resolved.directory, issues),
    issues,
    orphans: issues.filter(issue => !issue.archived && !linked.has(issue.slug)),
  };
  lastLoaded = result;
  return result;
}

export function orphans(project?: string | Outliner, directory?: string) {
  if (project && typeof project !== 'string') return project.orphans;
  if (typeof project === 'string') return load(project, directory).orphans;
  if (!lastLoaded) throw new Error('Load an outliner project before calling orphans()');
  return lastLoaded.orphans;
}
function currentBlock(bullet: Bullet): Block {
  const note = readFileSync(bullet.path, 'utf8');
  const block = blockAt(note, bullet.line);
  if (block.text !== bullet.text) throw new Error('Outliner bullet changed; reload and propose the diff again.');
  return { ...block, tag: bullet.tags.join(',') };
}
function issueSlug(issue: string | TrackerIssue | IssueLink) {
  const slug = typeof issue === 'string' ? issue.match(/(?:^|\/)([a-z0-9][a-z0-9-]*)\]?\]?$/i)?.[1] : issue.slug;
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error('Expected an issue slug or resolved issue');
  return slug;
}
function addIssueLink(text: string, repo: string, slug: string) {
  const lines = text.split('\n');
  const refs = issueLinks(lines[0]);
  if (refs.some(ref => ref.repo === repo && ref.slug === slug)) return text;
  if (refs.length) throw new Error(`Bullet already links ${refs.map(ref => ref.target).join(', ')}; reconcile that link before attaching another issue.`);
  const link = `[[projects/${repo}/issues/${slug}]]`;
  const tags = lines[0].match(/(?:\s+#[\p{L}\p{N}_-]+)+\s*$/u)?.[0];
  lines[0] = tags ? lines[0].slice(0, -tags.length).trimEnd() + ` → ${link}` + tags : lines[0].trimEnd() + ` → ${link}`;
  return lines.join('\n');
}

export function move(bullet: Bullet, options: { to: 'efforts'; issue?: string | TrackerIssue | IssueLink }) {
  const block = currentBlock(bullet);
  const replacement = options.issue ? addIssueLink(block.text, bullet.repo, issueSlug(options.issue)) : block.text;
  return writeBack(bullet.path, block, { moveTo: options.to, replace: replacement });
}
export function mark(bullet: Bullet, status: 'done') {
  const block = currentBlock(bullet);
  if (bullet.done) return;
  const lines = block.text.split('\n');
  const tags = lines[0].match(/(?:\s+#[\p{L}\p{N}_-]+)+\s*$/u)?.[0];
  lines[0] = tags ? lines[0].slice(0, -tags.length).trimEnd() + ' #done' + tags : lines[0].trimEnd() + ' #done';
  return writeBack(bullet.path, block, { replace: lines.join('\n') });
}
export function remove(bullet: Bullet) {
  const block = currentBlock(bullet);
  return writeBack(bullet.path, block, { remove: true });
}
function issueTitle(bullet: Bullet) {
  return bullet.text.split(/\r?\n/)[0]
    .replace(/^[ \t]*(?:[-+*]|\d+[.)]) +/, '')
    .replace(/\s*#(?:done|[\p{L}\p{N}_-]+)\b/gu, '')
    .replace(/\s*\[\[[^\]]+\]\]/g, '')
    .trim();
}
function slugify(text: string) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-+$/g, '');
  if (!slug) throw new Error('Issue title needs an ASCII slug');
  return slug;
}
// Persist an issue draft after the interactive introduce workflow has settled it.
function introduce(directory: string, draft: IssueDraft): TrackerIssue {
  const session = process.env.PI_SESSION_ID;
  if (!session) throw new Error('PI_SESSION_ID is required to record issue provenance');
  if (!draft.title.trim() || !draft.body.trim()) throw new Error('Issue introduction needs a title and body');
  const stage = draft.stage ?? 'idea';
  if (!['idea', 'goal', 'spec', 'ticket'].includes(stage)) throw new Error(`Invalid introduced issue stage: ${stage}`);
  const slug = draft.slug ?? slugify(draft.title);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Invalid issue slug: ${slug}`);
  const issueRoot = existsSync(join(directory, 'docs', 'issues')) ? join(directory, 'docs', 'issues') : join(directory, 'issues');
  if (!existsSync(issueRoot)) throw new Error(`No tracker issue directory in ${directory}`);
  const file = join(issueRoot, slug + '.md');
  const frontmatter = stringify({
    stage,
    author: `session:${session}`,
    ...(draft.assignee ? { assignee: draft.assignee } : {}),
    ...(draft.priority ? { priority: draft.priority } : {}),
  }).trimEnd();
  writeFileSync(file, `---\n${frontmatter}\n---\n\n${draft.body.trim()}\n`, { flag: 'wx' });
  return { slug, file, stage, effectiveStage: stage, claimed: false, archived: false };
}
// Exec calls a lib module's exported `attach` at startup; its capabilities object is not a bullet.
export function attach(bullet: Bullet, draft?: IssueDraft): IssueLink;
export function attach(capabilities: object): void;
export function attach(value: object, draft?: IssueDraft): IssueLink | void {
  if (!('path' in value) || typeof value.path !== 'string') return;
  const bullet = value as Bullet;
  const block = currentBlock(bullet);
  const linked = issueLinks(block.text.split('\n')[0]).filter(link => link.repo === bullet.repo);
  if (linked.length > 1) throw new Error('Bullet links multiple issues; choose one before attaching.');
  if (linked.length === 1) return { ...linked[0], issue: bullet.links.find(link => link.repo === bullet.repo && link.slug === linked[0].slug)?.issue };
  const title = draft?.title ?? issueTitle(bullet);
  const issueDraft = draft ?? { title, body: bullet.text, stage: 'idea' as const };
  const created = introduce(bullet.directory, issueDraft);
  try {
    writeBack(bullet.path, block, { replace: addIssueLink(block.text, bullet.repo, created.slug) });
  } catch (error) {
    rmSync(created.file!, { force: true });
    throw error;
  }
  return { target: `projects/${bullet.repo}/issues/${created.slug}`, repo: bullet.repo, slug: created.slug, archivedLink: false, issue: created };
}
