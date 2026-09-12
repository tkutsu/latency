"use client";

import { useEffect, useMemo, useRef } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import type { Label } from "@/lib/labels";
import {
  CHROME,
  stressColour,
  type StressDomain,
  type Theme,
} from "@/lib/palette";
import type { LatencyNode } from "@/lib/types";
import {
  apply,
  fitTransform,
  framedBounds,
  placeAll,
  positionAt,
  type Placement,
  type Transform,
} from "@/lib/view";

const PADDING = 44;
const NODE_RADIUS = 3.6;
const ACTIVE_RADIUS = 6.5;
const HIT_RADIUS = 14;
/**
 * The share of nodes the frame is sized to hold. The rest are pinned to its
 * edge: giving them the frame instead would shrink the continent by a third to
 * show a handful of dots in open space. Set so the geographic layout fits
 * whole — Iceland and Palermo included — and only latency space, which has the
 * long tail, pins anything.
 */
const FRAME_REACH = 0.995;
/** How far inside the canvas a pinned node sits. */
const EDGE_INSET = 7;

interface Props {
  nodes: LatencyNode[];
  labels: Label[];
  morph: number;
  theme: Theme;
  showStress: boolean;
  /** Stress in ms at which the ramp saturates. */
  stressDomain: StressDomain;
  activeIndex: number | null;
  onHover: (index: number | null) => void;
  onSelect: (index: number | null) => void;
}

export function LatencyCanvas({
  nodes,
  labels,
  morph,
  theme,
  showStress,
  stressDomain,
  activeIndex,
  onHover,
  onSelect,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useElementSize(frameRef);

  const positions = useMemo(
    () => nodes.map((node) => positionAt(node, morph)),
    [nodes, morph],
  );

  const transform = useMemo(
    () =>
      fitTransform(
        framedBounds(positions, FRAME_REACH),
        width,
        height,
        PADDING,
      ),
    [positions, width, height],
  );

  // Screen positions are needed by both the renderer and the hit test, so they
  // are computed once per frame rather than in each — and pinned in one place,
  // so a node pinned to the edge is hoverable exactly where it is drawn.
  const screen = useMemo(
    () => placeAll(positions, transform, width, height, EDGE_INSET),
    [positions, transform, width, height],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    draw(context, {
      nodes,
      labels,
      screen,
      transform,
      morph,
      theme,
      showStress,
      stressDomain,
      activeIndex,
      width,
      height,
    });
  }, [
    nodes,
    labels,
    screen,
    transform,
    morph,
    theme,
    showStress,
    stressDomain,
    activeIndex,
    width,
    height,
  ]);

  function nearest(event: React.PointerEvent<HTMLCanvasElement>): number | null {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    let best: number | null = null;
    let bestDistance = HIT_RADIUS;
    // 500-odd nodes is nothing to scan, and a linear pass keeps the hit test
    // honest about overlap: the topmost-drawn node is not necessarily nearest.
    for (let index = 0; index < screen.length; index += 1) {
      const at = screen[index].point;
      const distance = Math.hypot(at.x - x, at.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return best;
  }

  return (
    <div ref={frameRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        // Sized by CSS, not by the measurement: the bitmap below follows the
        // element, never the other way round.
        className="h-full w-full touch-none"
        role="img"
        aria-label={`${nodes.length} RIPE Atlas anchors across Europe, drawn ${
          morph < 0.5 ? "close to their real positions" : "in latency space"
        }. The table below the map lists the anchors the layout fits worst.`}
        onPointerMove={(event) => onHover(nearest(event))}
        onPointerLeave={() => onHover(null)}
        onPointerDown={(event) => onSelect(nearest(event))}
      />
    </div>
  );
}

interface Scene {
  nodes: LatencyNode[];
  labels: Label[];
  screen: Placement[];
  transform: Transform;
  morph: number;
  theme: Theme;
  showStress: boolean;
  stressDomain: StressDomain;
  activeIndex: number | null;
  width: number;
  height: number;
}

function draw(context: CanvasRenderingContext2D, scene: Scene) {
  const chrome = CHROME[scene.theme];
  context.clearRect(0, 0, scene.width, scene.height);

  drawScaleBar(context, scene, chrome.muted, chrome.hairline);
  if (scene.activeIndex !== null) drawActiveLinks(context, scene, chrome);

  // A ring in the surface colour, because the core is a pile of overlapping
  // anchors and without it Amsterdam is one blob rather than thirty dots.
  context.lineWidth = 1.4;
  context.strokeStyle = chrome.surface;
  for (let index = 0; index < scene.nodes.length; index += 1) {
    if (index === scene.activeIndex) continue;
    const { point, beyond } = scene.screen[index];
    const colour = scene.showStress
      ? stressColour(scene.nodes[index].stress, scene.stressDomain, scene.theme)
      : chrome.node;
    context.globalAlpha = scene.activeIndex === null ? 0.92 : 0.35;
    context.beginPath();
    context.arc(point.x, point.y, NODE_RADIUS, 0, Math.PI * 2);
    if (beyond) {
      // Hollow, because this one is not where it is drawn — it embeds off the
      // edge of the frame and has been pinned to it.
      context.strokeStyle = colour;
      context.stroke();
      context.strokeStyle = chrome.surface;
    } else {
      context.fillStyle = colour;
      context.fill();
      context.stroke();
    }
  }
  context.globalAlpha = 1;

  if (scene.activeIndex !== null) {
    const { point } = scene.screen[scene.activeIndex];
    context.beginPath();
    context.arc(point.x, point.y, ACTIVE_RADIUS, 0, Math.PI * 2);
    context.fillStyle = chrome.signal;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = chrome.surface;
    context.stroke();
  }

  drawLabels(context, scene, chrome);
}

/**
 * For the node under the cursor: where it would sit on a real map, and the
 * pairs its drawn position gets most wrong. Only ever one node's worth, since
 * 523 nodes of this would be a solid field of lines.
 */
function drawActiveLinks(
  context: CanvasRenderingContext2D,
  scene: Scene,
  chrome: (typeof CHROME)[Theme],
) {
  const index = scene.activeIndex!;
  const node = scene.nodes[index];
  const from = scene.screen[index].point;

  const geographicPoint = apply(node.geographic, scene.transform);
  if (Math.hypot(geographicPoint.x - from.x, geographicPoint.y - from.y) > 6) {
    context.setLineDash([3, 4]);
    context.lineWidth = 1.5;
    context.strokeStyle = chrome.muted;
    context.globalAlpha = 0.8;
    context.beginPath();
    context.moveTo(geographicPoint.x, geographicPoint.y);
    context.lineTo(from.x, from.y);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(geographicPoint.x, geographicPoint.y, 2.5, 0, Math.PI * 2);
    context.fillStyle = chrome.muted;
    context.fill();
  }

  const byId = new Map(scene.nodes.map((other, i) => [other.id, i]));
  context.lineWidth = 2;
  context.strokeStyle = chrome.link;
  for (const pair of node.worstPairs) {
    const other = byId.get(pair.id);
    if (other === undefined) continue;
    context.globalAlpha = 0.55;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(scene.screen[other].point.x, scene.screen[other].point.y);
    context.stroke();
  }
  context.globalAlpha = 1;
}

/**
 * Landmark names, plus whatever is under the cursor. Labels are placed greedily
 * and any that would collide with one already drawn is dropped — a name half
 * on top of another name is worse than no name.
 */
function drawLabels(
  context: CanvasRenderingContext2D,
  scene: Scene,
  chrome: (typeof CHROME)[Theme],
) {
  context.font =
    "500 11px system-ui, -apple-system, 'Segoe UI', sans-serif";
  context.textBaseline = "middle";

  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const queue = [...scene.labels];
  if (scene.activeIndex !== null) {
    const node = scene.nodes[scene.activeIndex];
    // The cursor's node jumps the queue: it is the one the reader asked for.
    queue.unshift({
      index: scene.activeIndex,
      text: `${node.city || node.hostname}${node.city ? "" : ""}`,
    });
  }

  for (const label of queue) {
    const { point } = scene.screen[label.index];
    const width = context.measureText(label.text).width;
    const w = width + 6;
    const h = 13;
    // Right of the node by default, flipped left when that would run off the
    // canvas. Without the flip a node pinned to the right edge — which is to
    // say one of the furthest-out nodes on the map — silently loses its name.
    let x = point.x + 9;
    if (x + w > scene.width - 6) x = point.x - 9 - w;
    if (x < 6) continue;
    const y = Math.min(scene.height - 6 - h, Math.max(6, point.y - 6));
    const box = { x, y, w, h };
    if (taken.some((other) => overlaps(box, other))) continue;
    taken.push(box);

    const active = label.index === scene.activeIndex;
    // A halo rather than a filled plate: the map underneath stays visible.
    context.lineWidth = 3;
    context.strokeStyle = chrome.surface;
    context.lineJoin = "round";
    context.strokeText(label.text, box.x + 3, box.y + h / 2);
    context.fillStyle = active ? chrome.ink : chrome.muted;
    context.fillText(label.text, box.x + 3, box.y + h / 2);
  }
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * The map has no axes — it is a plane of milliseconds with no meaningful origin
 * — so the only scale cue it needs is how far ten milliseconds is. It shortens
 * as the frame refits, which is itself the signal that the map has stretched.
 */
function drawScaleBar(
  context: CanvasRenderingContext2D,
  scene: Scene,
  ink: string,
  hairline: string,
) {
  const ms = 10;
  const pixels = ms * scene.transform.scale;
  if (!Number.isFinite(pixels) || pixels < 8) return;
  const x = 16;
  const y = scene.height - 18;

  context.strokeStyle = hairline;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + pixels, y);
  context.stroke();

  context.fillStyle = ink;
  context.font = "500 10px system-ui, -apple-system, 'Segoe UI', sans-serif";
  context.textBaseline = "top";
  context.fillText(`${ms} ms`, x, y + 5);
}
