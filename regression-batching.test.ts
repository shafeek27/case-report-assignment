/**
 * PSE-A2-002 regression: an import larger than the batch size must process every
 * accepted row exactly once and may only report "completed" when nothing is pending.
 *
 * Before the fix, the worker paged through the shrinking "pending" set with an
 * OFFSET and skipped unprocessed rows (12 rows at batch size 5 gave 7 results,
 * 5 pending and state "completed"). These tests drive the real Bun HTTP server
 * through the shared harness, with an isolated temporary SQLite file per lab.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { json, object, objects, starterDirectory, startLab, waitForCompletion, type RunningLab } from "./harness";

const cedar: Record<string, string> = { "x-lab-workspace": "cedar-demo" };
const maple: Record<string, string> = { "x-lab-workspace": "maple-demo" };

interface ExpectedRow {
  documentRef: string;
  normalizedLabel: string;
}

function useLab(batchSize: number): () => RunningLab {
  let directory: string | undefined;
  let lab: RunningLab | undefined;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "pse-regression-"));
    lab = await startLab(join(directory, "test.sqlite"), batchSize);
  });
  afterAll(async () => {
    try {
      if (lab) await lab.stop();
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });
  return () => {
    if (!lab) throw new Error("Lab did not start");
    return lab;
  };
}

async function read(lab: RunningLab, path: string, headers: Record<string, string> = cedar): Promise<Record<string, unknown>> {
  const response = await fetch(`${lab.url}${path}`, { headers });
  expect(response.status).toBe(200);
  return json(response);
}

async function create(lab: RunningLab, csv: string): Promise<string> {
  const response = await fetch(`${lab.url}/imports`, {
    method: "POST", headers: { ...cedar, "content-type": "text/csv" }, body: csv,
  });
  expect(response.status).toBe(202);
  const body = await json(response);
  if (typeof body.id !== "string") throw new Error("Create did not return a string import ID");
  return body.id;
}

/** Labels with surrounding spaces and mixed case, so normalization is checked too. */
function generatedRows(count: number, prefix: string): { csv: string; expected: ExpectedRow[] } {
  const lines = ["document_ref,label"];
  const expected: ExpectedRow[] = [];
  for (let index = 1; index <= count; index += 1) {
    const n = String(index).padStart(3, "0");
    lines.push(`${prefix}-${n},  Item ${n} mixed Case  `);
    expected.push({ documentRef: `${prefix}-${n}`, normalizedLabel: `ITEM ${n} MIXED CASE` });
  }
  return { csv: `${lines.join("\n")}\n`, expected };
}

function expectedBatchSizes(total: number, batchSize: number): number[] {
  return Array.from({ length: Math.ceil(total / batchSize) }, (_, index) => Math.min(batchSize, total - index * batchSize));
}

async function verifyImport(lab: RunningLab, id: string, expected: ExpectedRow[], batchSize: number): Promise<void> {
  // 1. Completion is genuine: processed == total and nothing pending.
  expect(await waitForCompletion(lab.url, id)).toEqual({
    id, workspaceId: "cedar-demo", state: "completed", total: expected.length, processed: expected.length, pending: 0,
  });

  // 2. Every source row is processed, with identities in source order.
  const records = objects((await read(lab, `/imports/${id}/records`)).records);
  expect(records.map((record) => record.documentRef)).toEqual(expected.map((row) => row.documentRef));
  expect(records.every((record) => record.state === "processed")).toBe(true);
  const recordIds = records.map((record) => Number(record.id));
  expect(new Set(recordIds).size).toBe(expected.length);

  // 3. Exactly one genuine, normalized result per source record.
  const results = objects((await read(lab, `/imports/${id}/results`)).results);
  expect(results).toEqual(records.map((record, index) => ({
    recordId: record.id,
    documentRef: expected[index]?.documentRef,
    normalizedLabel: expected[index]?.normalizedLabel,
  })));

  // 4. Bounded batches that cover every record exactly once, in order.
  const batches = objects((await read(lab, `/imports/${id}/events`)).events)
    .filter((event) => event.type === "batch_processed")
    .map((event) => object(event.details));
  const batchedIds: number[] = [];
  for (const details of batches) {
    if (!Array.isArray(details.recordIds)) throw new Error("Batch record IDs must be an array");
    expect(details.count).toBe(details.recordIds.length);
    batchedIds.push(...details.recordIds.map(Number));
  }
  expect(batches.map((details) => details.count)).toEqual(expectedBatchSizes(expected.length, batchSize));
  expect(batchedIds).toEqual(recordIds);

  // 5. The new import stays invisible to the other workspace.
  for (const resource of ["", "/records", "/results", "/events"]) {
    const response = await fetch(`${lab.url}/imports/${id}${resource}`, { headers: maple });
    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ code: "not_found" });
  }
}

async function expectControlUnchanged(lab: RunningLab): Promise<void> {
  expect(await read(lab, "/imports/control-002", maple)).toEqual({
    id: "control-002", workspaceId: "maple-demo", state: "paused", total: 3, processed: 0, pending: 3,
  });
  expect(objects((await read(lab, "/imports/control-002/records", maple)).records).map((record) => [record.documentRef, record.state]))
    .toEqual([["CTRL-001", "pending"], ["CTRL-002", "pending"], ["CTRL-003", "pending"]]);
  expect(await read(lab, "/imports/control-002/results", maple)).toEqual({ results: [] });
  expect(objects((await read(lab, "/imports/control-002/events", maple)).events).map((event) => event.type))
    .toEqual(["import_created"]);
}

const sampleRows: ExpectedRow[] = Array.from({ length: 12 }, (_, index) => {
  const n = String(index + 1).padStart(3, "0");
  return { documentRef: `DOC-${n}`, normalizedLabel: `SAMPLE ${n}` };
});

describe("PSE-A2-002: reported volume (12 rows) at the default batch size 5", () => {
  const lab = useLab(5);

  test("the seeded customer case completes with all 12 genuine results", async () => {
    expect(await waitForCompletion(lab().url, "case-002")).toEqual({
      id: "case-002", workspaceId: "cedar-demo", state: "completed", total: 12, processed: 12, pending: 0,
    });
    const results = objects((await read(lab(), "/imports/case-002/results")).results);
    expect(results.map((result) => [result.documentRef, result.normalizedLabel]))
      .toEqual(sampleRows.map((row) => [row.documentRef, row.normalizedLabel]));
  });

  test("importing the supplied fixture processes every row exactly once", async () => {
    const csv = await readFile(join(starterDirectory, "fixtures", "case-002.csv"), "utf8");
    const id = await create(lab(), csv);
    await verifyImport(lab(), id, sampleRows, 5);
  });

  test("the paused Maple control stays unchanged", async () => {
    await expectControlUnchanged(lab());
  });
});

const matrix: Array<{ batchSize: number; volumes: number[] }> = [
  { batchSize: 5, volumes: [1, 4, 5, 6, 10, 11, 12, 13, 200] },
  { batchSize: 3, volumes: [2, 3, 4, 7, 12] },
  { batchSize: 20, volumes: [12, 20, 21, 41, 200] },
  { batchSize: 1, volumes: [1, 3, 12] },
];

for (const { batchSize, volumes } of matrix) {
  describe(`batch size ${batchSize}`, () => {
    const lab = useLab(batchSize);

    test.each(volumes)("processes all %i rows exactly once in bounded batches", async (count) => {
      const { csv, expected } = generatedRows(count, `B${batchSize}N${count}`);
      const id = await create(lab(), csv);
      await verifyImport(lab(), id, expected, batchSize);
    });

    test("the paused Maple control stays unchanged", async () => {
      await expectControlUnchanged(lab());
    });
  });
}
