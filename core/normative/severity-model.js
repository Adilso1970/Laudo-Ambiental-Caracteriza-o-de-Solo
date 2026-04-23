export const SEVERITY_LEVELS = Object.freeze({
  INFO: "info",
  ALERTA: "alerta",
  ATENCAO: "atencao",
  CRITICO: "critico"
});

export const SEVERITY_WEIGHT = Object.freeze({
  info: 1,
  alerta: 2,
  atencao: 3,
  critico: 4
});

export function normalizeSeverity(value = "info") {
  const normalized = String(value).trim().toLowerCase();
  return SEVERITY_WEIGHT[normalized] ? normalized : "info";
}

export function compareSeverity(a, b) {
  const wa = SEVERITY_WEIGHT[normalizeSeverity(a)] ?? 0;
  const wb = SEVERITY_WEIGHT[normalizeSeverity(b)] ?? 0;
  return wa - wb;
}
