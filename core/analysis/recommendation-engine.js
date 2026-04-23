function severityRank(value = "info") {
  const map = { critico: 4, atencao: 3, alerta: 2, info: 1 };
  return map[String(value).toLowerCase()] ?? 0;
}

function deadlineRank(value = "normal") {
  const map = { imediato: 4, prioritario: 3, curto_prazo: 2, normal: 1 };
  return map[String(value).toLowerCase()] ?? 0;
}

function findPolicy(item, pack) {
  const policies = Array.isArray(pack?.policies) ? pack.policies : [];

  return (
    policies.find(policy =>
      String(policy?.match?.severity ?? "").toLowerCase() === String(item?.severity ?? "").toLowerCase() &&
      String(policy?.match?.outputType ?? "").toLowerCase() === String(item?.outputType ?? "").toLowerCase()
    ) ||
    policies.find(policy =>
      String(policy?.match?.severity ?? "").toLowerCase() === String(item?.severity ?? "").toLowerCase() &&
      !policy?.match?.outputType
    ) ||
    policies.find(policy => String(policy?.id ?? "") === "POL-DEFAULT") ||
    {}
  );
}

export function buildRecommendations(matches = [], policyPack = {}) {
  const items = (Array.isArray(matches) ? matches : [])
    .map(item => {
      const policy = findPolicy(item, policyPack);

      return {
        sourceId: item?.id ?? "",
        severity: String(item?.severity ?? "info").toLowerCase(),
        outputType: String(item?.outputType ?? "observacao").toLowerCase(),
        message: String(item?.message ?? "").trim(),
        recommendation: String(item?.recommendation ?? "").trim(),
        owner: String(policy?.owner ?? "responsavel_tecnico"),
        deadlineClass: String(policy?.deadlineClass ?? "normal"),
        reviewLevel: String(policy?.reviewLevel ?? "recomendada"),
        actionRequired: String(policy?.actionRequired ?? "avaliar e registrar"),
        policyId: String(policy?.id ?? "POL-DEFAULT")
      };
    })
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity);
      if (sev !== 0) return sev;
      return deadlineRank(b.deadlineClass) - deadlineRank(a.deadlineClass);
    });

  const owners = {};
  for (const item of items) {
    owners[item.owner] = (owners[item.owner] ?? 0) + 1;
  }

  return {
    total: items.length,
    owners,
    items
  };
}
