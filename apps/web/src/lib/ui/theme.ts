// Paleta sobria de acentos para proyectos/indicadores.
// Sparse: lime es el primario; estos son acentos contenidos.

export const PROJECT_COLORS = [
  "#E7FF44", // lime
  "#7DD3A8", // verde
  "#6BA8E5", // azul tenue
  "#E5A96B", // ámbar
  "#C78BE0", // malva
  "#E58B9D", // rosa tenue
];

export function projectColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

export function todayLabel(now = new Date()): string {
  return now
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function dueLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(iso)) return `Hoy ${timeLabel(iso)}`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d
    .toLocaleDateString("es-AR", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

// Tokens para la carta náutica del mapa.
// ponytail: vivos a propósito — son valores SVG-only y no se exportan a CSS.
// Subir opacity global si se nota el fondo muy apagado en monitores claros.
export const CHART = {
  grid: "rgba(231, 255, 68, 0.04)",
  gridStrong: "rgba(231, 255, 68, 0.07)",
  contour: "rgba(125, 211, 168, 0.10)",
  contourStrong: "rgba(125, 211, 168, 0.18)",
  coord: "rgba(161, 161, 170, 0.35)",
  territoryStroke: "rgba(231, 255, 68, 0.18)",
  territoryStrokeActive: "rgba(231, 255, 68, 0.42)",
  route: "rgba(161, 161, 170, 0.35)",
  routeFocus: "rgba(231, 255, 68, 0.75)",
  nodeFill: "#0B0F10",
  nodeStroke: "#1A2023",
  nodeFillActive: "#203A2E",
  nodeFillCompleted: "#121719",
  nodeFillSelected: "#E7FF44",
  nodeStrokeSelected: "#E7FF44",
  lighthouse: "rgba(231, 255, 68, 0.85)",
  beam: "rgba(231, 255, 68, 0.18)",
  beamEdge: "rgba(231, 255, 68, 0.55)",
};
