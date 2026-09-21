// extract: candidate spans for semantic lints, with the local context a judge needs.
//
//   bun lib/lint/extract.ts <repoRoot> <tsconfig>[,<tsconfig>...] [sinceRef]   # jsonl of Span on stdout
//
// Uses the target repo's own TypeScript so types resolve as its typecheck sees them. Every
// tsconfig is loaded so property uses are counted across the whole repository, not one project.
// With sinceRef only spans on lines `git diff sinceRef` added are emitted; the index is still whole.
//
// Kinds: expect (assertions in tests), field (optional properties, with every use of that
// property across the repository), static (findings needing no judgment: an exiting guard whose
// type predicate is already satisfied by its argument's declared type; an optional field nothing
// in the repository names). Fields whose value reaches a library from node_modules are skipped:
// their consumer is outside the repository.
//
// Context: the enclosing function, signatures of everything it calls, for expect the source of
// the function under test and the concept notes whose `path:` frontmatter names that source.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type TS from "typescript";

export interface Span {
  kind: "expect" | "field" | "static";
  file: string;
  line: number;
  text: string;
  enclosing: string;
  callees: string[];
  subject?: string;
  test?: string;
  references?: string[];
  sameName?: number;
  concepts?: string;
  reason?: string;
  predicate?: string;
  argument?: string;
}

/** Optional props every React component declares; their consumer is the framework. */
const FRAMEWORK_PROPS = new Set(["className", "children", "style", "id", "key", "ref"]);

const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

/** Markdown notes under docs/ whose `path:` frontmatter names a source file or directory. */
function conceptNotes(root: string): { path: string; title: string; body: string }[] {
  const notes: { path: string; title: string; body: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { if (!/issues|attachments|guide/.test(entry)) walk(full); continue; }
      if (!entry.endsWith(".md")) continue;
      const text = readFileSync(full, "utf8");
      const path = text.match(/^path:\s*(\S+)/m)?.[1];
      if (!path) continue;
      const body = text.replace(/^---[\s\S]*?---\s*/, "");
      notes.push({ path, title: entry.replace(/\.md$/, ""), body: cap(body, 1500) });
    }
  };
  try { walk(join(root, "docs")); } catch {}
  return notes;
}

/** file → line numbers `git diff ref` adds, for the working tree. */
function addedLines(root: string, ref: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  const diff = execFileSync("git", ["diff", "-U0", ref, "--"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  let file = "";
  for (const line of diff.split("\n")) {
    const f = line.match(/^\+\+\+ b\/(.*)$/);
    if (f) { file = f[1]!; out.set(file, new Set()); continue; }
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h) for (let i = +h[1]!, n = h[2] === undefined ? 1 : +h[2]; n > 0; n--) out.get(file)!.add(i++);
  }
  return out;
}

export function extract(root: string, tsconfigs: string[], sinceRef?: string): Span[] {
  const ts: typeof TS = createRequire(resolve(root, "package.json"))("typescript");
  const programs = tsconfigs.map((tsconfig) => {
    const config = ts.readConfigFile(resolve(root, tsconfig), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, tsconfig, ".."));
    return ts.createProgram(parsed.fileNames, parsed.options);
  });
  const added = sinceRef === undefined ? undefined : addedLines(root, sinceRef);
  const notes = conceptNotes(root);
  const spans: Span[] = [];
  const seen = new Set<string>();
  const rel = (sf: TS.SourceFile) => relative(root, sf.fileName);
  const isProject = (sf: TS.SourceFile) => !sf.isDeclarationFile && !sf.fileName.includes("node_modules") && /\.tsx?$/.test(sf.fileName);

  // Property uses across every program, keyed by the declaring property's position so
  // same-named fields on unrelated types stay apart; unresolved uses fall back to the name.
  const propertyUses = new Map<string, string[]>();
  // Declaring keys of fields whose value is handed to a node_modules library.
  const externalSinks = new Set<string>();
  const calleeOf = (n: TS.CallExpression | TS.NewExpression) => ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression;
  const declKey = (s: TS.Symbol | undefined, name: string): string => {
    const d = s?.declarations?.[0];
    return d ? `${d.getSourceFile().fileName}:${d.pos}` : `name:${name}`;
  };
  for (const program of programs) {
    const checker = program.getTypeChecker();
    const propertyOf = (type: TS.Type | undefined, name: string): TS.Symbol | undefined => {
      if (!type) return undefined;
      if (type.isUnion()) for (const t of type.types) { const s = propertyOf(t, name); if (s) return s; }
      return type.getProperty(name);
    };
    for (const sf of program.getSourceFiles()) {
      if (!isProject(sf)) continue;
      const lines = sf.text.split("\n");
      const record = (n: TS.Node, name: string, symbol: TS.Symbol | undefined) => {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
        const entry = `${rel(sf)}:${line + 1}: ${lines[line]!.trim()}`;
        for (const key of new Set([declKey(symbol, name), `name:${name}`])) {
          const list = propertyUses.get(key) ?? [];
          if (!list.includes(entry)) list.push(entry);
          propertyUses.set(key, list);
        }
      };
      const external = (s: TS.Symbol | undefined) => !!s?.declarations?.some((d) => d.getSourceFile().fileName.includes("node_modules"));
      // The property a value expression was read from, through one binding or variable.
      const flowsFrom = (e: TS.Node | undefined): TS.Symbol | undefined => {
        if (!e) return undefined;
        if (ts.isJsxExpression(e) || ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return flowsFrom(e.expression);
        if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) return flowsFrom(e.left);
        if (ts.isConditionalExpression(e)) return flowsFrom(e.whenTrue) ?? flowsFrom(e.whenFalse);
        if (ts.isPropertyAccessExpression(e)) return checker.getSymbolAtLocation(e.name);
        if (!ts.isIdentifier(e)) return undefined;
        const decl = checker.getSymbolAtLocation(e)?.declarations?.[0];
        if (decl && ts.isBindingElement(decl) && ts.isObjectBindingPattern(decl.parent))
          return propertyOf(checker.getTypeAtLocation(decl.parent), decl.propertyName && ts.isIdentifier(decl.propertyName) ? decl.propertyName.text : e.text);
        if (decl && ts.isVariableDeclaration(decl)) return flowsFrom(decl.initializer);
        return undefined;
      };
      const sink = (target: TS.Symbol | undefined, value: TS.Node | undefined) => {
        if (!external(target)) return;
        const source = flowsFrom(value);
        if (source && !external(source)) externalSinks.add(declKey(source, source.name));
      };
      const visit = (n: TS.Node) => {
        if (ts.isPropertyAccessExpression(n)) record(n, n.name.text, checker.getSymbolAtLocation(n.name));
        else if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name)) {
          const s = propertyOf(checker.getContextualType(n.parent), n.name.text);
          record(n, n.name.text, s);
          sink(s, n.initializer);
        } else if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
          const s = propertyOf(checker.getContextualType(n.parent), n.name.text);
          record(n, n.name.text, s);
          sink(s, ts.isPropertyAssignment(n) ? n.initializer : n.name);
        } else if (ts.isCallExpression(n) && external(checker.getSymbolAtLocation(calleeOf(n)))) n.arguments.forEach((a) => sink(checker.getSymbolAtLocation(calleeOf(n)), a));
        else if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && ts.isObjectBindingPattern(n.parent)) {
          const name = n.propertyName && ts.isIdentifier(n.propertyName) ? n.propertyName.text : n.name.text;
          record(n, name, propertyOf(checker.getTypeAtLocation(n.parent), name));
        } else if (ts.isStringLiteral(n) && n.parent && ts.isElementAccessExpression(n.parent))
          record(n, n.text, propertyOf(checker.getTypeAtLocation(n.parent.expression), n.text));
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  for (const program of programs) {
    const checker = program.getTypeChecker();
    const enclosingFunction = (node: TS.Node): TS.Node => {
      let n: TS.Node | undefined = node.parent;
      while (n && !ts.isFunctionLike(n)) n = n.parent;
      return n ?? node.getSourceFile();
    };
    const declarationOf = (node: TS.Node): TS.Declaration | undefined => {
      const symbol = checker.getSymbolAtLocation(node);
      const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      return target?.declarations?.find((d) => !program.isSourceFileDefaultLibrary(d.getSourceFile()) && !d.getSourceFile().fileName.includes("node_modules"));
    };
    const callees = (scope: TS.Node): string[] => {
      const out = new Set<string>();
      const visit = (n: TS.Node) => {
        if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
          const callee = calleeOf(n);
          const decl = declarationOf(callee);
          if (decl && ts.isFunctionLike(decl)) out.add(cap(decl.getText().split("{")[0]!.trim(), 300));
          else if (decl && (ts.isVariableDeclaration(decl) || ts.isParameter(decl)))
            out.add(`${callee.getText()}: ${checker.typeToString(checker.getTypeAtLocation(callee))}`);
        }
        ts.forEachChild(n, visit);
      };
      visit(scope);
      return [...out];
    };
    const exits = (s: TS.Statement): boolean =>
      ts.isReturnStatement(s) || ts.isThrowStatement(s) || ts.isContinueStatement(s) || ts.isBreakStatement(s) ||
      (ts.isBlock(s) && s.statements.length === 1 && exits(s.statements[0]!));
    const testName = (node: TS.Node): string | undefined => {
      for (let n = node.parent; n; n = n.parent)
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(test|it)$/.test(n.expression.text) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]))
          return n.arguments[0].text;
      return undefined;
    };
    const subjectOf = (expectCall: TS.CallExpression): { text: string; file: string } | undefined => {
      let found: { text: string; file: string } | undefined;
      const visit = (n: TS.Node) => {
        if (found) return;
        if (ts.isCallExpression(n)) {
          const decl = declarationOf(calleeOf(n));
          if (decl && ts.isFunctionLike(decl) && !/\.test\.tsx?$/.test(decl.getSourceFile().fileName)) { found = { text: cap(decl.getText(), 4000), file: rel(decl.getSourceFile()) }; return; }
        }
        ts.forEachChild(n, visit);
      };
      expectCall.arguments.forEach(visit);
      return found;
    };
    const conceptsFor = (file: string): string | undefined => {
      const hits = notes.filter((n) => n.path === file || (n.path.endsWith("/") && file.startsWith(n.path)));
      return hits.length ? cap(hits.map((n) => `# ${n.title}\n${n.body}`).join("\n\n"), 6000) : undefined;
    };
    // A type predicate whose argument's declared type already satisfies it.
    const satisfiedPredicate = (cond: TS.Expression): Partial<Span> | undefined => {
      const e = ts.isPrefixUnaryExpression(cond) && cond.operator === ts.SyntaxKind.ExclamationToken ? cond.operand : cond;
      if (!ts.isCallExpression(e) || e.arguments.length !== 1) return undefined;
      const sig = checker.getResolvedSignature(e);
      const pred = sig && checker.getTypePredicateOfSignature(sig);
      if (!pred?.type) return undefined;
      const arg = checker.getTypeAtLocation(e.arguments[0]!);
      if (arg.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) return undefined;
      if (!checker.isTypeAssignableTo(arg, pred.type)) return undefined;
      const decl = declarationOf(calleeOf(e));
      return { reason: `argument is already ${checker.typeToString(arg)}, which satisfies ${e.expression.getText()}`, argument: checker.typeToString(arg), predicate: decl ? cap(decl.getText(), 2000) : e.expression.getText() };
    };

    for (const sf of program.getSourceFiles()) {
      if (!isProject(sf) || seen.has(sf.fileName)) continue;
      seen.add(sf.fileName);
      const lines = added?.get(rel(sf));
      if (added && !lines) continue;
      const isTest = /\.test\.tsx?$/.test(sf.fileName);
      const changed = (node: TS.Node) => {
        if (!lines) return true;
        const from = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, to = sf.getLineAndCharacterOfPosition(node.end).line + 1;
        for (let i = from; i <= to; i++) if (lines.has(i)) return true;
        return false;
      };
      const push = (kind: Span["kind"], node: TS.Node, extra: Partial<Span> = {}) => {
        if (!changed(node)) return;
        const fn = enclosingFunction(node);
        spans.push({ kind, file: rel(sf), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          text: node.getText(), enclosing: fn === sf ? "" : fn.getText(), callees: callees(fn), ...extra });
      };
      const visit = (n: TS.Node) => {
        const key = `${sf.fileName}:${n.pos}`;
        if (!isTest && ts.isPropertySignature(n) && n.questionToken && ts.isIdentifier(n.name) && changed(n) && !FRAMEWORK_PROPS.has(n.name.text) && !externalSinks.has(key) && (propertyUses.get(key)?.length ?? 0) <= 30) {
          const owner = n.parent;
          const ownerName = ts.isInterfaceDeclaration(owner) ? owner.name.text : ts.isTypeLiteralNode(owner) && ts.isTypeAliasDeclaration(owner.parent) ? owner.parent.name.text : "";
          const resolved = propertyUses.get(key) ?? [];
          const others = (propertyUses.get(`name:${n.name.text}`) ?? []).filter((r) => !resolved.includes(r));
          const sameName = others.length;
          if (sameName > 60) { ts.forEachChild(n, visit); return; }
          // Type operators (Pick, indexed access, intersections) hide the declaring symbol from some
          // uses, so a sparsely resolved field also lists same-named uses, marked as such.
          const references = resolved.length >= 3 ? resolved : [...resolved, ...others.slice(0, 15).map((r) => `${r}  (same name, other type)`)];
          spans.push({ kind: references.length ? "field" : "static", file: rel(sf), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            text: `${ownerName}.${n.name.text}: ${n.getText()}`, enclosing: cap(owner.getText(), 3000), callees: [], references, sameName,
            ...(references.length ? {} : { reason: "optional field never named anywhere in the repository" }) });
        } else if (!isTest && ts.isIfStatement(n) && exits(n.thenStatement) && !n.elseStatement) {
          const satisfied = satisfiedPredicate(n.expression);
          if (satisfied) push("static", n, satisfied);
        } else if (isTest && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "expect") {
          let top: TS.Node = n;
          while (top.parent && !ts.isExpressionStatement(top.parent) && !ts.isBlock(top.parent)) top = top.parent;
          const subject = subjectOf(n);
          push("expect", top, { subject: subject?.text, test: testName(n), concepts: subject && conceptsFor(subject.file) });
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }
  return spans;
}

if (import.meta.main) {
  const [root, tsconfigs, sinceRef] = process.argv.slice(2);
  if (!root || !tsconfigs) throw new Error("usage: extract.ts <repoRoot> <tsconfig>[,<tsconfig>] [sinceRef]");
  for (const span of extract(resolve(root), tsconfigs.split(","), sinceRef)) console.log(JSON.stringify(span));
}
