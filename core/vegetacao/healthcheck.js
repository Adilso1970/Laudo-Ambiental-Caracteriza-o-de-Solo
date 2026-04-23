import { validateVegetacaoSessionContract } from './validator.js';
import { buildVegetacaoPipelineSnapshot } from './pipeline.js';
import { buildVegetacaoReadinessSummary } from './readiness_service.js';
import { buildVegetacaoHandoffSnapshot } from './handoff_service.js';
import { buildVegetacaoModuleState } from './module_service.js';

const MODULE_NAME = 'vegetacao';

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

function normalizeInput(input = {}) {
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

function createCheck(id, label, ok, details = {}) {
  return {
    id,
    label,
    ok: Boolean(ok),
    details
  };
}

function calculateScore(checks = []) {
  const total = toArray(checks).length;
  if (!total) return 0;

  const passed = toArray(checks).filter((item) => item.ok).length;
  return Math.round((passed / total) * 100);
}

function summarizeChecks(checks = []) {
  return {
    total: toArray(checks).length,
    passed: toArray(checks).filter((item) => item.ok).length,
    failed: toArray(checks).filter((item) => !item.ok).length,
    score: calculateScore(checks)
  };
}

export function buildVegetacaoHealthcheck(input = {}) {
  const normalized = normalizeInput(input);

  const validation = validateVegetacaoSessionContract({
    project: normalized.project,
    activeSectorId: normalized.activeSectorId,
    sectors: normalized.sectors,
    captures: normalized.captures
  });

  const pipelineSnapshot = buildVegetacaoPipelineSnapshot(normalized);
  const readinessSummary = buildVegetacaoReadinessSummary(normalized);
  const handoffSnapshot = buildVegetacaoHandoffSnapshot(normalized);
  const moduleState = buildVegetacaoModuleState(normalized);

  const checks = [
    createCheck(
      'project_id',
      'Projeto possui identificador tecnico',
      Boolean(validation?.project?.projectId),
      { projectId: validation?.project?.projectId || '' }
    ),
    createCheck(
      'validator',
      'Validador estrutural executou',
      Boolean(validation?.summary),
      { errors: validation?.summary?.errors ?? null, warnings: validation?.summary?.warnings ?? null }
    ),
    createCheck(
      'captures_loaded',
      'Sessao possui capturas carregadas',
      toArray(normalized.captures).length > 0,
      { totalCapturas: toArray(normalized.captures).length }
    ),
    createCheck(
      'sectors_loaded',
      'Sessao possui setores carregados',
      toArray(normalized.sectors).length > 0,
      { totalSetores: toArray(normalized.sectors).length }
    ),
    createCheck(
      'pipeline',
      'Pipeline tecnico executou',
      Boolean(pipelineSnapshot?.resumo),
      { status: pipelineSnapshot?.resumo?.status ?? '' }
    ),
    createCheck(
      'readiness',
      'Readiness tecnico executou',
      Boolean(readinessSummary?.decision),
      { decisionCode: readinessSummary?.decision?.code ?? '' }
    ),
    createCheck(
      'handoff',
      'Handoff tecnico executou',
      Boolean(handoffSnapshot?.executiveSummary),
      { readyForLaudo: handoffSnapshot?.executiveSummary?.readyForLaudo ?? false }
    ),
    createCheck(
      'module_state',
      'Estado consolidado do modulo foi gerado',
      Boolean(moduleState?.flags),
      { readyForLaudo: moduleState?.flags?.readyForLaudo ?? false }
    ),
    createCheck(
      'structure_errors',
      'Sessao sem erros estruturais',
      toNumber(validation?.summary?.errors) === 0,
      { errors: validation?.summary?.errors ?? null }
    ),
    createCheck(
      'laudo_ready',
      'Modulo apto para laudo',
      Boolean(moduleState?.flags?.readyForLaudo),
      { pendenciasAbertas: moduleState?.flags?.pendenciasAbertas ?? null }
    )
  ];

  const summary = summarizeChecks(checks);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    passed: summary.failed === 0,
    summary,
    checks,
    artifacts: {
      validation: clone(validation),
      pipelineSnapshot: clone(pipelineSnapshot),
      readinessSummary: clone(readinessSummary),
      handoffSnapshot: clone(handoffSnapshot),
      moduleState: clone(moduleState)
    }
  };
}

export function buildVegetacaoHealthcheckSnapshot(input = {}) {
  const report = buildVegetacaoHealthcheck(input);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    passed: report.passed,
    summary: report.summary,
    checks: report.checks.map((item) => ({
      id: item.id,
      label: item.label,
      ok: item.ok
    }))
  };
}

export function buildVegetacaoHealthcheckTextBundle(input = {}) {
  const report = buildVegetacaoHealthcheck(input);
  const moduleState = report?.artifacts?.moduleState ?? {};
  const flags = moduleState?.flags ?? {};

  return {
    titulo: 'Healthcheck tecnico do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0,
    readyForLaudo: Boolean(flags.readyForLaudo),
    totalCapturas: toNumber(flags.totalCapturas),
    totalSetores: toNumber(flags.totalSetores),
    especiesMapeadas: toNumber(flags.especiesMapeadas),
    pendenciasAbertas: toNumber(flags.pendenciasAbertas)
  };
}