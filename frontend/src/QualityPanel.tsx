import { ShieldCheck } from "lucide-react";
import type { Quality } from "./types";

function percentage(value: number | undefined) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? `${(value * 100).toFixed(1)}%`
    : "Unavailable";
}
function Metrics({
  precision,
  recall,
  f1,
}: {
  precision?: number;
  recall?: number;
  f1?: number;
}) {
  return (
    <div className="quality-scores">
      {[
        ["Precision", precision],
        ["Recall", recall],
        ["F1 Score", f1],
      ].map(([label, value]) => (
        <div key={String(label)}>
          <strong>
            {percentage(typeof value === "number" ? value : undefined)}
          </strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function count(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? String(value)
    : "Unavailable";
}
export default function QualityPanel({ quality }: { quality: Quality | null }) {
  const heldout = quality?.heldoutTest,
    multilingual = quality?.multilingualSynthetic;
  return (
    <section className="panel quality" aria-label="Extraction quality">
      <div className="panel-heading">
        <h3>
          <ShieldCheck size={16} />
          Extraction quality
        </h3>
        <span className="tag">EVALUATION RESULTS</span>
      </div>
      {!quality ? (
        <p className="quiet-state">
          Quality evaluation unavailable. The intelligence engine has not
          supplied results.
        </p>
      ) : (
        <>
          {heldout ? (
            <>
              <h4>Frozen held-out benchmark</h4>
              <p>
                {count(heldout.samples)} samples. Lenient type and overlapping
                span match:
              </p>
              <Metrics
                precision={heldout.lenientPrecision}
                recall={heldout.lenientRecall}
                f1={heldout.lenientF1}
              />
              <p>Strict type and exact span match:</p>
              <Metrics
                precision={heldout.strictPrecision}
                recall={heldout.strictRecall}
                f1={heldout.strictF1}
              />
            </>
          ) : (
            <>
              <h4>Synthetic extraction evaluation</h4>
              <Metrics precision={quality.precision} recall={quality.recall} />
              <p>
                {count(quality.samples)} samples. {quality.scope}
              </p>
              <p>Frozen held-out results: Unavailable.</p>
            </>
          )}
          <h4>Synthetic Hindi/Hinglish fixtures</h4>
          {multilingual ? (
            <>
              <p>
                {count(multilingual.samples)} samples. Strict type and exact
                span match:
              </p>
              <Metrics
                precision={multilingual.strictPrecision}
                recall={multilingual.strictRecall}
                f1={multilingual.strictF1}
              />
              <p>
                True positives: {count(multilingual.truePositives)}; false
                positives: {count(multilingual.falsePositives)}; false
                negatives: {count(multilingual.falseNegatives)}.
              </p>
              <p>{multilingual.scope}</p>
            </>
          ) : (
            <p>Separate fixture results: Unavailable.</p>
          )}
          <small>
            Synthetic fixture metrics are separate from the frozen held-out
            benchmark. Neither establishes general multilingual or real-world
            accuracy.
          </small>
        </>
      )}
    </section>
  );
}
