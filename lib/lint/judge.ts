// judge: one Jev request per span, a few narrow yes/no questions per kind; ranked findings out.
//
//   bun lib/lint/judge.ts < spans.jsonl > findings.jsonl
//
// Each question names one smell from the code/testing guidelines. Probabilities are kept raw so
// thresholds and ranking stay with the consumer. Questions about guards, catches, tautological
// and type-guaranteed assertions were tried and did not separate hand labels; see README.

import { decide, type Question, type State } from "../decide";
import type { Span } from "./extract";

const CONTEXT = "TypeScript from a solo-maintained codebase: strict types, no-unnecessary-condition lint on, tests written from what a user would notice. ";

const questions: Record<Span["kind"], Record<string, Question>> = {
  static: {
    beyond_type: { type: "noul", instructions: CONTEXT + "The guard in `span` calls a type predicate whose source is `predicate`, on an argument whose declared type is already `argument`. Does the predicate's body verify anything that type does not guarantee (a format, a range, finiteness, non-emptiness)?" },
  },
  field: {
    inert: { type: "noul", instructions: CONTEXT + "`span` declares an optional field of the type in `type`; `references` lists every line in the repository that uses that property (see `note` if present). Is the field inert — only validated, defaulted, copied, serialized or passed along, and never read to decide behavior, compute a result, or display something?" },
  },
  expect: {
    implementation_detail: { type: "noul", instructions: CONTEXT + "Does the assertion in `span` check internal structure, intermediate values, or call shapes that a user of the code under test would never notice, rather than an outcome they would? If `concepts` is present it describes what the code under test is for and who reads it; judge 'notice' against those readers." },
    off_concept: { type: "noul", instructions: CONTEXT + "`concepts` are the documented ideas the code under test realizes. Does the assertion in `span` check something none of them describe or imply — a behavior the documentation does not promise?" },
  },
};

const cap = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) + "…" : s);

export function stateOf(span: Span): State {
  const s: Record<string, unknown> = { span: span.text, function: cap(span.enclosing, 6000) || "(module scope)", callees: span.callees.slice(0, 20) };
  if (span.test) s.test = span.test;
  if (span.subject) s.subject = cap(span.subject, 6000);
  if (span.kind === "static") { s.predicate = span.predicate; s.argument = span.argument; }
  if (span.concepts) s.concepts = span.concepts;
  if (span.kind === "field") { s.type = s.function; delete s.function; delete s.callees; s.references = span.references; if (span.sameName) s.note = `${span.sameName} other uses of a same-named property on unrelated types are not listed; values may still flow between them structurally.`; }
  return s as State;
}

export interface Finding extends Span { answers: Record<string, number> }

export async function judge(span: Span): Promise<Finding> {
  if (span.kind === "static" && !span.predicate) return { ...span, answers: {} };
  const qs = span.kind === "expect" && !span.concepts ? { implementation_detail: questions.expect.implementation_detail! } : questions[span.kind];
  const d = await decide(stateOf(span), qs);
  return { ...span, answers: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, +v.dist.true!.toFixed(3)])) };
}

export async function judgeAll(spans: Span[], concurrency = 16, onEach?: (f: Finding) => void): Promise<Finding[]> {
  const out: Finding[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < spans.length) {
      const span = spans[i++]!;
      try { const f = await judge(span); out.push(f); onEach?.(f); }
      catch (error) { console.error(`${span.file}:${span.line} ${(error as Error).message}`); }
    }
  }));
  return out;
}

if (import.meta.main) {
  const spans = (await Bun.stdin.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Span);
  await judgeAll(spans, 16, (f) => console.log(JSON.stringify(f)));
}
