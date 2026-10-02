import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

// A detached grandchild mirrors Chromium's independent POSIX process group.
if (process.argv[2] === "leaf") {
  process.on("SIGTERM", () => {});
  console.log(JSON.stringify({ leaf: process.pid }));
} else {
  const leaf = spawn(process.execPath, [process.argv[1], "leaf"], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "ignore"],
  });
  leaf.stdout.once("data", (data) => {
    const ids = { root: process.pid, ...JSON.parse(data.toString()) };
    if (process.env.REEL_PROCESS_TEST_DIRECTORY)
      writeFileSync(
        path.join(
          process.env.REEL_PROCESS_TEST_DIRECTORY,
          `${process.pid}.json`,
        ),
        JSON.stringify(ids),
      );
    console.log(JSON.stringify(ids));
  });
  process.on("SIGTERM", () => {
    if (process.argv[2] === "polite") process.exit(0);
  });
}
setInterval(() => {}, 1000);
