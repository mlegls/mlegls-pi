// Real-ledger worker replay. Artifacts contain private session memory: keep them out of git;
// commit only selected, redacted observations in the verification packet.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agentLoop } from "@earendil-works/pi-agent-core";
import { getAgentDir, ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { runReflector } from "../agents/reflector/agent.js";
import { condenseToTarget, reflectionPoolTokens } from "../agents/condenser/agent.js";
import { REFLECTOR_SYSTEM } from "../agents/reflector/prompts.js";
import { CONDENSER_SYSTEM } from "../agents/condenser/prompts.js";
import { DEFAULTS, resolveCompactionSummaryMaxTokens, resolveReflectionPoolBudget } from "../config.js";
import { ledgerBranch } from "./store.js";
import {
	buildCompactionProjection, buildObservationsDroppedData, buildReflectionsRecordedData,
	foldLedger, isObservationsDroppedEntry, isObservationsRecordedEntry, isReflectionsRecordedEntry,
	OM_OBSERVATIONS_DROPPED, OM_REFLECTIONS_RECORDED, renderSummaryWithBudget,
	type Entry,
} from "./index.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const save = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
type Snapshot = { version: 1; session: string; source: string; sourceSha256: string; entries: Entry[] };
type Step = { at: string; entries: Entry[] };

function snapshot(file: string): Snapshot {
	const raw = readFileSync(file, "utf8");
	// Snapshots are pretty JSON; session files are one complete object per line.
	if (raw.trimStart().startsWith("{\n")) {
		const saved = JSON.parse(raw);
		if (saved.version === 1 && Array.isArray(saved.entries)) return saved;
		throw new Error("Unsupported replay snapshot");
	}
	const [header, ...entries] = raw.trim().split("\n").map((line) => JSON.parse(line));
	if (header.type !== "session") throw new Error("Expected a Pi session JSONL or replay input.json");
	const byId = new Map(entries.map((e) => [e.id, e]));
	const branch: Entry[] = [];
	for (let e = entries.at(-1); e; e = byId.get(e.parentId)) branch.unshift(e);
	const sm = { getSessionId: () => header.id, getLeafId: () => branch.at(-1)?.id ?? null,
		getBranch: () => branch, getHeader: () => header };
	const ledger = ledgerBranch(sm, branch);
	if (!ledger.some(isObservationsRecordedEntry)) throw new Error("No observations found in this session's ledger");
	// Preserve ids and compaction boundaries, not raw conversation or old rendered summaries.
	return { version: 1, session: header.id, source: resolve(file), sourceSha256: hash(raw),
		entries: ledger.map((e) => ({
			id: e.id, type: e.type, timestamp: e.timestamp, customType: e.customType,
			...(isObservationsRecordedEntry(e) || isReflectionsRecordedEntry(e) || isObservationsDroppedEntry(e) ? { data: e.data } : {}),
			...(e.type === "compaction" ? { firstKeptEntryId: e.firstKeptEntryId } : {}),
		})) };
}

// Agent loops otherwise report provider failures as ordinary empty results.
const checkedLoop: typeof agentLoop = (...args) => {
	const stream = agentLoop(...args);
	const result = stream.result.bind(stream);
	stream.result = async () => {
		const messages = await result();
		for (const m of messages) if (m.role === "assistant" && (m.stopReason === "error" || m.stopReason === "aborted")) {
			throw new Error(m.errorMessage ?? m.stopReason);
		}
		return messages;
	};
	return stream;
};

export async function replayWorkers(args: string[]): Promise<void> {
	const [file, output, selector = "openai/gpt-6.1-terra"] = args;
	if (!file || !output) throw new Error("Usage: --workers <session.jsonl|input.json> <output-dir> [provider/model]");
	mkdirSync(output, { recursive: true });
	const frozen = snapshot(file);
	const inputHash = hash(JSON.stringify(frozen));
	const contextWindow = 1_000_000; // Recorded session's foreground model, not the OM worker.
	const budget = resolveReflectionPoolBudget(DEFAULTS, contextWindow);
	const manifest = { version: 1, session: frozen.session, inputHash, model: selector, contextWindow, budget,
		promptsHash: hash(REFLECTOR_SYSTEM + CONDENSER_SYSTEM) };
	const manifestFile = join(output, "manifest.json");
	if (existsSync(manifestFile) && JSON.stringify(JSON.parse(readFileSync(manifestFile, "utf8"))) !== JSON.stringify(manifest)) {
		throw new Error("Replay inputs/model/prompts changed; use a fresh output directory");
	}
	save(join(output, "input.json"), frozen);
	save(manifestFile, manifest);
	console.log(JSON.stringify({ setup: manifest, reflectorBoundaries: new Set(frozen.entries.filter(isReflectionsRecordedEntry).map((e) => e.data.coversUpToId)).size }));

	// Like a live session: restore the host's dynamic catalog before synchronous registry reads.
	// refreshOnCreate:false skips that disk restoration too, not merely network refresh.
	const agentDir = getAgentDir();
	const runtime = await ModelRuntime.create({
		authPath: join(agentDir, "auth.json"),
		modelsPath: join(agentDir, "models.json"),
		modelsStorePath: join(agentDir, "models-store.json"),
		allowModelNetwork: false,
	});
	const registry = new ModelRegistry(runtime);
	const slash = selector.indexOf("/");
	const model = registry.find(selector.slice(0, slash), selector.slice(slash + 1));
	if (!model) throw new Error("Required exact replay model is not in Pi's catalog: " + selector);
	if (!await runtime.checkAuth(model.provider)) throw new Error("No configured authentication for " + model.provider);
	console.log(JSON.stringify({ ready: selector, agentDir, workerContextWindow: model.contextWindow }));
	const worker = { model, modelRegistry: { streamSimple: registry.streamSimple.bind(registry) }, agentLoop: checkedLoop,
		maxTurns: DEFAULTS.agentMaxTurns, maxOutputTokens: DEFAULTS.agentMaxTokens, thinkingLevel: "low" as const };
	const stepFile = join(output, "steps.jsonl");
	const steps: Step[] = existsSync(stepFile) ? readFileSync(stepFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
	const completed = new Map(steps.map((s) => [s.at, s.entries]));
	const observations = new Set(frozen.entries.filter(isObservationsRecordedEntry).flatMap((e) => e.data.observations.map((o) => o.id)));
	const replayed: Entry[] = [];
	const boundaries = new Set<string>();
	const compactions: unknown[] = [];
	let serial = steps.reduce((n, s) => n + s.entries.length, 0);
	const custom = (customType: string, data: unknown): Entry => ({ type: "custom", id: "replay:" + ++serial, customType, data });

	for (const entry of frozen.entries) {
		if (isReflectionsRecordedEntry(entry)) {
			// Keep the original id as an inert coverage anchor, including for resumed steps.
			replayed.push({ id: entry.id, type: "custom", customType: "om.replayed" });
			const coverage = entry.data.coversUpToId;
			if (boundaries.has(coverage)) continue;
			boundaries.add(coverage);
			const cached = completed.get(entry.id);
			if (cached) { replayed.push(...cached); continue; }
			const generated: Entry[] = [];
			const add = (type: string, data: unknown) => { if (data) { const e = custom(type, data); generated.push(e); replayed.push(e); } };
			const before = foldLedger(replayed);
			const result = await runReflector({ ...worker, reflections: before.activeReflections, observations: before.activeObservations });
			if (result) {
				add(OM_REFLECTIONS_RECORDED, buildReflectionsRecordedData(result.reflections, coverage));
				for (const s of result.supersessions) add(OM_OBSERVATIONS_DROPPED, buildObservationsDroppedData(s.reflectionIds, coverage, s.supersededBy));
			}
			const pool = foldLedger(replayed).activeReflections;
			if (reflectionPoolTokens(pool) > budget.maxTokens) {
				const condensed = await condenseToTarget({ ...worker, reflections: pool, targetTokens: budget.targetTokens });
				if (condensed) {
					add(OM_REFLECTIONS_RECORDED, buildReflectionsRecordedData(condensed.reflections, coverage));
					add(OM_OBSERVATIONS_DROPPED, buildObservationsDroppedData(condensed.droppedIds, coverage));
				}
			}
			appendFileSync(stepFile, JSON.stringify({ at: entry.id, entries: generated } satisfies Step) + "\n");
			console.log(JSON.stringify({ boundary: boundaries.size, at: entry.id, poolTokens: reflectionPoolTokens(foldLedger(replayed).activeReflections) }));
		} else if (isObservationsDroppedEntry(entry)) {
			// Replay the historical observation/dropper schedule, never its old reflection tombstones.
			const ids = entry.data.observationIds.filter((id) => observations.has(id));
			replayed.push(ids.length ? { ...entry, data: { ...entry.data, observationIds: ids } } : { id: entry.id, type: "custom", customType: "om.replayed" });
		} else if (entry.type === "compaction" && entry.firstKeptEntryId) {
			const projection = buildCompactionProjection(replayed, entry.firstKeptEntryId, DEFAULTS);
			const summary = renderSummaryWithBudget(projection.reflections, projection.observations,
				{ maxTokens: resolveCompactionSummaryMaxTokens(DEFAULTS, contextWindow) });
			writeFileSync(join(output, "summary-" + entry.id + ".md"), summary.text);
			save(join(output, "pool-" + entry.id + ".json"), foldLedger(replayed).activeReflections);
			replayed.push({ ...entry, details: projection.details });
			const metric = { id: entry.id, timestamp: entry.timestamp, reflections: summary.reflections.length,
				poolTokens: reflectionPoolTokens(foldLedger(replayed).activeReflections), fullFold: projection.fullFold };
			compactions.push(metric);
			console.log(JSON.stringify({ compaction: metric }));
		} else replayed.push(entry);
	}
	const final = foldLedger(replayed);
	save(join(output, "ledger.json"), replayed);
	save(join(output, "metrics.json"), { ...manifest, boundaries: boundaries.size, compactions,
		finalReflections: final.activeReflections.length, finalPoolTokens: reflectionPoolTokens(final.activeReflections),
		underCeiling: reflectionPoolTokens(final.activeReflections) <= budget.maxTokens });
}
