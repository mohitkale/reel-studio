import { appendFileSync } from "node:fs";
const [role, file, behavior] = process.argv.slice(2);
appendFileSync(file, `${role}:${process.pid}:start\n`);
if (behavior === "crash") setTimeout(() => process.exit(7), 50);
process.on("SIGTERM", () => {
  appendFileSync(file, `${role}:${process.pid}:stop\n`);
  process.exit(0);
});
setInterval(() => {}, 1000);
