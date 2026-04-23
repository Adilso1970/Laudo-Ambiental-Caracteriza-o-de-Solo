import { loadNormativePack } from "../normative/normative-loader.js";
import { evaluateNormativePack } from "../normative/rule-engine.js";
import { normalizeProjectContext } from "./context-normalizer.js";
import { buildAnalysisSummary, buildHumanReadableReport } from "./diagnostic-summary.js";

export async function runConsistencyAnalysis(rawContext = {}, options = {}) {
  const version = String(options.version ?? "v1");
  const pack = await loadNormativePack(version);
  const normalizedContext = normalizeProjectContext(rawContext);
  const matches = evaluateNormativePack(pack, normalizedContext);
  const summary = buildAnalysisSummary(matches);

  return {
    engine: "consistency-analysis",
    packVersion: pack?.version ?? version,
    domain: pack?.domain ?? "app-caracterizacao-solo-nb",
    executedAt: new Date().toISOString(),
    normalizedContext,
    matches,
    summary,
    humanReport: buildHumanReadableReport({
      packVersion: pack?.version ?? version,
      matches,
      summary
    })
  };
}
