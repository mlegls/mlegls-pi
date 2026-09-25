import { test, expect } from "bun:test";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCompressor } from "./skim.ts";

const directory = mkdtempSync(join(tmpdir(), "skim-test-"));
process.env.PI_SKIM_SOCKET = join(directory, "skim.sock");

test("sessions share the socket and disposing one leaves the other usable", async () => {
  let count = 0;
  const server = createServer(connection => {
    let input = "";
    connection.on("data", data => {
      input += data;
      if (!input.includes("\n")) return;
      const jobs = JSON.parse(input.slice(0, input.indexOf("\n")));
      count++;
      connection.end(JSON.stringify({ outputs: jobs.map((job: { text: string }) => job.text.toUpperCase()) }) + "\n");
    });
  });
  await new Promise<void>(resolve => server.listen(process.env.PI_SKIM_SOCKET, resolve));
  try {
    const a = createCompressor(), b = createCompressor();
    expect(await Promise.all([a.compress([{ text: "one", rate: 0.5 }]), b.compress([{ text: "two", rate: 0.75 }])])).toEqual([["ONE"], ["TWO"]]);
    a.dispose();
    expect(await b.compress([{ text: "three", rate: 0.25 }])).toEqual(["THREE"]);
    expect(count).toBe(3);
    b.dispose();
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
    delete process.env.PI_SKIM_SOCKET;
  }
});
