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
  status: "MATCH_CANDIDATE" | "NO_MATCH" | "NO_FACE_DETECTED" | "MULTIPLE_FACES" | "LOW_QUALITY" | "EMPTY_GALLERY";
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

// ==========================================
// Investigation Intelligence Suite Types
// ==========================================

export interface ReplayDelta {
  nodesAdded: string[];
  edgesAdded: string[];
  alertsTriggered: string[];
}

export interface ReplayCumulative {
  nodeCount: number;
  edgeCount: number;
  alertCount: number;
}

export interface ReplayStep {
  step: number;
  timestamp: string;
  recordId: string;
  kind: string;
  caseId: string;
  summary: string;
  delta: ReplayDelta;
  cumulative: ReplayCumulative;
}

export interface ReplayResponse {
  steps: ReplayStep[];
  totalSteps: number;
  graphAtStep: Graph | null;
}

export interface WhatIfRequest {
  excludeSources?: string[];
  excludeIdentifiers?: string[];
  excludeDecisions?: string[];
  excludeNodes?: string[];
}

export interface WhatIfDelta {
  removedNodes: Entity[];
  addedNodes: Entity[];
  removedEdges: Edge[];
  addedEdges: Edge[];
  affectedAlerts: Alert[];
  connectivityChanges: string[];
}

export interface WhatIfResponse {
  canonicalGraphUnchanged: boolean;
  excludedCount: number;
  summary: string;
  delta: WhatIfDelta;
  simulatedGraph: Graph;
}

export type ContradictionRuleId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";
export type ContradictionReviewStatus = "PENDING" | "ACKNOWLEDGED" | "RESOLVED" | "FLAGGED_FALSE_POSITIVE" | "UNDER_INVESTIGATION";

export interface Contradiction {
  id: string;
  ruleId: ContradictionRuleId;
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  entityIds: string[];
  evidenceIds: string[];
  sourceRecordIds: string[];
  reviewStatus: ContradictionReviewStatus;
  reviewNotes: string;
  reviewedBy: string;
  reviewedAt: string;
}

export interface ContradictionReview {
  id: string;
  ruleId: string;
  status: ContradictionReviewStatus;
  notes: string;
  author: string;
  updatedAt: string;
}

export interface ContradictionReviewRequest {
  status: ContradictionReviewStatus;
  notes: string;
}

export interface EvidenceDetail {
  evidenceId: string;
  sourceRecordId: string;
  sourceKind: string;
  caseId: string;
  timestamp: string;
  confidence: number;
  rawExcerpt: string;
  rationale: string;
}

export interface EvidenceTrailStep {
  sourceNode: Entity;
  targetNode: Entity;
  edge: Edge;
  evidence: EvidenceDetail[];
}

export interface EvidenceTrailPath {
  pathIndex: number;
  totalHops: number;
  steps: EvidenceTrailStep[];
  pathSummary: string;
}

export interface EvidenceTrailResponse {
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  paths: EvidenceTrailPath[];
  chainSummary: string;
}

export interface InvestigationGap {
  id: string;
  category: "UNRESOLVED_IDENTIFIER" | "DEAD_END_LEAD" | "UNVERIFIED_ASSET" | "SINGLE_SOURCE_RISK" | "TEMPORAL_BLINDSPOT";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  entityIds: string[];
  suggestedActions: string[];
}

export interface GapsResponse {
  gaps: InvestigationGap[];
  totalGaps: number;
  gapsByCategory: Record<string, number>;
}

export interface NetworkChange {
  id: string;
  timestamp: string;
  trigger: string;
  changeType: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  affectedEntities: string[];
  previousState: string;
  newState: string;
}

export interface NetworkChangesResponse {
  changes: NetworkChange[];
  totalChanges: number;
  changesByType: Record<string, number>;
}
export interface AuditVerificationResponse {
  valid: boolean;
  entriesChecked?: number;
  entriesVerified?: number;
  genesisHash?: string;
  headHash?: string;
  verifiedAt?: string;
  firstBrokenEntry?: number | string | null;
  brokenAtIndex?: number;
  reason?: string;
}

export interface DossierRequest {
  graphImage?: string;
  sections?: string[];
  simulationMode?: "canonical" | "simulation" | "overlay";
  whatIfData?: WhatIfResponse;
  evidenceTrail?: EvidenceTrailResponse;
}

// Multimodal Evidence Fusion types
export interface EvidenceAsset {
  id: string;
  caseId: string;
  fileName: string;
  mediaType: "DOCUMENT" | "AUDIO" | "IMAGE" | "VIDEO";
  mimeType: string;
  fileSize: number;
  fileHash: string;
  storagePath: string;
  analysisStatus: "PENDING" | "ANALYZED" | "FAILED";
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface EvidenceItem {
  id: string;
  assetId: string;
  itemType:
    | "DOCUMENT_PAGE"
    | "DOCUMENT_LINE"
    | "AUDIO_TRANSCRIPT"
    | "AUDIO_SEGMENT"
    | "VISUAL_EMBEDDING"
    | "EXTRACTED_ENTITY";
  pageOrFrame: number;
  timestampStart: number;
  timestampEnd: number;
  speaker: string;
  rawText: string;
  confidence: number;
  embedding?: number[];
  modelName: string;
  provenance: Record<string, any>;
  createdAt: string;
}

export interface VisualMatchLead {
  matchAssetId: string;
  matchCaseId: string;
  matchFrameIndex: number;
  matchTimestamp: number;
  similarity: number;
  similarityScore: number;
  similarityDisplay: string;
  leadDisclaimer: string;
  thumbnail: string;
  provenance: Record<string, any>;
}

export interface VisualSearchResponse {
  matches: VisualMatchLead[];
  totalMatches: number;
  threshold: number;
  disclaimer: string;
}

export interface EvidenceReviewDecision {
  id: string;
  itemId: string;
  decision: "PENDING" | "ACCEPTED" | "REJECTED" | "CORROBORATED";
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
}

