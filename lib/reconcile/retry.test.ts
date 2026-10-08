import { test } from "bun:test";
import { trial } from "../../docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture";

// Approved offline trial: admitted setup retry and first/second/auth provider reports through shell workers.
test("setup and provider failures retry within their budgets before owner escalation", trial, 120_000);
