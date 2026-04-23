import { ensureVegetacaoModuleBootstrap } from './module_bootstrap.js';
import { buildVegetacaoModuleState, buildVegetacaoModuleArtifacts } from './module_service.js';
import { buildVegetacaoRuntimeEnvelope } from './module_runtime.js';
import { buildVegetacaoHealthcheck, buildVegetacaoHealthcheckSnapshot, buildVegetacaoHealthcheckTextBundle } from './healthcheck.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_MODULE_API__';

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

function resolveRuntimeSource(config = {}) {
  if (typeof config.getSource === 'function') {
    return config.getSource();
  }

  if (typeof globalThis !== 'undefined') {
    return globalThis.__APP_SOLO_NB_VEGETACAO__ ?? {};
  }

  return {};
}

function extractInputFromRuntimeSource(source = {}) {
  const runtime = safeObject(source);
  const session = safeObject(runtime.session ?? runtime.getSession?.() ?? {});
  const snapshot = safeObject(runtime.snapshot ?? runtime.getSnapshot?.() ?? {});
  const moduleState = safeObject(snapshot.moduleState);
  const project = safeObject(runtime.project ?? session.projectContext ?? {});

  return {
    project,
    sessionId: session.sessionId ?? session.id ?? moduleState.sessionId ?? '',
    activeSectorId: session.activeSectorId ?? session.setorAtivoId ?? moduleState.activeSectorId ?? '',
    captures: Array.isArray(session.captures) ? session.captures : (Array.isArray(moduleState.captures) ? moduleState.captures : []),
    sectors: Array.isArray(session.sectors) ? session.sectors : (Array.isArray(moduleState.sectors) ? moduleState.sectors : []),
    threshold: 60,
    metadata: {
      source: 'module_api.runtime_source'
    }
  };
}

export function createVegetacaoModuleApi(config = {}) {
  const bootstrap = ensureVegetacaoModuleBootstrap({
    ...config,
    bindGlobal: config.bindGlobal !== false
  });

  function buildCurrentInput() {
    return extractInputFromRuntimeSource(resolveRuntimeSource(config));
  }

  function start() {
    const result = bootstrap.start();
    emit('solo-nb:vegetacao:module-api-started', {
      module: MODULE_NAME,
      state: result
    });
    return result
  }

  function syncNow(reason = 'manual') {
    const result = bootstrap.syncNow(reason);
    emit('solo-nb:vegetacao:module-api-synced', {
      module: MODULE_NAME,
      reason,
      state: result
    });
    return result
  }

  function getState() {
    return clone(bootstrap.getState());
  }

  function getSummary() {
    return clone(bootstrap.getSummary());
  }

  function getSnapshot() {
    return clone(bootstrap.getSnapshot());
  }

  function readStored(projectId = null) {
    return clone(bootstrap.readStored(projectId));
  }

  function buildState(input = null) {
    const resolvedInput = input ?? buildCurrentInput();
    return buildVegetacaoModuleState(resolvedInput);
  }

  function buildArtifacts(input = null) {
    const resolvedInput = input ?? buildCurrentInput();
    return buildVegetacaoModuleArtifacts(resolvedInput);
  }

  function buildEnvelope(project = {}, session = {}, options = {}) {
    return buildVegetacaoRuntimeEnvelope(project, session, options);
  }

  function buildHealth(input = null) {
    const resolvedInput = input ?? buildCurrentInput();
    return buildVegetacaoHealthcheck(resolvedInput);
  }

  function buildHealthSnapshot(input = null) {
    const resolvedInput = input ?? buildCurrentInput();
    return buildVegetacaoHealthcheckSnapshot(resolvedInput);
  }

  function buildHealthText(input = null) {
    const resolvedInput = input ?? buildCurrentInput();
    return buildVegetacaoHealthcheckTextBundle(resolvedInput);
  }

  const api = {
    module: MODULE_NAME,
    start,
    syncNow,
    getState,
    getSummary,
    getSnapshot,
    readStored,
    buildState,
    buildArtifacts,
    buildEnvelope,
    buildHealth,
    buildHealthSnapshot,
    buildHealthText
  };

  if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
    globalThis[GLOBAL_KEY] = api;
  }

  return api;
}

export function bootstrapVegetacaoModuleApi(config = {}) {
  const api = createVegetacaoModuleApi(config);
  api.start();
  return api;
}

export function ensureVegetacaoModuleApi(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoModuleApi(config);
}