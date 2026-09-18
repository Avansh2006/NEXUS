# Investigator workbench

NEXUS: graphite navigation rail, light document surfaces, dark graph canvas,
teal emphasis, amber human-review leads. Typography uses installed system fonts.
Persistent synthetic-data banner. No remote fonts or external demo resources.

Navigation: Dashboard, Data Ingestion, Investigation Workspace, Alerts, Clusters,
Timeline, Reports. Entity and case details share the workspace inspector.
Empty state offers Load demo. Real request status and errors remain visible.

Workspace: statistics, search, type/case filters, crime/date/location filters;
graph center; legend; inspector with case memberships, influence breakdown,
evidence and highlighted FIR spans. Focus at 1–2 hops. Search jumps to selection.
Node fill = entity type, border = community, size = influence. Top 80 + alert nodes
initially; Expand all within bounded demo graph. Paths highlight evidence-backed hops.

Analyze transforms case-specific ghost islands to canonical graph. Transition
under 1.5 seconds; honors reduced motion. Counts come from persisted graph.
Alert click selects related entity and opens evidence. Suppressed alerts remain
visible with reason. Review controls accept/reject/undo possible name matches.

Reports include source/evidence tables and optional current graph PNG; print dialog
can save PDF. Buttons have text/accessible names; forms have labels; keyboard focus
is visible. Errors use role=alert and processing status uses aria-live.
