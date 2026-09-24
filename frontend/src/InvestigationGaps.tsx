import { useState, useEffect } from "react";
import {
  FileSearch,
  CheckCircle2,
  Filter,
  PhoneCall,
  Car,
  UserX,
  FileQuestion,
  ListTodo,
} from "lucide-react";
import { api } from "./types";
import type { GapsResponse } from "./types";

interface Props {
  onSelectEntity?: (id: string) => void;
}

export default function InvestigationGaps({ onSelectEntity }: Props) {
  const [data, setData] = useState<GapsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  useEffect(() => {
    loadGaps();
  }, []);

  const loadGaps = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<GapsResponse>("/investigation/gaps");
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load investigation gaps");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "UNRESOLVED_IDENTIFIER":
        return { label: "Unresolved Identifier", icon: PhoneCall, color: "bg-red-100 text-red-800 border-red-200" };
      case "DEAD_END_LEAD":
        return { label: "Incomplete Profile", icon: UserX, color: "bg-amber-100 text-amber-800 border-amber-200" };
      case "UNVERIFIED_ASSET":
        return { label: "Unregistered Asset", icon: Car, color: "bg-purple-100 text-purple-800 border-purple-200" };
      case "SINGLE_SOURCE_RISK":
        return { label: "Single-Source Risk", icon: FileQuestion, color: "bg-blue-100 text-blue-800 border-blue-200" };
      default:
        return { label: category, icon: FileSearch, color: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  const filtered = data
    ? data.gaps.filter((g) => {
        if (selectedCategory !== "ALL" && g.category !== selectedCategory) return false;
        return true;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs font-semibold rounded-full uppercase tracking-wider">
                Investigative Blind Spot Radar
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Knowledge Graph Coverage
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              Investigation Gap Finder & Actionable Next Steps
            </h2>
            <p className="text-xs text-slate-500">
              Surfaces missing KYC identifiers, dead-end leads without telecommunications, uncorroborated single-source claims, and suggests procedural legal inquiries.
            </p>
          </div>

          {data && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="text-base font-bold text-slate-800">
                  {data.totalGaps}
                </div>
                <div className="text-[10px] text-slate-500">Identified Gaps</div>
              </div>
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-center">
                <div className="text-base font-bold text-red-600">
                  {data.gaps.filter((g) => g.severity === "HIGH").length}
                </div>
                <div className="text-[10px] text-red-700">Urgent Gaps</div>
              </div>
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        {data && (
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Filter size={13} />
              Filter by Category:
            </span>
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedCategory === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({data.totalGaps})
            </button>
            {Object.entries(data.gapsByCategory).map(([cat, count]) => {
              const badge = getCategoryBadge(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {badge.label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Gaps List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">
          Scanning graph topology for investigative gaps...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          No gaps match the selected category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((g) => {
            const b = getCategoryBadge(g.category);
            const Icon = b.icon;
            return (
              <div
                key={g.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold border rounded-md uppercase tracking-wider flex items-center gap-1.5 ${b.color}`}
                    >
                      <Icon size={12} />
                      {b.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                        g.severity === "HIGH"
                          ? "bg-red-100 text-red-800"
                          : g.severity === "MEDIUM"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {g.severity} Priority
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {g.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {g.description}
                    </p>
                  </div>

                  {/* Suggested Next Steps */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      <ListTodo size={14} className="text-emerald-600" />
                      Suggested Procedural Next Steps:
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {g.suggestedActions.map((act, actIdx) => (
                        <li key={actIdx} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Entity Pills */}
                {g.entityIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Subject:
                    </span>
                    {g.entityIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => onSelectEntity?.(id)}
                        className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 hover:bg-emerald-50 rounded text-xs transition"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
