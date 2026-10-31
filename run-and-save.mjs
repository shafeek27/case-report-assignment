// Runs a command, shows its output and saves it with real timestamps, platform and exit code.
// Works the same in PowerShell, cmd and bash.
// Usage (from starter/):  node ../support/run-and-save.mjs <out.txt> <command> [args...]
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [out, ...cmd] = process.argv.slice(2);
if (!out || cmd.length === 0) {
  console.error("Usage: node ../support/run-and-save.mjs <out.txt> <command> [args...]");
  process.exit(2);
}
mkdirSync(dirname(out), { recursive: true });
const file = createWriteStream(out);
const write = (text) => { file.write(text); process.stdout.write(text); };
write(`$ ${cmd.join(" ")}\n# started ${new Date().toISOString()} (real time) | node ${process.version} | ${process.platform}-${process.arch}\n\n`);
const child = spawn(cmd[0], cmd.slice(1), {
  shell: process.platform === "win32",
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
});
child.stdout.on("data", write);
child.stderr.on("data", write);
child.on("close", (code) => {
  write(`\n# exit code ${code} at ${new Date().toISOString()}\n`);
  file.end();
  process.exitCode = code ?? 1;
});
