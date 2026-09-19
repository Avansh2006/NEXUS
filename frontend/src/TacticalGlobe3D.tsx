import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Entity, Edge, EntityType } from "./types";
import { colors } from "./types";
import { Globe } from "lucide-react";

interface TacticalGlobe3DProps {
  nodes: Entity[];
  edges: Edge[];
  selectedId?: string;
  onSelectNode?: (id: string) => void;
}

export default function TacticalGlobe3D({
  nodes,
  edges,
  selectedId,
  onSelectNode,
}: TacticalGlobe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState({ lat: "24.52° N", lon: "78.43° E", speed: "1.0x" });
  const isInteracting = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1e24);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 240;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Tactical Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Base Sphere
    const sphereRadius = 80;
    const sphereGeom = new THREE.SphereGeometry(sphereRadius, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x102830,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const baseSphere = new THREE.Mesh(sphereGeom, sphereMat);
    globeGroup.add(baseSphere);

    // Tactical Equator & Grid Rings
    const ringMat = new THREE.LineBasicMaterial({ color: 0x3d7b68, transparent: true, opacity: 0.35 });
    const ringGeom = new THREE.RingGeometry(sphereRadius * 0.99, sphereRadius * 1.01, 64);
    const ring1 = new THREE.LineSegments(new THREE.WireframeGeometry(ringGeom), ringMat);
    ring1.rotation.x = Math.PI / 2;
    globeGroup.add(ring1);

    // Atmosphere Glow Ring
    const outerRingGeom = new THREE.RingGeometry(sphereRadius * 1.15, sphereRadius * 1.16, 64);
    const outerRingMat = new THREE.LineBasicMaterial({ color: 0x56a38b, transparent: true, opacity: 0.2 });
    const outerRing = new THREE.LineSegments(new THREE.WireframeGeometry(outerRingGeom), outerRingMat);
    globeGroup.add(outerRing);

    // Map Nodes onto Sphere using Fibonacci spiral
    const nodeObjects: { mesh: THREE.Mesh; node: Entity }[] = [];
    const nodeCount = Math.max(nodes.length, 1);

    nodes.forEach((n, idx) => {
      const phi = Math.acos(-1 + (2 * idx) / nodeCount);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;

      const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
      const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
      const z = sphereRadius * Math.cos(phi);

      const entityColor = colors[n.type as EntityType];
      const colorHex = entityColor ? parseInt(entityColor.replace("#", "0x"), 16) : 0x7ecba1;
      const isTarget = n.id === selectedId;

      const nodeGeom = new THREE.SphereGeometry(isTarget ? 3.5 : 2.0, 12, 12);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: isTarget ? 0xffe680 : colorHex,
      });

      const nodeMesh = new THREE.Mesh(nodeGeom, nodeMat);
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = { id: n.id, label: n.label, type: n.type };

      globeGroup.add(nodeMesh);
      nodeObjects.push({ mesh: nodeMesh, node: n });
    });

    // Draw 3D Curves for Top Edges (limit to first 40 for crisp performance)
    const activeEdges = edges.slice(0, 45);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x48b898,
      transparent: true,
      opacity: 0.35,
    });

    activeEdges.forEach((edge) => {
      const src = nodeObjects.find((no) => no.node.id === edge.source);
      const tgt = nodeObjects.find((no) => no.node.id === edge.target);
      if (!src || !tgt) return;

      const v1 = src.mesh.position;
      const v2 = tgt.mesh.position;
      const mid = v1.clone().add(v2).multiplyScalar(0.5);
      const midLen = mid.length();
      if (midLen > 0) {
        mid.normalize().multiplyScalar(sphereRadius * 1.25);
      }

      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      const points = curve.getPoints(16);
      const curveGeom = new THREE.BufferGeometry().setFromPoints(points);
      const curveLine = new THREE.Line(curveGeom, lineMat);
      globeGroup.add(curveLine);
    });

    // Raycasting for Node Hover & Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-100, -100);

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isInteracting.current) {
        const deltaX = e.clientX - previousMousePosition.current.x;
        const deltaY = e.clientY - previousMousePosition.current.y;
        globeGroup.rotation.y += deltaX * 0.006;
        globeGroup.rotation.x += deltaY * 0.006;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };

        const latDeg = Math.round(((globeGroup.rotation.x % Math.PI) / Math.PI) * 90);
        const lonDeg = Math.round(((globeGroup.rotation.y % (Math.PI * 2)) / (Math.PI * 2)) * 180);
        setTelemetry({
          lat: `${Math.abs(latDeg)}° ${latDeg >= 0 ? "N" : "S"}`,
          lon: `${Math.abs(lonDeg)}° ${lonDeg >= 0 ? "E" : "W"}`,
          speed: "Manual",
        });
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      isInteracting.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isInteracting.current = false;
      setTelemetry((t) => ({ ...t, speed: "1.0x" }));
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeObjects.map((n) => n.mesh));
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        if (clickedMesh.userData?.id && onSelectNode) {
          onSelectNode(clickedMesh.userData.id);
        }
      }
    };

    container.addEventListener("mousemove", onPointerMove);
    container.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mouseup", onPointerUp);
    container.addEventListener("click", onClick);

    // Animation loop
    let animId = 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isInteracting.current && !prefersReducedMotion) {
        globeGroup.rotation.y += 0.0035;
        outerRing.rotation.z += 0.002;
      }

      // Check hover
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeObjects.map((n) => n.mesh));
      if (intersects.length > 0) {
        const hovered = intersects[0].object as THREE.Mesh;
        setHoveredNode(`${hovered.userData.label} (${hovered.userData.type})`);
        container.style.cursor = "pointer";
      } else {
        setHoveredNode(null);
        container.style.cursor = isInteracting.current ? "grabbing" : "grab";
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", onPointerMove);
      container.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mouseup", onPointerUp);
      container.removeEventListener("click", onClick);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sphereGeom.dispose();
      sphereMat.dispose();
    };
  }, [nodes, edges, selectedId, onSelectNode]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#0c1e24] rounded-b-lg overflow-hidden flex flex-col justify-between">
      {/* Tactical HUD Header */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#102a33cc] backdrop-blur-md border border-[#3b685c44] text-[#a1d9c2] text-xs font-mono">
          <Globe size={13} className="text-[#5ce0a8] animate-spin-slow" />
          <span>TACTICAL 3D HOLO SPHERE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#5ce0a8] animate-pulse" />
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#769e90] bg-[#102a33cc] backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3b685c44]">
          <span>COORD: {telemetry.lat}, {telemetry.lon}</span>
          <span>ORBIT: {telemetry.speed}</span>
        </div>
      </div>

      {/* 3D WebGL Canvas Host */}
      <div ref={containerRef} className="w-full h-full min-h-[480px] flex-1 cursor-grab" />

      {/* Interactive Tooltip on Node Hover */}
      {hoveredNode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none z-20 px-3 py-1.5 rounded-lg bg-[#14313ac0] backdrop-blur-md border border-[#529e8466] text-[#e0fff2] text-xs font-medium shadow-lg">
          {hoveredNode}
        </div>
      )}

      {/* Tactical HUD Bottom Legend */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none text-xs text-[#82a89a]">
        <div className="flex items-center gap-3 bg-[#102a33cc] backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3b685c33] font-mono text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4fd1a5]" /> Person
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4ea8de]" /> Phone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ffd166]" /> Account
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f77f00]" /> Crime
          </span>
        </div>
        <div className="bg-[#102a33cc] backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3b685c33] text-[10px] font-mono">
          DRAG TO ROTATE · CLICK NODE TO INSPECT
        </div>
      </div>
    </div>
  );
}
