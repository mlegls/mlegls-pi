#!/usr/bin/env python3
"""Local macOS experiment, not an acceptance test. Never edits source sessions."""
import argparse
import collections
from datetime import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import struct
import subprocess
import tempfile
import termios
import time
import uuid

ANSI = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")
PROBE = b"idle-cost-editor-probe"

def command(*args, env=None):
    # Capture stderr: zmx writes diagnostics (e.g. "no sessions found") with
    # positional writes, which overwrite a redirected console file from offset 0.
    return subprocess.check_output(args, env=env, text=True, stderr=subprocess.PIPE).strip()

def clone(source, target, cwd):
    raw = source.read_bytes()
    entries = [json.loads(line) for line in raw.splitlines()]
    header = entries[0]
    info = {"source_session_id": header["id"], "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw), "entries": len(entries),
            "messages": dict(collections.Counter(e["message"]["role"] for e in entries if e["type"] == "message")),
            "compactions": sum(e["type"] == "compaction" for e in entries),
            "images": sum(c.get("type") == "image" for e in entries if e["type"] == "message" for c in e["message"].get("content", []) if isinstance(c, dict)),
            "source_duration_seconds": round((datetime.fromisoformat(entries[-1]["timestamp"].replace("Z", "+00:00")) - datetime.fromisoformat(header["timestamp"].replace("Z", "+00:00"))).total_seconds(), 1)}
    header["id"] = str(uuid.uuid4())
    header["cwd"] = str(cwd)
    header.pop("parentSession", None)
    # Keep every tree entry and its payload, but disconnect copied worker ownership
    # and subscriptions. A fresh id also prevents inherited record-store cursors.
    for e in entries:
        if e["type"] != "custom":
            continue
        if e.get("customType") in ("board-subs", "board-seen"):
            e["data"] = []
        elif e.get("customType") == "board-cursor":
            e["data"] = {"offset": 0, "pending": []}
        elif e.get("customType") == "session-meta":
            e["data"] = {"mode": "tui"}
    target.write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in entries) + "\n")
    return info

def processes(root):
    rows = {}
    for line in command("ps", "-axo", "pid=,ppid=,rss=,time=,comm=").splitlines():
        fields = line.split(None, 4)
        if len(fields) != 5:
            continue
        pid, parent, rss, cpu, executable = fields
        parts = cpu.replace("-", ":").split(":")
        seconds = sum(float(p) * 60 ** i for i, p in enumerate(reversed(parts)))
        rows[int(pid)] = {"pid": int(pid), "parent": int(parent), "rss_kib": int(rss),
                          "cpu_seconds": seconds, "executable": Path(executable).name}
    owned = {root}
    while True:
        next_owned = owned | {pid for pid, row in rows.items() if row["parent"] in owned}
        if next_owned == owned:
            return [row for pid, row in rows.items() if pid in owned]
        owned = next_owned

def read(fd, seconds):
    output = bytearray()
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if not select.select([fd], [], [], min(.05, max(0, end - time.monotonic())))[0]:
            continue
        try:
            chunk = os.read(fd, 65536)
        except OSError:
            break
        if not chunk:
            break
        output.extend(chunk)
        # Ordinary 120x40 xterm, no kitty keyboard/image capability.
        for query, response in ((b"\x1b[6n", b"\x1b[1;1R"),
                                (b"\x1b[c", b"\x1b[?1;2c"),
                                (b"\x1b[>c", b"\x1b[>0;0;0c")):
            if query in chunk:
                os.write(fd, response)
    return bytes(output)

def trial(source, label, run, args, scratch, env):
    name = f"idle-cost-{os.getpid()}-{label}-{run}"
    session = scratch / f"{label}-{run}.jsonl"
    seed = clone(source, session, Path.cwd())
    # fork gives zmx a controlling PTY, as a terminal app would.
    start = time.monotonic()
    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe("zmx", ["zmx", "attach", name, "pi", "--session", str(session)], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
    root = None
    turn = None
    try:
        output = bytearray()
        while time.monotonic() - start < 120:
            output.extend(read(fd, .05))
            del output[:-262144]
            if b"mail/" in ANSI.sub(b"", bytes(output[-65536:])):
                break
        else:
            Path("/tmp/idle-cost-failure.terminal").write_bytes(output[-262144:])
            raise RuntimeError(f"{name}: no extension footer in 120s; see /tmp/idle-cost-failure.terminal")
        footer = time.monotonic() - start
        os.write(fd, PROBE)
        echo = bytearray()
        while time.monotonic() - start < 120:
            echo.extend(read(fd, .01))
            del echo[:-262144]
            if PROBE in ANSI.sub(b"", bytes(echo[-65536:])):
                break
        else:
            Path("/tmp/idle-cost-failure.terminal").write_bytes(echo[-262144:])
            raise RuntimeError(f"{name}: editor did not echo probe; see /tmp/idle-cost-failure.terminal")
        usable = time.monotonic() - start
        # Private diagnostic only: may contain historical conversation text.
        (scratch / f"{name}.terminal").write_bytes(output + echo)
        os.write(fd, b"\x15")  # clear draft
        if args.turn:
            offset = session.stat().st_size
            turn_start = time.monotonic()
            os.write(fd, b"This is a one-turn idle-memory measurement. Reply exactly MEASUREMENT_READY. Do not call tools.\r")
            appended = bytearray()
            while time.monotonic() - turn_start < 180:
                read(fd, .1)
                with session.open("rb") as stream:
                    stream.seek(offset)
                    chunk = stream.read()
                offset += len(chunk)
                appended.extend(chunk)
                try:
                    new_entries = [json.loads(line) for line in appended.splitlines()]
                except json.JSONDecodeError:
                    continue
                answers = [e["message"] for e in new_entries if e["type"] == "message" and e["message"]["role"] == "assistant"]
                if answers and answers[-1].get("stopReason") in ("stop", "error", "aborted"):
                    answer = answers[-1]
                    if answer.get("stopReason") != "stop":
                        raise RuntimeError(f"{name}: warm turn {answer.get('stopReason')}; private session {session}")
                    assert not any(c.get("type") == "toolCall" for a in answers for c in a["content"])
                    turn = {"seconds": round(time.monotonic() - turn_start, 3),
                            "provider": answer.get("provider"), "model": answer.get("model"),
                            "usage": answer.get("usage"), "stopReason": answer.get("stopReason")}
                    break
            else:
                raise RuntimeError(f"{name}: warm turn did not finish in 180s")
        listing = command("zmx", "list", env=env)
        row = next(line for line in listing.splitlines() if f"name={name}\t" in line)
        pi_pid = int(re.search(r"\bpid=(\d+)", row)[1])
        root = int(command("ps", "-p", str(pi_pid), "-o", "ppid="))
        # Detach client, then measure unviewed idle process + daemon.
        os.write(fd, b"\x1c")
        read(fd, .2)
        os.waitpid(pid, 0)
        detached = command("zmx", "list", env=env)
        detached_row = next(line for line in detached.splitlines() if f"name={name}\t" in line)
        assert "clients=0" in detached_row
        time.sleep(args.settle)
        samples = []
        for i in range(args.samples + 1):
            samples.append({"elapsed_seconds": round(time.monotonic() - start, 3),
                            "processes": processes(root)})
            if i < args.samples:
                time.sleep(args.interval)
        footprints = []
        for process in samples[-1]["processes"]:
            check = subprocess.run(["vmmap", "-summary", str(process["pid"])], capture_output=True, text=True, timeout=30)
            footprints.append({"pid": process["pid"], "executable": process["executable"],
                               "exit_code": check.returncode,
                               "lines": [line for line in (check.stdout + check.stderr).splitlines() if "Physical footprint" in line]})
        return {"label": label, "trial": run, "seed": seed, "name": name,
                "daemon_pid": root, "pi_pid": pi_pid, "footer_seconds": round(footer, 4),
                "usable_seconds": round(usable, 4),
                # Endpoint witnesses: the footer marker and the unsubmitted probe
                # draft were both seen (else the trial raises), and zmx reported
                # no attached client before sampling. No conversation text.
                "footer_marker": "mail/", "probe_echoed": PROBE.decode(),
                "clients_after_detach": int(re.search(r"\bclients=(\d+)", detached_row)[1]),
                "warm_turn": turn, "samples": samples, "footprints": footprints}
    finally:
        subprocess.run(["zmx", "kill", name, "--force"], env=env, capture_output=True)
        os.close(fd)
        try:
            os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            pass

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--small", type=Path, required=True)
    parser.add_argument("--large", type=Path, required=True)
    parser.add_argument("--turn", action="store_true", help="submit one no-tools model turn before idle sampling (uses existing auth)")
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--settle", type=float, default=15)
    parser.add_argument("--samples", type=int, default=12)
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not shutil.which("pi") or not shutil.which("zmx"):
        parser.error("pi and zmx must be on PATH (use mise x zmx@0.8.1)")
    env = dict(os.environ)
    for key in list(env):
        if key.startswith(("PI_SESSION", "PI_WM_", "PI_BOARD_", "ORCA_", "HERDR_", "ZMX_")) or key in ("TMUX", "TMUX_PANE"):
            del env[key]
    env["TERM"] = "xterm-256color"
    env["PI_IMAGE_PROTOCOL"] = "none"
    with tempfile.TemporaryDirectory(prefix="idle-cost-") as directory:
        scratch = Path(directory)
        env["ZMX_DIR"] = str(scratch / "zmx")
        result = {"started": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                  "revision": command("git", "rev-parse", "HEAD"),
                  "pi_version": command("pi", "--version", env=env),
                  "bun_version": command("bun", "--version"),
                  "zmx_version": command("zmx", "version", env=env).splitlines()[:2],
                  "machine": command("uname", "-m"),
                  "memory_bytes": int(command("sysctl", "-n", "hw.memsize")),
                  "swap": command("sysctl", "vm.swapusage"),
                  "terminal": {"rows": 40, "columns": 120, "TERM": env["TERM"], "PI_IMAGE_PROTOCOL": env["PI_IMAGE_PROTOCOL"]},
                  "warm_turn": args.turn, "settle_seconds": args.settle, "interval_seconds": args.interval, "trials": []}
        for run in range(1, args.trials + 1):
            for label, source in (("small", args.small), ("large", args.large)):
                item = trial(source, label, run, args, scratch, env)
                result["trials"].append(item)
                args.output.write_text(json.dumps(result, indent=2) + "\n")
                print(label, run, "usable", item["usable_seconds"], "seconds", flush=True)
        result["remaining_sessions"] = command("zmx", "list", env=env)
        args.output.write_text(json.dumps(result, indent=2) + "\n")

if __name__ == "__main__":
    main()
