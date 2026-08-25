<script lang="ts">
  import type { ApiList, ApiTask } from "../types.ts";
  import type { DerivedMap, FocusState, MapNode, MapViewport } from "./types.ts";
  import { CHART } from "../ui/theme.ts";
  import { projectColor } from "../ui/theme.ts";

  let {
    map,
    lists,
    tasks,
    viewport = $bindable(),
    selectedTaskId = $bindable(),
    focusMode = $bindable(),
    focusedTaskId = $bindable(),
    onNodePositionChange,
    onNodeConnect,
    onProjectClick,
  }: {
    map: DerivedMap;
    lists: ApiList[];
    tasks: ApiTask[];
    viewport: MapViewport;
    selectedTaskId: string | null;
    focusMode: boolean;
    focusedTaskId: string | null;
    onNodePositionChange: (taskId: string, pos: { x: number; y: number }) => void;
    onNodeConnect: (fromId: string, toId: string) => void;
    onProjectClick: (listId: string) => void;
  } = $props();

  const WIDTH = 1400;
  const HEIGHT = 900;
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 2.5;
  const DRAG_THRESHOLD = 6;

  let svgEl: SVGSVGElement | undefined = $state();
  let panOrigin: { x: number; y: number; vx: number; vy: number } | null = null;
  let dragNode: { id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null = null;
  let dragMoved = false;
  let connectFrom: { id: string; x: number; y: number; hoverId: string | null } | null = null;
  let pointerXY = $state<{ x: number; y: number } | null>(null);

  function clampZoom(z: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  function toWorld(svgX: number, svgY: number): { x: number; y: number } {
    return {
      x: (svgX - WIDTH / 2) / viewport.zoom - viewport.x,
      y: (svgY - HEIGHT / 2) / viewport.zoom - viewport.y,
    };
  }

  function svgPoint(evt: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    const sx = ((evt.clientX - rect.left) / rect.width) * WIDTH;
    const sy = ((evt.clientY - rect.top) / rect.height) * HEIGHT;
    return { x: sx, y: sy };
  }

  function startPan(evt: PointerEvent) {
    if (evt.button !== 0) return;
    const target = evt.target as Element;
    if (target.closest("[data-node]") || target.closest("[data-territory-label]")) return;
    panOrigin = { x: evt.clientX, y: evt.clientY, vx: viewport.x, vy: viewport.y };
    (evt.currentTarget as Element).setPointerCapture(evt.pointerId);
  }

  function movePan(evt: PointerEvent) {
    if (panOrigin) {
      const dx = (evt.clientX - panOrigin.x) / viewport.zoom;
      const dy = (evt.clientY - panOrigin.y) / viewport.zoom;
      viewport = { ...viewport, x: panOrigin.vx - dx, y: panOrigin.vy - dy };
      return;
    }
    if (dragNode) {
      const sp = svgPoint(evt);
      const w = toWorld(sp.x, sp.y);
      const next = { x: w.x - dragNode.offsetX, y: w.y - dragNode.offsetY };
      onNodePositionChange(dragNode.id, next);
      const moved =
        Math.abs(next.x - dragNode.startX) > 4 || Math.abs(next.y - dragNode.startY) > 4;
      if (moved) dragMoved = true;
      return;
    }
    if (connectFrom) {
      const sp = svgPoint(evt);
      const w = toWorld(sp.x, sp.y);
      pointerXY = w;
      const hit = nodeAt(w.x, w.y);
      connectFrom = { ...connectFrom, hoverId: hit && hit !== connectFrom.id ? hit : null };
      return;
    }
  }

  function endPan(evt: PointerEvent) {
    if (panOrigin) {
      panOrigin = null;
      try {
        (evt.currentTarget as Element).releasePointerCapture(evt.pointerId);
      } catch {
        // ignore
      }
      return;
    }
    if (dragNode) {
      dragNode = null;
      dragMoved = false;
      try {
        (evt.currentTarget as Element).releasePointerCapture(evt.pointerId);
      } catch {
        // ignore
      }
      return;
    }
    if (connectFrom) {
      if (connectFrom.hoverId) {
        onNodeConnect(connectFrom.id, connectFrom.hoverId);
      }
      connectFrom = null;
      pointerXY = null;
      try {
        (evt.currentTarget as Element).releasePointerCapture(evt.pointerId);
      } catch {
        // ignore
      }
    }
  }

  function onWheel(evt: WheelEvent) {
    evt.preventDefault();
    const sp = svgPoint(evt);
    const before = toWorld(sp.x, sp.y);
    const factor = evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clampZoom(viewport.zoom * factor);
    viewport = { ...viewport, zoom: nextZoom };
    const after = toWorld(sp.x, sp.y);
    viewport = { ...viewport, x: viewport.x + (before.x - after.x), y: viewport.y + (before.y - after.y) };
  }

  function onDblClick(evt: MouseEvent) {
    const target = evt.target as Element;
    if (target.closest("[data-node]") || target.closest("[data-territory-label]")) return;
    const sp = svgPoint(evt);
    const before = toWorld(sp.x, sp.y);
    const nextZoom = clampZoom(viewport.zoom * 1.4);
    viewport = { ...viewport, zoom: nextZoom };
    const after = toWorld(sp.x, sp.y);
    viewport = { ...viewport, x: viewport.x + (before.x - after.x), y: viewport.y + (before.y - after.y) };
  }

  function nodeAt(x: number, y: number): string | null {
    for (const n of map.nodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= 18 * 18) return n.taskId;
    }
    return null;
  }

  function startNodeDrag(evt: PointerEvent, node: MapNode) {
    evt.stopPropagation();
    if (evt.button !== 0) return;
    if (evt.shiftKey) {
      const sp = svgPoint(evt);
      const w = toWorld(sp.x, sp.y);
      connectFrom = { id: node.taskId, x: node.x, y: node.y, hoverId: null };
      pointerXY = w;
      (evt.currentTarget as Element).setPointerCapture(evt.pointerId);
      return;
    }
    const sp = svgPoint(evt);
    const w = toWorld(sp.x, sp.y);
    dragNode = {
      id: node.taskId,
      startX: node.x,
      startY: node.y,
      offsetX: w.x - node.x,
      offsetY: w.y - node.y,
    };
    dragMoved = false;
    (evt.currentTarget as Element).setPointerCapture(evt.pointerId);
  }

  function clickNode(taskId: string) {
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    selectedTaskId = taskId;
  }

  function isFocused(t: ApiTask): boolean {
    if (!focusMode || !focusedTaskId) return true;
    const focus = tasks.find((x) => x.id === focusedTaskId);
    if (!focus) return true;
    if (t.id === focusedTaskId) return true;
    if (t.listId === focus.listId) return true;
    const chain = new Set<string>([focus.id]);
    let frontier: string[] = [focus.id];
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const t2 of tasks) {
          if (t2.dependsOn === id && !chain.has(t2.id)) {
            chain.add(t2.id);
            next.push(t2.id);
          }
        }
      }
      frontier = next;
    }
    const reverse = new Set<string>([focus.id]);
    let rfrontier: string[] = [focus.id];
    while (rfrontier.length) {
      const next: string[] = [];
      for (const id of rfrontier) {
        for (const t2 of tasks) {
          if (t2.id === id) continue;
          if (t2.dependsOn === id && !reverse.has(t2.id)) {
            // already added
          }
          if ((t2.dependsOn === id || reverse.has(t2.dependsOn ?? "")) && !reverse.has(t2.id)) {
            reverse.add(t2.id);
            next.push(t2.id);
          }
        }
      }
      rfrontier = next;
    }
    return chain.has(t.id) || reverse.has(t.id);
  }

  function nodeOpacity(t: ApiTask): number {
    if (!focusMode) return 1;
    return isFocused(t) ? 1 : 0.18;
  }

  const tasksById = $derived(new Map(tasks.map((t) => [t.id, t])));
  const focusTarget = $derived(
    focusedTaskId ? map.nodes.find((n) => n.taskId === focusedTaskId) ?? null : null,
  );

  const gridLines = $derived.by(() => {
    const step = 60;
    const startX = Math.floor((viewport.x - WIDTH / 2 / viewport.zoom) / step) * step;
    const endX = Math.ceil((viewport.x + WIDTH / 2 / viewport.zoom) / step) * step;
    const startY = Math.floor((viewport.y - HEIGHT / 2 / viewport.zoom) / step) * step;
    const endY = Math.ceil((viewport.y + HEIGHT / 2 / viewport.zoom) / step) * step;
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let x = startX; x <= endX; x += step) {
      lines.push({ x1: x, y1: startY, x2: x, y2: endY, major: x % 300 === 0 });
    }
    for (let y = startY; y <= endY; y += step) {
      lines.push({ x1: startX, y1: y, x2: endX, y2: y, major: y % 300 === 0 });
    }
    return lines;
  });

  const contours = $derived.by(() => {
    return [
      { cx: -180, cy: -80, rx: 380, ry: 220, major: false },
      { cx: -180, cy: -80, rx: 250, ry: 150, major: true },
      { cx: 220, cy: 120, rx: 340, ry: 200, major: false },
      { cx: 220, cy: 120, rx: 220, ry: 130, major: true },
      { cx: -20, cy: -260, rx: 220, ry: 130, major: false },
      { cx: -440, cy: 160, rx: 200, ry: 140, major: false },
    ];
  });
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {WIDTH} {HEIGHT}"
  class="block h-full w-full select-none touch-none"
  onpointerdown={startPan}
  onpointermove={movePan}
  onpointerup={endPan}
  onpointercancel={endPan}
  onwheel={onWheel}
  ondblclick={onDblClick}
  role="application"
  aria-label="Mapa de tareas"
>
  <defs>
    <radialGradient id="lighthouse-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color={CHART.lighthouse} stop-opacity="0.9" />
      <stop offset="60%" stop-color={CHART.lighthouse} stop-opacity="0.15" />
      <stop offset="100%" stop-color={CHART.lighthouse} stop-opacity="0" />
    </radialGradient>
    <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color={CHART.beamEdge} stop-opacity="0.7" />
      <stop offset="100%" stop-color={CHART.beam} stop-opacity="0" />
    </linearGradient>
    <pattern id="grain-pattern" patternUnits="userSpaceOnUse" width="200" height="200">
      <rect width="200" height="200" fill="transparent" />
      <circle cx="40" cy="60" r="0.6" fill="rgba(231,255,68,0.06)" />
      <circle cx="160" cy="40" r="0.6" fill="rgba(231,255,68,0.04)" />
      <circle cx="100" cy="140" r="0.6" fill="rgba(231,255,68,0.05)" />
      <circle cx="20" cy="180" r="0.6" fill="rgba(231,255,68,0.03)" />
      <circle cx="180" cy="160" r="0.6" fill="rgba(231,255,68,0.05)" />
    </pattern>
  </defs>

  <g transform="translate({WIDTH / 2 + viewport.x * viewport.zoom}, {HEIGHT / 2 + viewport.y * viewport.zoom}) scale({viewport.zoom})">
    <rect x={-3000} y={-2000} width="6000" height="4000" fill="url(#grain-pattern)" opacity="0.6" />

    <g class="chart-grid">
      {#each gridLines as line}
        <line
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          class={line.major ? "major" : ""}
        />
      {/each}
    </g>

    <g>
      {#each contours as c}
        <ellipse cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} class="chart-contour {c.major ? 'major' : ''}" />
      {/each}
    </g>

    <g>
      {#each map.territories as t (t.listId)}
        {@const inactive = t.activeCount === 0}
        <g
          class="chart-territory"
          style:opacity={inactive ? 0.4 : 1}
          onclick={() => onProjectClick(t.listId)}
          role="button"
          tabindex="-1"
          aria-label={`Territorio ${t.name}`}
        >
          <ellipse
            cx={t.cx}
            cy={t.cy}
            rx={t.rx}
            ry={t.ry}
            fill="none"
            stroke={CHART.territoryStroke}
            stroke-width="1"
            stroke-dasharray="2 5"
          />
          <text
            data-territory-label
            x={t.cx - t.rx + 8}
            y={t.cy - t.ry + 18}
            class="nautical-coord"
            style:fill={inactive ? "rgba(161,161,170,0.35)" : "rgba(231,255,68,0.65)"}
            style:font-size="10px"
            style:font-family="var(--font-mono)"
            style:letter-spacing="0.18em"
          >
            {t.name.toUpperCase()}
          </text>
          <text
            x={t.cx - t.rx + 8}
            y={t.cy - t.ry + 32}
            class="nautical-coord"
          >
            {t.activeCount} activas · {t.taskCount - t.activeCount} hechas
          </text>
        </g>
      {/each}
    </g>

    <g>
      {#each map.routes as r (r.fromId + "->" + r.toId)}
        {@const a = map.nodes.find((n) => n.taskId === r.fromId)}
        {@const b = map.nodes.find((n) => n.taskId === r.toId)}
        {@const tA = tasksById.get(r.fromId)}
        {@const tB = tasksById.get(r.toId)}
        {#if a && b && tA && tB}
          {@const inFocus = !focusMode || (focusedTaskId && (focusedTaskId === r.fromId || focusedTaskId === r.toId))}
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            class="chart-route"
            stroke={inFocus ? CHART.routeFocus : CHART.route}
            stroke-width="1.2"
            style:opacity={inFocus ? 0.9 : 0.25}
          />
        {/if}
      {/each}
    </g>

    <g>
      {#each map.nodes as n (n.taskId)}
        {@const t = tasksById.get(n.taskId)}
        {#if t}
          {@const selected = selectedTaskId === n.taskId}
          {@const completed = t.completed}
          {@const priority = t.priority === "high"}
          {@const op = nodeOpacity(t)}
          <g
            data-node={n.taskId}
            class="chart-node"
            transform="translate({n.x}, {n.y})"
            style:opacity={op}
            onpointerdown={(e) => startNodeDrag(e, n)}
            onclick={() => clickNode(n.taskId)}
            role="button"
            tabindex="-1"
            aria-label={t.title}
          >
            {#if selected}
              <circle r="14" fill={CHART.nodeFillSelected} opacity="0.15" />
              <circle r="9" fill={CHART.nodeFillSelected} opacity="0.25" />
            {/if}
            <circle
              r="7"
              fill={selected ? CHART.nodeFillSelected : completed ? CHART.nodeFillCompleted : priority ? CHART.nodeStrokeSelected : CHART.nodeFill}
              stroke={selected || priority ? CHART.nodeStrokeSelected : CHART.nodeStroke}
              stroke-width={priority ? 2 : 1.5}
              stroke-dasharray={completed ? "2 2" : ""}
              opacity={completed ? 0.45 : 1}
            />
            {#if priority && !completed}
              <circle r="3" fill={CHART.nodeStrokeSelected} opacity="0.9" />
            {/if}
            <text
              x="0"
              y="-13"
              text-anchor="middle"
              style:fill={selected ? "var(--color-lime)" : "rgba(244,244,245,0.85)"}
              style:font-family="var(--font-sans)"
              style:font-size="11px"
              style:font-weight={selected ? "600" : "400"}
              style:text-decoration={completed ? "line-through" : "none"}
              opacity={completed ? 0.5 : 1}
            >
              {t.title.length > 28 ? t.title.slice(0, 27) + "…" : t.title}
            </text>
            <title>
              {t.title} · {lists.find((l) => l.id === t.listId)?.name ?? ""}{t.dueAt ? ` · ${new Date(t.dueAt).toLocaleString("es-AR")}` : ""}
            </title>
          </g>
        {/if}
      {/each}
    </g>

    {#if connectFrom && pointerXY}
      {@const fromNode = map.nodes.find((n) => n.taskId === connectFrom!.id)}
      {#if fromNode}
        <line
          x1={fromNode.x}
          y1={fromNode.y}
          x2={pointerXY.x}
          y2={pointerXY.y}
          stroke={CHART.routeFocus}
          stroke-width="1.5"
          stroke-dasharray="3 4"
        />
        <circle cx={pointerXY.x} cy={pointerXY.y} r="5" fill={CHART.beamEdge} />
      {/if}
    {/if}

    <g transform="translate(-560, 360)">
      <circle r="48" fill="url(#lighthouse-halo)" opacity={focusTarget ? 0.9 : 0.35} />
      <g>
        <rect x="-6" y="-18" width="12" height="22" fill="#1A2023" stroke="rgba(231,255,68,0.4)" />
        <polygon points="-9,-18 9,-18 0,-30" fill="#121719" stroke="rgba(231,255,68,0.4)" />
        <rect x="-7" y="-10" width="14" height="6" fill={CHART.lighthouse} opacity="0.85" />
        <rect x="-3" y="4" width="6" height="14" fill="#1A2023" />
        <rect x="-9" y="18" width="18" height="4" fill="#1A2023" />
      </g>
      {#if focusTarget}
        {@const dx = focusTarget.x - (-560)}
        {@const dy = focusTarget.y - 360}
        {@const dist = Math.sqrt(dx * dx + dy * dy)}
        {@const angle = Math.atan2(dy, dx) * (180 / Math.PI)}
        <g transform="rotate({angle})" opacity="0.9" style="transition: opacity 220ms ease">
          <polygon
            points="6,-30 {dist * 0.95},-18 {dist * 0.95},18 6,30"
            fill="url(#beam-gradient)"
          />
          <line
            x1="6"
            y1="0"
            x2={dist * 0.95}
            y2="0"
            stroke={CHART.beamEdge}
            stroke-width="1.2"
            stroke-dasharray="2 4"
            opacity="0.7"
          />
        </g>
      {/if}
    </g>

    <g>
      <text x={map.bounds.minX} y={map.bounds.minY - 16} class="nautical-coord">
        {Math.abs(Math.round(map.bounds.minX))}°N · {Math.abs(Math.round(map.bounds.minY))}°W
      </text>
      <text x={map.bounds.maxX} y={map.bounds.minY - 16} class="nautical-coord" text-anchor="end">
        {Math.abs(Math.round(map.bounds.maxX))}°N · {Math.abs(Math.round(map.bounds.minY))}°W
      </text>
      <text x={map.bounds.minX} y={map.bounds.maxY + 24} class="nautical-coord">
        {Math.abs(Math.round(map.bounds.minX))}°N · {Math.abs(Math.round(map.bounds.maxY))}°W
      </text>
      <text x={map.bounds.maxX} y={map.bounds.maxY + 24} class="nautical-coord" text-anchor="end">
        {Math.abs(Math.round(map.bounds.maxX))}°N · {Math.abs(Math.round(map.bounds.maxY))}°W
      </text>
    </g>
  </g>
</svg>