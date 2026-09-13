import { prisma } from "../src/library/db";
import { collectStudioDiagnostics } from "../src/library/studio-diagnostics";

async function main() {
  const report = await collectStudioDiagnostics();
  console.log(`Reel Studio diagnostics · ${report.platform}`);
  for (const check of report.checks) {
    const marker =
      check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×";
    console.log(`${marker} ${check.label}: ${check.detail}`);
    if (check.fix) console.log(`  ${check.fix}`);
  }
  console.log(
    `\n${report.summary.passed} passed · ${report.summary.warnings} warnings · ${report.summary.failed} failed`,
  );
  if (!report.ready) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
