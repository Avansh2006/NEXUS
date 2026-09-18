# API contract

Base /api. JSON unless stated. Errors: `{error:{code,message}}`; validation 400,
unknown ID 404, body too large 413, rate limit 429, unavailable engine 503.
IDs are opaque strings. POST responses 200; partial row success is 200 with errors.
No stack traces. All endpoints operate on the local synthetic investigation.

## Types
Node: `{id,type,label,properties:{caseIds,evidenceIds,...}}`.
Edge: `{id,source,target,type,properties:{caseIds,evidenceIds,firstSeen,lastSeen,events}}`.
Graph: `{nodes,edges,evidence,records,analysis,analyzed,suggestions}`.
Evidence: `{id,recordId,entityId,edgeId,start,end,row,raw,confidence}` (nullable spans).
Alert: `{id,ruleId,entityIds,evidenceIds,explanation,suppressed}`.
Metrics: `{entityId,degree,betweenness,caseComponent,influence,community}`.

| Method/path | Request | Response and purpose | Errors |
|---|---|---|---|
| POST /data/fir | `{records:[{caseId,text,date,crimeType}]}` or `{format:"csv",content:"..."}` | `{accepted,duplicates,errors:[{row,message}]}` ingest | 400/413/429/503 |
| POST /data/cdr | `{records:[{caseId,from,to,timestamp,duration,location}]}` or CSV envelope | ingestion result | 400/413/429 |
| POST /data/transactions | `{records:[{caseId,from,to,timestamp,amount}]}` or CSV envelope | ingestion result | 400/413/429 |
| POST /analyze | `{}` | analysis `{metrics,alerts,communities,counts}` | 429/503 |
| GET /graph | none | Graph, empty before load | 503 |
| GET /network/{entityId} | `?hops=1` (1–2) | Graph subset around entity | 400/404 |
| GET /entities/{id} | none | `{node,edges,evidence,records,alerts}` | 404 |
| GET /entities/search | `?q=` (max 100 chars) | Node[] case-insensitive match | 400 |
| GET /clusters | none | `{id,entityIds}[]` | — |
| GET /case-links | none | `{caseIds,entityIds,evidenceIds,explanation}[]` shared non-public identifier leads | — |
| GET /influencers | none | Metrics[] descending influence | — |
| GET /suspicious-patterns | none | Alert[] including suppressed | — |
| GET /timeline/{entityId} | none | `{edgeId,timestamp,evidenceId,type}[]` sorted | 404 |
| GET /paths | `?from=&to=` | `{nodeIds,edges}` shortest unweighted path | 404 (ID/no path) |
| GET /link-suggestions | none | `{id,left,right,score,reason,status}[]` name review | — |
| POST /link-suggestions/{id}/accept | `{}` | Graph after provenance-preserving merge | 404/409 |
| POST /link-suggestions/{id}/reject | `{}` | Graph after reject or undo | 404/409 |
| POST /reports | `{graphImage?:"data:image/png;base64,..."}` | printable `text/html` evidence report | 400/413 |
| POST /demo/load | `{}` | ingestion counts; idempotent raw seed load | 503 |
| POST /demo/reset | `{}` | `{reset:true}` clear investigation | — |
| GET /quality | none | gold-set micro precision/recall and counts | 503 |
| GET /audit | none | recent `{action,createdAt}` events | — |
| GET /health | none | `{status:"ok"}` API liveness | — |

Sidecar: POST /extract `{text,recordId}` → `{entities:[{type,raw,start,end,
confidence,normalized,role}]}`. POST /analyze Graph → analysis.
GET /quality evaluates committed gold labels. GET /health returns liveness.
Limits: 2 MiB request, 500 rows/request, 10000 characters/FIR; bounded graph 1500
nodes/10000 edges, 30 mutations/minute/client. UTF-8 CSV/JSON/TXT client decoding.
