import { recomputeAllGameGrades } from "../grading/recomputeAllGameGrades.js";

function parseArgs(argv = []) {
  const args = { dryRun: false, limit: null, pageSize: null };
  for (const raw of argv) {
    const arg = String(raw || "").trim();
    if (!arg) continue;
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isFinite(parsed) && parsed > 0) args.limit = parsed;
      continue;
    }
    if (arg.startsWith("--page-size=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isFinite(parsed) && parsed > 0) args.pageSize = parsed;
      continue;
    }
  }
  return args;
}

async function run() {
  const { dryRun, limit, pageSize } = parseArgs(process.argv.slice(2));
  const summary = await recomputeAllGameGrades({ dryRun, limit, pageSize });
  console.log("Game grade recompute complete:", summary);
}

run().catch(err => {
  console.error("Game grade recompute failed:", err);
  process.exit(1);
});
