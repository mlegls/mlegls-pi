# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["llmlingua==0.2.2", "transformers==4.57.6", "torch>=2.6,<3"]
# ///
"""Per-user Unix-socket LLMLingua daemon. Cache the model with --setup."""
import contextlib
import fcntl
import json
import os
import socketserver
import sys
from pathlib import Path
from threading import Lock

setup = "--setup" in sys.argv
if not setup:
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

compressor = None
model_lock = Lock()


def load_model():
    global compressor, torch
    if compressor is not None:
        return compressor
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
    return compressor


if setup:
    load_model()
    print("LLMLingua skim dependencies and checkpoint ready.")
    sys.exit(0)

def compress(jobs):
    if not isinstance(jobs, list) or any(
        not isinstance(job, dict) or job.get("rate") not in (0.25, 0.5, 0.75)
        or not isinstance(job.get("text"), str) for job in jobs
    ):
        raise ValueError("invalid skim job")
    model = load_model()
    outputs = []
    with torch.inference_mode(), contextlib.redirect_stdout(sys.stderr):
        for job in jobs:
            result = model.compress_prompt(
                [job["text"]], rate=job["rate"],
                force_tokens=["!", ".", "?", "\n"], drop_consecutive=True,
                force_reserve_digit=True, use_context_level_filter=False,
            )
            outputs.append(result["compressed_prompt"])
    return outputs


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            # Bound memory even if a client sends an unbounded line.
            line = self.rfile.readline(1024 * 1024 + 1)
            if len(line) > 1024 * 1024 or not line.endswith(b"\n"):
                raise ValueError("invalid skim request")
            with model_lock:
                response = {"outputs": compress(json.loads(line))}
        except Exception as error:
            response = {"error": str(error)}
        try:
            self.wfile.write((json.dumps(response, ensure_ascii=False) + "\n").encode())
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__" and "--serve" in sys.argv:
    path = Path(os.environ.get("PI_SKIM_SOCKET", str(Path.home() / ".cache/mlegls-pi/skim.sock")))
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Keep the lock held through socket cleanup. Only the owner removes a stale socket.
    with open(str(path) + ".lock", "a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            sys.exit(0)
        path.unlink(missing_ok=True)
        try:
            with socketserver.ThreadingUnixStreamServer(str(path), Handler) as server:
                os.chmod(path, 0o600)
                server.daemon_threads = True
                server.serve_forever()
        finally:
            path.unlink(missing_ok=True)
