export function buildAnalysisSummary(matches = []) {
  const items = Array.isArray(matches) ? matches : [];

  const bySeverity = {
    info: 0,
    alerta: 0,
    atencao: 0,
    critico: 0
  };

  const byOutputType = {};

  for (const item of items) {
    const severity = String(item?.severity ?? "info").toLowerCase();
    const outputType = String(item?.outputType ?? "indefinido").toLowerCase();

    if (Object.prototype.hasOwnProperty.call(bySeverity, severity)) {
      bySeverity[severity] += 1;
    } else {
      bySeverity.info += 1;
    }

    byOutputType[outputType] = (byOutputType[outputType] ?? 0) + 1;
  }

  const hasCritical = bySeverity.critico > 0;
  const hasAttention = bySeverity.atencao > 0;
  const hasAlert = bySeverity.alerta > 0;

  return {
    total: items.length,
    bySeverity,
    byOutputType,
    blocking: hasCritical,
    reviewRecommended: hasCritical || hasAttention || hasAlert
  };
}

export function buildHumanReadableReport(result) {
  const summary = result?.summary ?? {};
  const matches = Array.isArray(result?.matches) ? result.matches : [];

  const lines = [];
  lines.push("DIAGNOSTICO TECNICO AUTOMATICO");
  lines.push(`Versao do pacote: ${result?.packVersion ?? "desconhecida"}`);
  lines.push(`Total de ocorrencias: ${summary.total ?? 0}`);
  lines.push(`Critico: ${summary?.bySeverity?.critico ?? 0}`);
  lines.push(`Atencao: ${summary?.bySeverity?.atencao ?? 0}`);
  lines.push(`Alerta: ${summary?.bySeverity?.alerta ?? 0}`);
  lines.push(`Info: ${summary?.bySeverity?.info ?? 0}`);
  lines.push(`Bloqueante: ${summary?.blocking ? "SIM" : "NAO"}`);
  lines.push("");

  if (matches.length === 0) {
    lines.push("Nenhuma inconsistencia ou pendencia detectada.");
    return lines.join("\n");
  }

  lines.push("Ocorrencias:");
  for (const item of matches) {
    lines.push(`- [${String(item.severity ?? "info").toUpperCase()}] ${item.message}`);
    if (item.recommendation) {
      lines.push(`  Recomendacao: ${item.recommendation}`);
    }
    if (Array.isArray(item.requires) && item.requires.length > 0) {
      lines.push(`  Exige: ${item.requires.join(", ")}`);
    }
  }

  return lines.join("\n");
}
