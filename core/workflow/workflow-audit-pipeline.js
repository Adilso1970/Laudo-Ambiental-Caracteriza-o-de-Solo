import { buildWorkflowDecision, transitionWorkflowState } from "./workflow-engine.js";

export function runWorkflowAuditStage({
  analysisResult = {},
  currentStatus = "rascunho",
  actor = "sistema",
  reason = "analise_automatica",
  metadata = {},
  projectContext = {}
} = {}) {
  const decision = buildWorkflowDecision(analysisResult, currentStatus);

  return transitionWorkflowState({
    currentStatus,
    targetStatus: decision.targetStatus,
    actor,
    reason,
    metadata: {
      ...metadata,
      source: "workflow-audit-stage"
    },
    analysisResult,
    projectContext
  });
}
