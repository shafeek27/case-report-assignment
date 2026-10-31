// Reproduction: POST a CSV to an ISOLATED lab server, wait for the worker, snapshot the new import.
// Refuses port 4328 so the original customer-case database is never touched.
// Usage (from starter/):  node ../support/reproduce.mjs <out.json> <isolatedBaseUrl> [csvPath]
import { readFileSync } from "node:fs";
import { call, save, takeSnapshot } from "./lib.mjs";

const [out, baseUrl, csvPath = "fixtures/case-002.csv"] = process.argv.slice(2);
if (!out || !baseUrl) {
  console.error("Usage: node ../support/reproduce.mjs <out.json> <isolatedBaseUrl> [csvPath]");
  process.exit(2);
}
if (/:4328\/?$/.test(baseUrl)) {
  console.error("Refusing to POST to port 4328 (original case database). Start an isolated server instead.");
  process.exit(2);
}
const res = await fetch(`${baseUrl}/imports`, {
  method: "POST",
  headers: { "x-lab-workspace": "cedar-demo", "Content-Type": "text/csv" },
  body: readFileSync(csvPath, "utf8"),
});
const created = { request: "POST /imports", csvPath, status: res.status, body: await res.json() };
console.log("POST /imports ->", created.status, JSON.stringify(created.body));
if (created.status !== 202) process.exit(1);

const id = created.body.id;
for (let i = 0; i < 600; i++) {
  const { body } = await call(baseUrl, `/imports/${id}`, "cedar-demo");
  if (body.state === "completed" || body.state === "failed") break;
  await new Promise((r) => setTimeout(r, 100));
}
const snapshot = await takeSnapshot(baseUrl, id);
snapshot.post = created;
save(out, snapshot);
console.log(JSON.stringify(snapshot.summary, null, 2));
console.log(`Saved ${out}`);
