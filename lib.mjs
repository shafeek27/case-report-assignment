// Shared helpers for the evidence scripts. Only the public HTTP API is used.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export async function call(baseUrl, path, workspace) {
  const headers = workspace ? { "x-lab-workspace": workspace } : {};
  const res = await fetch(baseUrl + path, { headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { request: `GET ${path}`, workspace: workspace ?? null, status: res.status, body };
}

export async function takeSnapshot(baseUrl, importId) {
  const cedar = (p) => call(baseUrl, `/imports/${importId}${p}`, "cedar-demo");
  const maple = (p) => call(baseUrl, `/imports/control-002${p}`, "maple-demo");
  const snapshot = {
    capturedAt: new Date().toISOString(),
    clockNote: "capturedAt is real execution time, NOT the simulated policy clock",
    baseUrl,
    importId,
    health: await call(baseUrl, "/health"),
    cedar: {
      detail: await cedar(""), records: await cedar("/records"),
      results: await cedar("/results"), events: await cedar("/events"),
    },
    control: {
      detail: await maple(""), records: await maple("/records"),
      results: await maple("/results"), events: await maple("/events"),
    },
    isolation: {
      crossWorkspaceRead: await call(baseUrl, `/imports/${importId}`, "maple-demo"),
      unknownImport: await call(baseUrl, "/imports/does-not-exist", "cedar-demo"),
      missingSelector: await call(baseUrl, `/imports/${importId}`),
    },
  };
  snapshot.summary = summarize(snapshot);
  return snapshot;
}

export function summarize(s) {
  const records = s.cedar.records.body?.records ?? [];
  const results = s.cedar.results.body?.results ?? [];
  const events = s.cedar.events.body?.events ?? [];
  const resultIds = results.map((r) => r.recordId);
  const byId = new Map(records.map((r) => [r.id, r]));
  return {
    detail: s.cedar.detail.body,
    recordCount: records.length,
    pending: records.filter((r) => r.state === "pending").map((r) => `${r.id}:${r.documentRef}`),
    processed: records.filter((r) => r.state === "processed").map((r) => `${r.id}:${r.documentRef}`),
    resultCount: results.length,
    results: results.map((r) => `${r.recordId}:${r.documentRef}:${r.normalizedLabel}`),
    duplicateResultRecordIds: resultIds.filter((id, i) => resultIds.indexOf(id) !== i),
    processedWithoutResult: records
      .filter((r) => r.state === "processed" && !resultIds.includes(r.id)).map((r) => r.documentRef),
    wrongNormalization: results.filter((r) => {
      const src = byId.get(r.recordId);
      return !src || src.label.trim().toUpperCase() !== r.normalizedLabel;
    }).map((r) => r.documentRef),
    batchEvents: events.filter((e) => e.type === "batch_processed").map((e) => ({ eventId: e.id, ...e.details })),
    eventTypes: events.map((e) => `${e.id}:${e.type}`),
    control: s.control.detail.body,
    controlResultCount: (s.control.results.body?.results ?? []).length,
    isolationStatuses: {
      crossWorkspaceRead: s.isolation.crossWorkspaceRead.status,
      unknownImport: s.isolation.unknownImport.status,
      missingSelector: s.isolation.missingSelector.status,
    },
  };
}

export function save(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
}
