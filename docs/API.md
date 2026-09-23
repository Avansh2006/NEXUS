# API contract

Base path: `/api`. JSON unless indicated. All investigation routes require
`Authorization: Bearer <token>`. Only `GET /health` and `POST /auth/login` are public.
IDs are opaque; URL-encode them in path parameters. This API operates on synthetic data.

Errors use `{error:{code,message}}`: validation 400, authentication 401, permission 403,
unknown identifier 404, stale workflow conflict 409, oversized body 413, throttling 429,
and unavailable intelligence service 503. Responses carry a server-generated
`X-Request-ID`; retain that ID when checking service logs. Ingestion partial success
returns 200 with individual row errors. See [security](SECURITY.md) for controls.

## Authentication and roles

| Method/path | Request | Response |
| --- | --- | --- |
| POST /auth/login | `{username,password}` | `{token,username,role,expiresAt}`; expiry is an ISO instant |
| GET /auth/me | none | `{username,role}` |
| GET /health | none | `{status:"ok"}`; API liveness only |
| GET /diagnostics | none, ADMIN only | `{status,database:{status},intelligence:{status},versions:{java,api,intelligence}}` |

Tokens expire after one hour by default. VIEWER can read/export and POST `/reports`
and `/what-if/remove`; INVESTIGATOR also performs ingestion, analysis, resolution and
workflow mutations. ADMIN additionally owns all `/demo/*` routes and `/diagnostics`.
There are no role-header overrides or public default credentials.

## Graph and evidence types

- Node: `{id,type,label,properties:{caseIds,evidenceIds,support,...}}`.
  Types include Person, Phone, Account, Location, Vehicle, Organization, Case and SocialHandle.
- Edge: `{id,source,target,type,properties:{caseIds,evidenceIds,firstSeen,lastSeen,events,support}}`.
- Graph: `{nodes,edges,evidence,records,analysis,analyzed,suggestions}`.
- Evidence: `{id,recordId,entityId,edgeId,start,end,row,raw,confidence}`; spans may be null.
  Client-facing offsets address the original JavaScript/Java UTF-16 source string.
- Alert: `{id,ruleId,entityIds,evidenceIds,explanation,suppressed}`.
- Support: `{level,recordCount,sourceKindCount,minimumExtractionConfidence,
  credibilityAssessed,lowCredibility,explanation}`.

Support is a transparent evidence summary, not truth probability. High requires at least
2 independent records, 2 source kinds, minimum confidence 0.9 and all credibility assessed
without low grades. Medium requires 2 records, minimum confidence 0.8 and no low grades.
Otherwise support is Low. Reliability E/F or information credibility 5/6 is low; missing
grades are unassessed. Repeated spans from one record do not count as independent support.

## Sources, analysis and navigation

| Method/path | Request or query | Response |
| --- | --- | --- |
| POST /data/{kind} | `{records:[...]}` or `{format:"csv",content:"..."}` | `{accepted,duplicates,errors:[{row,message}]}` |
| POST /analyze | `{}` | Analysis, including metrics/alerts/communities/counts |
| GET /graph | none | Full Graph |
| GET /network/{id} | `hops=1` or `2` | Graph subset |
| GET /entities/{id} | none | `{node,edges,evidence,records,alerts}` |
| GET /entities/search | `q`, maximum 100 characters | Node array |
| GET /clusters | none | `{id,entityIds}[]` |
| GET /case-links | none | `{caseIds,entityIds,evidenceIds,explanation}[]` |
| GET /influencers | none | Descriptive metrics array |
| GET /suspicious-patterns | none | Alert array, including suppressed leads |
| GET /timeline/{id} | none | Sorted relationship events |
| GET /paths | `from`, `to` | `{nodeIds,edges}` shortest unweighted path |
| GET /link-suggestions | none | `{id,left,right,score,reason,status}[]` |
| POST /link-suggestions/{id}/accept | `{}` | Graph after reviewed merge |
| POST /link-suggestions/{id}/reject | `{}` | Graph after reject/undo |

Narrative kinds are `fir`, `criminal-history`, `intel-report`, `surveillance-report`.
Each requires `caseId`, UTC ISO `date`, and `text`; `crimeType` is optional.
Optional `sourceReliability` is A-F and `informationCredibility` is 1-6. Invalid supplied
grades reject that row. Narratives remain source records; social handles require
explicit platform context and use normalized platform/handle identity.

`cdr` rows require `caseId,from,to,timestamp,duration` with optional `location`.
`transactions` rows require `caseId,from,to,timestamp,amount`. Numeric values must be
finite and nonnegative. Source batches preserve original text and independent row errors.
Limits: 2 MiB POST body, 500 rows, 10,000 characters per narrative; analysis is bounded
at 1,500 nodes/10,000 edges. Authenticated POST requests are limited to 30/minute/account;
login attempts have a separate 30/minute/remote-address bucket.

## Persistent workflow

| Method/path | Request | Response |
| --- | --- | --- |
| GET /workflow | none | `{notes:Note[],watchlist:string[],triage:Triage[]}` |
| GET /entities/{id}/notes | none | Note array, resolving active merge aliases |
| POST /entities/{id}/notes | `{text}` | Created Note |
| GET /watchlist | none | Current user's watched entity IDs |
| POST /entities/{id}/watchlist | `{watched:boolean}` | `{watched:boolean}`; idempotent |
| POST /alerts/{id}/triage | `{status,version}` | Updated Triage |

`Note = {id,entityId,text,author,createdAt}`; text is 1-4,000 characters.
`Triage = {alertId,status,version,author,updatedAt}`. Status is exactly New,
Under Review, Verified, or Dismissed. Use version 0 for an untouched alert, then the
last returned version. A stale update returns 409: refresh before retrying.
Verified means reviewed, not proof of guilt. Unknown IDs are rejected.

Workflow is separate from replaceable graph analysis. Stable-ID notes/watchlists/triage
survive reanalysis. Notes retain original entity IDs while canonical reads expose them
during a merge. Undo preserves original ownership. Reset clears workflow; obsolete
alert state is omitted from active workflow results.

## Simulation and output

`POST /what-if/remove` accepts `{entityIds:string[]}` with 1-20 unique existing non-Case IDs:

```json
{
  "before": {"components": 2, "largestComponent": 4, "isolatedNodes": 1},
  "after": {"components": 3, "largestComponent": 2, "isolatedNodes": 2},
  "removedEdges": 2,
  "articulationPoints": ["example-id"],
  "removedEntityIds": ["example-id"]
}
```

These quantities describe undirected connectivity excluding Case nodes and
CONNECTED_TO_CASE edges. The endpoint does not mutate sources, graph, or analysis.
The example illustrates response shape, not a measured demo result.

| Method/path | Content |
| --- | --- |
| POST /reports | Optional `{graphImage:"data:image/png;base64,..."}`; printable `text/html` |
| GET /exports/nodes.csv | `text/csv`, attachment `nodes.csv` |
| GET /exports/edges.csv | `text/csv`, attachment `edges.csv` |
| GET /exports/graph.graphml | `application/graphml+xml`, attachment `graph.graphml` |

Exports include stable graph/evidence identifiers and support fields. CSV is escaped
and formula prefixes neutralized; GraphML uses declared keys, namespaces and XML escaping.
Report PNG data URLs must be below 1.5 MB. Full graph data is exported irrespective of
client filters/playback; an included report image reflects the displayed view.

## Demo, quality and audit

ADMIN routes: POST `/demo/load`, `/demo/reset`, `/demo/incoming`,
`/demo/incoming/remove`, each with `{}`. Reset clears investigation and workflow.
Repeated incoming loads may return a no-op status without new-node/link arrays;
clients should restore current state from `/graph`.

`GET /quality` returns synthetic precision/recall/counts/scope, optional
`heldoutTest`/`heldoutDev` strict and lenient metrics, and `multilingualSynthetic`:
`{samples,truePositives,falsePositives,falseNegatives,strictPrecision,strictRecall,
strictF1,scope}`. Hindi/Hinglish fixtures are a separate evaluation, not general
multilingual accuracy. Missing evaluations must not be presented as measured results.

`GET /audit` returns recent entries with `id,action,createdAt,userId,entityId,
payloadDigest,prevHash,entryHash`. `GET /audit/verify` returns
`{valid:true,entriesVerified,headHash}` or `{valid:false,brokenAtIndex,reason,...}`.
This checks stored chain consistency, not independent authenticity of source records.

The internal Python service exposes extraction, analysis, quality and health routes.
It is not the authenticated public API and must remain on the internal network.
