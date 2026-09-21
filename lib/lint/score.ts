// score: how well the judge's rankings agree with hand labels.
//
//   bun lib/lint/score.ts findings.jsonl labels.tsv
//
// labels.tsv rows: <file>:<line>[#<field>]\t<question>\t<1|0>\t<note>. The #field suffix picks one
// of several fields declared on a line. A label of 1 means the smell the
// question names is present. Reports AUC per question (probability a positive outranks a
// negative) and the labeled items with their scores so mistakes are inspectable.

import type { Finding } from "./judge";

export function auc(pos: number[], neg: number[]): number {
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return pos.length && neg.length ? wins / (pos.length * neg.length) : NaN;
}

if (import.meta.main) {
  const [findingsPath, labelsPath] = process.argv.slice(2);
  const findings = new Map((await Bun.file(findingsPath!).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Finding).flatMap((f) => { const at = `${f.file}:${f.line}`; const name = f.kind === "field" || f.kind === "static" ? f.text.match(/^[^.]*\.(\w+):/)?.[1] : undefined; return name ? [[`${at}#${name}`, f] as const, [at, f] as const] : [[at, f] as const]; }));
  const labels = (await Bun.file(labelsPath!).text()).split("\n").filter((l) => l && !l.startsWith("#")).map((l) => { const [at, question, label, note = ""] = l.split("\t"); return { at: at!, question: question!, label: label === "1", note }; });
  const byQuestion = new Map<string, { pos: number[]; neg: number[]; rows: string[] }>();
  for (const { at, question, label, note } of labels) {
    const f = findings.get(at);
    const p = f?.answers[question];
    if (p === undefined) { console.error(`no finding for ${at} ${question}`); continue; }
    const q = byQuestion.get(question) ?? { pos: [], neg: [], rows: [] };
    (label ? q.pos : q.neg).push(p);
    q.rows.push(`  ${label ? "+" : "-"} ${p.toFixed(2)} ${at} ${note}`);
    byQuestion.set(question, q);
  }
  for (const [question, { pos, neg, rows }] of byQuestion) {
    console.log(`${question}: AUC ${auc(pos, neg).toFixed(2)} (${pos.length}+ ${neg.length}-)`);
    for (const row of rows.sort((a, b) => Number(b.slice(4, 8)) - Number(a.slice(4, 8)))) console.log(row);
  }
}
