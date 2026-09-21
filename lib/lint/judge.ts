// judge: one Jev request per span, a few narrow yes/no questions per kind; ranked findings out.
//
//   bun lib/lint/judge.ts < spans.jsonl > findings.jsonl
//
// Each question names one smell from the code/testing guidelines. Probabilities are kept raw so
// thresholds and ranking stay with the consumer.

import { decide, type Question, type State } from "../decide";
import type { Span } from "./extract";

const CONTEXT = "TypeScript from a solo-maintained codebase: strict types, no-unnecessary-condition lint on, tests written from what a user would notice. ";

const questions: Record<Span["kind"], Record<string, Question>> = {
  catch: {
    swallows: { type: "noul", instructions: CONTEXT + "Does the try/catch in `span` swallow the error, continuing with a default, a log, or a generic message instead of producing a distinct outcome the caller can act on?" },
    unreachable: { type: "noul", instructions: CONTEXT + "Given `callees` (what the code in `span` calls, with their signatures), does the catch handle a failure that nothing inside the try can actually raise?" },
    just_in_case: { type: "noul", instructions: CONTEXT + "Is the try/catch in `span` there 'just in case' — would deleting it and letting the error propagate leave every reachable behavior a user or caller sees unchanged?" },
  },
  guard: {
    excluded: { type: "noul", instructions: CONTEXT + "Does the guard in `span` test a condition that the declared types of the values involved (see `function` and `callees`) already make impossible?" },
    revalidates: { type: "noul", instructions: CONTEXT + "Does the guard in `span` re-check something a callee or an earlier statement in `function` already established?" },
    just_in_case: { type: "noul", instructions: CONTEXT + "Is the guard in `span` there 'just in case' — protecting against a situation no caller produces — rather than producing an outcome the caller relies on?" },
  },
  field: {
    inert: { type: "noul", instructions: CONTEXT + "`span` declares an optional field of the type in `type`; `references` lists every line in the program that names that property. Is the field inert — only validated, defaulted, copied, serialized or passed along, and never read to decide behavior, compute a result, or display something?" },
    speculative: { type: "noul", instructions: CONTEXT + "Judging from `references`, does the field in `span` exist for a consumer that does not yet exist — plumbing laid for a future feature rather than a present need?" },
  },
  expect: {
    implementation_detail: { type: "noul", instructions: CONTEXT + "Does the assertion in `span` check internal structure, intermediate values, or call shapes that a user of the code under test would never notice, rather than an outcome they would?" },
    tautological: { type: "noul", instructions: CONTEXT + "Given `subject` (the source of the function under test) and `test`, is the assertion's outcome so directly entailed by reading the implementation that it carries no information — it could only fail if someone edited the code specifically to make it fail?" },
    typed: { type: "noul", instructions: CONTEXT + "Does the assertion in `span` only check something the TypeScript compiler already guarantees (a property exists, a value has a shape, a function returns its declared type)?" },
  },
};

const cap = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) + "…" : s);

export function stateOf(span: Span): State {
  const s: Record<string, unknown> = { span: span.text, function: cap(span.enclosing, 6000) || "(module scope)", callees: span.callees.slice(0, 20) };
  if (span.test) s.test = span.test;
  if (span.subject) s.subject = cap(span.subject, 6000);
  if (span.kind === "field") { s.type = s.function; delete s.function; delete s.callees; s.references = span.references; }
  return s as State;
}

export interface Finding extends Span { answers: Record<string, number> }

export async function judge(span: Span): Promise<Finding> {
  const qs = questions[span.kind];
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
