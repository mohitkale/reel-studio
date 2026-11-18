/** The numbers and the table `npm run benchmark:writers` prints. */
export interface BenchmarkRow {
  example: string;
  pass: boolean;
  /** Model calls, 1 or 2 (the retry). */
  attempts: number;
  errors: number;
  warnings: number;
  seconds: number;
  note?: string;
}

export function summarise(rows: BenchmarkRow[]) {
  const times = rows.map((row) => row.seconds).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const medianSeconds =
    times.length === 0
      ? 0
      : times.length % 2
        ? times[middle]!
        : (times[middle - 1]! + times[middle]!) / 2;
  return {
    total: rows.length,
    passed: rows.filter((row) => row.pass).length,
    calls: rows.reduce((sum, row) => sum + row.attempts, 0),
    medianSeconds,
  };
}

export function benchmarkTable(rows: BenchmarkRow[]): string {
  const lines = [
    "| Brief | Result | Calls | Warnings | Seconds | First problem |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of rows)
    lines.push(
      `| ${row.example} | ${row.pass ? "pass" : "fail"} | ${row.attempts} | ${row.warnings} | ${row.seconds.toFixed(1)} | ${(row.note ?? "").replace(/\|/g, "/").slice(0, 80)} |`,
    );
  return lines.join("\n");
}
