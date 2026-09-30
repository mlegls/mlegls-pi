"""Replays the drive checks in docs/attachments/orchestrate-rework-effect/index.md
against the public surface: `python3 metrics.py` stdout, the metrics.tsv it
writes, and the report docs/research/orchestrate-rework-effect.md.

Needs the local archives (~/.local/share/pi-board/log.jsonl and
~/.pi/agent/sessions); skipped where they are absent.

    python3 -m unittest docs/analysis/orchestrate-rework-effect/test_metrics.py
"""
import csv, io, os, re, subprocess, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SCRIPT = os.path.join(HERE, "metrics.py")
TSV = os.path.join(HERE, "metrics.tsv")
REPORT = os.path.join(ROOT, "docs", "research", "orchestrate-rework-effect.md")
ARCHIVES = [os.path.expanduser("~/.local/share/pi-board/log.jsonl"),
            os.path.expanduser("~/.pi/agent/sessions")]


def run_cli():
    p = subprocess.run([sys.executable, SCRIPT], cwd=ROOT, capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    return p.stdout


def era_line(out, era):
    return re.search(rf"^  {era}: (.*)$", out, re.M).group(1)


def report_table(report):
    lines = [l for l in report.splitlines() if l.startswith("| ") and not l.startswith("| run")]
    return {l.strip("|").split("|")[0].strip().split(" (")[0]: [c.strip() for c in l.strip("|").split("|")]
            for l in lines}


@unittest.skipUnless(all(os.path.exists(p) for p in ARCHIVES), "local pi archives absent")
class DriveChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out1 = run_cli()
        cls.out2 = run_cli()
        with open(TSV) as f:
            cls.tsv_text = f.read()
        cls.rows = {r["run"]: r for r in csv.DictReader(io.StringIO(cls.tsv_text), delimiter="\t")}
        with open(REPORT) as f:
            cls.report = f.read()

    def test_check1_reproducible_and_tsv_is_the_printed_table(self):
        """Check 1: repeated runs print identical output; metrics.tsv is exactly the printed table."""
        self.assertEqual(self.out1, self.out2)
        printed = self.out1.split("\n\n", 1)[0].strip()
        self.assertEqual(printed, self.tsv_text.strip())
        self.assertIn("per-run table written to docs/analysis/orchestrate-rework-effect/metrics.tsv", self.out1)
        self.assertEqual(len(self.rows), 29)

    def test_check2_report_era_totals_match_cli(self):
        """Check 2: the report's era paragraph states the CLI's runs/sends/worker sessions/cost."""
        for era in ("before", "after"):
            line = era_line(self.out1, era)
            runs, sends, ws = (re.search(rf"{k}=(\d+)", line).group(1)
                               for k in ("runs", "sends", "worker_sessions"))
            wcost = re.search(r"worker_\$(\d+)", line).group(1)
            self.assertRegex(self.report, rf"{era} — {runs} runs, {sends} sends,\s+{ws} worker sessions,\s+\${wcost}"
                             if era == "before" else
                             rf"{era} — {runs} runs, {sends} sends, {ws}\s+worker sessions, \${wcost}")

    def test_check3_handle_count_from_dispatchers(self):
        """Check 3 (and the drive's narrative-agreement expectation): every report table cell equals the TSV; every
        resolved run has one root dispatcher; board-sender zeros are not reported as the handle count."""
        table = report_table(self.report)
        self.assertEqual(set(table), set(self.rows))
        for run, r in self.rows.items():
            cells = table[run]
            disp = f"{r['root_dispatchers']}+{r['worktree_dispatchers']}"
            if r["dispatch_unresolved"] != "0":
                disp += f" ({r['dispatch_unresolved']} unresolved)"
            self.assertEqual(cells[8], disp, run)
            self.assertEqual(cells[9], f"{r['board_parent_cwds']}/{r['board_parent_sessions']}", run)
            self.assertEqual(cells[3:8] + [cells[10]],
                             [r["sends"], r["workers"], f"{r['done']}/{r['never']}", r["ckpt_msgs"],
                              r["nested_topics"], f"{float(r['worker_$']):.2f}"], run)
            if int(r["workers"]) and r["dispatch_unresolved"] != r["workers"]:
                self.assertEqual(r["root_dispatchers"], "1", run)
        self.assertEqual(self.rows["verify-final"]["board_parent_cwds"], "0")
        self.assertEqual(self.rows["orca-probe"]["board_parent_sessions"], "1")

    def test_check4_nesting_consistent(self):
        """Check 4: materials-closeout nested topics agree between report and TSV, and the
        report does not claim after-era nesting vanished while the TSV shows a worktree dispatcher."""
        mc = self.rows["materials-closeout"]
        self.assertEqual(report_table(self.report)["materials-closeout"][7], mc["nested_topics"])
        self.assertEqual(mc["worktree_dispatchers"], "1")
        self.assertNotIn("no 09-16+ run has any", self.report)

    def test_check5_prior_audit_value_reported_as_measured(self):
        """Check 5: the report states the CLI's worker-topic count against the 09-18 audit's 217."""
        n = re.search(r"worker_topics=(\d+) \(target 217\)", self.out1).group(1)
        self.assertIn(f"worker topics {n} vs its 217" if n != "217" else "worker topics 217 =", self.report)

    def test_check6_fractions_and_checkpoints(self):
        """Check 6: zero-worker rows have no fraction; era never/workers and checkpoint sends
        printed by the CLI appear in the report."""
        for r in self.rows.values():
            if r["workers"] == "0":
                self.assertEqual(r["never_frac"], "n/a")
            else:
                self.assertAlmostEqual(float(r["never_frac"]), int(r["never"]) / int(r["workers"]), places=3)
        nb = re.search(r"never/workers=(\d+/\d+) ckpt_msgs=(\d+)", self.out1.split("  after:")[0].split("  before:")[1]).groups()
        na = re.search(r"never/workers=(\d+/\d+) ckpt_msgs=(\d+)", self.out1.split("  after:")[1]).groups()
        self.assertIn(f"before {nb[0]}", self.report)
        self.assertIn(f"after {na[0]}", self.report)
        self.assertIn(f"checkpoint sends {nb[1]} vs {na[1]}", self.report)

    def test_check7_missing_data_explained(self):
        """Check 7: the report accounts for the CLI's missing sessions and unresolved dispatchers."""
        miss = re.search(r"missing_sessions=(\d+)", era_line(self.out1, "before")).group(1)
        self.assertIn(f"Missing data: {miss} before-era sender sessions", self.report)
        unresolved = sum(int(r["dispatch_unresolved"]) for r in self.rows.values())
        workers = sum(int(r["workers"]) for r in self.rows.values())
        self.assertIn(f"{unresolved} of {workers} worker\nhandles", self.report)
        self.assertIn("09-23", self.report)  # paseo campaign referenced, not measured


if __name__ == "__main__":
    unittest.main()
