import { test } from "bun:test";
import { trial } from "../../docs/attachments/worker-setup-failure-after-admission-escapes-launch-retry/fixture";

// Approved offline trial: worker setup retry and first (continue)/second (fresh worker)/third/auth provider reports through fake-bb workers.
test("setup and provider failures retry within their budgets before owner escalation", trial, 120_000);
