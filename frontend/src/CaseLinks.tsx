import { ArrowRight, Link2 } from "lucide-react";
import type { Graph } from "./types";
export default function CaseLinks({
  graph,
  onSelect,
}: {
  graph: Graph;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel padded review-panel">
      <h2>Suggested case connections</h2>
      <p>
        Shared hard identifiers, excluding configured public/service
        identifiers. Review the sources before linking investigations.
      </p>
      <div className="alert-grid">
        {graph.analysis.caseLinks?.map((link) => (
          <article className="alert-card" key={link.caseIds.join("|")}>
            <div>
              <Link2 size={17} />
              <span className="tag">
                {link.entityIds.length} SHARED IDENTIFIERS
              </span>
            </div>
            <h3>{link.caseIds.join(" ↔ ")}</h3>
            <p>{link.explanation}</p>
            <footer>
              <span>{link.evidenceIds.length} evidence references</span>
              <button onClick={() => onSelect(link.entityIds[0])}>
                Inspect <ArrowRight size={14} />
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!graph.analyzed ? <p>Analyze the network to compare cases.</p> : null}
    </section>
  );
}
