function createEventId(prefix = "AUD") {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

export function createAuditEvent({
  type = "workflow_transition",
  actor = "sistema",
  previousStatus = "",
  targetStatus = "",
  reason = "",
  metadata = {}
} = {}) {
  return {
    id: createEventId("AUD"),
    timestamp: new Date().toISOString(),
    type: String(type),
    actor: String(actor),
    previousStatus: String(previousStatus),
    targetStatus: String(targetStatus),
    reason: String(reason),
    metadata: metadata && typeof metadata === "object" ? metadata : {}
  };
}

export function appendAuditEvent(log = [], event = {}) {
  return [...(Array.isArray(log) ? log : []), event];
}

export function buildAuditDigest(log = []) {
  const items = Array.isArray(log) ? log : [];
  const byType = {};
  const byTargetStatus = {};

  for (const item of items) {
    const type = String(item?.type ?? "indefinido");
    const targetStatus = String(item?.targetStatus ?? "indefinido");

    byType[type] = (byType[type] ?? 0) + 1;
    byTargetStatus[targetStatus] = (byTargetStatus[targetStatus] ?? 0) + 1;
  }

  return {
    total: items.length,
    byType,
    byTargetStatus
  };
}
