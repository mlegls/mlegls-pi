// extract: candidate spans for semantic lints, with the local context a judge needs.
//
//   bun lib/lint/extract.ts <repoRoot> <tsconfig> [file...]   # jsonl of Span on stdout
//
// Uses the target repo's own TypeScript so types resolve as its typecheck sees them.
// Kinds: catch (try statements), guard (if whose branch exits), expect (assertions in tests),
// field (optional properties of exported types, with every same-named use in the program).
// Context is the enclosing function, the signatures of everything it calls, and for expect,
// the source of the function under test when it resolves to a declaration in the repo.

import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import type TS from "typescript";

export interface Span {
  kind: "catch" | "guard" | "expect" | "field";
  file: string;
  line: number;
  text: string;
  enclosing: string;
  callees: string[];
  subject?: string;
  test?: string;
  references?: string[];
}

export function extract(root: string, tsconfig: string, only?: string[]): Span[] {
  const ts: typeof TS = createRequire(resolve(root, "package.json"))("typescript");
  const config = ts.readConfigFile(resolve(root, tsconfig), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, tsconfig, ".."));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const wanted = only && new Set(only.map((f) => resolve(root, f)));
  const spans: Span[] = [];

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
    const seen = new Set<string>();
    const visit = (n: TS.Node) => {
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        const callee = ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression;
        const decl = declarationOf(callee);
        if (decl && ts.isFunctionLike(decl)) {
          const head = decl.getText().split("{")[0]!.trim();
          seen.add(head.length > 300 ? head.slice(0, 300) + "…" : head);
        } else if (decl && (ts.isVariableDeclaration(decl) || ts.isParameter(decl))) {
          seen.add(`${callee.getText()}: ${checker.typeToString(checker.getTypeAtLocation(callee))}`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(scope);
    return [...seen];
  };
  const exits = (s: TS.Statement): boolean =>
    ts.isReturnStatement(s) || ts.isThrowStatement(s) || ts.isContinueStatement(s) || ts.isBreakStatement(s) ||
    (ts.isBlock(s) && s.statements.length === 1 && exits(s.statements[0]!));
  const testName = (node: TS.Node): string | undefined => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(test|it)$/.test(n.expression.text) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]))
        return n.arguments[0].text;
    }
    return undefined;
  };
  const subjectOf = (expectCall: TS.CallExpression): string | undefined => {
    let found: string | undefined;
    const visit = (n: TS.Node) => {
      if (found) return;
      if (ts.isCallExpression(n)) {
        const callee = ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression;
        const decl = declarationOf(callee);
        if (decl && ts.isFunctionLike(decl) && !decl.getSourceFile().fileName.match(/\.test\.tsx?$/)) { found = decl.getText(); return; }
      }
      ts.forEachChild(n, visit);
    };
    expectCall.arguments.forEach(visit);
    return found && found.length > 4000 ? found.slice(0, 4000) + "…" : found;
  };

  const propertyUses = new Map<string, string[]>();
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || sf.fileName.includes("node_modules")) continue;
    const visit = (n: TS.Node) => {
      const name = ts.isPropertyAccessExpression(n) ? n.name : ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n) || ts.isBindingElement(n) ? n.name : ts.isStringLiteral(n) && ts.isElementAccessExpression(n.parent) ? n : undefined;
      if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line;
        const text = sf.text.split("\n")[line]!.trim();
        const key = name.text;
        const list = propertyUses.get(key) ?? [];
        if (!list.some((l) => l.startsWith(`${relative(root, sf.fileName)}:${line + 1}:`))) list.push(`${relative(root, sf.fileName)}:${line + 1}: ${text}`);
        propertyUses.set(key, list);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || sf.fileName.includes("node_modules")) continue;
    if (wanted && !wanted.has(sf.fileName)) continue;
    const isTest = /\.test\.tsx?$/.test(sf.fileName);
    const push = (kind: Span["kind"], node: TS.Node, extra: Partial<Span> = {}) => {
      const fn = enclosingFunction(node);
      spans.push({
        kind, file: relative(root, sf.fileName), line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        text: node.getText(), enclosing: fn === sf ? "" : fn.getText(), callees: callees(fn), ...extra,
      });
    };
    const visit = (n: TS.Node) => {
      if (!isTest && ts.isPropertySignature(n) && n.questionToken && ts.isIdentifier(n.name) && (propertyUses.get(n.name.text)?.length ?? 0) <= 30) {
        const owner = n.parent;
        const ownerName = ts.isInterfaceDeclaration(owner) ? owner.name.text : ts.isTypeLiteralNode(owner) && ts.isTypeAliasDeclaration(owner.parent) ? owner.parent.name.text : "";
        spans.push({ kind: "field", file: relative(root, sf.fileName), line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          text: `${ownerName}.${n.name.text}: ${n.getText()}`, enclosing: owner.getText().length > 3000 ? owner.getText().slice(0, 3000) + "…" : owner.getText(), callees: [],
          references: propertyUses.get(n.name.text) ?? [] });
      }
      else if (!isTest && ts.isTryStatement(n)) push("catch", n);
      else if (!isTest && ts.isIfStatement(n) && exits(n.thenStatement) && !n.elseStatement) push("guard", n);
      else if (isTest && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "expect") {
        let top: TS.Node = n;
        while (top.parent && !ts.isExpressionStatement(top.parent) && !ts.isBlock(top.parent)) top = top.parent;
        push("expect", top, { subject: subjectOf(n), test: testName(n) });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return spans;
}

if (import.meta.main) {
  const [root, tsconfig, ...files] = process.argv.slice(2);
  if (!root || !tsconfig) throw new Error("usage: extract.ts <repoRoot> <tsconfig> [file...]");
  for (const span of extract(resolve(root), tsconfig, files.length ? files : undefined)) console.log(JSON.stringify(span));
}
