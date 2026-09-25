import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import type { Core, ElementDefinition, LayoutOptions } from "cytoscape";
import fcose from "cytoscape-fcose";
import { colors } from "./types";
import type { Graph, WhatIfResponse, EvidenceTrailPath } from "./types";

cytoscape.use(fcose);

const communityColors = [
  "#83d9c3",
  "#a89be0",
  "#e7bf70",
  "#80b4e9",
  "#e293a7",
  "#cad99c",
];

interface Props {
  graph: Graph;
  visible: Set<string>;
  selected: string;
  focus: number;
  path: string[];
  incomingHighlightNodes?: Set<string>;
  onSelect: (id: string) => void;
  onReady: (graph: Core | null) => void;
  // Visual Forensics additions
  simulationMode?: "canonical" | "simulation" | "overlay";
  whatIfResponse?: WhatIfResponse | null;
  showOnlyImpacted?: boolean;
  evidencePath?: EvidenceTrailPath | null;
  replayVisibleNodes?: Set<string> | null;
  replayNewNodes?: Set<string> | null;
  replayNewEdges?: Set<string> | null;
  onEdgeSelect?: (edgeId: string) => void;
}

export default function NetworkGraph({
  graph,
  visible,
  selected,
  focus,
  path,
  incomingHighlightNodes,
  onSelect,
  onReady,
  simulationMode = "canonical",
  whatIfResponse = null,
  showOnlyImpacted = false,
  evidencePath = null,
  replayVisibleNodes = null,
  replayNewNodes = null,
  replayNewEdges = null,
  onEdgeSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const select = useRef(onSelect);
  const edgeSelect = useRef(onEdgeSelect);
  const visibleKey = [...visible].sort().join("|");
  select.current = onSelect;
  edgeSelect.current = onEdgeSelect;

  useEffect(() => {
    if (!host.current) return;
    const metrics = new Map(
      graph.analysis.metrics?.map((m) => [m.entityId, m]),
    );
    const elements: ElementDefinition[] = [];

    for (const n of graph.nodes.filter((n) => visible.has(n.id))) {
      const instances = graph.analyzed ? ["canonical"] : n.properties.caseIds;
      for (const instance of instances) {
        const m = metrics.get(n.id);
        elements.push({
          data: {
            id: graph.analyzed ? n.id : `${n.id}@${instance}`,
            canonical: n.id,
            label: n.label,
            color: colors[n.type],
            size: Math.round(
              20 + (m?.influence ?? (n.type === "Case" ? 35 : 10)) * 0.4,
            ),
            border: graph.analyzed
              ? communityColors[(m?.community ?? 0) % communityColors.length]
              : "#46616a",
            type: n.type,
          },
          classes: [
            n.type === "Case" ? "case" : "",
            incomingHighlightNodes?.has(n.id) ? "incoming-highlight" : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
    }

    const ids = new Set(elements.map((e) => String(e.data.id)));
    for (const e of graph.edges) {
      for (const instance of graph.analyzed
        ? ["canonical"]
        : e.properties.caseIds) {
        const source = graph.analyzed ? e.source : `${e.source}@${instance}`,
          target = graph.analyzed ? e.target : `${e.target}@${instance}`;
        if (ids.has(source) && ids.has(target))
          elements.push({
            data: {
              id: `${e.id}@${instance}`,
              canonical: e.id,
              source,
              target,
              label: e.type.replaceAll("_", " "),
              type: e.type,
              support: e.properties.support?.level ?? "Low",
            },
          });
      }
    }

    const allPositioned = elements
      .filter((e) => !e.data.source)
      .every((e) => positions.current.has(String(e.data.id)));

    for (const e of elements) {
      const pos = positions.current.get(String(e.data.id));
      if (pos) e.position = pos;
    }

    const instance = cytoscape({
      container: host.current,
      elements,
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            width: "data(size)",
            height: "data(size)",
            label: "data(label)",
            "font-size": 11,
            "font-family": "Inter, sans-serif",
            color: "#f0f8f6",
            "text-valign": "bottom",
            "text-margin-y": 7,
            "text-outline-color": "#13282e",
            "text-outline-width": 3,
            "border-width": 2,
            "border-color": "data(border)",
          },
        },
        {
          selector: ".case",
          style: {
            shape: "round-rectangle",
            "font-size": 11,
            "font-weight": 700,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#83aeb0",
            "target-arrow-color": "#83aeb0",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.5,
            "curve-style": "bezier",
            opacity: 0.7,
          },
        },
        {
          selector: 'edge[type="CONNECTED_TO_CASE"]',
          style: {
            "line-style": "dotted",
            opacity: 0.38,
            "target-arrow-shape": "none",
          },
        },
        { selector: 'edge[support="Low"]', style: { "line-style": "dashed" } },
        { selector: ".dim", style: { opacity: 0.1 } },
        {
          selector: ".active",
          style: {
            "border-width": 5,
            "border-color": "#ffffff",
            "text-outline-width": 3,
          },
        },
        {
          selector: "edge.highlight",
          style: {
            "line-color": "#81f2cf",
            "target-arrow-color": "#81f2cf",
            width: 2.5,
            opacity: 1,
          },
        },
        {
          selector: "node.highlight",
          style: { "border-width": 4, "border-color": "#81f2cf" },
        },
        {
          selector: "node.incoming-highlight",
          style: {
            "border-width": 4,
            "border-color": "#f59e0b",
          },
        },
        // Feature 1: Replay Styles
        {
          selector: "node.replay-new",
          style: {
            "border-width": 5,
            "border-color": "#10b981",
            opacity: 1,
          },
        },
        {
          selector: "edge.replay-new",
          style: {
            width: 3,
            "line-color": "#10b981",
            "target-arrow-color": "#10b981",
            opacity: 1,
          },
        },
        // Feature 2: Counterfactual Ghosting Styles
        {
          selector: "node.ghost-node",
          style: {
            opacity: 0.35,
            "border-style": "dashed",
            "border-width": 3,
            "border-color": "#ef4444",
            color: "#fca5a5",
          },
        },
        {
          selector: "edge.ghost-edge",
          style: {
            opacity: 0.25,
            "line-style": "dashed",
            "line-color": "#ef4444",
            "target-arrow-color": "#ef4444",
          },
        },
        {
          selector: "edge.ghost-severed",
          style: {
            opacity: 0.2,
            "line-style": "dotted",
            "line-color": "#f97316",
            "target-arrow-color": "#f97316",
          },
        },
        // Feature 3: Evidence Path Styles
        {
          selector: "node.evidence-path-node",
          style: {
            "border-width": 5,
            "border-color": "#38bdf8",
            opacity: 1,
            "z-index": 999,
          },
        },
        {
          selector: "edge.evidence-path-edge",
          style: {
            width: 3.5,
            "line-color": "#38bdf8",
            "target-arrow-color": "#38bdf8",
            opacity: 1,
            "z-index": 999,
          },
        },
        {
          selector: ".evidence-dim",
          style: {
            opacity: 0.12,
          },
        },
      ],
      layout: {
        name: allPositioned ? "preset" : "fcose",
        quality: "default",
        randomize: true,
        animate: false,
        nodeRepulsion: 5500,
        idealEdgeLength: 75,
        gravity: 0.15,
        packComponents: true,
      } as LayoutOptions,
    });

    instance.on("tap", "node", (e) =>
      select.current(String(e.target.data("canonical"))),
    );

    instance.on("tap", "edge", (e) =>
      edgeSelect.current?.(String(e.target.data("canonical"))),
    );

    cy.current = instance;
    onReady(instance);

    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(host.current);

    return () => {
      observer.disconnect();
      onReady(null);
      instance.nodes().forEach((n) => {
        positions.current.set(n.id(), { ...n.position() });
      });
      instance.destroy();
      cy.current = null;
    };
  }, [graph, visibleKey, onReady]);

  // Dynamic Class and Layout Layer
  useEffect(() => {
    const instance = cy.current;
    if (!instance) return;

    // Reset standard & forensic classes
    instance
      .elements()
      .removeClass(
        "dim active highlight ghost-node ghost-edge ghost-severed evidence-path-node evidence-path-edge evidence-dim replay-new",
      )
      .style("display", "element");

    // 1. REPLAY MODE FILTERING & ANIMATION
    if (replayVisibleNodes) {
      instance.nodes().forEach((n) => {
        const can = String(n.data("canonical"));
        if (!replayVisibleNodes.has(can)) {
          n.style("display", "none");
        } else if (replayNewNodes?.has(can)) {
          n.addClass("replay-new");
        }
      });
      instance.edges().forEach((e) => {
        const s = String(e.source().data("canonical"));
        const t = String(e.target().data("canonical"));
        const canEdge = String(e.data("canonical"));
        if (!replayVisibleNodes.has(s) || !replayVisibleNodes.has(t)) {
          e.style("display", "none");
        } else if (replayNewEdges?.has(canEdge)) {
          e.addClass("replay-new");
        }
      });
      return;
    }

    // 2. COUNTERFACTUAL / WHAT-IF GHOSTING
    if (whatIfResponse) {
      const removedNodeIds = new Set(
        whatIfResponse.delta.removedNodes.map((n) => n.id),
      );
      const removedEdgeIds = new Set(
        whatIfResponse.delta.removedEdges.map((e) => e.id),
      );

      if (simulationMode === "simulation") {
        // Hide excluded nodes & severed edges
        instance.nodes().forEach((n) => {
          if (removedNodeIds.has(String(n.data("canonical")))) {
            n.style("display", "none");
          }
        });
        instance.edges().forEach((e) => {
          if (removedEdgeIds.has(String(e.data("canonical")))) {
            e.style("display", "none");
          }
        });
      } else if (simulationMode === "overlay") {
        // Ghost excluded nodes & edges
        instance.nodes().forEach((n) => {
          if (removedNodeIds.has(String(n.data("canonical")))) {
            n.addClass("ghost-node");
          }
        });
        instance.edges().forEach((e) => {
          if (removedEdgeIds.has(String(e.data("canonical")))) {
            e.addClass("ghost-edge");
          }
        });

        if (showOnlyImpacted) {
          // Dim elements that are neither excluded nor adjacent
          const impactedNodes = instance.nodes().filter((n) =>
            removedNodeIds.has(String(n.data("canonical"))),
          );
          const neighborhood = impactedNodes.closedNeighborhood();
          instance.elements().not(neighborhood).addClass("dim");
        }
      }
    }

    // 3. EVIDENCE TRAIL HIGHLIGHTING
    if (evidencePath) {
      const pathNodeIds = new Set<string>();
      const pathEdgeIds = new Set<string>();

      evidencePath.steps.forEach((step) => {
        pathNodeIds.add(step.sourceNode.id);
        pathNodeIds.add(step.targetNode.id);
        pathEdgeIds.add(step.edge.id);
      });

      const pathNodes = instance
        .nodes()
        .filter((n) => pathNodeIds.has(String(n.data("canonical"))));
      const pathEdges = instance
        .edges()
        .filter((e) => pathEdgeIds.has(String(e.data("canonical"))));

      pathNodes.addClass("evidence-path-node");
      pathEdges.addClass("evidence-path-edge");

      const pathElements = pathNodes.union(pathEdges);
      instance.elements().not(pathElements).addClass("evidence-dim");

      if (pathElements.length > 0) {
        instance.animate({
          fit: { eles: pathElements, padding: 80 },
          duration: 400,
        });
      }
      return;
    }

    // 4. CANONICAL NODE SELECTION & FOCUS
    const selectedNodes = instance
      .nodes()
      .filter((n) => n.data("canonical") === selected);
    selectedNodes.addClass("active");

    if (focus && selectedNodes.length) {
      let near = selectedNodes.closedNeighborhood();
      for (let i = 1; i < focus; i++) near = near.closedNeighborhood();
      instance.elements().not(near).addClass("dim");
      near.edges().addClass("highlight");
    }

    if (path.length) {
      instance
        .nodes()
        .filter((n) => path.includes(String(n.data("canonical"))))
        .addClass("highlight");
      instance
        .edges()
        .filter(
          (e) =>
            path.includes(String(e.source().data("canonical"))) &&
            path.includes(String(e.target().data("canonical"))),
        )
        .addClass("highlight");
    }

    if (selectedNodes.length) {
      instance.animate({
        center: { eles: selectedNodes },
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 350,
      });
    }
  }, [
    selected,
    focus,
    path,
    graph,
    visible,
    simulationMode,
    whatIfResponse,
    showOnlyImpacted,
    evidencePath,
    replayVisibleNodes,
    replayNewNodes,
    replayNewEdges,
  ]);

  return (
    <div
      ref={host}
      className="cytoscape"
      data-entity-types={[
        ...new Set(
          graph.nodes.filter((n) => visible.has(n.id)).map((n) => n.type),
        ),
      ]
        .sort()
        .join(",")}
      role="img"
      aria-label="Interactive evidence network. Use the search and entity list to select nodes with the keyboard."
    />
  );
}
