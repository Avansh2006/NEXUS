export type EntityType =
  | "Person"
  | "Phone"
  | "Account"
  | "Location"
  | "Vehicle"
  | "Organization"
  | "Case"
  | "SocialHandle";
export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  properties: {
    support?: EvidenceSupport;
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
    support?: EvidenceSupport;
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
    sourceReliability?: string;
    informationCredibility?: number;
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
    support?: EvidenceSupport;
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
  multilingualSynthetic?: {
    samples: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    strictPrecision: number;
    strictRecall: number;
    strictF1: number;
    scope: string;
  };
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
  SocialHandle: "#d09dec",
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
export const API_BASE =
  (import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, "")
    : "") + "/api";

export interface EvidenceSupport {
  level: "Low" | "Medium" | "High";
  recordCount: number;
  sourceKindCount: number;
  minimumExtractionConfidence: number;
  credibilityAssessed: boolean;
  lowCredibility: boolean;
  explanation: string;
}
export interface Session {
  token: string;
  username: string;
  role: "ADMIN" | "INVESTIGATOR" | "VIEWER";
  expiresAt: string;
}
export function getSession(): Session | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem("nexus.session") ?? "null");
    if (value && typeof value === "object") {
      const candidate = value as Partial<Session>;
      if (typeof candidate.token === "string" && candidate.token.length > 0 && candidate.token.length <= 8192 &&
          typeof candidate.username === "string" && candidate.username.trim().length > 0 && candidate.username.length <= 80 &&
          ["ADMIN", "INVESTIGATOR", "VIEWER"].includes(candidate.role ?? "") &&
          typeof candidate.expiresAt === "string" && Number.isFinite(Date.parse(candidate.expiresAt))) return candidate as Session;
    }
  } catch { /* Discard malformed storage and allow sign-in. */ }
  sessionStorage.removeItem("nexus.session");
  return null;
}
export function setSession(session: Session | null, expired = false) {
  if (session) sessionStorage.setItem("nexus.session", JSON.stringify(session));
  else sessionStorage.removeItem("nexus.session");
  window.dispatchEvent(
    new CustomEvent("nexus-session", { detail: { expired } }),
  );
}
export async function apiRaw(path: string, body?: unknown): Promise<Response> {
  const token = getSession()?.token;
  const response = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && token && getSession()?.token === token)
      setSession(null, true);
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      response.status === 403
        ? "Your role does not permit this action."
        : (error?.error?.message ?? `Request failed (${response.status})`),
    );
  }
  return response;
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  return (await apiRaw(path, body)).json() as Promise<T>;
}
export async function download(path: string, filename: string) {
  const response = await apiRaw(path);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const token = getSession()?.token;
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!response.ok) {
    if (response.status === 401 && token && getSession()?.token === token)
      setSession(null, true);
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      response.status === 403
        ? "Your role does not permit this action."
        : (error?.error?.message ?? `Request failed (${response.status})`),
    );
  }
  return response.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const token = getSession()?.token;
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401 && token && getSession()?.token === token)
      setSession(null, true);
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      response.status === 403
        ? "Your role does not permit this action."
        : (error?.error?.message ?? `Request failed (${response.status})`),
    );
  }
  return response.json() as Promise<T>;
}

export interface DetectedFaceBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FaceQuality {
  sharpness: number;
  contrast: number;
  brightness: number;
  resolution_score: number;
  overall_quality: number;
  is_cctv_quality: boolean;
  notes: string[];
}

export interface DetectedFace {
  faceIndex: number;
  score: number;
  thumbnail: string;
  bbox?: DetectedFaceBBox;
  quality?: FaceQuality;
}

export interface PersonContext {
  id: string;
  canonicalId: string;
  label: string;
  type: string;
  referencePhoto?: string;
  faceEnrolledAt?: string;
  qualityScore?: number;
  roles?: string[];
  corroboration?: string;
  cases?: string[];
  phones?: string[];
  accounts?: string[];
  vehicles?: string[];
  locations?: string[];
  associates?: Array<{ id: string; label: string; relation: string }>;
  relationships?: Array<{ type: string; target: string; targetType: string }>;
  activeAlertsCount?: number;
  aliases?: string[];
}

export interface FaceCandidate {
  personNodeId: string;
  similarity: number;
  status: "STRONG_CANDIDATE" | "CANDIDATE";
  model: string;
  faceId: string;
  person: PersonContext;
  quality?: Record<string, unknown>;
}

export interface VisionSearchResult {
  status: "MATCH_CANDIDATE" | "NO_MATCH" | "NO_FACE_DETECTED" | "MULTIPLE_FACES" | "LOW_QUALITY";
  facesDetected: number;
  threshold: number;
  model: string;
  imageHash: string;
  matches: FaceCandidate[];
  faces: DetectedFace[];
  alignedThumbnail?: string;
}

export interface PersonFace {
  id: string;
  personNodeId: string;
  imageHash: string;
  modelName: string;
  modelVersion: string;
  createdAt: string;
  sourceRecordId?: string;
  qualityScore: number;
  metadata?: {
    filename?: string;
    thumbnail?: string;
    bbox?: DetectedFaceBBox;
    quality?: FaceQuality;
    personLabel?: string;
  };
}

export interface FaceDecision {
  id: string;
  personNodeId: string;
  decision: "CONFIRMED" | "REJECTED";
  similarity: number;
  modelName: string;
  imageHash: string;
  notes: string;
  author: string;
  createdAt: string;
}

export interface FaceDecisionRequest {
  personNodeId: string;
  decision: "CONFIRMED" | "REJECTED";
  similarity: number;
  imageHash: string;
  modelName: string;
  notes: string;
}

