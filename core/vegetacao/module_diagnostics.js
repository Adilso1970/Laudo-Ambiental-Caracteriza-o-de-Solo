import { getVegetacaoModuleManifest, buildVegetacaoModuleConsumerGuide } from './module_manifest.js';
import { buildVegetacaoHealthcheck, buildVegetacaoHealthcheckSnapshot } from './healthcheck.js';
import { buildVegetacaoSelfTest, buildVegetacaoSelfTestSnapshot, buildVegetacaoSelfTestTextBundle } from './module_selftest.js';
import { buildVegetacaoModuleState, buildVegetacaoModuleArtifacts } from './module_service.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_MODULE_DIAGNOSTICS__';

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

function emit(name, detail) {
  if (typeof globalThis?.dispatchEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}

export function normalizeVegetacaoDiagnosticsInput(input = {}) {
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

function buildSignals(moduleState = {}, healthcheck = {}, selftest = {}) {
  const flags = safeObject(moduleState.flags);
  const healthSummary = safeObject(healthcheck.summary);
  const selfSummary = safeObject(selftest.summary);

  return {
    readyForLaudo: Boolean(flags.readyForLaudo),
    canContinue: Boolean(flags.canContinue),
    hasErrors: Boolean(flags.hasErrors),
    hasWarnings: Boolean(flags.hasWarnings),
    duplicateCandidates: toNumber(flags.duplicateCandidates),
    pendenciasAbertas: toNumber(flags.pendenciasAbertas),
    totalCapturas: toNumber(flags.totalCapturas),
    totalSetores: toNumber(flags.totalSetores),
    especiesMapeadas: toNumber(flags.especiesMapeadas),
    healthScore: toNumber(healthSummary.score),
    selfTestScore: toNumber(selfSummary.score),
    healthPassed: Boolean(healthcheck.passed),
    selfTestPassed: Boolean(selftest.passed)
  };
}

function buildDecision(signals = {}) {
  if (signals.hasErrors) {
    return {
      code: 'blocked_structure',
      label: 'Estrutura bloqueada',
      stable: false
    };
  }

  if (signals.hasWarnings || signals.duplicateCandidates > 0 || signals.pendenciasAbertas > 0) {
    return {
      code: 'review_required',
      label: 'Revisao tecnica necessaria',
      stable: true
    };
  }

  if (signals.readyForLaudo && signals.healthPassed && signals.selfTestPassed) {
    return {
      code: 'ready_for_next_integration',
      label: 'Pronto para proxima integracao',
      stable: true
    };
  }

  return {
    code: 'in_progress',
    label: 'Em andamento',
    stable: true
  };
}

export function buildVegetacaoDiagnosticsReport(input = {}) {
  const normalized = normalizeVegetacaoDiagnosticsInput(input);

  const manifest = getVegetacaoModuleManifest();
  const guide = buildVegetacaoModuleConsumerGuide();
  const moduleState = buildVegetacaoModuleState(normalized);
  const artifacts = buildVegetacaoModuleArtifacts(normalized);
  const healthcheck = buildVegetacaoHealthcheck(normalized);
  const healthSnapshot = buildVegetacaoHealthcheckSnapshot(normalized);
  const selftest = buildVegetacaoSelfTest(normalized);
  const selftestSnapshot = buildVegetacaoSelfTestSnapshot(normalized);
  const selftestText = buildVegetacaoSelfTestTextBundle(normalized);

  const signals = buildSignals(moduleState, healthcheck, selftest);
  const decision = buildDecision(signals);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    decision,
    signals,
    manifest: clone(manifest),
    consumerGuide: clone(guide),
    moduleState: clone(moduleState),
    artifacts: clone(artifacts),
    healthcheck: clone(healthcheck),
    healthSnapshot: clone(healthSnapshot),
    selftest: clone(selftest),
    selftestSnapshot: clone(selftestSnapshot),
    selftestText: clone(selftestText)
  };
}

export function buildVegetacaoDiagnosticsSnapshot(input = {}) {
  const report = buildVegetacaoDiagnosticsReport(input);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    decision: report.decision,
    signals: report.signals,
    healthSnapshot: report.healthSnapshot,
    selftestSnapshot: report.selftestSnapshot
  };
}

export function publishVegetacaoDiagnostics(input = {}, options = {}) {
  const report = buildVegetacaoDiagnosticsReport(input);

  if (options.bindGlobal !== false && typeof globalThis !== 'undefined') {
    globalThis[GLOBAL_KEY] = report;
  }

  if (options.emit !== false) {
    emit('solo-nb:vegetacao:module-diagnostics-updated', report);
  }

  return report;
}