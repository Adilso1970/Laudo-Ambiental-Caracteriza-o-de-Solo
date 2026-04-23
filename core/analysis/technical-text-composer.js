function interpolate(template, variables = {}) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (_, key) => String(variables[key] ?? ""));
}

function topMessages(items = [], limit = 3) {
  return (Array.isArray(items) ? items : [])
    .slice(0, limit)
    .map(item => String(item?.message ?? "").trim())
    .filter(Boolean);
}

function joinSentences(values = []) {
  return values.filter(Boolean).join(" ");
}

export function composeTechnicalText(result = {}, snippetPack = {}) {
  const snippets = snippetPack?.snippets ?? {};
  const summary = result?.diagnostic?.summary ?? {};
  const findings = result?.findings ?? {};
  const recommendations = result?.recommendations ?? {};
  const topItems = findings?.items ?? [];
  const topPendencias = findings?.byType?.pendencias ?? [];

  const resumoBase = findings?.total > 0
    ? interpolate(snippets?.resumoTecnico?.withOccurrences, { total: findings.total })
    : String(snippets?.resumoTecnico?.clean ?? "Não foram detectadas ocorrências automáticas relevantes.");

  const resumoDetalhe = topMessages(topItems, 3).join(" ");
  const resumoTecnico = joinSentences([resumoBase, resumoDetalhe]);

  const conformidade = findings?.emissionGate?.canEmit
    ? String(snippets?.conformidade?.clear ?? "Não foram identificados impedimentos automáticos para emissão.")
    : joinSentences([
        String(snippets?.conformidade?.blocking ?? "Existem pendências técnicas que impedem a emissão automática."),
        findings?.emissionGate?.reasons?.join(" ") ?? ""
      ]);

  const pendencias = topPendencias.length > 0
    ? joinSentences([
        String(snippets?.pendencias?.intro ?? "Pendências prioritárias:"),
        topMessages(topPendencias, 5).join(" ")
      ])
    : String(snippets?.pendencias?.empty ?? "Não há pendências automáticas em aberto.");

  const recomendacoesTexto = recommendations?.items?.length > 0
    ? joinSentences([
        String(snippets?.recomendacoes?.intro ?? "Recomenda-se:"),
        recommendations.items
          .slice(0, 5)
          .map(item => `${item.actionRequired} (${item.owner})`)
          .join("; ") + "."
      ])
    : String(snippets?.recomendacoes?.empty ?? "Sem recomendações automáticas adicionais.");

  return {
    resumoTecnico,
    conformidade,
    pendencias,
    recomendacoes: recomendacoesTexto,
    meta: {
      totalOcorrencias: summary?.total ?? findings?.total ?? 0,
      bloqueante: Boolean(findings?.emissionGate?.canEmit === false)
    }
  };
}
