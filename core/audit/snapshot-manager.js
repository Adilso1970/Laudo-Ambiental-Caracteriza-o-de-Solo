function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function createAnalysisSnapshot(analysisResult = {}) {
  return {
    capturedAt: new Date().toISOString(),
    engine: String(analysisResult?.engine ?? "automatic-analysis"),
    executedAt: analysisResult?.executedAt ?? null,
    diagnostic: {
      packVersion: analysisResult?.diagnostic?.packVersion ?? null,
      summary: cloneJsonSafe(analysisResult?.diagnostic?.summary ?? {})
    },
    findings: {
      total: analysisResult?.findings?.total ?? 0,
      emissionGate: cloneJsonSafe(analysisResult?.findings?.emissionGate ?? {}),
      reviewFlags: cloneJsonSafe(analysisResult?.findings?.reviewFlags ?? {})
    },
    recommendations: {
      total: analysisResult?.recommendations?.total ?? 0,
      owners: cloneJsonSafe(analysisResult?.recommendations?.owners ?? {})
    },
    workflowHints: cloneJsonSafe(analysisResult?.workflowHints ?? {}),
    textSuggestionsMeta: cloneJsonSafe(analysisResult?.textSuggestions?.meta ?? {})
  };
}

export function createWorkflowSnapshot({
  projectContext = {},
  analysisResult = {},
  workflowDecision = {}
} = {}) {
  return {
    snapshotVersion: "1.0.0",
    mode: "local-first",
    createdAt: new Date().toISOString(),
    workflowDecision: cloneJsonSafe(workflowDecision),
    analysis: createAnalysisSnapshot(analysisResult),
    projectContext: cloneJsonSafe(projectContext)
  };
}

export function serializeSnapshot(snapshot = {}) {
  return JSON.stringify(snapshot ?? {}, null, 2);
}
