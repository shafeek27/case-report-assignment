"""Applies the PSE-A2-002 fix to starter/src and saves the diff as evidence/04-fix.diff.
Run from starter/:   py ../support/apply_fix.py      (Mac/Linux: python3 ../support/apply_fix.py)
All-or-nothing: if the expected original code is not found exactly, nothing is changed.
"""
import difflib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STARTER = ROOT / "starter"
DIFF_OUT = ROOT / "evidence" / "04-fix.diff"

OLD_WORKER_LOOP = """    let offset = 0;
    while (true) {
      const batch = repository.pendingBatch(workspaceId, importId, batchSize, offset);
      if (batch.length === 0) break;
      repository.commitBatch(workspaceId, importId, batch);
      offset += batch.length;
    }
"""
NEW_WORKER_LOOP = """    // PSE-A2-002: always read the FIRST pending rows. Each committed batch leaves the
    // pending set, so the previous offset skipped rows that had never been processed.
    while (true) {
      const batch = repository.pendingBatch(workspaceId, importId, batchSize);
      if (batch.length === 0) break;
      repository.commitBatch(workspaceId, importId, batch);
    }
"""
OLD_PENDING_BATCH = """  pendingBatch(workspaceId: WorkspaceId, id: string, limit: number, offset: number): SourceRecord[] {
    return this.db.query<SourceRecord, [string, string, number, number]>(`
      SELECT id, document_ref AS documentRef, label, state FROM records
      WHERE workspace_id = ? AND import_id = ? AND state = 'pending' ORDER BY id LIMIT ? OFFSET ?
    `).all(workspaceId, id, limit, offset);
  }
"""
NEW_PENDING_BATCH = """  pendingBatch(workspaceId: WorkspaceId, id: string, limit: number): SourceRecord[] {
    // Committed rows are no longer 'pending', so the next batch is always the first `limit` rows.
    return this.db.query<SourceRecord, [string, string, number]>(`
      SELECT id, document_ref AS documentRef, label, state FROM records
      WHERE workspace_id = ? AND import_id = ? AND state = 'pending' ORDER BY id LIMIT ?
    `).all(workspaceId, id, limit);
  }
"""
OLD_FINISH = """  finishImport(workspaceId: WorkspaceId, id: string): void {
    this.db.transaction(() => {
"""
NEW_FINISH = """  finishImport(workspaceId: WorkspaceId, id: string): void {
    this.db.transaction(() => {
      // Completion is only valid when every source row has been processed (PSE-A2-002).
      const job = this.getImport(workspaceId, id);
      if (job.pending !== 0 || job.processed !== job.total) {
        throw new Error(`Import cannot complete: ${job.pending} of ${job.total} records are still pending`);
      }
"""

PATCHES = {
    "src/worker.ts": [(OLD_WORKER_LOOP, NEW_WORKER_LOOP)],
    "src/repository.ts": [(OLD_PENDING_BATCH, NEW_PENDING_BATCH), (OLD_FINISH, NEW_FINISH)],
}


def main():
    planned, errors = [], []
    for rel, edits in PATCHES.items():
        path = STARTER / rel
        raw = path.read_bytes().decode("utf-8")
        crlf = "\r\n" in raw
        original = raw.replace("\r\n", "\n")
        text = original
        for old, new in edits:
            if new in text:
                continue  # this part is already applied
            if text.count(old) != 1:
                errors.append(f"{rel}: expected original code not found exactly once:\n{old}")
                continue
            text = text.replace(old, new)
        if text != original:
            planned.append((rel, path, original, text, crlf))
    if errors:
        print("NOTHING CHANGED.\n" + "\n".join(errors))
        sys.exit(1)
    if not planned:
        print("Fix is already applied; nothing to do.")
        return
    diff = []
    for rel, path, original, text, crlf in planned:
        diff += difflib.unified_diff(original.splitlines(keepends=True), text.splitlines(keepends=True),
                                     fromfile=f"a/starter/{rel}", tofile=f"b/starter/{rel}")
        path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))
        print("patched", rel)
    DIFF_OUT.parent.mkdir(parents=True, exist_ok=True)
    DIFF_OUT.write_text("".join(diff), encoding="utf-8")
    print("saved", DIFF_OUT)


if __name__ == "__main__":
    main()
