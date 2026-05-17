import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));

assert(!read("src/app/(app)/dashboard/page.tsx").includes("WeeklyReviewBanner"), "dashboard weekly banner must stay removed");

assert(exists("src/app/api/workspaces/[id]/pins/route.ts"), "mentor pin route is missing");
assert(exists("src/app/api/workspaces/[id]/pins/[pinId]/route.ts"), "mentor unpin route is missing");
assert(read("src/app/(app)/team/feed/page.tsx").includes("Pinned by mentors"), "team feed must render pinned content");

for (const path of [
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/app/api/billing/webhook/route.ts",
  "src/app/api/auth/register/route.ts",
]) {
  assert(read(path).includes("rateLimit("), `${path} must use rateLimit`);
}

for (const path of [
  "src/app/api/workspaces/[id]/feed/route.ts",
  "src/app/api/workspaces/[id]/leaderboard/route.ts",
  "src/app/api/workspaces/[id]/members/route.ts",
  "src/app/api/workspaces/[id]/trades/[tradeId]/comments/route.ts",
]) {
  assert(read(path).includes("requireWorkspace"), `${path} must use workspace guards`);
}

assert(read("src/app/(app)/learn/page.tsx").includes("MicroLessonWidget"), "learn micro lesson widget is missing");
assert(read("next.config.ts").includes("withSentryConfig"), "Sentry wrapper is missing from next config");

console.log("smoke-implementation: ok");
