# Verification

## Automated checks
- `python -m pytest -q intelligence`: 11 tests cover extraction spans, account-vs-phone
  ambiguity, normalization, synthetic gold quality, R1–R6 positive/negative cases,
  public suppression, case-link exclusion, determinism, empty graphs, sidecar contract.
- `mvn -f backend/pom.xml test`: 8 tests cover conservative resolution, hard-ID merge,
  reversible reconstruction, evidence linkage, identifier validation, HTML escaping,
  CORS, bounded bodies, UTF-8, malformed JSON, rate limits, row isolation and duplicates.
- `cd frontend && pnpm build`: strict TypeScript and production Vite build.
- `python scripts/generate_demo.py` then `git diff --exit-code -- data/demo`:
  reproducible seeded output, including 18 independent gold narratives.
- `python scripts/verify_demo.py`: clean reset → raw demo load → graph → analyze twice
  → ground truth → all read endpoints → paths → HTML report → duplicates/CSV/errors
  → accept/undo merge → final clean reset/load/analyze/report.

## Measured first integrated run (2026-09-18)
121 records; 146 nodes; 313 edges; 961 evidence references; R1–R6 all detected.
22 alerts, including one suppressed public/service-number alert.
Local warm load 1.169 s; analysis 0.768 s. These are observations, not an SLA.
Gold set: precision 1.000, recall 1.000; TP 27, FP 0, FN 0, 18 samples.
These template-based synthetic measurements do not establish real-world performance.

## Container evidence
GitHub Actions builds all four Compose services, runs PostgreSQL 16, and executes
the same black-box rehearsal through Nginx. Both jobs passed in
[run 35376781394](https://github.com/Avansh2006/NEXUS/actions/runs/35376781394).
Later commits receive the same checks. Current status is on the repository Actions tab.
Local Docker is unavailable; local rehearsal uses the explicitly documented H2 profile.

## Browser rehearsal
Check persistent synthetic banner, no blank/error overlay, no browser exceptions.
Reset → Load demo → see case islands → Analyze Network → select shared phone.
Verify entity/case filters, search-to-jump, 1–2 hop focus, source FIR highlights,
alerts including suppression, communities, timeline, paths with evidence, report download.
Verify collapsed navigation retains accessible labels and visible keyboard focus.
Screenshots and recorded fallback are local artifacts described in DEMO_GUIDE.

## Known test limits
No representative real FIR corpus, fuzzy-resolution accuracy benchmark, exhaustive
browser automation suite, load/concurrency stress test, or third-party penetration test.
Source validation tests are representative; not every possible malformed CSV is covered.
Visual graph layout is randomized; analysis metrics, memberships and alerts are deterministic.
