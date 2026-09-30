const original = globalThis.fetch;
let attempts = 0;
const fails = Number(process.env.SIM_FAILURES ?? 1);
const status = process.env.SIM_STATUS ?? "503";
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
  if (url.hostname !== "api.typesafe.ai" && url.hostname !== "api.cloudflare.com") return original(input, init);
  attempts++;
  console.error(`decision transport attempt ${attempts}, elapsed=${Date.now() - Number(process.env.SIM_START)}ms, status=${attempts <= fails ? status : "real"}`);
  if (attempts <= fails) {
    if (status === "network") throw new TypeError("synthetic connection reset");
    return new Response("synthetic outage", {status: Number(status)});
  }
  return original(input, init);
};
