import { runConsistencyAnalysis } from "./consistency-engine.js";
import { loadRecommendationPolicies, loadLaudoSnippets } from "./aux-pack-loader.js";
import { buildFindings } from "./findings-engine.js";
import { buildRecommendations } from "./recommendation-engine.js";
import { composeTechnicalText } from "./technical-text-composer.js";

function suggestWorkflowStatus(result) {
  const canEmit = result?.findings?.emissionGate?.canEmit;
  const hasItems = (result?.findings?.total ?? 0) > 0;
  const hasReview = Boolean(result?.findings?.reviewFlags?.requiresTechnicalReview);

  if (canEmit === false) return "com_pendencias";
  if (hasReview || hasItems) return "em_revisao_tecnica";
  return "aprovado_para_emissao";
}

export async function runAutomaticAnalysis(rawContext = {}, options = {}) {
  const version = String(options.version ?? "v1");
  const [diagnostic, recommendationPolicies, laudoSnippets] = await Promise.all([
    runConsistencyAnalysis(rawContext, options),
    loadRecommendationPolicies(version),
    loadLaudoSnippets(version)
  ]);

  const findings = buildFindings(diagnostic.matches, diagnostic.summary);
  const recommendations = buildRecommendations(diagnostic.matches, recommendationPolicies);

  const result = {
    engine: "automatic-analysis",
    executedAt: new Date().toISOString(),
    diagnostic,
    findings,
    recommendations
  };

  const textSuggestions = composeTechnicalText(result, laudoSnippets);

  return {
    ...result,
    textSuggestions,
    workflowHints: {
      suggestedStatus: suggestWorkflowStatus(result),
      canEmit: Boolean(findings?.emissionGate?.canEmit)
    }
  };
}
