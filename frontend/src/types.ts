export type EntityType =
  | "Person"
  | "Phone"
  | "Account"
  | "Location"
  | "Vehicle"
  | "Organization"
  | "Case";
export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  properties: {
    caseIds: string[];
    evidenceIds: string[];
    roles?: string[];
    crimeType?: string;
    corroboration?: string[];
  };
}
export interface Event {
  timestamp: string;
  evidenceId: string;
  amount: number;
}
export interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: {
    caseIds: string[];
    evidenceIds: string[];
    firstSeen: string;
    lastSeen: string;
    events: Event[];
  };
}
export interface Evidence {
  id: string;
  recordId: string;
  entityId: string | null;
  edgeId: string | null;
  start: number | null;
  end: number | null;
  row: number;
  raw: string;
  confidence: number;
}
export interface Extraction {
  type: string;
  raw: string;
  start: number;
  end: number;
  confidence: number;
  normalized: string;
  role: string;
}
export interface Source {
  id: string;
  kind: string;
  payload: {
    caseId: string;
    text?: string;
    date?: string;
    crimeType?: string;
    from?: string;
    to?: string;
    timestamp?: string;
    amount?: number;
    duration?: number;
    location?: string;
    _entities?: Extraction[];
  };
}
export interface Alert {
  id: string;
  ruleId: string;
  entityIds: string[];
  evidenceIds: string[];
  explanation: string;
  suppressed: boolean;
}
export interface Metric {
  entityId: string;
  degree: number;
  betweenness: number;
  caseComponent: number;
  influence: number;
  community: number;
  tacticalRole?: string;
  roleTitle?: string;
  roleCriteria?: string;
  roleHypothesis?: string;
}
export interface Community {
  id: number;
  entityIds: string[];
}
export interface Telemetry {
  nodeCount: number;
  edgeCount: number;
  betweennessMode: string;
  kSamples: number;
  communityCount: number;
  computationTimeMs?: number;
  breakdownMs?: {
    communities: number;
    centrality: number;
  };
}
export interface Analysis {
  metrics?: Metric[];
  alerts?: Alert[];
  communities?: Community[];
  telemetry?: Telemetry;
  caseLinks?: {
    caseIds: string[];
    entityIds: string[];
    evidenceIds: string[];
    explanation: string;
  }[];
  counts?: {
    records: number;
    entities: number;
    relationships: number;
    casesLinked: number;
  };
}
export interface Suggestion {
  id: string;
  left: string;
  right: string;
  score: number;
  reason: string;
  status: string;
}
export interface Graph {
  nodes: Entity[];
  edges: Edge[];
  evidence: Evidence[];
  records: Source[];
  analysis: Analysis;
  analyzed: boolean;
  suggestions: Suggestion[];
}
export interface Quality {
  precision: number;
  recall: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  samples: number;
  scope: string;
  heldoutTest?: {
    samples: number;
    strictPrecision: number;
    strictRecall: number;
    strictF1: number;
    lenientPrecision: number;
    lenientRecall: number;
    lenientF1: number;
  };
  heldoutDev?: {
    samples: number;
    strictPrecision: number;
    strictRecall: number;
    strictF1: number;
    lenientPrecision: number;
    lenientRecall: number;
    lenientF1: number;
  };
}
export interface IngestResult {
  accepted: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}
export interface IncomingResult {
  status: string;
  caseId: string;
  latencyMs: number;
  newNodes: string[];
  crossCaseLinks: Array<{
    entityId: string;
    label: string;
    type: string;
    cases: string[];
  }>;
  graph?: Graph;
  message?: string;
}
export interface PathResult {
  nodeIds: string[];
  edges: Edge[];
}
export const colors: Record<EntityType, string> = {
  Person: "#60c5b3",
  Phone: "#e5b45b",
  Account: "#ad9ff0",
  Location: "#699ee5",
  Vehicle: "#ea8998",
  Organization: "#e8d5a4",
  Case: "#c6d0d1",
};
export const emptyGraph: Graph = {
  nodes: [],
  edges: [],
  evidence: [],
  records: [],
  analysis: {},
  analyzed: false,
  suggestions: [],
};
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      error?.error?.message ?? `Request failed (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}
