# Evidence index

Timestamps inside these files are **real execution times**, not the simulated policy clock used in
`CASE_REPORT.md`. Files were produced by the scripts in `../support/`, run from `starter/`.

| File | What it shows |
| --- | --- |
| `00-versions.txt` | Bun version, Node version and platform |
| `01-baseline-original-case.json` | Original `case-002` after the unpatched worker ran: detail, records, results, events, Maple control, isolation statuses |
| `02-repro-before-fix.json` | Isolated database: new POST of `fixtures/case-002.csv` with the unpatched code |
| `03-tests-before-fix.txt` | Full suite incl. new regression tests on unpatched code (regression tests fail) |
| `04-fix.diff` | The exact code change |
| `05-check-types-after-fix.txt` | `bun run check-types` after the fix |
| `06-tests-after-fix.txt` | Full suite after the fix (all pass) |
| `07-repro-after-fix.json` | Isolated database: same POST with the patched code |
| `08-pre-recovery.json` | Original `case-002` after restarting on patched code, before resume |
| `09-resume-case.txt` | Output of the approved `bun run resume-case` |
| `10-after-recovery.json` | Original `case-002` after the worker processed the resumed work |
| `11-recovery-verification.txt` | Automated comparison of 08 and 10 |
