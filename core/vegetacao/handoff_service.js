import { buildVegetacaoReadinessReport, buildVegetacaoReadinessSummary } from './readiness_service.js';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function safeObject(value) {
  return typeof value === 'object' && value !== null ? value : {};
}

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

export function normalizeVegetacaoHandoffInput(input = {}) {
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

function buildExecutiveSummary(report = {}) {
  const project = report.pipeline?.laudoHook?.project ?? {};
  const summary = report.pipeline?.analysis?.resumo ?? {};
  const decision = report.decision ?? {};
  const quality = report.quality ?? {};

  return {
    projectId: toText(project.projectId),
    nomeProjeto: toText(project.nomeProjeto || project.projectId),
    municipio: toText(project.municipio),
    uf: toText(project.uf),
    areaHa: toNumber(project.areaHa),
    decisionCode: toText(decision.code),
    decisionLabel: toText(decision.label),
    readyForLaudo: Boolean(decision.readyForLaudo),
    totalCapturas: toNumber(summary.totalCapturas),
    totalSetores: toNumber(summary.totalSetores),
    especiesMapeadas: toNumber(summary.especiesMapeadas),
    individuosEstimados: toNumber(summary.individuosEstimados),
    areaOcupadaEstimadaM2: toNumber(summary.areaOcupadaEstimadaM2),
    duplicateCandidates: toNumber(summary.duplicateCandidates),
    pendenciasAbertas: toNumber(summary.pendenciasAbertas),
    hasErrors: Boolean(quality.hasErrors),
    hasWarnings: Boolean(quality.hasWarnings)
  };
}

function buildLaudoContract(report = {}) {
  return {
    module: 'vegetacao',
    generatedAt: report.generatedAt,
    readyForLaudo: Boolean(report.decision?.readyForLaudo),
    laudoHook: clone(report.pipeline?.laudoHook ?? null),
    laudoResumo: clone(report.pipeline?.laudoResumo ?? null),
    pipelineSnapshot: clone(report.pipelineSnapshot ?? null)
  };
}

function buildAuditContract(report = {}) {
  return {
    module: 'vegetacao',
    generatedAt: report.generatedAt,
    decision: clone(report.decision ?? null),
    quality: clone(report.quality ?? null),
    actions: clone(report.actions ?? []),
    issues: clone(report.validation?.issues ?? []),
    checklist: clone(report.checklist?.checklist ?? []),
    dedupAudit: clone(report.pipeline?.analysis?.dedupAudit ?? null)
  };
}

function buildTechnicalAppendix(report = {}) {
  return {
    module: 'vegetacao',
    generatedAt: report.generatedAt,
    validation: clone(report.validation ?? null),
    pipeline: clone(report.pipeline ?? null),
    pipelineSnapshot: clone(report.pipelineSnapshot ?? null)
  };
}

function buildDistributionTags(report = {}) {
  const tags = ['vegetacao', 'supressao', 'compensacao'];

  if (report.decision?.readyForLaudo) tags.push('laudo_ready');
  if (report.quality?.hasWarnings) tags.push('review_required');
  if (report.quality?.hasErrors) tags.push('blocked_structure');
  if (toNumber(report.quality?.duplicateCandidates) > 0) tags.push('dedup_pending');

  return [...new Set(tags)];
}

export function buildVegetacaoHandoffPackage(input = {}) {
  const normalized = normalizeVegetacaoHandoffInput(input);
  const report = buildVegetacaoReadinessReport(normalized);
  const summary = buildVegetacaoReadinessSummary(normalized);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    metadata: normalized.metadata,
    tags: buildDistributionTags(report),
    executiveSummary: buildExecutiveSummary(report),
    laudoContract: buildLaudoContract(report),
    auditContract: buildAuditContract(report),
    technicalAppendix: buildTechnicalAppendix(report),
    readinessSummary: clone(summary)
  };
}

export function buildVegetacaoHandoffSnapshot(input = {}) {
  const handoff = buildVegetacaoHandoffPackage(input);

  return {
    version: handoff.version,
    module: handoff.module,
    generatedAt: handoff.generatedAt,
    tags: handoff.tags,
    executiveSummary: handoff.executiveSummary,
    readinessSummary: handoff.readinessSummary
  };
}

export function buildVegetacaoHandoffTextBundle(input = {}) {
  const handoff = buildVegetacaoHandoffPackage(input);
  const summary = handoff.executiveSummary ?? {};

  return {
    titulo: 'Handoff tecnico do modulo Vegetacao',
    subtitulo: summary.nomeProjeto || summary.projectId || 'Projeto atual',
    status: summary.decisionLabel || 'Sem status',
    prontoParaLaudo: Boolean(summary.readyForLaudo),
    indicadores: {
      totalCapturas: toNumber(summary.totalCapturas),
      totalSetores: toNumber(summary.totalSetores),
      especiesMapeadas: toNumber(summary.especiesMapeadas),
      individuosEstimados: toNumber(summary.individuosEstimados),
      areaOcupadaEstimadaM2: toNumber(summary.areaOcupadaEstimadaM2),
      duplicateCandidates: toNumber(summary.duplicateCandidates),
      pendenciasAbertas: toNumber(summary.pendenciasAbertas)
    },
    proximasAcoes: clone(handoff.auditContract?.actions ?? [])
  };
}