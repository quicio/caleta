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
