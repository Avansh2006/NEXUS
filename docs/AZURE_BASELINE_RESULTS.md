# Azure baseline verification — 2026-09-23

Verified on the newly created `nexus-deva-test-vm` in Animesh's subscription,
using branch `feat/deva` and application source from commit
`0a9ec84` plus the new test tooling. The source revision is also recorded in
the collected artifacts. This is an existing-application baseline, not a
claim that the feature-completion design has been implemented.

| Check | Result |
| --- | --- |
| Python/FastAPI unit and contract tests | 15 passed, 2 dependency deprecation warnings |
| Java unit and API tests | 11 passed, no failures/errors/skips |
| TypeScript check and Vite production build | Passed |
| Docker Compose build and startup | Passed with PostgreSQL 16 |
| Black-box API/demo rehearsal | Passed |
| Playwright browser tests | 5 passed in 49.0 seconds |
| Debugger JSON configuration parsing | Passed locally and on the VM |
| Test-runner shell syntax | Passed on the VM |
| Interactive debugger breakpoint attachment | Not tested |

The browser run covered the investigation-to-report journey, upload row
errors/deduplication/escaping, mobile/reduced-motion layout, 3D/Copilot/report
extensions, and incoming FIR ingestion/retraction. The demo rehearsal observed
22 alerts (one suppressed), 1.613-second load, and 0.874-second analysis on its
synthetic fixture. These are observations, not performance guarantees.

Vite reported a large-bundle warning (approximately 1.46 MB minified main JS).
It did not fail the build and has not been optimized in this infrastructure
change. Passing baseline tests does not establish production security or
representative real-world extraction quality.

## Evidence

- VM logs and exit codes: `/home/nexus/NEXUS/artifacts/azure/`.
- Local archive: `artifacts/azure/nexus-test-results.tar.gz`.
- Extracted local logs, screenshots, videos, and report:
  `artifacts/azure/collected/artifacts/`.
- Extracted Java test reports:
  `artifacts/azure/collected/backend/target/surefire-reports/`.
- SHA-256 of the archive, verified equal before and after transfer:
  `1a838f3851a433d76608a8aa5d09d3ca554ba4a3cd1aa0e5694ecdd153b72cb2`.

All six test-runner stages returned exit code zero. The VM remains available
through SSH; NEXUS is bound to loopback, and the only custom inbound network
rule allows SSH from the provisioning client. Daily shutdown was verified
enabled for 18:30 UTC (midnight India time).

## Remaining work

The authentication changes, additional source types, investigator workflow,
timeline playback, removal simulation, exports, and extraction improvements
in the completion design remain unimplemented. This change delivers the
dedicated test infrastructure, reproducible baseline runner, debugger
configurations, and baseline evidence. Git author identity is still unset,
so these repository changes have not been committed or pushed.
