import {
  createVegetacaoModuleAdapter,
  bootstrapVegetacaoModuleAdapter,
  buildVegetacaoModuleAdapterSnapshot
} from './module_adapter.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_MODULE_BOOTSTRAP__';

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

export function createVegetacaoModuleBootstrap(config = {}) {
  const adapter = createVegetacaoModuleAdapter({
    ...config,
    bindGlobal: config.bindGlobal !== false,
    registryConfig: {
      ...(safeObject(config.registryConfig)),
      metadata: {
        bootstrap: 'module_bootstrap',
        ...(safeObject(config.registryConfig?.metadata))
      }
    }
  });

  const state = {
    started: false,
    lastSnapshot: null
  };

  function refresh(reason = 'bootstrap.refresh') {
    const adapterState = adapter.getState();
    const snapshot = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      started: state.started,
      summary: clone(adapterState?.summary ?? null),
      state: clone(adapterState?.state ?? null)
    };

    state.lastSnapshot = snapshot;
    emit('solo-nb:vegetacao:module-bootstrap-updated', snapshot);
    return snapshot;
  }

  function start() {
    if (!state.started) {
      adapter.start();
      state.started = true;
    }

    const snapshot = refresh('bootstrap.started');

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        start: () => bootstrap.start(),
        syncNow: (reason = 'manual') => bootstrap.syncNow(reason),
        refresh: (reason = 'manual.refresh') => bootstrap.refresh(reason),
        getState: () => bootstrap.getState(),
        getSummary: () => bootstrap.getSummary(),
        getSnapshot: () => bootstrap.getSnapshot(),
        buildSnapshot: () => bootstrap.buildSnapshot(),
        readStored: (projectId = null) => bootstrap.readStored(projectId),
        subscribe: (listener) => bootstrap.subscribe(listener)
      };
    }

    return snapshot;
  }

  function syncNow(reason = 'manual') {
    adapter.syncNow(reason);
    return refresh(`bootstrap.sync.${reason}`);
  }

  function readStored(projectId = null) {
    return adapter.readStored(projectId);
  }

  function buildSnapshot() {
    return buildVegetacaoModuleAdapterSnapshot({
      ...config,
      bindGlobal: false
    });
  }

  function subscribe(listener) {
    return adapter.subscribe(listener);
  }

  const bootstrap = {
    start,
    syncNow,
    readStored,
    subscribe,
    refresh,
    buildSnapshot,
    getSummary: () => clone(adapter.getSummary()),
    getState: () => clone(adapter.getState()),
    getSnapshot: () => clone(state.lastSnapshot)
  };

  return bootstrap;
}

export function bootstrapVegetacaoModule(config = {}) {
  const bootstrap = createVegetacaoModuleBootstrap(config);
  bootstrap.start();
  return bootstrap;
}

export function ensureVegetacaoModuleBootstrap(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoModule(config);
}