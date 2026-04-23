function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function evaluateApprovalPolicy(analysisResult = {}) {
  const findings = analysisResult?.findings ?? {};
  const diagnostic = analysisResult?.diagnostic ?? {};
  const emissionGate = findings?.emissionGate ?? {};
  const reviewFlags = findings?.reviewFlags ?? {};
  const bySeverity = diagnostic?.summary?.bySeverity ?? {};
  const pendencias = safeArray(findings?.byType?.pendencias);
  const inconsistencias = safeArray(findings?.byType?.inconsistencias);

  const blockingReasons = [];
  const reviewReasons = [];

  if (analysisResult == null || typeof analysisResult !== "object") {
    blockingReasons.push("Resultado de análise ausente.");
  }

  if (emissionGate?.canEmit === false) {
    for (const reason of safeArray(emissionGate?.reasons)) {
      blockingReasons.push(String(reason));
    }
  }

  if ((bySeverity?.critico ?? 0) > 0) {
    blockingReasons.push("Há ocorrência crítica identificada pela análise automática.");
  }

  if (pendencias.length > 0) {
    blockingReasons.push("Existem pendências técnicas em aberto.");
  }

  if ((bySeverity?.atencao ?? 0) > 0) {
    reviewReasons.push("Há ocorrência classificada em atenção.");
  }

  if ((bySeverity?.alerta ?? 0) > 0) {
    reviewReasons.push("Há ocorrência classificada em alerta.");
  }

  if (inconsistencias.length > 0) {
    reviewReasons.push("Foram detectadas inconsistências técnicas.");
  }

  if (reviewFlags?.requiresTechnicalReview) {
    reviewReasons.push("A análise recomenda revisão técnica.");
  }

  const uniqueBlocking = [...new Set(blockingReasons.filter(Boolean))];
  const uniqueReview = [...new Set(reviewReasons.filter(Boolean))];

  const canApprove = uniqueBlocking.length === 0 && uniqueReview.length === 0;
  const canMoveToReview = uniqueBlocking.length === 0;

  let targetStatus = "aprovado_para_emissao";
  if (uniqueBlocking.length > 0) {
    targetStatus = "com_pendencias";
  }
  else if (uniqueReview.length > 0) {
    targetStatus = "em_revisao_tecnica";
  }

  return {
    canApprove,
    canMoveToReview,
    targetStatus,
    blockingReasons: uniqueBlocking,
    reviewReasons: uniqueReview,
    summary: {
      totalBlockingReasons: uniqueBlocking.length,
      totalReviewReasons: uniqueReview.length
    }
  };
}
