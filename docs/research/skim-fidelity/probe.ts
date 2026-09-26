// bun docs/research/skim-fidelity/probe.ts > /tmp/skim-fidelity.jsonl
// Live selection plus production rendering, no host/model routing or downstream agent.
import { create, type Event } from "../../../lib/ingress.ts";
import { createCompressor } from "../../../lib/skim.ts";
import { cases } from "./cases.ts";

console.log(JSON.stringify({ type: "manifest", revision: Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim(), timestamp: new Date().toISOString(), runs: 2 }));
const compressor = createCompressor();
try {
  for (const c of cases) {
    // Direct compression is a stress control, not evidence of selection by the live judge.
    const direct = await compressor.compress([.75, .5, .25].map(rate => ({ text: c.text, rate: rate as .75 | .5 | .25 })));
    console.log(JSON.stringify({ type: "compression", id: c.id, outputs: direct.map((text, i) => ({ rate: [.75, .5, .25][i], text, exactEvidence: c.evidence.map(e => text.includes(e)) })) }));
    for (const intent of ["task", "focus", "orientation"] as const) {
      const query = intent === "task" ? c.task : "Get an overview of the project's tooling and development workflow.";
      const focus = intent === "focus" ? c.task : undefined;
      for (let run = 0; run < 2; run++) {
        const events: Event[] = [];
        const reader = create({ record: e => events.push(e) });
        try {
          const output = await reader.filter(c.text, query, undefined, focus);
          const event = events.find(e => e.type === "filter");
          // Check every advertised handle; merged omission runs need not have a page ID.
          const pulls = [...new Set(output.match(/ing-[a-f0-9]{16}/g) ?? [])].map(id => {
            const original = reader.pull(id);
            return { id, bytes: Buffer.byteLength(original), exactSubstring: c.text.includes(original) };
          });
          console.log(JSON.stringify({ type: "reading", id: c.id, intent, run, query, focus, output, exactEvidence: c.evidence.map(e => output.includes(e)), pulls, event, failures: events.filter(e => e.type.includes("unavailable")) }));
          // Replay the same decisions under compressor failure and budget pressure.
          if (run === 0 && event?.type === "filter") {
            for (const control of ["fallback", "budget"] as const) {
              const controlEvents: Event[] = [];
              const replay = create({ judge: async () => event.pages.map(p => p.judgment), record: e => controlEvents.push(e), ...(control === "fallback" ? { compress: async () => { throw new Error("audit: injected compressor failure"); } } : {}) });
              try {
                const result = await replay.filter(c.text, query, control === "budget" ? 256 : undefined, focus);
                const recovered = [...new Set(result.match(/ing-[a-f0-9]{16}/g) ?? [])].map(id => ({ id, exactSubstring: c.text.includes(replay.pull(id)) }));
                console.log(JSON.stringify({ type: "control", id: c.id, intent, control, output: result, exactEvidence: c.evidence.map(e => result.includes(e)), pulls: recovered, events: controlEvents }));
              } finally { replay.dispose(); }
            }
          }
        } finally { reader.dispose(); }
      }
    }
  }
} finally { compressor.dispose(); }
