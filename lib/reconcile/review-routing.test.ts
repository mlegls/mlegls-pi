import { expect, test } from "bun:test";
import { replay } from "../../docs/attachments/visual-review-only-for-changes-that-render-something-new/replay.ts";

// Both packets are visual. The actual launch must follow what changed in Git.
test("visual review follows rendered changes, not recordings alone", async () => {
 expect(await replay("recordings")).toContain("(review, reviewer)");
 expect(await replay("css")).toContain("(review, visual-reviewer)");
}, 120_000);
