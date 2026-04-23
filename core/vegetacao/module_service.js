import { buildVegetacaoReadinessReport, buildVegetacaoReadinessSummary } from './readiness_service.js';
import {
  buildVegetacaoHandoffPackage,
  buildVegetacaoHandoffSnapshot,
  buildVegetacaoHandoffTextBundle
} from './handoff_service.js';
import { buildVegetacaoPipelineSnapshot } from './pipeline.js';

const STORAGE_NAMESPACE = 'solo-nb:vegetacao:module:v1';

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

function resolveStorage(customStorage) {
  if (customStorage) return customStorage;

  try {
    return globalThis?.localStorage ?? null;
  } catch (_) {
    return null;
  }
}

export function normalizeVegetacaoModuleInput(input = {}) {
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

export function buildVegetacaoModuleStorageKey(projectId = 'projeto-atual') {
  return `${STORAGE_NAMESPACE}:${toText(projectId) || 'projeto-atual'}`;
}

export function buildVegetacaoModuleArtifacts(input = {}) {
  const normalized = normalizeVegetacaoModuleInput(input);

  const readinessReport = buildVegetacaoReadinessReport(normalized);
  const readinessSummary = buildVegetacaoReadinessSummary(normalized);
  const handoffPackage = buildVegetacaoHandoffPackage(normalized);
  const handoffSnapshot = buildVegetacaoHandoffSnapshot(normalized);
  const handoffText = buildVegetacaoHandoffTextBundle(normalized);
  const pipelineSnapshot = buildVegetacaoPipelineSnapshot(normalized);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    projectId: toText(
      readinessReport?.validation?.project?.projectId ||
      normalized.project?.projectId ||
      normalized.project?.id ||
      normalized.project?.projetoId ||
      normalized.project?.project_id ||
      'projeto-atual'
    ),
    readinessReport,
    readinessSummary,
    handoffPackage,
    handoffSnapshot,
    handoffText,
    pipelineSnapshot
  };
}

function buildModuleFlags(artifacts = {}) {
  const decision = artifacts?.readinessReport?.decision ?? {};
  const quality = artifacts?.readinessReport?.quality ?? {};
  const pipelineResumo = artifacts?.pipelineSnapshot?.resumo ?? {};

  return {
    canContinue: Boolean(decision.canContinue),
    canPublishLaudoHook: Boolean(decision.canPublishLaudoHook),
    readyForLaudo: Boolean(decision.readyForLaudo),
    hasErrors: Boolean(quality.hasErrors),
    hasWarnings: Boolean(quality.hasWarnings),
    hasInfos: Boolean(quality.hasInfos),
    duplicateCandidates: toNumber(quality.duplicateCandidates),
    pendenciasAbertas: toNumber(quality.pendenciasAbertas),
    totalCapturas: toNumber(pipelineResumo.totalCapturas),
    totalSetores: toNumber(pipelineResumo.totalSetores),
    especiesMapeadas: toNumber(pipelineResumo.especiesMapeadas)
  };
}

export function buildVegetacaoModuleState(input = {}) {
  const artifacts = buildVegetacaoModuleArtifacts(input);
  const flags = buildModuleFlags(artifacts);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: artifacts.generatedAt,
    projectId: artifacts.projectId,
    flags,
    decision: clone(artifacts.readinessReport?.decision ?? null),
    actions: clone(artifacts.readinessReport?.actions ?? []),
    checklist: clone(artifacts.readinessSummary?.checklist ?? []),
    pipelineSnapshot: clone(artifacts.pipelineSnapshot ?? null),
    handoffSnapshot: clone(artifacts.handoffSnapshot ?? null)
  };
}

export function saveVegetacaoModuleArtifacts(input = {}, options = {}) {
  const artifacts = buildVegetacaoModuleArtifacts(input);
  const storage = resolveStorage(options.storage);
  const key = buildVegetacaoModuleStorageKey(artifacts.projectId);

  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(artifacts));
    } catch (_) {}
  }

  if (options.emit !== false && typeof globalThis?.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent('solo-nb:vegetacao:module-artifacts-updated', {
      detail: artifacts
    }));
  }

  return artifacts;
}

export function readVegetacaoModuleArtifacts(projectId = 'projeto-atual', options = {}) {
  const storage = resolveStorage(options.storage);
  const key = buildVegetacaoModuleStorageKey(projectId);

  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function buildVegetacaoModuleIntegrationEnvelope(input = {}) {
  const artifacts = buildVegetacaoModuleArtifacts(input);
  const state = buildVegetacaoModuleState(input);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: artifacts.generatedAt,
    projectId: artifacts.projectId,
    state,
    artifacts
  };
}