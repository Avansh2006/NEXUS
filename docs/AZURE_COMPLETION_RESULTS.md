# Azure completion verification — 2026-09-23

The approved prototype feature scope was implemented on `feat/deva` and tested
on the newly provisioned `nexus-deva-test-vm` in Animesh's subscription. The
PostgreSQL-backed Compose project is `nexus-deva-test`, in `/home/nexus/NEXUS`.

## Reproducible source

The final application/test snapshot is retained locally as
`.tools/azure/nexus-final.tar.gz`, SHA-256:

```text
d8125f6429921ecf5e78031983ff19c73df4077c84282fd835e581b29b7ac7c7
```

This archive includes the final database configuration fixes and their regression
tests. Only delivery documentation/checklist changes follow this tested snapshot.
The source hash is also recorded in `artifacts/azure/source-revision.txt`.

## Coverage

| Final check | Result |
| --- | --- |
| Python unit/contract/tooling tests | 25 passed, 2 dependency warnings |
| Java unit/API/workflow/configuration tests | 42 passed; no failures, errors or skips |
| TypeScript and Vite production build | Passed |
| PostgreSQL Compose build/start | Passed |
| Demo rehearsal and authenticated feature checks | Passed |
| Database/API restart and persistence | Passed |
| Engine unavailable and recovered responses | Passed; recovery converged in 8 polls / 7.06 seconds |
| Playwright browser suite | 15 passed in 1.4 minutes; no retries |
| Overall runner | Exit 0; all 14 recorded stages exit 0 |

Collected evidence: `artifacts/azure/nexus-completion-results.tar.gz`, SHA-256
`048af4e38c28695e8ec89efbc9019284bc21b836f6f0c22cac463924452d0740`.
Extracted logs, JUnit XML, browser report, screenshots/video and final Compose status
are in `artifacts/azure/completion-collected/`. The VM retains the original results.

The final review caught malformed database URL credential logging and an ignored
connection-timeout property. Both were corrected; the two added regression tests
failed before the fix and pass in the final 42-test Java suite.

- Real login and role boundaries, token expiry/claims, request IDs, malformed
  requests, body/rate guards, sanitized errors, and attributed audit verification.
- Additional narrative sources, Hindi/Hinglish and social handles, original
  evidence offsets including emoji, credibility validation, and support rules.
- Notes, per-user watchlists and optimistic triage, including merge/undo visibility,
  concurrent audit writes, and persistence across database and API restart.
- Structural simulation without graph mutation, formula-safe CSV, parseable GraphML,
  reports and deterministic graph-data digest.
- Browser login/expiry/downloads, delayed authentication responses, ingestion,
  workflow, playback/filter interaction, quality/audit failure displays,
  mobile/reduced-motion layout, 3D/copilot, and incoming-record retraction.
- Engine shutdown produces explicit unavailable responses; recovery checks wait
  for authenticated API diagnostics to confirm the restarted service is reachable.

## Debugging and limits

VS Code browser, Python and Java debugger configurations parse successfully locally
and on the VM. All PowerShell launch scripts and the Bash verification runner passed
syntax checks. Interactive editor breakpoint attachment was **not tested**.

The synthetic-data generator reproduced the committed demo with no content diff.
Python reported two dependency deprecation warnings; Vite reported a large-bundle
warning. These did not fail verification. Small synthetic extraction measurements
are separate from frozen held-out results and do not establish general accuracy.

Playwright traces are disabled by default because they can capture credentials;
the collected final artifacts exclude trace ZIPs. Login credentials are kept in
ignored `.tools/azure/credentials.json`, never in this report or Git. See
[VM access](AZURE_TEST_VM.md), [debugging](DEBUGGING.md), and the
[feature inventory and limitations](FINAL_FEATURES.md). Production SSO, tenant
isolation, live data integrations and formal security certification remain outside
the approved prototype scope.
