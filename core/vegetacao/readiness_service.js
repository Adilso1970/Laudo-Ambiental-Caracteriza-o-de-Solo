import { validateVegetacaoSessionContract, buildVegetacaoSessionChecklist } from './validator.js';
import { buildVegetacaoPipeline, buildVegetacaoPipelineSnapshot } from './pipeline.js';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function safeObject(value) {
  return typeof value === 'object' && value !== null ? value : {};
}

export function normalizeVegetacaoReadinessInput(input = {}) {
  return {
    project: safeObject(input.project),
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: toNumber(input.threshold || 60) || 60,
    metadata: safeObject(input.metadata)
  };
}

function buildDecision(validation = {}, pipeline = {}) {
  const summary = validation.summary ?? {};
  const gates = validation.gates ?? {};
  const analysisSummary = pipeline.analysis?.resumo ?? {};
  const readyForLaudo = Boolean(pipeline.laudoHook?.readyForLaudo);

  if (!gates.sessionMinimaOk) {
    return {
      code: 'blocked_structure',
      label: 'Estrutura bloqueada',
      canContinue: false,
      canPublishLaudoHook: false,
      readyForLaudo: false
    };
  }

  if (!gates.preAnalisePodeRodar) {
    return {
      code: 'blocked_preanalysis',
      label: 'Pre-analise bloqueada',
      canContinue: false,
      canPublishLaudoHook: false,
      readyForLaudo: false
    };
  }

  if (summary.warnings > 0 || toNumber(analysisSummary.pendenciasAbertas) > 0 || !readyForLaudo) {
    return {
      code: 'review_required',
      label: 'Revisao tecnica necessaria',
      canContinue: true,
      canPublishLaudoHook: true,
      readyForLaudo: false
    };
  }

  return {
    code: 'ready_for_laudo',
    label: 'Pronto para laudo',
    canContinue: true,
    canPublishLaudoHook: true,
    readyForLaudo: true
  };
}

function buildQualitySignals(validation = {}, pipeline = {}) {
  const issues = toArray(validation.issues);
  const analysisSummary = pipeline.analysis?.resumo ?? {};
  const dedupAudit = pipeline.analysis?.dedupAudit ?? {};
  const summary = validation.summary ?? {};

  return {
    hasErrors: toNumber(summary.errors) > 0,
    hasWarnings: toNumber(summary.warnings) > 0,
    hasInfos: toNumber(summary.infos) > 0,
    duplicateCandidates: toNumber(dedupAudit.duplicateCandidates),
    duplicateGroups: toNumber(dedupAudit.duplicateGroups),
    pendenciasAbertas: toNumber(analysisSummary.pendenciasAbertas),
    especiesMapeadas: toNumber(analysisSummary.especiesMapeadas),
    totalCapturas: toNumber(analysisSummary.totalCapturas),
    totalSetores: toNumber(analysisSummary.totalSetores),
    totalIssues: issues.length
  };
}

function buildActionQueue(validation = {}, pipeline = {}) {
  const actions = [];
  const summary = validation.summary ?? {};
  const gates = validation.gates ?? {};
  const analysisSummary = pipeline.analysis?.resumo ?? {};
  const dedupAudit = pipeline.analysis?.dedupAudit ?? {};

  if (!gates.sessionMinimaOk) {
    actions.push('Corrigir erros estruturais da sessao antes de continuar.');
  }

  if (toNumber(summary.warnings) > 0) {
    actions.push('Revisar avisos tecnicos do projeto, setores e capturas.');
  }

  if (toNumber(dedupAudit.duplicateCandidates) > 0) {
    actions.push('Revisar candidatos de deduplicacao antes da consolidacao final.');
  }

  if (toNumber(analysisSummary.pendenciasAbertas) > 0) {
    actions.push('Tratar pendencias da pre-analise antes da integracao final no laudo.');
  }

  if (!actions.length) {
    actions.push('Sessao apta para proxima integracao tecnica do modulo Vegetacao.');
  }

  return actions;
}

export function buildVegetacaoReadinessReport(input = {}) {
  const normalized = normalizeVegetacaoReadinessInput(input);

  const validation = validateVegetacaoSessionContract({
    project: normalized.project,
    activeSectorId: normalized.activeSectorId,
    sectors: normalized.sectors,
    captures: normalized.captures
  });

  const checklist = buildVegetacaoSessionChecklist({
    project: normalized.project,
    activeSectorId: normalized.activeSectorId,
    sectors: normalized.sectors,
    captures: normalized.captures
  });

  const pipeline = buildVegetacaoPipeline({
    project: normalized.project,
    sessionId: normalized.sessionId,
    activeSectorId: normalized.activeSectorId,
    captures: normalized.captures,
    sectors: normalized.sectors,
    threshold: normalized.threshold,
    metadata: normalized.metadata
  });

  const pipelineSnapshot = buildVegetacaoPipelineSnapshot({
    project: normalized.project,
    sessionId: normalized.sessionId,
    activeSectorId: normalized.activeSectorId,
    captures: normalized.captures,
    sectors: normalized.sectors,
    threshold: normalized.threshold,
    metadata: normalized.metadata
  });

  const decision = buildDecision(validation, pipeline);
  const quality = buildQualitySignals(validation, pipeline);
  const actions = buildActionQueue(validation, pipeline);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    metadata: normalized.metadata,
    decision,
    quality,
    actions,
    validation,
    checklist,
    pipeline,
    pipelineSnapshot
  };
}

export function buildVegetacaoReadinessSummary(input = {}) {
  const report = buildVegetacaoReadinessReport(input);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    decision: report.decision,
    quality: report.quality,
    actions: report.actions,
    checklist: report.checklist?.checklist ?? [],
    pipelineSnapshot: report.pipelineSnapshot
  };
}