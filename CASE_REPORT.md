# Case report — PSE-A2-002

**Customer:** Cedar Demo Malaysia (fictional) · **Priority:** P2 · **Support owner:** [[Your name]]

Labels: **Customer report** = what the customer said · **Verified** = shown in a linked evidence file ·
**Hypothesis** = not proven · **Draft** = message written for this exercise, not sent to anyone.
Simulated policy times (GST/MYT) are separate from the real timestamps inside evidence files.

## 1. Summary and impact

- **Priority / rationale:**
  - **Impact:** P2. One customer's import workflow is partially degraded. An import of 12 accepted records reports
    `completed`, but 5 records were never processed, so the customer cannot continue with them. The 7 existing
    results are genuine and intact.
  - **No wider incident:** no outage, security issue, data exposure or legal/tax deadline was found.
  - **Why the workaround is limited:** single-record imports cover only genuinely new records. They do not recover
    the 5 unprocessed rows. Re-uploading is unsafe because every POST creates a new import with no
    deduplication, so the 7 completed rows would be processed again.
  - **Broader scope (verified locally):** the defect is in the shared worker. Before the fix, every tested import
    larger than the batch size failed the same way, in the lab, at batch sizes 1, 3, 5 and 20
    ([`03`](evidence/03-tests-before-fix.txt)). Other workspaces' larger imports may therefore be silently
    incomplete in production. This is not verified, and it is why I escalated promptly (section 5).
- **Current status:**
  - **Local:** the fix and regression tests are verified ([`06`](evidence/06-tests-after-fix.txt)). The existing
    case is reconciled in the lab database with the approved `resume-case`
    ([`11`](evidence/11-recovery-verification.txt)).
  - **Awaiting:** independent engineering review, a release decision, a production scope check, production
    reconciliation approval, and customer confirmation.
  - **Not production-restored.**
- **Reported observation (customer report):** "12 records uploaded and accepted; the import now says complete;
  only seven results are visible; should we upload the file again?"
- **Verified baseline** — [`evidence/01-baseline-original-case.json`](evidence/01-baseline-original-case.json), captured [[FILL capturedAt]] (real time):
  - `case-002`: state `completed`, total 12, **processed 7, pending 5**.
  - Records: DOC-001…DOC-012 (record IDs 1–12).
    - Processed: DOC-001–005 and DOC-011–012.
    - **Pending: DOC-006–010.**
  - Results: 7, one per processed record (`SAMPLE 001`–`005`, `SAMPLE 011`, `SAMPLE 012`). Correctly
    normalized, no duplicates, none missing for processed rows.
  - Events: `import_created`, `processing_started`, `batch_processed` ×2 (IDs [1–5], then [11, 12]; counts 5 and
    2), `processing_completed`.
  - Maple `control-002`: paused, 3 pending, 0 results, only `import_created`.
  - Isolation: cross-workspace read 404, unknown import 404, missing selector 400.
  - **Mismatch:** the import is `completed` although pending = 5 and processed ≠ total, which breaks the completion
    invariant. The customer's "seven visible" is accurate. Nothing is hidden: five rows were never processed.
- **Workaround / safety:**
  - Do not re-upload `case-002` or any partly processed file.
  - Do not delete existing results.
  - Genuinely new, urgent records may use single-record imports (the approved workaround).
  - The five missing rows are recovered **in place**, never by replaying the file.

## 2. Draft customer communications

All messages are **drafts** for this exercise.

### Acknowledgment — simulated Mon 26 Oct 2026, 09:35 GST / 13:35 MYT

> **Subject:** PSE-A2-002 – Incomplete import: investigating now (next update by 10:00 GST / 14:00 MYT)
>
> Hi Cedar Demo Malaysia team,
>
> Thank you for reporting this. I understand you uploaded 12 records, the import shows as complete, but only seven
> results are visible, and that this is holding up your work. I've taken ownership of this case at P2 priority and
> am investigating now.
>
> **Where we are:** I'm checking the import's actual state: which records were accepted, which have results, and
> what the processing history shows. We have not confirmed a cause yet.
>
> **In the meantime, please:**
> - **Don't upload the same file again.** Each upload creates a new, separate import with no duplicate check, so
>   records that already have results could be processed twice.
> - **Keep the seven existing results.** Please don't delete them; we'll reconcile against them.
> - **If you have genuinely new records** (not in this file) that can't wait, you can submit them one at a time as
>   single-record imports. This won't recover the current import, which we'll handle separately.
>
> **Next update:** by **10:00 GST / 14:00 MYT today**, even if nothing has changed.
>
> Regards,
> [[Your name]], Product Support, Complyance

### Checkpoint update — simulated 10:00 GST / 14:00 MYT

> **Subject:** PSE-A2-002 – Update: import state confirmed, cause under investigation
>
> Hi Cedar Demo Malaysia team,
>
> **Confirmed since my last message:**
> - All 12 records were accepted and stored.
> - **Seven have genuine, correct results**: DOC-001 to DOC-005, DOC-011 and DOC-012.
> - **Five have not been processed yet**: DOC-006 to DOC-010. They are still waiting even though the import is
>   labelled complete.
> - Your existing results are intact, and there is no sign that any other customer's data was involved.
> - We have reproduced the same pattern in an isolated test environment.
>
> **Not yet confirmed:**
> - The exact cause. We are tracing it in the processing logic now.
> - When the five records will be processed. We'll give you a realistic picture once we understand the cause, and
>   we won't guess before then.
>
> **Please continue to:**
> - Not re-upload the file, because that would duplicate the seven completed records.
> - Use single-record imports only for genuinely new, urgent records.
>
> **Next update:** by **12:00 GST / 16:00 MYT today**, or sooner if we confirm the cause.
>
> Regards,
> [[Your name]], Product Support

### Progress update — simulated 12:00 GST / 16:00 MYT

> **Subject:** PSE-A2-002 – Cause identified, fix in testing
>
> Hi Cedar Demo Malaysia team,
>
> **What we found:** a fault in how imports are processed in groups. After the first group, the processor skipped
> some waiting records, then marked the import complete. It affects imports with more records than one processing
> group, which explains your five missing records.
>
> **Where we are:** we've prepared a targeted fix and are testing it with your file and with smaller and larger
> imports. Your seven results remain safe. Once the fix is verified, we'll continue your **existing** import so
> only the five missing records are processed. You won't need to re-upload.
>
> **Please continue to:** avoid re-uploading, and use single-record imports for urgent new records.
>
> **Next update:** by **15:00 GST / 19:00 MYT today**.
>
> Regards,
> [[Your name]], Product Support

### Final update / conditional closure — simulated 15:00 GST / 19:00 MYT, Mon 26 Oct 2026

> **Subject:** PSE-A2-002 – Fix verified in testing; your import reconciled in our verification environment; awaiting release
>
> Hi Cedar Demo Malaysia team,
>
> **What happened:**
> - After processing the first group of five records, the import processor skipped records that were still
>   waiting, and then marked the import complete.
> - Records DOC-006 to DOC-010 were never processed.
> - Nothing that had already been produced was changed.
>
> **What we verified:**
> - We fixed the processing logic, and the import can now only be marked complete when every record has been
>   processed.
> - In our verification environment we tested your 12-record file, smaller and larger imports, and several batch
>   settings. Every record was processed exactly once.
> - Using an approved recovery step, we continued your **existing** import in that environment. Only DOC-006 to
>   DOC-010 were processed. The seven earlier results stayed unchanged, there are no duplicates, and the import
>   shows 12 of 12 with none pending.
>
> **Still pending:**
> - **Engineering review and release of the fix.** It is not released yet. Until it is, imports with more than five
>   records could be affected in the same way.
> - **Your live workspace.** Applying the same reconciliation to your live import needs engineering approval. We
>   will confirm once your live import reflects it.
> - **Your confirmation.** When we tell you it's live, please check that your import shows **12 results and 0
>   pending**, with DOC-006 to DOC-010 each present once.
>
> **Until then, please:**
> - Don't re-upload the file.
> - Use single-record imports for urgent new records.
>
> **Next update:** by **10:00 GST / 14:00 MYT on Tuesday 27 October**, or sooner when engineering responds.
>
> **Closing the case:** we'll close this case only after the fix is released, your live import shows all 12
> results with no duplicates, and you confirm you can continue. If anything looks different, reply here and we'll
> pick it up immediately.
>
> Regards,
> [[Your name]], Product Support

## 3. Reproduction and root cause

- **Environment and steps:**
  - Runtime: [[FILL OS]], Bun [[FILL]], Node [[FILL]] ([`00`](evidence/00-versions.txt)).
  - Default batch size 5.
  - Isolated database `starter/.data/repro-before.sqlite` on port 4329, not the original case database.
  - Request: `POST /imports` with `x-lab-workspace: cedar-demo`, `Content-Type: text/csv` and
    `fixtures/case-002.csv`, which created import [[FILL id from 02]]
    ([`02-repro-before-fix.json`](evidence/02-repro-before-fix.json)).
- **Expected versus observed (isolated reproduction, unpatched):**

  | | Expected | Observed |
  | --- | --- | --- |
  | Import state | `completed` only when pending = 0 | `completed` with pending 5 |
  | Processed / total | 12 / 12 | 7 / 12 |
  | Source rows | all 12 `processed` | DOC-006–010 still `pending` |
  | Results | 12 (`SAMPLE 001`…`012`) | 7 (DOC-001–005, DOC-011, DOC-012) |
  | `batch_processed` events | counts 5, 5, 2 covering all 12 IDs | counts 5, 2 |

- **Causal explanation (confirmed in code):**
  - `src/worker.ts` `processImport()` loops with `offset = 0` and calls
    `repository.pendingBatch(workspaceId, importId, batchSize, offset)`, then adds `offset += batch.length`.
  - `src/repository.ts` `pendingBatch()` runs
    `... WHERE state = 'pending' ORDER BY id LIMIT ? OFFSET ?`.
  - `commitBatch()` changes each committed row to `processed`, so the pending set shrinks after every batch while
    the offset grows. The two move against each other:

    | Loop | Pending set | Offset | Returned |
    | --- | --- | --- | --- |
    | 1 | DOC-001–012 (12 rows) | 0 | DOC-001–005 |
    | 2 | DOC-006–012 (7 rows) | 5 | DOC-011–012 (DOC-006–010 skipped) |
    | 3 | DOC-006–010 (5 rows) | 7 | nothing, so the loop ends |

  - `finishImport()` then sets `completed` unconditionally, so the import claims success with five rows pending.
  - Imports no larger than the batch size finish in one batch, which is why the starter tests (1 and 5 rows)
    passed.
  - The regression suite shows the boundary: before the fix, exactly the volumes greater than the batch size
    failed ([`03`](evidence/03-tests-before-fix.txt)).
- **Rejected hypotheses:**
  - *Results exist but the read API hides them:* rejected, because the source rows themselves are `pending` and
    `getResults` is a direct join.
  - *CSV parsing dropped rows:* rejected, because total = 12 and all 12 source rows are stored.
  - *Workspace mix-up:* rejected, because every query is scoped by workspace and import, the control is
    unchanged, and cross-workspace reads return 404.
  - *Processing error:* rejected, because there is no `processing_failed` event and both batch events committed
    normally.
- **Permanent change** ([`04-fix.diff`](evidence/04-fix.diff)):
  1. `src/worker.ts`: the offset is removed. Each loop takes the first `batchSize` pending rows, until none remain.
  2. `src/repository.ts` `pendingBatch()`: the `OFFSET` parameter is removed. Committed rows already leave the
     pending set.
  3. `src/repository.ts` `finishImport()`: a guard refuses completion unless pending = 0 and processed = total.
     If that ever triggers, the existing error path marks the import `failed` with a `processing_failed` event,
     instead of reporting false success.

  The public API, CSV validation, batch limit, normalization and workspace scoping are unchanged. Each loop
  either processes at least one row or throws, so it always terminates.

## 4. Tests and existing-case reconciliation

| Check | Actual result and evidence |
| --- | --- |
| Regression: failure before, success after | Before: [[FILL summary line]] ([`03`](evidence/03-tests-before-fix.txt)); the reported-case tests failed with `processed: 7, pending: 5`. After: [[FILL]] ([`06`](evidence/06-tests-after-fix.txt)). |
| Varied volumes, batch boundaries, different batch size | `tests/regression-batching.test.ts`, each lab on its own temporary database: batch 5 with 1, 4, 5, 6, 10, 11, 12, 13 and 200 rows; batch 3 with 2, 3, 4, 7 and 12; batch 20 with 12, 20, 21, 41 and 200; batch 1 with 1, 3 and 12. Each test asserts the exact `documentRef` order, exact normalized labels, one result per record ID, batch counts equal to the expected boundaries (e.g. 5, 5, 2), every ID in exactly one batch, `completed` only with pending 0, and cross-workspace 404. |
| API validation and workspace isolation | The 25 starter tests (CSV rejection, selectors, 404 scope, restart persistence) pass after the fix ([`06`](evidence/06-tests-after-fix.txt)). Snapshots 01, 08 and 10 record cross-workspace 404, unknown 404 and missing selector 400. |
| Original case before recovery | [`08`](evidence/08-pre-recovery.json): identical to the baseline (completed, 7 processed, 5 pending: DOC-006–010). Restarting on patched code did not change the completed case. |
| Patched-worker restart and approved `resume-case` | The server was restarted on the patched code. [`09`](evidence/09-resume-case.txt): `{"id":"case-002","workspaceId":"cedar-demo","state":"queued","pending":5}` [[confirm]]. The worker then logged `resume_requested`, `processing_started`, one `batch_processed` (IDs 6–10, count 5) and `processing_completed` ([`10`](evidence/10-after-recovery.json)). |
| Original case after recovery | [`11`](evidence/11-recovery-verification.txt): same import and record IDs 1–12, 12 genuine results, 0 pending, the 7 earlier results byte-identical, new batch contains only the 5 previously pending IDs, no duplicates. [[FILL: ALL CHECKS PASSED]] |
| Paused Maple control | Identical detail, records, results and events in 01, 08 and 10; checked automatically in 11. Also asserted in every regression lab. |

**Not run / not verified:**
- Production behaviour and the production scope of the defect.
- Platforms other than [[FILL OS]].
- Concurrent workers.
- A direct test of the `finishImport` guard, which is unreachable through the API once the worker is fixed.

A resume acknowledgment and local passing tests do not establish production restoration.

## 5. Escalation and customer ownership

- **Decision:** escalate to engineering now, at P2, with a request for a priority review.
- **Reasons:**
  - **Release needs engineering.** The defect is in shared product code, so the fix needs independent review and a
    release decision that support cannot make.
  - **Wider impact is likely.** Lab evidence shows every import larger than the batch size is affected, so other
    workspaces may have imports that falsely say `completed`. Finding them needs a production query.
  - **Recovery needs authorization.** `resume-case` is approved for the lab only. Reconciling this customer's live
    import needs explicit engineering authorization.
  - **Possible customer notice.** Engineering may need to decide whether other customers should be told.
- **Continuity:**
  - Support ([[Your name]]) keeps ownership of the customer, the safe guidance and every update.
  - Next customer update: Tue 27 Oct, 10:00 GST / 14:00 MYT.
  - Engineering owner: **requested, not accepted**.

### Linear-ready draft (not created)

> **Title:** [P2] Import worker skips pending rows and marks multi-batch imports `completed` (PSE-A2-002, Cedar Demo Malaysia)
>
> **Priority:** P2 (please review for possible raise if the scope query finds other customers)
> **Requested owner:** Import pipeline engineering on-call (requested, not accepted)
> **Support owner:** [[Your name]]
>
> **Impact / scope:**
> - Cedar Demo `case-002`: 12 accepted, 7 processed, 5 pending (DOC-006–010), state `completed`.
> - The customer is blocked on 5 records and has been told not to re-upload.
> - In the lab, every import with more rows than the batch size is affected, at any batch size and in any
>   workspace. Production scope is unknown.
>
> **Reproduction:**
> - Lab with default batch size 5. POST `fixtures/case-002.csv`.
> - Result: `completed` with processed 7 / pending 5; `batch_processed` counts 5 and 2.
> - Evidence: `evidence/01`, `02`, `03`.
>
> **Confirmed cause:**
> - `worker.ts` `processImport()` paginates `pendingBatch()` with an increasing OFFSET over the shrinking pending
>   set, so it skips rows.
> - `finishImport()` then marks `completed` without checking pending.
>
> **Local change** (`evidence/04-fix.diff`):
> - Remove the offset, so each loop takes the first N pending rows.
> - Guard completion so it requires pending = 0.
> - No API or contract change.
> - Tests: [[FILL after-fix summary]], covering volumes 1–200 and batch sizes 1, 3, 5 and 20.
>
> **Lab reconciliation:** the existing case was reconciled with `resume-case`. Result: 12 results, 0 pending,
> earlier results unchanged, no duplicates (`evidence/11`).
>
> **Requests:**
> 1. Review the patch and decide on the release.
> 2. Run a production query for imports with `state = 'completed'` and pending records > 0, across all workspaces,
>    since the defect was introduced.
> 3. Authorize or perform reconciliation of Cedar `case-002` in production. Process pending rows only; no replay.
> 4. Decide whether other affected customers need proactive notice.
>
> **Requested checkpoint:**
> - Acknowledgment and an owner by 16:00 GST, Mon 26 Oct.
> - Scope-query result by 10:00 GST, Tue 27 Oct.
>
> **Pending decisions:** owner acceptance, release timing, production reconciliation approval, customer
> notification.

- **Exit criteria:**
  - The fix is reviewed and released.
  - The production scope query is answered and any affected imports are handled.
  - Cedar `case-002` shows 12 results, 0 pending and no duplicates in production.
  - The customer confirms they can continue.
- **Renewed engagement:** follow up with engineering if there is no acknowledgment by the checkpoint. Reopen or
  re-escalate if the scope query finds other customers or the customer reports any mismatch. No restoration ETA
  is promised.

## 6. Submission notes

- **Evidence index:** [`evidence/README.md`](evidence/README.md). Baseline: `01`, `02`. Tests: `03`, `05`, `06`.
  Fix: `04`. Recovery: `07`–`11`.
- **AI assistance:** I used Claude (Anthropic) to help trace the code path and to draft the fix, regression tests,
  evidence scripts and report wording. I checked the cause directly in `worker.ts` and `repository.ts`, compared
  every claim in this report with the evidence files, and ran all commands myself.
- **Limitations:**
  - Local lab verification only. Production state, release and customer confirmation are not verified.
  - Run on [[FILL OS]]; the packet validated macOS only.
  - The completion guard is covered by code review, not a dedicated test.
  - No concurrency testing.
