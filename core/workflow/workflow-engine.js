import { normalizeWorkflowStatus, canTransition, getAllowedTransitions } from "./status-machine.js";
import { evaluateApprovalPolicy } from "./approval-policy.js";
import { createAuditEvent } from "../audit/audit-log.js";
import { createWorkflowSnapshot } from "../audit/snapshot-manager.js";

export function buildWorkflowDecision(analysisResult = {}, currentStatus = "rascunho") {
  const normalizedCurrent = normalizeWorkflowStatus(currentStatus);
  const policy = evaluateApprovalPolicy(analysisResult);
  const suggestedStatus = analysisResult?.workflowHints?.suggestedStatus ?? policy?.targetStatus ?? "em_revisao_tecnica";
  const normalizedTarget = normalizeWorkflowStatus(suggestedStatus);

  return {
    currentStatus: normalizedCurrent,
    targetStatus: normalizedTarget,
    canTransition: canTransition(normalizedCurrent, normalizedTarget),
    allowedTransitions: getAllowedTransitions(normalizedCurrent),
    policy
  };
}

export function transitionWorkflowState({
  currentStatus = "rascunho",
  targetStatus,
  actor = "sistema",
  reason = "analise_automatica",
  metadata = {},
  analysisResult = {},
  projectContext = {}
} = {}) {
  const normalizedCurrent = normalizeWorkflowStatus(currentStatus);
  const decision = buildWorkflowDecision(analysisResult, normalizedCurrent);
  const requestedTarget = normalizeWorkflowStatus(targetStatus ?? decision.targetStatus);
  const accepted = canTransition(normalizedCurrent, requestedTarget);
  const finalStatus = accepted ? requestedTarget : normalizedCurrent;

  const auditEvent = createAuditEvent({
    type: "workflow_transition",
    actor,
    previousStatus: normalizedCurrent,
    targetStatus: finalStatus,
    reason,
    metadata: {
      ...metadata,
      requestedTarget,
      accepted,
      suggestedTarget: decision.targetStatus
    }
  });

  const snapshot = createWorkflowSnapshot({
    projectContext,
    analysisResult,
    workflowDecision: {
      currentStatus: normalizedCurrent,
      requestedTarget,
      finalStatus,
      accepted,
      reason,
      policy: decision.policy
    }
  });

  return {
    previousStatus: normalizedCurrent,
    requestedTarget,
    finalStatus,
    accepted,
    rejectionReason: accepted ? null : `Transição inválida de ${normalizedCurrent} para ${requestedTarget}.`,
    nextAllowedTransitions: getAllowedTransitions(finalStatus),
    decision,
    auditEvent,
    snapshot
  };
}
