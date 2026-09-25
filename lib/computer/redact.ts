// Scrub strings structurally so quoted/newline-containing secrets stay valid JSON.
export function redact<T>(value: T, inputs: Record<string, string> = {}, hidden: readonly string[] = []): T {
    const secrets = hidden.filter(name => inputs[name]).sort((a, b) => inputs[b].length - inputs[a].length);
    const text = (s: string) => secrets.reduce((s, name) => s.split(inputs[name]).join("%" + name + "%"), s);
    const visit = (v: any): any => typeof v === "string" ? text(v) : Array.isArray(v) ? v.map(visit)
        : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [text(k), visit(x)])) : v;
    return visit(value);
}
