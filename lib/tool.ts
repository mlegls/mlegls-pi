// A data-returning tool reached from codemode scripts: the result is JSON both as the model's text
// and as structuredContent, which scripts receive as a value.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static, type TSchema } from "typebox";

export interface DataTool<P extends TSchema> {
	name: string;
	description: string;
	parameters: P;
	namespace: { name: string; description: string };
	readOnly?: boolean;
	run: (params: Static<P>, ctx: ExtensionContext, signal?: AbortSignal) => unknown;
}

export function dataTool<P extends TSchema>(pi: ExtensionAPI, t: DataTool<P>) {
	pi.registerTool({
		name: t.name, label: t.name.replaceAll("_", " "), description: t.description, parameters: t.parameters,
		namespace: t.namespace, exposure: "codemode", outputSchema: Type.Any(),
		annotations: { readOnlyHint: t.readOnly ?? false, openWorldHint: false },
		async execute(_id, params, signal, _onUpdate, ctx) {
			const value = await t.run(params as Static<P>, ctx, signal);
			const json = JSON.parse(JSON.stringify(value ?? null));
			return { content: [{ type: "text" as const, text: typeof json === "string" ? json : JSON.stringify(json, null, 1) }], structuredContent: json, details: undefined };
		},
	});
}
