// extract: candidate spans for semantic lints, with the local context a judge needs.
//
//   bun lib/lint/extract.ts <repoRoot> <tsconfig>[,<tsconfig>...] [file...]   # jsonl of Span on stdout
//
// Uses the target repo's own TypeScript so types resolve as its typecheck sees them. Every
// tsconfig is loaded so property uses are counted across the whole repository, not one project.
//
// Kinds: catch (try statements), guard (if whose branch exits), expect (assertions in tests),
// field (optional properties, with every use of that property across the repository).
// Guards that only narrow a discriminant or a possibly-undefined lookup are skipped: strict
// types force those. A guard whose type predicate is already satisfied by its argument's
// declared type is emitted as kind "static", as is an optional field nothing in the repository names.
//
// Context: the enclosing function, signatures of everything it calls, for expect the source of
// the function under test and the concept notes whose `path:` frontmatter names that source.

import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type TS from "typescript";

export interface Span {
  kind: "catch" | "guard" | "expect" | "field" | "static";
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

export function extract(root: string, tsconfigs: string[], only?: string[]): Span[] {
  const ts: typeof TS = createRequire(resolve(root, "package.json"))("typescript");
  const programs = tsconfigs.map((tsconfig) => {
    const config = ts.readConfigFile(resolve(root, tsconfig), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, tsconfig, ".."));
    return ts.createProgram(parsed.fileNames, parsed.options);
  });
  const wanted = only && new Set(only.map((f) => resolve(root, f)));
  const notes = conceptNotes(root);
  const spans: Span[] = [];
  const seen = new Set<string>();
  const rel = (sf: TS.SourceFile) => relative(root, sf.fileName);
  const isProject = (sf: TS.SourceFile) => !sf.isDeclarationFile && !sf.fileName.includes("node_modules") && /\.tsx?$/.test(sf.fileName);

  // Property uses across every program, keyed by the declaring property's position so
  // same-named fields on unrelated types stay apart; unresolved uses fall back to the name.
  const propertyUses = new Map<string, string[]>();
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
      const visit = (n: TS.Node) => {
        if (ts.isPropertyAccessExpression(n)) record(n, n.name.text, checker.getSymbolAtLocation(n.name));
        else if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name)) record(n, n.name.text, checker.getSymbolAtLocation(n.name));
        else if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)))
          record(n, n.name.text, propertyOf(checker.getContextualType(n.parent), n.name.text));
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
    const calleeOf = (n: TS.CallExpression | TS.NewExpression) => ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression;
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
    // Guards strict types force: discriminant checks and possibly-undefined lookups.
    const strictForced = (cond: TS.Expression): boolean => {
      if (ts.isParenthesizedExpression(cond)) return strictForced(cond.expression);
      if (ts.isBinaryExpression(cond) && (cond.operatorToken.kind === ts.SyntaxKind.BarBarToken || cond.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken))
        return strictForced(cond.left) && strictForced(cond.right);
      const e = ts.isPrefixUnaryExpression(cond) && cond.operator === ts.SyntaxKind.ExclamationToken ? cond.operand : cond;
      if (ts.isBinaryExpression(e)) {
        const op = e.operatorToken.kind;
        const literal = ts.isStringLiteralLike(e.right) || ts.isStringLiteralLike(e.left);
        if ((op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) && literal && ts.isPropertyAccessExpression(e.left) && /^(kind|type|tag|role|status)$/.test(e.left.name.text)) return true;
        if ((op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) && (e.right.kind === ts.SyntaxKind.UndefinedKeyword || e.right.getText() === "undefined")) {
          const t = checker.getTypeAtLocation(e.left);
          const decl = ts.isIdentifier(e.left) ? declarationOf(e.left) : undefined;
          const init = decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined;
          const lookup = ts.isElementAccessExpression(e.left) || (init && (ts.isElementAccessExpression(init) || (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) && /^(get|at|find|pop|shift)$/.test(init.expression.name.text))));
          if (lookup && t.isUnion() && t.types.some((u) => u.flags & ts.TypeFlags.Undefined)) return true;
        }
      }
      return false;
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
      if (wanted && !wanted.has(sf.fileName)) continue;
      const isTest = /\.test\.tsx?$/.test(sf.fileName);
      const push = (kind: Span["kind"], node: TS.Node, extra: Partial<Span> = {}) => {
        const fn = enclosingFunction(node);
        spans.push({ kind, file: rel(sf), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          text: node.getText(), enclosing: fn === sf ? "" : fn.getText(), callees: callees(fn), ...extra });
      };
      const visit = (n: TS.Node) => {
        if (!isTest && ts.isPropertySignature(n) && n.questionToken && ts.isIdentifier(n.name) && !FRAMEWORK_PROPS.has(n.name.text) && (propertyUses.get(`${sf.fileName}:${n.pos}`)?.length ?? 0) <= 30) {
          const owner = n.parent;
          const ownerName = ts.isInterfaceDeclaration(owner) ? owner.name.text : ts.isTypeLiteralNode(owner) && ts.isTypeAliasDeclaration(owner.parent) ? owner.parent.name.text : "";
          const resolved = propertyUses.get(`${sf.fileName}:${n.pos}`) ?? [];
          const others = (propertyUses.get(`name:${n.name.text}`) ?? []).filter((r) => !resolved.includes(r));
          const sameName = others.length;
          if (sameName > 60) { ts.forEachChild(n, visit); return; }
          // Type operators (Pick, indexed access, intersections) hide the declaring symbol from some
          // uses, so a sparsely resolved field also lists same-named uses, marked as such.
          const references = resolved.length >= 3 ? resolved : [...resolved, ...others.slice(0, 15).map((r) => `${r}  (same name, other type)`)];
          spans.push({ kind: references.length ? "field" : "static", file: rel(sf), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            text: `${ownerName}.${n.name.text}: ${n.getText()}`, enclosing: cap(owner.getText(), 3000), callees: [], references, sameName,
            ...(references.length ? {} : { reason: "optional field never named anywhere in the repository" }) });
        } else if (!isTest && ts.isTryStatement(n)) push("catch", n);
        else if (!isTest && ts.isIfStatement(n) && exits(n.thenStatement) && !n.elseStatement) {
          const satisfied = satisfiedPredicate(n.expression);
          if (satisfied) push("static", n, satisfied);
          else if (!strictForced(n.expression)) push("guard", n);
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
  const [root, tsconfigs, ...files] = process.argv.slice(2);
  if (!root || !tsconfigs) throw new Error("usage: extract.ts <repoRoot> <tsconfig>[,<tsconfig>] [file...]");
  for (const span of extract(resolve(root), tsconfigs.split(","), files.length ? files : undefined)) console.log(JSON.stringify(span));
}
