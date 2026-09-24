import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScanFace,
  Upload,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  FileText,
  Phone,
  Car,
  CreditCard,
  MapPin,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Sliders,
  Eye,
  Layers,
  History,
  Info,
} from "lucide-react";
import { api, apiForm } from "./types";
import type {
  Graph,
  Session,
  VisionSearchResult,
  FaceCandidate,
  FaceDecision,
} from "./types";

interface SampleFixture {
  id: string;
  label: string;
  filename: string;
  description: string;
  dataUrl?: string;
  sizeBytes?: number;
}

interface VisualIdentitySearchProps {
  graph: Graph;
  session: Session;
  onNavigateToPerson: (personId: string) => void;
  onRefreshGraph?: () => Promise<unknown>;
}

export default function VisualIdentitySearch({
  graph,
  session,
  onNavigateToPerson,
  onRefreshGraph,
}: VisualIdentitySearchProps) {
  const canEdit = session.role !== "VIEWER";

  // File and input state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.60);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);

  // Execution & Progress state
  const [searching, setSearching] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>("");
  const [searchResult, setSearchResult] = useState<VisionSearchResult | null>(null);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // Gallery status & Fixtures
  const [enrolledCount, setEnrolledCount] = useState<number>(0);
  const [fixtures, setFixtures] = useState<SampleFixture[]>([]);
  const [decisions, setDecisions] = useState<FaceDecision[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "decisions">("search");

  // Decision Modal
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    candidate: FaceCandidate | null;
    action: "CONFIRMED" | "REJECTED";
    notes: string;
  }>({
    open: false,
    candidate: null,
    action: "CONFIRMED",
    notes: "",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load status, sample fixtures, and decision history
  const loadStatus = useCallback(async () => {
    try {
      const statusRes = await api<{ enrolledFacesCount: number }>("/vision/status");
      setEnrolledCount(statusRes.enrolledFacesCount ?? 0);
    } catch {
      // Backend may be initializing
    }
  }, []);

  const loadFixtures = useCallback(async () => {
    try {
      const fixList = await api<SampleFixture[]>("/vision/fixtures");
      setFixtures(fixList ?? []);
    } catch {
      // Non-fatal if fixtures endpoint not ready
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    try {
      const decList = await api<FaceDecision[]>("/vision/decisions");
      setDecisions(decList ?? []);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadFixtures();
    loadDecisions();
  }, [loadStatus, loadFixtures, loadDecisions, graph]);

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)/) && !file.name.match(/\.(jpe?g|png|webp)$/i)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size exceeds 10 MiB limit.");
      return;
    }
    setError("");
    setSelectedFile(file);
    setSelectedFaceIndex(null);
    setSearchResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

  // Load sample test fixture
  const handleLoadFixture = (fix: SampleFixture) => {
    if (!fix.dataUrl) return;
    try {
      setError("");
      setSearchResult(null);
      setSelectedFaceIndex(null);
      setPreviewUrl(fix.dataUrl);

      const file = dataUrlToFile(fix.dataUrl, fix.filename);
      setSelectedFile(file);
      setNotice(`Loaded sample test fixture: ${fix.label}`);
    } catch (err: any) {
      setError(`Failed to load fixture: ${err.message}`);
    }
  };

  // Seed demo face gallery
  const handleSeedDemo = async () => {
    try {
      setError("");
      setNotice("Enrolling reference faces for active demo personas…");
      const res = await api<{ enrolledCount: number; newlyEnrolled?: number }>("/vision/demo-enroll", {});
      if (res && typeof res.enrolledCount === "number") {
        setEnrolledCount(res.enrolledCount);
      }
      await loadStatus();
      await onRefreshGraph?.();
      setNotice(`Demo face gallery populated: ${res.enrolledCount} persona reference portraits enrolled.`);
    } catch (err: any) {
      setError(`Failed to seed gallery: ${err.message}`);
    }
  };

  // Execute Search
  const handleExecuteSearch = async (faceIdx?: number | null) => {
    if (!selectedFile) {
      setError("Please select or drop an image first.");
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");

    // Simulated animated multi-stage progress
    setProgressStage("Detecting faces in imagery (SCRFD-10G)...");
    const t1 = setTimeout(() => {
      setProgressStage("Aligning facial landmarks (112x112 affine warp)...");
    }, 450);
    const t2 = setTimeout(() => {
      setProgressStage("Generating normalized AdaFace signature...");
    }, 900);
    const t3 = setTimeout(() => {
      setProgressStage("Searching NEXUS identity gallery across enrolled Person nodes...");
    }, 1350);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("threshold", String(threshold));
      const targetIndex = faceIdx !== undefined ? faceIdx : selectedFaceIndex;
      if (targetIndex !== null && targetIndex >= 0) {
        formData.append("faceIndex", String(targetIndex));
      }

      const result = await apiForm<VisionSearchResult>("/vision/search", formData);
      setSearchResult(result);
      if (result.status === "MATCH_CANDIDATE") {
        setNotice(`Found ${result.matches.length} candidate match(es) meeting similarity threshold >= ${result.threshold.toFixed(2)}.`);
      } else if (result.status === "EMPTY_GALLERY") {
        setNotice("Face gallery is currently empty (0 enrolled identities). Seed demo gallery or enroll reference portraits.");
      } else if (result.status === "NO_MATCH") {
        setNotice(`Search complete: 0 enrolled identities met similarity threshold >= ${result.threshold.toFixed(2)}.`);
      } else if (result.status === "MULTIPLE_FACES") {
        setNotice(`${result.facesDetected} faces detected. Select a subject below to identify.`);
      } else if (result.status === "NO_FACE_DETECTED") {
        setError("No human face detected in the uploaded image.");
      }
    } catch (err: any) {
      setError(err.message || "Visual identity search request failed.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setSearching(false);
      setProgressStage("");
      loadStatus();
    }
  };

  // Submit Confirm / Reject Decision
  const handleSubmitDecision = async () => {
    if (!decisionModal.candidate) return;
    try {
      setError("");
      await api<FaceDecision>("/vision/decisions", {
        personNodeId: decisionModal.candidate.personNodeId,
        decision: decisionModal.action,
        similarity: decisionModal.candidate.similarity,
        imageHash: searchResult?.imageHash || "",
        modelName: decisionModal.candidate.model || "adaface_ir101_webface12m",
        notes: decisionModal.notes,
      });

      setNotice(
        `Decision recorded: ${decisionModal.action} for ${decisionModal.candidate.person.label}. Logged into tamper-evident audit ledger.`
      );
      setDecisionModal({ open: false, candidate: null, action: "CONFIRMED", notes: "" });
      await loadDecisions();
      await onRefreshGraph?.();
    } catch (err: any) {
      setError(`Failed to record decision: ${err.message}`);
    }
  };

  return (
    <div className="visual-identity-page flex flex-col gap-6 w-full max-w-7xl mx-auto pb-12">
      {/* Top Banner / System Notice */}
      <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1a4038] text-[#34d399] border border-[#2f5a4e]">
              <ScanFace size={13} /> ADAFACE IR-101 + SCRFD
            </span>
            <span className="text-xs text-[#8ab4a3] font-mono">
              Enrolled identities in gallery: <b>{enrolledCount}</b>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Visual Identity Search
          </h2>
          <p className="text-xs text-[#8aa1a7] mt-0.5">
            Low-quality CCTV & surveillance candidate facial matching. Machine proposals require explicit human review.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit ? (
            <button
              onClick={handleSeedDemo}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow ${
                enrolledCount === 0
                  ? "bg-[#143d34] hover:bg-[#1a4f43] text-[#6ee7b7] border-[#2a6859] ring-2 ring-emerald-500/50"
                  : "bg-[#0f2923] hover:bg-[#153a31] text-[#a7f3d0] border-[#1d4d42]"
              }`}
              title="Enroll demo reference faces for active people in workspace"
            >
              <Users size={14} />
              {enrolledCount === 0 ? "Seed Demo Face Gallery" : "Re-seed Demo Gallery"}
            </button>
          ) : (
            enrolledCount === 0 && (
              <span className="px-3 py-1.5 rounded-lg bg-[#291e14] border border-[#664219] text-[#fcd34d] text-xs font-mono flex items-center gap-1">
                <Info size={12} /> Gallery empty (Viewer: Read-only)
              </span>
            )
          )}

          <div className="flex rounded-lg bg-[#0a1518] p-1 border border-[#1b3e39]">
            <button
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === "search" ? "bg-[#1b3e39] text-white shadow-sm" : "text-[#7f999b] hover:text-white"
              }`}
              onClick={() => setActiveTab("search")}
            >
              Face Matching
            </button>
            <button
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "decisions" ? "bg-[#1b3e39] text-white shadow-sm" : "text-[#7f999b] hover:text-white"
              }`}
              onClick={() => {
                setActiveTab("decisions");
                loadDecisions();
              }}
            >
              <History size={13} />
              Decisions ({decisions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="bg-[#331114] border border-[#7f1d1d] text-[#fca5a5] px-4 py-3 rounded-lg text-xs flex items-center justify-between gap-3 shadow">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-[#ef4444] flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-[#fca5a5] hover:text-white">✕</button>
        </div>
      )}

      {notice && (
        <div className="bg-[#0e2c24] border border-[#1b5e4a] text-[#86efac] px-4 py-3 rounded-lg text-xs flex items-center justify-between gap-3 shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#22c55e] flex-shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice("")} className="text-[#86efac] hover:text-white">✕</button>
        </div>
      )}

      {activeTab === "decisions" ? (
        /* Decisions Log Panel */
        <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-6 shadow-lg flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Investigator Face Decision Audit Trail</h3>
              <p className="text-xs text-[#8aa1a7]">
                Explicit confirmation and rejection records signed into the tamper-evident investigation audit ledger.
              </p>
            </div>
            <button
              onClick={loadDecisions}
              className="text-xs text-[#6ee7b7] hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} /> Refresh
            </button>
          </div>

          {decisions.length === 0 ? (
            <div className="p-8 text-center text-[#7f999b] text-xs border border-dashed border-[#1e3c38] rounded-lg">
              No face matching decisions recorded yet. Run a search and confirm or reject candidate matches to create an immutable audit record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1f423d] text-[#8aa1a7] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-2.5 px-3">Decision</th>
                    <th className="py-2.5 px-3">Target Person</th>
                    <th className="py-2.5 px-3">Similarity</th>
                    <th className="py-2.5 px-3">Investigator</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Investigator Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17322e]">
                  {decisions.map((d) => {
                    const personNode = graph.nodes.find((n) => n.id === d.personNodeId);
                    return (
                      <tr key={d.id} className="hover:bg-[#132c33]/40 transition-colors">
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              d.decision === "CONFIRMED"
                                ? "bg-[#14532d] text-[#86efac] border border-[#166534]"
                                : "bg-[#450a0a] text-[#fca5a5] border border-[#7f1d1d]"
                            }`}
                          >
                            {d.decision === "CONFIRMED" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {d.decision}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-white">
                          <button
                            onClick={() => onNavigateToPerson(d.personNodeId)}
                            className="text-[#6ee7b7] hover:underline"
                          >
                            {personNode?.label || d.personNodeId}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-300">
                          {d.similarity.toFixed(3)}
                        </td>
                        <td className="py-3 px-3 text-[#cbd5e1] font-mono">{d.author}</td>
                        <td className="py-3 px-3 text-[#94a3b8] font-mono">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-[#94a3b8] max-w-xs truncate">
                          {d.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Main Face Matching Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image Upload & Controls (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Upload Box */}
            <div
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all bg-[#0d1c21] flex flex-col items-center justify-center min-h-[220px] ${
                previewUrl ? "border-[#2f5a4e]" : "border-[#1b3e39] hover:border-[#2f6f60]"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {previewUrl ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="relative group max-h-56 max-w-full rounded-lg overflow-hidden border border-[#2f5a4e] bg-black">
                    <img
                      src={previewUrl}
                      alt="Query preview"
                      className="max-h-56 w-auto object-contain mx-auto"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded bg-[#1e463d] text-white text-xs hover:bg-[#25574c]"
                      >
                        Change Image
                      </button>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setSearchResult(null);
                          setSelectedFaceIndex(null);
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#450a0a] text-[#fca5a5] text-xs hover:bg-[#5c0f0f]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {selectedFile && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[11px] text-[#7f999b] font-mono">
                        {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#143d34] text-[#6ee7b7] border border-[#2a6859]">
                        <CheckCircle2 size={12} className="text-[#34d399]" />
                        Probe image ready
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-12 h-12 rounded-full bg-[#132c33] text-[#34d399] flex items-center justify-center border border-[#234b42]">
                    <Upload size={22} />
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1">Upload Probe Image</h4>
                  <p className="text-xs text-[#7f999b] max-w-xs">
                    Drag and drop CCTV frame, surveillance photo, or mugshot crop (JPEG, PNG, WebP up to 10 MiB)
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-3.5 py-1.5 rounded-lg bg-[#1a4038] hover:bg-[#24574c] text-[#a7f3d0] text-xs font-semibold border border-[#2f5a4e] transition-colors"
                  >
                    Select File
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
            </div>

            {/* Empty Gallery Alert in Left Column */}
            {enrolledCount === 0 && (
              <div className="bg-[#1b2318] border border-[#6b581e] rounded-xl p-4 shadow flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-300">
                    Gallery Contains 0 Enrolled Faces
                  </span>
                </div>
                <p className="text-[11px] text-[#cbd5e1] leading-relaxed">
                  Identity search requires enrolled reference portraits in the gallery. Seed the demo gallery to enroll portraits for active persons.
                </p>
                {canEdit ? (
                  <button
                    onClick={handleSeedDemo}
                    className="mt-1 w-full py-2 rounded-lg bg-[#143d34] hover:bg-[#1a4f43] text-[#6ee7b7] text-xs font-semibold border border-[#2a6859] transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    <Users size={14} />
                    Seed Demo Face Gallery
                  </button>
                ) : (
                  <span className="text-[10px] text-amber-400 font-mono mt-1">
                    Viewer mode: Administrator or Investigator needed to enroll reference faces.
                  </span>
                )}
              </div>
            )}

            {/* Quick Test Fixtures */}
            {fixtures.length > 0 && (
              <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-4 shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#8aa1a7] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-400" /> Bundled Test Imagery (1-Click)
                  </span>
                  <span className="text-[10px] text-[#5e777d]">Offline Fixtures</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {fixtures.map((fix) => (
                    <button
                      key={fix.id}
                      onClick={() => handleLoadFixture(fix)}
                      className="text-left px-3 py-2 rounded-lg bg-[#0a1619] hover:bg-[#14292f] border border-[#1b3a35] hover:border-[#2f6f60] transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-medium text-[#e2e8f0] group-hover:text-emerald-300">
                          {fix.label}
                        </div>
                        <div className="text-[10px] text-[#71878d] truncate max-w-xs">
                          {fix.description}
                        </div>
                      </div>
                      <ArrowRight size={13} className="text-[#45645c] group-hover:text-emerald-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Match Settings */}
            <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-4 shadow flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sliders size={13} className="text-[#34d399]" />
                  Similarity Threshold
                </label>
                <span className="text-xs font-mono font-bold text-[#34d399] bg-[#122e28] px-2 py-0.5 rounded border border-[#1f4e43]">
                  {threshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.85"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#29a98b] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#698187] font-mono">
                <span>0.40 (Broad / CCTV)</span>
                <span>0.60 (Standard)</span>
                <span>0.85 (Strict)</span>
              </div>
              <p className="text-[11px] text-[#7f999b] leading-relaxed">
                AdaFace normalized cosine similarity metric. Lower values accommodate low-resolution CCTV, extreme angles, or sensor noise.
              </p>

              <div className="pt-3 border-t border-[#1b3e39]/80 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteSearch()}
                  disabled={!selectedFile || searching}
                  className={`w-full py-3.5 px-5 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-2xl select-none ${
                    selectedFile && !searching
                      ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:via-teal-200 hover:to-emerald-300 text-slate-950 shadow-emerald-500/40 ring-2 ring-emerald-300/80 hover:shadow-emerald-400/50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      : searching
                      ? "bg-[#184e40] text-emerald-200 border border-[#2f6f60] cursor-wait"
                      : "bg-[#132c25] text-[#71988d] border border-[#1e443b] opacity-80 cursor-not-allowed"
                  }`}
                >
                  {searching ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-300 rounded-full animate-spin" />
                      <span>Searching Identity Gallery…</span>
                    </>
                  ) : (
                    <>
                      <Search size={18} className={selectedFile ? "stroke-[2.5] text-slate-950" : "text-[#71988d]"} />
                      <span>Run Visual Identity Search</span>
                    </>
                  )}
                </button>
                {selectedFile && !searching && (
                  <p className="text-[11px] text-emerald-400 font-medium text-center flex items-center justify-center gap-1.5 animate-pulse">
                    <Sparkles size={13} className="text-amber-400" />
                    Probe ready · Click to execute AdaFace similarity search
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Search Results & Candidates (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Searching Animated Progress State */}
            {searching && (
              <div className="bg-[#0f1f24] border border-[#1f4e43] rounded-xl p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                  <div className="w-14 h-14 rounded-full bg-[#122e28] border border-[#2f6f60] flex items-center justify-center text-emerald-400">
                    <ScanFace size={28} className="animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-wide">
                    ANALYZING VISUAL IDENTITY
                  </h3>
                  <p className="text-xs text-[#6ee7b7] font-mono mt-1 animate-pulse">
                    {progressStage}
                  </p>
                </div>
                <div className="w-64 h-1.5 bg-[#0a1619] rounded-full overflow-hidden border border-[#1b3a35]">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {/* Multi-Face Selection Panel */}
            {!searching && searchResult && searchResult.facesDetected > 1 && (
              <div className="bg-[#1b2318] border border-[#6b581e] rounded-xl p-4 shadow flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">
                      MULTIPLE FACES DETECTED ({searchResult.facesDetected} Subjects)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#fcd34d]">Click a subject to isolate & search</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {searchResult.faces.map((f) => (
                    <button
                      key={f.faceIndex}
                      onClick={() => {
                        setSelectedFaceIndex(f.faceIndex);
                        handleExecuteSearch(f.faceIndex);
                      }}
                      className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1.5 ${
                        selectedFaceIndex === f.faceIndex
                          ? "bg-[#293c20] border-amber-400 shadow-md ring-1 ring-amber-400"
                          : "bg-[#111910] border-[#384824] hover:border-amber-500/60"
                      }`}
                    >
                      {f.thumbnail ? (
                        <img
                          src={f.thumbnail}
                          alt={`Face ${f.faceIndex + 1}`}
                          className="w-16 h-16 rounded object-cover border border-amber-900/60"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-black/40 flex items-center justify-center text-xs text-slate-500">
                          Face {f.faceIndex + 1}
                        </div>
                      )}
                      <div className="text-[11px] font-semibold text-white">Subject #{f.faceIndex + 1}</div>
                      <div className="text-[9px] text-[#fcd34d] font-mono">
                        Det. Score: {(f.score * 100).toFixed(0)}%
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Candidate Match Result */}
            {!searching && searchResult && (
              <div className="flex flex-col gap-4">
                {searchResult.status === "MATCH_CANDIDATE" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <h3 className="text-sm font-bold tracking-wider text-emerald-400 uppercase">
                          Potential Identity Match ({searchResult.matches.length} Candidate{searchResult.matches.length > 1 ? "s" : ""})
                        </h3>
                      </div>
                      <span className="text-[11px] text-[#7f999b] font-mono">
                        Model: {searchResult.model}
                      </span>
                    </div>

                    {searchResult.matches.map((candidate, idx) => (
                      <div
                        key={candidate.faceId || idx}
                        className="bg-[#0f1f24] border border-[#2f5a4e] rounded-xl p-5 shadow-xl flex flex-col gap-4 transition-all hover:border-[#387a68]"
                      >
                        {/* Header with similarity meter */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1b3e39]">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#163e34] text-[#6ee7b7] border border-[#286052]">
                              {candidate.status}
                            </span>
                            <span className="text-xs text-[#8aa1a7] font-mono">
                              ID: {candidate.person.canonicalId || candidate.personNodeId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8aa1a7]">Similarity:</span>
                            <span className="text-sm font-mono font-bold text-white bg-[#122e28] px-2.5 py-0.5 rounded border border-[#2f5a4e]">
                              {candidate.similarity.toFixed(3)}
                            </span>
                            <div className="w-16 h-2 bg-[#0a1619] rounded-full overflow-hidden border border-[#1b3a35]">
                              <div
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400"
                                style={{ width: `${Math.min(100, Math.max(0, candidate.similarity * 100))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Photo Comparison & Bio Details */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Photo Comparison (4 cols) */}
                          <div className="md:col-span-4 flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Reference Portrait */}
                              <div className="flex flex-col items-center text-center">
                                <div className="w-full aspect-square rounded-lg bg-black/60 border border-[#2f5a4e] overflow-hidden flex items-center justify-center">
                                  {candidate.person.referencePhoto ? (
                                    <img
                                      src={candidate.person.referencePhoto}
                                      alt="Enrolled reference"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-slate-500 text-xs">No Ref Photo</div>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#8aa1a7] font-mono mt-1">Enrolled Reference</span>
                              </div>

                              {/* Aligned Query Crop */}
                              <div className="flex flex-col items-center text-center">
                                <div className="w-full aspect-square rounded-lg bg-black/60 border border-[#3b82f6]/40 overflow-hidden flex items-center justify-center">
                                  {searchResult.alignedThumbnail ? (
                                    <img
                                      src={searchResult.alignedThumbnail}
                                      alt="Query probe face"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : previewUrl ? (
                                    <img
                                      src={previewUrl}
                                      alt="Query image"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-slate-500 text-xs">Probe</div>
                                  )}
                                </div>
                                <span className="text-[10px] text-sky-400 font-mono mt-1">Query Probe</span>
                              </div>
                            </div>

                            {Boolean(candidate.quality?.is_cctv_quality) && (
                              <div className="text-[10px] font-mono bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-1 rounded text-center">
                                Low-resolution CCTV sensor mode active
                              </div>
                            )}
                          </div>

                          {/* Nexus Investigation Context (8 cols) */}
                          <div className="md:col-span-8 flex flex-col gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white tracking-tight">
                                  {candidate.person.label}
                                </h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#214a3e] text-[#a5f0cd] border border-[#3d806a]">
                                  Person
                                </span>
                              </div>
                              {candidate.person.aliases && candidate.person.aliases.length > 0 && (
                                <div className="text-xs text-[#94a3b8] mt-0.5">
                                  Alias: <span className="text-slate-200">{candidate.person.aliases.join(", ")}</span>
                                </div>
                              )}
                            </div>

                            {/* Graph Attributes Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              {/* Linked Cases */}
                              <div className="bg-[#0a1619] p-2 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono flex items-center gap-1">
                                  <FileText size={11} className="text-emerald-400" /> Linked Cases
                                </div>
                                <div className="font-semibold text-white mt-0.5">
                                  {candidate.person.cases?.length ? (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {candidate.person.cases.map((c) => (
                                        <span key={c} className="bg-[#122e28] text-[#86efac] px-1.5 py-0.5 rounded text-[10px] font-mono">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500">None</span>
                                  )}
                                </div>
                              </div>

                              {/* Phones */}
                              <div className="bg-[#0a1619] p-2 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono flex items-center gap-1">
                                  <Phone size={11} className="text-sky-400" /> Known Phones
                                </div>
                                <div className="font-semibold text-white mt-0.5">
                                  {candidate.person.phones?.length ? (
                                    <div className="truncate text-slate-200" title={candidate.person.phones.join(", ")}>
                                      {candidate.person.phones.join(", ")}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500">None</span>
                                  )}
                                </div>
                              </div>

                              {/* Vehicles */}
                              <div className="bg-[#0a1619] p-2 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono flex items-center gap-1">
                                  <Car size={11} className="text-amber-400" /> Vehicles
                                </div>
                                <div className="font-semibold text-white mt-0.5">
                                  {candidate.person.vehicles?.length ? (
                                    <div className="truncate text-slate-200">
                                      {candidate.person.vehicles.join(", ")}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500">None</span>
                                  )}
                                </div>
                              </div>

                              {/* Accounts */}
                              <div className="bg-[#0a1619] p-2 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono flex items-center gap-1">
                                  <CreditCard size={11} className="text-purple-400" /> Accounts
                                </div>
                                <div className="font-semibold text-white mt-0.5 truncate">
                                  {candidate.person.accounts?.length ? candidate.person.accounts.join(", ") : "None"}
                                </div>
                              </div>

                              {/* Alerts */}
                              <div className="bg-[#0a1619] p-2 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono flex items-center gap-1">
                                  <AlertTriangle size={11} className="text-red-400" /> Active Alerts
                                </div>
                                <div className="font-semibold text-white mt-0.5">
                                  {candidate.person.activeAlertsCount && candidate.person.activeAlertsCount > 0 ? (
                                    <span className="text-red-400 font-bold">
                                      {candidate.person.activeAlertsCount} active alert(s)
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">0</span>
                                  )}
                                </div>
                              </div>

                              {/* Locations */}
                              <div className="bg-[#0a1619] p-2 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono flex items-center gap-1">
                                  <MapPin size={11} className="text-teal-400" /> Locations
                                </div>
                                <div className="font-semibold text-white mt-0.5 truncate">
                                  {candidate.person.locations?.length ? candidate.person.locations.join(", ") : "None"}
                                </div>
                              </div>
                            </div>

                            {/* Known Associates */}
                            {candidate.person.associates && candidate.person.associates.length > 0 && (
                              <div className="text-xs bg-[#0a1619] p-2.5 rounded-lg border border-[#17322e]">
                                <div className="text-[10px] text-[#7f999b] uppercase font-mono mb-1">
                                  Connected Associates ({candidate.person.associates.length})
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {candidate.person.associates.map((assoc, i) => (
                                    <button
                                      key={i}
                                      onClick={() => onNavigateToPerson(assoc.id)}
                                      className="px-2 py-0.5 rounded bg-[#132c33] hover:bg-[#1a3d47] text-[#a5f0cd] text-[11px] border border-[#2f5a4e] transition-colors"
                                    >
                                      {assoc.label} ({assoc.relation})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Investigator Actions Bar */}
                        <div className="pt-3 border-t border-[#1b3e39] flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onNavigateToPerson(candidate.personNodeId)}
                              className="px-3 py-1.5 rounded-lg bg-[#143038] hover:bg-[#1c434f] text-[#93c5fd] text-xs font-semibold border border-[#244f5c] transition-colors flex items-center gap-1.5"
                            >
                              <Eye size={13} />
                              Open Investigation
                            </button>
                            <button
                              onClick={() => onNavigateToPerson(candidate.personNodeId)}
                              className="px-3 py-1.5 rounded-lg bg-[#143038] hover:bg-[#1c434f] text-slate-200 text-xs font-medium border border-[#244f5c] transition-colors flex items-center gap-1.5"
                            >
                              <Layers size={13} />
                              View Network
                            </button>
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setDecisionModal({
                                    open: true,
                                    candidate,
                                    action: "CONFIRMED",
                                    notes: "",
                                  })
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-[#14532d] hover:bg-[#166534] text-[#bbf7d0] text-xs font-bold border border-[#22c55e]/40 transition-colors flex items-center gap-1.5 shadow"
                              >
                                <CheckCircle2 size={14} />
                                Confirm Match
                              </button>
                              <button
                                onClick={() =>
                                  setDecisionModal({
                                    open: true,
                                    candidate,
                                    action: "REJECTED",
                                    notes: "",
                                  })
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-[#450a0a] hover:bg-[#5c0f0f] text-[#fecaca] text-xs font-medium border border-[#ef4444]/40 transition-colors flex items-center gap-1.5"
                              >
                                <XCircle size={14} />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* EMPTY GALLERY STATE */}
                {searchResult.status === "EMPTY_GALLERY" && (
                  <div className="bg-[#0f1f24] border border-[#d97706]/50 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
                    <div className="w-14 h-14 rounded-full bg-[#2a1d0d] text-[#f59e0b] flex items-center justify-center border border-[#78350f]">
                      <Users size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-wide">
                        NO REFERENCE IDENTITIES ENROLLED (EMPTY GALLERY)
                      </h3>
                      <p className="text-xs text-[#cbd5e1] max-w-md mt-1 leading-relaxed">
                        Visual identity search requires enrolled reference portraits in the gallery to compare against. Currently, the gallery contains <b>0 enrolled identities</b>.
                      </p>
                    </div>

                    {searchResult.alignedThumbnail && (
                      <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0a1619] border border-[#1b3e39]">
                        <img
                          src={searchResult.alignedThumbnail}
                          alt="Detected probe face"
                          className="w-20 h-20 rounded-md object-cover border border-[#2f5a4e]"
                        />
                        <span className="text-[10px] text-[#6ee7b7] font-mono">
                          Probe face detected and aligned successfully
                        </span>
                      </div>
                    )}

                    {canEdit ? (
                      <div className="flex flex-col items-center gap-2 mt-2">
                        <button
                          onClick={async () => {
                            await handleSeedDemo();
                            if (selectedFile) {
                              await handleExecuteSearch();
                            }
                          }}
                          className="px-5 py-2.5 rounded-lg bg-[#143d34] hover:bg-[#1a4f43] text-[#6ee7b7] text-xs font-bold border border-[#2a6859] transition-all flex items-center gap-2 shadow-lg hover:shadow-emerald-900/40"
                        >
                          <Sparkles size={15} className="text-amber-400" />
                          Seed Demo Gallery & Re-run Search
                        </button>
                        <span className="text-[11px] text-[#7f999b]">
                          Automatically enrolls bundled reference portraits (Aariv, Mira, Dev) and executes search.
                        </span>
                      </div>
                    ) : (
                      <div className="bg-[#1b1c24] border border-[#3b3e59] p-3 rounded-lg text-xs text-[#94a3b8] max-w-sm">
                        <span className="font-semibold text-white">Viewer Role:</span> Read-only access. An investigator or administrator must enroll identities or seed the gallery.
                      </div>
                    )}
                  </div>
                )}

                {/* NO MATCH STATE */}
                {searchResult.status === "NO_MATCH" && (
                  <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 shadow">
                    <div className="w-12 h-12 rounded-full bg-[#182a2e] text-[#8aa1a7] flex items-center justify-center border border-[#234b42]">
                      <ScanFace size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      NO SUFFICIENTLY SIMILAR ENROLLED IDENTITY FOUND
                    </h3>
                    <p className="text-xs text-[#8aa1a7] max-w-md leading-relaxed">
                      No candidate in the NEXUS gallery achieved cosine similarity meeting threshold &ge;{" "}
                      <b>{searchResult.threshold.toFixed(2)}</b>.
                    </p>
                    <div className="text-[11px] text-[#698187] mt-1">
                      You may adjust the similarity threshold slider or enroll additional reference photos for suspects in the Entity Inspector.
                    </div>
                  </div>
                )}

                {/* NO FACE DETECTED STATE */}
                {searchResult.status === "NO_FACE_DETECTED" && (
                  <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 shadow">
                    <div className="w-12 h-12 rounded-full bg-[#291717] text-[#ef4444] flex items-center justify-center border border-[#5c2424]">
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-white">NO FACE DETECTED IN SUBMITTED IMAGERY</h3>
                    <p className="text-xs text-[#8aa1a7] max-w-md">
                      The SCRFD face detector could not find a clear human face in the submitted image. Ensure the image contains visible facial features.
                    </p>
                  </div>
                )}

                {/* LOW QUALITY STATE */}
                {searchResult.status === "LOW_QUALITY" && (
                  <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 shadow">
                    <div className="w-12 h-12 rounded-full bg-[#291f17] text-[#f59e0b] flex items-center justify-center border border-[#5c3e24]">
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-white">IMAGE QUALITY BELOW USABLE THRESHOLD</h3>
                    <p className="text-xs text-[#8aa1a7] max-w-md">
                      A face was detected, but blur or severe compression prevented reliable 512-dim landmark embedding generation.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Default Placeholder prior to search */}
            {!searching && !searchResult && (
              <div className="bg-[#0f1f24] border border-[#1b3e39] rounded-xl p-10 text-center flex flex-col items-center justify-center gap-3 shadow-lg min-h-[300px]">
                <div className="w-14 h-14 rounded-full bg-[#132c33] text-[#34d399] flex items-center justify-center border border-[#234b42]">
                  <ScanFace size={30} />
                </div>
                <h3 className="text-base font-semibold text-white tracking-wide">
                  Awaiting Visual Probe Imagery
                </h3>
                <p className="text-xs text-[#7f999b] max-w-md leading-relaxed">
                  Upload surveillance footage frames, dashcam snapshots, or pick one of the bundled test fixtures to search against enrolled NEXUS identities.
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-[#5e777d]">
                  <Info size={13} />
                  Candidate matches never merge identities automatically. All decisions are investigator-led.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation / Rejection Modal */}
      {decisionModal.open && decisionModal.candidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f1f24] border border-[#2f5a4e] rounded-xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#1b3e39] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {decisionModal.action === "CONFIRMED" ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    Confirm Face Match
                  </>
                ) : (
                  <>
                    <XCircle size={18} className="text-red-400" />
                    Reject Face Match
                  </>
                )}
              </h3>
              <button
                onClick={() => setDecisionModal({ open: false, candidate: null, action: "CONFIRMED", notes: "" })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[#94a3b8] flex flex-col gap-2">
              <p>
                Target Identity:{" "}
                <b className="text-white">{decisionModal.candidate.person.label}</b> (
                {decisionModal.candidate.personNodeId})
              </p>
              <p>
                Computed AdaFace Cosine Similarity:{" "}
                <b className="text-amber-300 font-mono">
                  {decisionModal.candidate.similarity.toFixed(3)}
                </b>
              </p>
              <p className="text-[11px] text-[#6ee7b7] bg-[#122e28] p-2.5 rounded border border-[#1f4e43] leading-relaxed">
                Recording this decision creates an immutable entry in the NEXUS audit ledger signed by{" "}
                <b>{session.username}</b>. It does <b>not</b> alter entity node graph structures.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">
                Investigator Rationale / Notes:
              </label>
              <textarea
                rows={3}
                value={decisionModal.notes}
                onChange={(e) =>
                  setDecisionModal((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder={
                  decisionModal.action === "CONFIRMED"
                    ? "e.g. Visual match corroborated by FIR witness description and known vehicle ZZ00NX0001."
                    : "e.g. Different facial features upon close examination; distinct ear geometry."
                }
                className="w-full rounded-lg bg-[#0a1619] border border-[#1f4e43] p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b3e39]">
              <button
                onClick={() => setDecisionModal({ open: false, candidate: null, action: "CONFIRMED", notes: "" })}
                className="px-3.5 py-1.5 rounded-lg bg-[#132c33] hover:bg-[#1a3d47] text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDecision}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow ${
                  decisionModal.action === "CONFIRMED"
                    ? "bg-[#166534] hover:bg-[#15803d] text-white"
                    : "bg-[#991b1b] hover:bg-[#b91c1c] text-white"
                }`}
              >
                Submit {decisionModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
