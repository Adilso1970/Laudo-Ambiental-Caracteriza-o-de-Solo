const PRIORITY_BY_SEVERITY = Object.freeze({
  critico: 100,
  atencao: 80,
  alerta: 60,
  info: 40
});

function uniqueList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeItem(item = {}) {
  const severity = String(item?.severity ?? "info").toLowerCase();
  const outputType = String(item?.outputType ?? "observacao").toLowerCase();

  return {
    id: String(item?.id ?? ""),
    theme: String(item?.theme ?? "geral"),
    severity,
    outputType,
    priority: PRIORITY_BY_SEVERITY[severity] ?? 10,
    message: String(item?.message ?? "").trim(),
    recommendation: String(item?.recommendation ?? "").trim(),
    requires: uniqueList(item?.requires),
    version: String(item?.version ?? "")
  };
}

export function buildFindings(matches = [], summary = {}) {
  const normalized = (Array.isArray(matches) ? matches : [])
    .map(normalizeItem)
    .sort((a, b) => b.priority - a.priority);

  const byType = {
    pendencias: normalized.filter(item => item.outputType === "pendencia"),
    inconsistencias: normalized.filter(item => item.outputType === "inconsistencia"),
    achados: normalized.filter(item => item.outputType === "achado"),
    observacoes: normalized.filter(item => !["pendencia", "inconsistencia", "achado"].includes(item.outputType))
  };

  const blockingReasons = [];
  if (summary?.blocking) {
    blockingReasons.push("Há ocorrência classificada como crítica.");
  }
  if (byType.pendencias.length > 0) {
    blockingReasons.push("Existem pendências técnicas em aberto.");
  }

  const requires = uniqueList(
    normalized.flatMap(item => Array.isArray(item.requires) ? item.requires : [])
  );

  return {
    total: normalized.length,
    highestPriority: normalized[0]?.priority ?? 0,
    byType,
    requires,
    blockingReasons,
    emissionGate: {
      canEmit: blockingReasons.length === 0,
      status: blockingReasons.length === 0 ? "apto_para_emissao" : "bloqueado_para_emissao",
      reasons: blockingReasons
    },
    reviewFlags: {
      requiresTechnicalReview: Boolean(summary?.reviewRecommended),
      requiresImmediateAction: normalized.some(item => item.severity === "critico")
    },
    items: normalized
  };
}
