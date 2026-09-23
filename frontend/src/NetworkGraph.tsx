import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import type { Core, ElementDefinition, LayoutOptions } from "cytoscape";
import fcose from "cytoscape-fcose";
import { colors } from "./types";
import type { Graph } from "./types";
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
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const select = useRef(onSelect);
  const visibleKey = [...visible].sort().join("|");
  select.current = onSelect;
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
    for (const e of graph.edges)
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
            "font-size": 10,
            "font-family": "Inter, sans-serif",
            color: "#d5e2e3",
            "text-valign": "bottom",
            "text-margin-y": 7,
            "text-outline-color": "#13282e",
            "text-outline-width": 2,
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
            "line-color": "#47616a",
            "target-arrow-color": "#47616a",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.5,
            "curve-style": "bezier",
            opacity: 0.45,
          },
        },
        {
          selector: 'edge[type="CONNECTED_TO_CASE"]',
          style: {
            "line-style": "dotted",
            opacity: 0.25,
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
  useEffect(() => {
    const instance = cy.current;
    if (!instance) return;
    instance.elements().removeClass("dim active highlight");
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
    if (selectedNodes.length)
      instance.animate({
        center: { eles: selectedNodes },
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 350,
      });
  }, [selected, focus, path, graph, visible]);
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
