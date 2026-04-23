import { getVegetacaoModuleManifest, buildVegetacaoModuleConsumerGuide } from './module_manifest.js';
import { buildVegetacaoHealthcheckSnapshot } from './healthcheck.js';
import { buildVegetacaoModuleState, buildVegetacaoModuleArtifacts } from './module_service.js';
import { buildVegetacaoRuntimeEnvelope } from './module_runtime.js';
import { buildVegetacaoHandoffSnapshot } from './handoff_service.js';
import { buildVegetacaoReadinessSummary } from './readiness_service.js';

const MODULE_NAME = 'vegetacao';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

function createCheck(id, label, ok, details = {}) {
  return {
    id,
    label,
    ok: Boolean(ok),
    details
  };
}

function summarizeChecks(checks = []) {
  const total = toArray(checks).length;
  const passed = toArray(checks).filter((item) => item.ok).length;
  const failed = total - passed;

  return {
    total,
    passed,
    failed,
    score: total > 0 ? Math.round((passed / total) * 100) : 0
  };
}

export function buildVegetacaoSelfTestInput(input = {}) {
  return {
    project: input.project ?? {},
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: toNumber(input.threshold || 60) || 60,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

export function buildVegetacaoSelfTest(input = {}) {
  const normalized = buildVegetacaoSelfTestInput(input);

  const manifest = getVegetacaoModuleManifest();
  const guide = buildVegetacaoModuleConsumerGuide();
  const healthcheck = buildVegetacaoHealthcheckSnapshot(normalized);
  const moduleState = buildVegetacaoModuleState(normalized);
  const artifacts = buildVegetacaoModuleArtifacts(normalized);
  const runtimeEnvelope = buildVegetacaoRuntimeEnvelope(
    normalized.project,
    {
      sessionId: normalized.sessionId,
      activeSectorId: normalized.activeSectorId,
      captures: normalized.captures,
      sectors: normalized.sectors,
      projectContext: normalized.project,
      metadata: normalized.metadata
    },
    {
      threshold: normalized.threshold,
      metadata: normalized.metadata
    }
  );
  const handoffSnapshot = buildVegetacaoHandoffSnapshot(normalized);
  const readinessSummary = buildVegetacaoReadinessSummary(normalized);

  const checks = [
    createCheck(
      'manifest',
      'Manifesto do modulo disponivel',
      Boolean(manifest?.module === MODULE_NAME && manifest?.entrypoints),
      { module: manifest?.module ?? '' }
    ),
    createCheck(
      'consumer_guide',
      'Guia de consumo do modulo disponivel',
      Boolean(guide?.publicApi && toArray(guide?.events).length > 0),
      { publicApi: guide?.publicApi ?? '' }
    ),
    createCheck(
      'healthcheck',
      'Healthcheck do modulo executou',
      Boolean(healthcheck?.summary),
      { score: healthcheck?.summary?.score ?? null }
    ),
    createCheck(
      'module_state',
      'Estado consolidado do modulo foi gerado',
      Boolean(moduleState?.flags),
      { readyForLaudo: moduleState?.flags?.readyForLaudo ?? false }
    ),
    createCheck(
      'artifacts',
      'Artefatos do modulo foram gerados',
      Boolean(artifacts?.handoffPackage && artifacts?.readinessReport),
      { projectId: artifacts?.projectId ?? '' }
    ),
    createCheck(
      'runtime_envelope',
      'Envelope de runtime foi gerado',
      Boolean(runtimeEnvelope?.artifacts && runtimeEnvelope?.state),
      { projectId: runtimeEnvelope?.projectId ?? '' }
    ),
    createCheck(
      'handoff_snapshot',
      'Snapshot de handoff foi gerado',
      Boolean(handoffSnapshot?.executiveSummary),
      { readyForLaudo: handoffSnapshot?.executiveSummary?.readyForLaudo ?? false }
    ),
    createCheck(
      'readiness_summary',
      'Resumo de readiness foi gerado',
      Boolean(readinessSummary?.decision),
      { decisionCode: readinessSummary?.decision?.code ?? '' }
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
    snapshots: {
      manifest: clone(manifest),
      consumerGuide: clone(guide),
      healthcheck: clone(healthcheck),
      moduleState: clone(moduleState),
      runtimeEnvelope: clone(runtimeEnvelope),
      handoffSnapshot: clone(handoffSnapshot),
      readinessSummary: clone(readinessSummary)
    }
  };
}

export function buildVegetacaoSelfTestSnapshot(input = {}) {
  const report = buildVegetacaoSelfTest(input);

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

export function buildVegetacaoSelfTestTextBundle(input = {}) {
  const report = buildVegetacaoSelfTest(input);
  const moduleState = report?.snapshots?.moduleState ?? {};
  const flags = moduleState?.flags ?? {};

  return {
    titulo: 'Self-test tecnico do modulo Vegetacao',
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