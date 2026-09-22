# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["llmlingua==0.2.2", "transformers==4.57.6", "torch>=2.6,<3"]
# ///
"""JSON-lines LLMLingua worker. Install/cache explicitly with uv run --python 3.12 lib/skim-worker.py --setup."""
import contextlib
import json
import os
import sys

setup = "--setup" in sys.argv
if not setup:
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

if not setup:
    print(json.dumps({"ready": os.getpid()}), flush=True)

# stdout is reserved for the protocol, including during model initialization.
with contextlib.redirect_stdout(sys.stderr):
    import torch
    from llmlingua import PromptCompressor

    torch.set_num_threads(4)
    compressor = PromptCompressor(
        model_name="microsoft/llmlingua-2-xlm-roberta-large-meetingbank",
        device_map=os.environ.get("PI_SKIM_DEVICE", "cpu"),
        model_config={"trust_remote_code": False, "torch_dtype": torch.float32,
                      "revision": "ebaba9b0e874dadd3003ffcff828e4397e568089",
                      "local_files_only": not setup},
        use_llmlingua2=True,
    )
    compressor.model.eval()

if setup:
    print("LLMLingua skim dependencies and checkpoint ready.")
    sys.exit(0)

for line in sys.stdin:
    try:
        jobs = json.loads(line)
        outputs = []
        with torch.inference_mode(), contextlib.redirect_stdout(sys.stderr):
            for job in jobs:
                if job["rate"] not in (0.25, 0.5, 0.75) or not isinstance(job["text"], str):
                    raise ValueError("invalid skim job")
                result = compressor.compress_prompt(
                    [job["text"]], rate=job["rate"],
                    force_tokens=["!", ".", "?", "\n"], drop_consecutive=True,
                    force_reserve_digit=True, use_context_level_filter=False,
                )
                outputs.append(result["compressed_prompt"])
        print(json.dumps({"outputs": outputs}, ensure_ascii=False), flush=True)
    except Exception as error:
        print(json.dumps({"error": str(error)}), flush=True)
