export const WORKFLOW_STATUSES = Object.freeze({
  RASCUNHO: "rascunho",
  EM_PREENCHIMENTO: "em_preenchimento",
  EM_REVISAO_TECNICA: "em_revisao_tecnica",
  COM_PENDENCIAS: "com_pendencias",
  APROVADO_PARA_EMISSAO: "aprovado_para_emissao",
  EMITIDO: "emitido",
  ARQUIVADO: "arquivado"
});

export const WORKFLOW_TRANSITIONS = Object.freeze({
  rascunho: ["em_preenchimento", "arquivado"],
  em_preenchimento: ["em_revisao_tecnica", "com_pendencias", "arquivado"],
  em_revisao_tecnica: ["com_pendencias", "aprovado_para_emissao", "arquivado"],
  com_pendencias: ["em_preenchimento", "em_revisao_tecnica", "arquivado"],
  aprovado_para_emissao: ["emitido", "com_pendencias", "arquivado"],
  emitido: ["arquivado"],
  arquivado: []
});

export function normalizeWorkflowStatus(value = "rascunho") {
  const raw = String(value ?? "rascunho").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WORKFLOW_TRANSITIONS, raw) ? raw : "rascunho";
}

export function getAllowedTransitions(status = "rascunho") {
  const normalized = normalizeWorkflowStatus(status);
  return [...(WORKFLOW_TRANSITIONS[normalized] ?? [])];
}

export function canTransition(fromStatus = "rascunho", toStatus = "rascunho") {
  const from = normalizeWorkflowStatus(fromStatus);
  const to = normalizeWorkflowStatus(toStatus);

  if (from === to) return true;
  return getAllowedTransitions(from).includes(to);
}

export function getWorkflowStageOrder(status = "rascunho") {
  const normalized = normalizeWorkflowStatus(status);
  const map = {
    rascunho: 1,
    em_preenchimento: 2,
    em_revisao_tecnica: 3,
    com_pendencias: 4,
    aprovado_para_emissao: 5,
    emitido: 6,
    arquivado: 7
  };

  return map[normalized] ?? 1;
}
