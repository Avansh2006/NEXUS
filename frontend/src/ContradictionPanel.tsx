import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Filter,
  MessageSquare,
  Lock,
} from "lucide-react";
import { api } from "./types";
import type { Contradiction, ContradictionReviewRequest, ContradictionReviewStatus, Session } from "./types";

interface Props {
  session: Session;
  onSelectEntity?: (id: string) => void;
}

export default function ContradictionPanel({ session, onSelectEntity }: Props) {
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [ruleFilter, setRuleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Review Modal state
  const [selectedContradiction, setSelectedContradiction] = useState<Contradiction | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ContradictionReviewStatus>("ACKNOWLEDGED");
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [reviewNotice, setReviewNotice] = useState<string>("");

  const canReview = session.role === "ADMIN" || session.role === "INVESTIGATOR";

  useEffect(() => {
    loadContradictions();
  }, []);

  const loadContradictions = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Contradiction[]>("/investigation/contradictions");
      setContradictions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load contradictions");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (c: Contradiction) => {
    setSelectedContradiction(c);
    setReviewStatus(c.reviewStatus === "PENDING" ? "ACKNOWLEDGED" : c.reviewStatus);
    setReviewNotes(c.reviewNotes || "");
    setReviewNotice("");
  };

  const handleSubmitReview = async () => {
    if (!selectedContradiction || !canReview) return;
    setSubmitting(true);
    try {
      const payload: ContradictionReviewRequest = {
        status: reviewStatus,
        notes: reviewNotes,
      };
      await api(`/investigation/contradictions/${selectedContradiction.id}/review`, payload);
      setReviewNotice("Review decision recorded successfully.");
      setTimeout(() => {
        setSelectedContradiction(null);
        loadContradictions();
      }, 700);
    } catch (err: unknown) {
      setReviewNotice(err instanceof Error ? err.message : "Review submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = contradictions.filter((c) => {
    if (ruleFilter !== "ALL" && c.ruleId !== ruleFilter) return false;
    if (statusFilter !== "ALL" && c.reviewStatus !== statusFilter) return false;
    return true;
  });

  const getRuleBadge = (ruleId: string) => {
    switch (ruleId) {
      case "C1":
        return { label: "C1: Multi-Person Identifier", color: "bg-red-100 text-red-800 border-red-200" };
      case "C2":
        return { label: "C2: Vehicle Attribution", color: "bg-amber-100 text-amber-800 border-amber-200" };
      case "C3":
        return { label: "C3: Spatiotemporal Conflict", color: "bg-purple-100 text-purple-800 border-purple-200" };
      case "C4":
        return { label: "C4: Near-Duplicate Identity", color: "bg-indigo-100 text-indigo-800 border-indigo-200" };
      case "C5":
        return { label: "C5: Incompatible Role", color: "bg-rose-100 text-rose-800 border-rose-200" };
      case "C6":
        return { label: "C6: Temporal Anomaly", color: "bg-blue-100 text-blue-800 border-blue-200" };
      default:
        return { label: ruleId, color: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  const getStatusBadge = (status: ContradictionReviewStatus) => {
    switch (status) {
      case "RESOLVED":
        return { label: "Resolved", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
      case "ACKNOWLEDGED":
        return { label: "Acknowledged", color: "bg-amber-100 text-amber-800 border-amber-300" };
      case "UNDER_INVESTIGATION":
        return { label: "Under Investigation", color: "bg-purple-100 text-purple-800 border-purple-300" };
      case "FLAGGED_FALSE_POSITIVE":
        return { label: "False Positive", color: "bg-slate-100 text-slate-700 border-slate-300" };
      default:
        return { label: "Pending Review", color: "bg-slate-100 text-slate-600 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full uppercase tracking-wider">
                Factual Integrity Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Rules C1 through C6
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              Contradiction & Cross-Case Discrepancy Engine
            </h2>
            <p className="text-xs text-slate-500">
              Identifies irreconcilable facts, impossible movements, role mismatches, and shared identifiers across independent case records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-base font-bold text-slate-800">
                {contradictions.length}
              </div>
              <div className="text-[10px] text-slate-500">Total Conflicts</div>
            </div>
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-center">
              <div className="text-base font-bold text-red-600">
                {contradictions.filter((c) => c.severity === "HIGH").length}
              </div>
              <div className="text-[10px] text-red-700">High Severity</div>
            </div>
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <div className="text-base font-bold text-emerald-700">
                {contradictions.filter((c) => c.reviewStatus === "RESOLVED").length}
              </div>
              <div className="text-[10px] text-emerald-800">Resolved</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter size={14} />
            Filter by Rule:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "C1", "C2", "C3", "C4", "C5", "C6"].map((r) => (
              <button
                key={r}
                onClick={() => setRuleFilter(r)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                  ruleFilter === r
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r === "ALL" ? "All Rules" : r}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-2" />

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            Status:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "PENDING", "ACKNOWLEDGED", "RESOLVED", "FLAGGED_FALSE_POSITIVE"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 text-xs rounded-md font-medium transition ${
                  statusFilter === st
                    ? "bg-emerald-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All Statuses" : st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* List of Contradiction Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">
          Scanning knowledge graph for factual contradictions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          No contradictions match the selected criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const rBadge = getRuleBadge(c.ruleId);
            const sBadge = getStatusBadge(c.reviewStatus);
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold border rounded-md uppercase tracking-wider ${rBadge.color}`}
                    >
                      {rBadge.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold border rounded-full ${sBadge.color}`}
                    >
                      {sBadge.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {c.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {c.description}
                  </p>

                  {/* Entity links */}
                  {c.entityIds.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Involved Entities:
                      </span>
                      {c.entityIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => onSelectEntity?.(id)}
                          className="px-2 py-0.5 bg-slate-100 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 rounded text-[11px] transition"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Review Notes Snippet if present */}
                  {c.reviewNotes && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700">
                      <strong>Investigator Note:</strong> "{c.reviewNotes}"
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        Reviewed by {c.reviewedBy} at {c.reviewedAt.slice(0, 10)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {c.id}
                  </span>
                  <button
                    onClick={() => handleOpenReview(c)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition"
                  >
                    <MessageSquare size={13} />
                    {c.reviewStatus === "PENDING" ? "Review Discrepancy" : "Update Review"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedContradiction && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Investigator Review Action
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {selectedContradiction.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedContradiction(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedContradiction.description}
            </p>

            {!canReview && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                <Lock size={14} className="flex-shrink-0" />
                <span>
                  Your current role (<strong>{session.role}</strong>) is read-only. Modifying discrepancy statuses requires Investigator or Admin authorization.
                </span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Determination Status:
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as ContradictionReviewStatus)}
                  disabled={!canReview || submitting}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED — Valid discrepancy noted</option>
                  <option value="RESOLVED">RESOLVED — Reconciled through primary sources</option>
                  <option value="UNDER_INVESTIGATION">UNDER_INVESTIGATION — Pending field verification</option>
                  <option value="FLAGGED_FALSE_POSITIVE">FLAGGED_FALSE_POSITIVE — Data artifact / legal alias</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Investigative Findings / Justification:
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={!canReview || submitting}
                  placeholder="Record evidentiary basis for resolving or acknowledging this contradiction..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              {reviewNotice && (
                <div className="text-xs font-semibold text-emerald-700">
                  {reviewNotice}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedContradiction(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              {canReview && (
                <button
                  onClick={handleSubmitReview}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  {submitting ? "Recording..." : "Save Determination"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
