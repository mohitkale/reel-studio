/**
 * Prints the ten slowest test files at the end of a run so slow tests are
 * noticed when they appear, not when CI becomes painful.
 */
export default class SlowestReporter {
  onTestRunEnd(testModules) {
    const rows = testModules
      .map((module) => ({
        file: module.relativeModuleId ?? module.moduleId,
        ms: module.diagnostic?.().duration ?? 0,
      }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 10);
    if (rows.length === 0) return;
    console.log("\nSlowest test files:");
    for (const row of rows) {
      console.log(`  ${(row.ms / 1000).toFixed(1).padStart(6)}s  ${row.file}`);
    }
  }
}
