import { execFile } from "node:child_process";

const inside = (cwd: string, root: string) => cwd === root || cwd.startsWith(root + "/");

async function cwdInventory(): Promise<Map<number, string>> {
	const listing = await new Promise<string>((resolve, reject) => {
		execFile("lsof", ["-d", "cwd", "-Fpn"], { encoding: "utf8", maxBuffer: 64 << 20 }, (error, out) => {
			if (error && error.code !== 1) reject(error); else resolve(out);
		});
	});
	const out = new Map<number, string>();
	let pid = 0;
	for (const line of listing.split("\n")) {
		if (line.startsWith("p")) pid = Number(line.slice(1));
		else if (line.startsWith("n") && pid) out.set(pid, line.slice(1));
	}
	return out;
}

export async function cwdProcesses(root: string): Promise<number[]> {
	return [...await cwdInventory()].filter(([, cwd]) => inside(cwd, root)).map(([pid]) => pid);
}

