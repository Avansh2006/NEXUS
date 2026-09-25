import { useEffect, useState } from "react";
export default function Playback({
  instants,
  value,
  onChange,
  resetKey,
}: {
  instants: number[];
  value: number | null;
  onChange: (value: number | null) => void;
  resetKey: unknown;
}) {
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const index =
    value === null
      ? instants.length - 1
      : Math.max(
          0,
          instants.findIndex((t) => t === value),
        );
  useEffect(() => {
    setPlaying(false);
    if (value !== null && !instants.includes(value))
      onChange(instants.length ? instants[0] : null);
  }, [resetKey, instants]);
  useEffect(() => {
    if (!playing || instants.length < 2) return;
    if (index >= instants.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => onChange(instants[index + 1]), 1000 / speed);
    return () => clearTimeout(timer);
  }, [playing, index, instants, speed, onChange]);
  return (
    <section className="playback panel padded" aria-label="Timeline playback">
      <div className="panel-heading">
        <h3>Timeline playback</h3>
        <button
          className="button compact"
          disabled={instants.length < 2}
          onClick={() => {
            if (!playing && index >= instants.length - 1) onChange(instants[0]);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause playback" : "Play playback"}
        </button>
      </div>
      <label>
        Playback instant
        <input
          aria-label="Playback instant"
          type="range"
          min={0}
          max={Math.max(0, instants.length - 1)}
          value={Math.max(0, index)}
          disabled={!instants.length}
          onChange={(e) => {
            setPlaying(false);
            onChange(instants[Number(e.target.value)]);
          }}
        />
      </label>
      <output aria-label="Playback timestamp">
        {instants.length
          ? new Date(instants[Math.max(0, index)]).toISOString()
          : "No dated events"}
      </output>
      <label>
        Playback speed
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[0.5, 1, 2].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
      <button
        className="button compact"
        onClick={() => {
          setPlaying(false);
          onChange(null);
        }}
      >
        Show all events
      </button>
      <p>
        Manual first. Scrubbing changes the displayed graph and timeline only.
      </p>
    </section>
  );
}
