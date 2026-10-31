// Read-only evidence snapshot: import detail/records/results/events, paused control, isolation.
// Usage (from starter/):  node ../support/snapshot.mjs <out.json> [baseUrl] [importId]
import { save, takeSnapshot } from "./lib.mjs";

const [out, baseUrl = "http://127.0.0.1:4328", importId = "case-002"] = process.argv.slice(2);
if (!out) {
  console.error("Usage: node ../support/snapshot.mjs <out.json> [baseUrl] [importId]");
  process.exit(2);
}
try {
  const snapshot = await takeSnapshot(baseUrl, importId);
  save(out, snapshot);
  console.log(JSON.stringify(snapshot.summary, null, 2));
  console.log(`Saved ${out}`);
} catch (err) {
  console.error(`Could not reach ${baseUrl} - is the server running? (${err.message})`);
  process.exit(1);
}
