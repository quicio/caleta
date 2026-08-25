// Tipos del Mapa — independientes del storage. Representan el modelo
// visual (viewport, nodos posicionados, focus) derivado de los datos del API.

import type { ApiList, ApiTask } from "../types.ts";

export interface MapViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface MapNode {
  taskId: string;
  listId: string;
  x: number;
  y: number;
}

export interface MapTerritory {
  listId: string;
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  taskCount: number;
  activeCount: number;
}

export interface MapRoute {
  fromId: string;
  toId: string;
}

export interface DerivedMap {
  territories: MapTerritory[];
  nodes: MapNode[];
  routes: MapRoute[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export type FocusState = {
  taskId: string;
  listId: string;
};

export type { ApiList, ApiTask };