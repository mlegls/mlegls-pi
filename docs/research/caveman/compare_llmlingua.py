# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["llmlingua==0.2.2", "transformers==4.57.6", "torch>=2.6,<3"]
# ///
"""Local compression probe, not an ingress integration.
uv run --python 3.12 docs/research/caveman/compare_llmlingua.py > /tmp/llmlingua.json
Set DEVICE=mps or MODEL=<Hugging Face model ID> to compare backends/models.
"""
import contextlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import sys
import time

import torch
from llmlingua import PromptCompressor

root = Path(__file__).resolve().parents[3]
model = os.environ.get("MODEL", "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank")
device = os.environ.get("DEVICE", "cpu")
# Avoid oversubscribing cores on short interactive reads.
torch.set_num_threads(4)
cases = [{"name": r["name"], "source": r["source"]} for r in json.loads((root / "docs/research/caveman/indexed.json").read_text())["receipts"]]
doc = (root / "docs/ingress.md").read_text()
cases.append({"name": "reading-policy", "source": doc.split("## Reading policy\n", 1)[1].split("## Replay records", 1)[0].strip()})
jobs = "--jobs" in sys.argv
if jobs:
    cases = json.load(sys.stdin)["jobs"]
    if any(c["rate"] not in [0, 0.25, 0.5, 0.75, 1] for c in cases):
        raise ValueError("invalid retention rate")
start = time.perf_counter()
with contextlib.redirect_stdout(sys.stderr):
    compressor = PromptCompressor(model_name=model, device_map=device,
        model_config={"trust_remote_code": False, "torch_dtype": torch.float32}, use_llmlingua2=True)
    compressor.model.eval()
load_ms = (time.perf_counter() - start) * 1000

def compress(text, rate):
    with torch.inference_mode(), contextlib.redirect_stdout(sys.stderr):
        result = compressor.compress_prompt(text, rate=rate,
            force_tokens=["!", ".", "?", "\n"], drop_consecutive=True,
            force_reserve_digit=True, use_context_level_filter=False)
        if device == "mps":
            torch.mps.synchronize()
        return result

start = time.perf_counter()
compress(cases[0]["source"], 0.5)
warmup_ms = (time.perf_counter() - start) * 1000
for case in cases:
    case["variants"] = []
    for rate in ([case["rate"]] if jobs else [0.75, 0.5, 0.35]):
        timings = []
        for _ in range(1 if jobs else 3):
            start = time.perf_counter()
            result = ({"compressed_prompt": case["source"] if rate == 1 else ""}
                      if rate in [0, 1] else compress(case["source"], rate))
            timings.append(round((time.perf_counter() - start) * 1000, 1))
        case["variants"].append({"requestedRetention": rate, "elapsedMs": timings, "result": result})
    print("finished " + case["name"], file=sys.stderr, flush=True)
print(json.dumps({"model": model, "revision": getattr(compressor.model.config, "_commit_hash", None),
    "device": device, "platform": platform.platform(), "threads": torch.get_num_threads(),
    "parameters": sum(p.numel() for p in compressor.model.parameters()),
    "versions": {name: importlib.metadata.version(name) for name in ["llmlingua", "transformers", "torch"]},
    "loadMsIncludingDownloads": round(load_ms), "warmupMs": round(warmup_ms),
    "options": {"force_tokens": ["!", ".", "?", "\n"], "drop_consecutive": True,
        "force_reserve_digit": True, "use_context_level_filter": False},
    "cases": cases}, indent=2, ensure_ascii=False))
