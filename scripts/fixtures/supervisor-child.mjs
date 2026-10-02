import { appendFileSync, readFileSync } from "node:fs";
const [role, file, behavior] = process.argv.slice(2);
appendFileSync(file, `${role}:${process.pid}:start\n`);
if (behavior === "recover-crash") {
  const count = (readFileSync(file, "utf8").match(/worker:.*:start/g) ?? [])
    .length;
  setTimeout(() => process.exit(7), count === 2 ? 1500 : 50);
}
if (behavior === "crash") setTimeout(() => process.exit(7), 50);
process.on("SIGTERM", () => {
  appendFileSync(file, `${role}:${process.pid}:stop\n`);
  process.exit(0);
});
setInterval(() => {}, 1000);
