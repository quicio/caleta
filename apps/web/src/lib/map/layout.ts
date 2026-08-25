// Layout determinístico del mapa.
// ponytail: seed por id (no random por mount) — el layout es estable entre renders
// para que drag-from-position funcione. Si en el futuro se quiere auto-layout más
// prolijo, reemplazar por d3-force o similar; hasta entonces es O(n) y basta.
//
// Posicionamos territorios en una grilla laxa alrededor del origen (0,0),
// nodos dentro del bounding ellipse de su territorio.

import type { ApiList, ApiTask, DerivedMap, MapNode, MapTerritory } from "./types.ts";

const TERRITORY_SPACING_X = 360;
const TERRITORY_SPACING_Y = 280;
const NODE_RADIUS_MAX = 130;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function territoryOrigin(listId: string, index: number): { x: number; y: number } {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const jitter = ((hash(listId) % 100) - 50) * 0.6;
  return {
    x: (col - 1) * TERRITORY_SPACING_X + jitter,
    y: (row - 0.5) * TERRITORY_SPACING_Y + jitter * 0.4,
  };
}

function nodeInside(
  listId: string,
  taskId: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): { x: number; y: number } {
  const angle = (hash(taskId) / 0xffffffff) * Math.PI * 2;
  const rNorm = (hash(taskId + "r") / 0xffffffff) * 0.78 + 0.12;
  return {
    x: cx + Math.cos(angle) * rx * rNorm,
    y: cy + Math.sin(angle) * ry * rNorm,
  };
}

export function deriveMap(
  lists: ApiList[],
  tasks: ApiTask[],
  overrides?: Record<string, { x: number; y: number }>,
): DerivedMap {
  const visibleLists = lists.filter((l) => !l.deletedAt);
  const visibleTasks = tasks.filter((t) => !t.deletedAt);

  const territories: MapTerritory[] = visibleLists.map((l, i) => {
    const own = visibleTasks.filter((t) => t.listId === l.id);
    const active = own.filter((t) => !t.completed);
    const origin = territoryOrigin(l.id, i);
    const rx = Math.max(NODE_RADIUS_MAX, 80 + Math.sqrt(active.length) * 36);
    const ry = Math.max(NODE_RADIUS_MAX * 0.7, 60 + Math.sqrt(active.length) * 28);
    return {
      listId: l.id,
      name: l.name,
      cx: origin.x,
      cy: origin.y,
      rx,
      ry,
      taskCount: own.length,
      activeCount: active.length,
    };
  });

  const territoryByList = new Map(territories.map((t) => [t.listId, t]));

  const nodes: MapNode[] = visibleTasks.map((t) => {
    const override = overrides?.[t.id];
    if (override) {
      return { taskId: t.id, listId: t.listId, x: override.x, y: override.y };
    }
    const terr = territoryByList.get(t.listId);
    if (!terr) {
      return { taskId: t.id, listId: t.listId, x: 0, y: 0 };
    }
    const pos = nodeInside(t.id, t.id, terr.cx, terr.cy, terr.rx, terr.ry);
    return { taskId: t.id, listId: t.listId, x: pos.x, y: pos.y };
  });

  const nodesById = new Map(nodes.map((n) => [n.taskId, n]));
  const routes = visibleTasks
    .filter((t) => t.dependsOn && nodesById.has(t.dependsOn) && t.dependsOn !== t.id)
    .map((t) => ({ fromId: t.dependsOn as string, toId: t.id }));

  let minX = -300;
  let minY = -200;
  let maxX = 300;
  let maxY = 200;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  for (const t of territories) {
    minX = Math.min(minX, t.cx - t.rx - 40);
    minY = Math.min(minY, t.cy - t.ry - 40);
    maxX = Math.max(maxX, t.cx + t.rx + 40);
    maxY = Math.max(maxY, t.cy + t.ry + 40);
  }

  return { territories, nodes, routes, bounds: { minX, minY, maxX, maxY } };
}

export function nodeById(map: DerivedMap, taskId: string): MapNode | undefined {
  return map.nodes.find((n) => n.taskId === taskId);
}

export function territoryById(map: DerivedMap, listId: string): MapTerritory | undefined {
  return map.territories.find((t) => t.listId === listId);
}