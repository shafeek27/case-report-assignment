// Compares the pre-recovery and post-recovery snapshots of the ORIGINAL case.
// Usage (from starter/):  node ../support/verify-recovery.mjs <before.json> <after.json> [out.txt]
import { readFileSync } from "node:fs";
import { save } from "./lib.mjs";

const [beforePath, afterPath, outPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error("Usage: node ../support/verify-recovery.mjs <before.json> <after.json> [out.txt]");
  process.exit(2);
}
const before = JSON.parse(readFileSync(beforePath, "utf8"));
const after = JSON.parse(readFileSync(afterPath, "utf8"));
const lines = [];
const log = (line) => { lines.push(line); console.log(line); };
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "   -- " + detail : ""}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortNum = (xs) => [...xs].sort((a, b) => a - b);

const bRecords = before.cedar.records.body.records;
const aRecords = after.cedar.records.body.records;
const bResults = before.cedar.results.body.results;
const aResults = after.cedar.results.body.results;
const bEvents = before.cedar.events.body.events;
const aEvents = after.cedar.events.body.events;
const aDetail = after.cedar.detail.body;
const batchSize = after.health.body.batchSize;

log(`before: ${beforePath} captured ${before.capturedAt} (real time)`);
log(`after:  ${afterPath} captured ${after.capturedAt} (real time)`);
log("");
check("same import id", aDetail.id === before.cedar.detail.body.id, aDetail.id);
check("same source records (id, documentRef, label)",
  same(bRecords.map((r) => [r.id, r.documentRef, r.label]), aRecords.map((r) => [r.id, r.documentRef, r.label])),
  `${aRecords.length} records`);
check("completed, nothing pending, processed == total",
  aDetail.state === "completed" && aDetail.pending === 0 && aDetail.processed === aDetail.total
    && aDetail.total === aRecords.length, JSON.stringify(aDetail));
check("every record processed", aRecords.every((r) => r.state === "processed"));
check("exactly one result per record",
  same(sortNum(aResults.map((r) => r.recordId)), sortNum(aRecords.map((r) => r.id))),
  `${aResults.length} results for ${aRecords.length} records`);
check("results genuinely normalized (label.trim().toUpperCase())", aResults.every((r) => {
  const src = aRecords.find((x) => x.id === r.recordId);
  return src && src.documentRef === r.documentRef && src.label.trim().toUpperCase() === r.normalizedLabel;
}));
check("all earlier results retained unchanged", bResults.every((b) => aResults.some((a) => same(a, b))),
  `${bResults.length} earlier results`);
check("earlier event history preserved", bEvents.every((b) => aEvents.some((a) => same(a, b))));
const newEvents = aEvents.filter((a) => !bEvents.some((b) => b.id === a.id));
log(`      new events: ${newEvents.map((e) => `${e.id}:${e.type}`).join(", ")}`);
check("resume_requested recorded", newEvents.some((e) => e.type === "resume_requested"));
const newBatches = newEvents.filter((e) => e.type === "batch_processed");
const newBatchIds = newBatches.flatMap((e) => e.details.recordIds);
const pendingBefore = bRecords.filter((r) => r.state === "pending").map((r) => r.id);
check("only previously pending records were processed (no duplicate work)",
  same(sortNum(newBatchIds), sortNum(pendingBefore)),
  `new batch ids [${newBatchIds}] vs pending before [${pendingBefore}]`);
check(`new batches bounded by batch size ${batchSize}`,
  newBatches.every((e) => e.details.count === e.details.recordIds.length && e.details.count <= batchSize),
  newBatches.map((e) => e.details.count).join(", "));
check("paused Maple control unchanged (detail, records, results, events)", same(before.control, after.control));
check("cross-workspace read still 404", after.isolation.crossWorkspaceRead.status === 404);
log("");
log(failures ? `${failures} CHECK(S) FAILED` : "ALL CHECKS PASSED");
if (outPath) save(outPath, lines.join("\n") + "\n");
process.exit(failures ? 1 : 0);
