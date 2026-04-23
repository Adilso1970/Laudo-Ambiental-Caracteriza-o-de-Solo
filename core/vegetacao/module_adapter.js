import {
  createVegetacaoModuleRegistry,
  bootstrapVegetacaoModuleRegistry,
  ensureVegetacaoModuleRegistry
} from './module_registry.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_MODULE_ADAPTER__';

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

function buildSummaryFromRegistryState(state = {}) {
  const payload = safeObject(state.payload);
  const innerState = safeObject(payload.state);
  const flags = safeObject(innerState.flags);
  const decision = safeObject(innerState.decision);
  const pipelineSnapshot = safeObject(innerState.pipelineSnapshot);
  const resumo = safeObject(pipelineSnapshot.resumo);
  const handoffSnapshot = safeObject(innerState.handoffSnapshot);
  const executiveSummary = safeObject(handoffSnapshot.executiveSummary);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    projectId: toText(
      payload.projectId ??
      innerState.projectId ??
      executiveSummary.projectId ??
      'projeto-atual'
    ),
    decisionCode: toText(decision.code),
    decisionLabel: toText(decision.label),
    canContinue: Boolean(flags.canContinue),
    canPublishLaudoHook: Boolean(flags.canPublishLaudoHook),
    readyForLaudo: Boolean(flags.readyForLaudo),
    hasErrors: Boolean(flags.hasErrors),
    hasWarnings: Boolean(flags.hasWarnings),
    duplicateCandidates: toNumber(flags.duplicateCandidates),
    pendenciasAbertas: toNumber(flags.pendenciasAbertas),
    totalCapturas: toNumber(flags.totalCapturas ?? resumo.totalCapturas),
    totalSetores: toNumber(flags.totalSetores ?? resumo.totalSetores),
    especiesMapeadas: toNumber(flags.especiesMapeadas ?? resumo.especiesMapeadas)
  };
}

export function createVegetacaoModuleAdapter(config = {}) {
  const listeners = new Set();

  const registry =
    config.useExistingRegistry === true
      ? ensureVegetacaoModuleRegistry(config.registryConfig ?? {})
      : createVegetacaoModuleRegistry(config.registryConfig ?? {});

  const state = {
    started: false,
    lastState: null,
    lastSummary: null,
    unsubscribeRegistry: null
  };

  function notify(reason = 'adapter.changed') {
    const snapshot = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      started: state.started,
      state: clone(state.lastState),
      summary: clone(state.lastSummary)
    };

    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_) {}
    });

    emit('solo-nb:vegetacao:module-adapter-updated', snapshot);
    return snapshot;
  }

  function refresh(reason = 'adapter.refresh') {
    state.lastState = typeof registry.getState === 'function' ? registry.getState() : null;
    state.lastSummary = buildSummaryFromRegistryState(state.lastState);
    return notify(reason);
  }

  function start() {
    if (!state.started) {
      if (typeof registry.start === 'function') {
        registry.start();
      }

      if (!state.unsubscribeRegistry && typeof registry.subscribe === 'function') {
        state.unsubscribeRegistry = registry.subscribe(() => {
          refresh('registry.updated');
        });
      }

      state.started = true;
    }

    refresh('adapter.started');

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        start: () => adapter.start(),
        syncNow: (reason = 'manual') => adapter.syncNow(reason),
        refresh: (reason = 'manual.refresh') => adapter.refresh(reason),
        getState: () => adapter.getState(),
        getSummary: () => adapter.getSummary(),
        getRegistryState: () => adapter.getRegistryState(),
        readStored: (projectId = null) => adapter.readStored(projectId),
        subscribe: (listener) => adapter.subscribe(listener)
      };
    }

    return adapter.getState();
  }

  function stop() {
    if (typeof state.unsubscribeRegistry === 'function') {
      state.unsubscribeRegistry();
      state.unsubscribeRegistry = null;
    }

    if (typeof registry.stop === 'function') {
      registry.stop();
    }

    state.started = false;
    return refresh('adapter.stopped');
  }

  function syncNow(reason = 'manual') {
    if (typeof registry.syncNow === 'function') {
      registry.syncNow(reason);
    }
    return refresh(`adapter.sync.${reason}`);
  }

  function readStored(projectId = null) {
    if (typeof registry.readStored === 'function') {
      return clone(registry.readStored(projectId));
    }
    return null;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  const adapter = {
    start,
    stop,
    syncNow,
    refresh,
    readStored,
    subscribe,
    getState: () => ({
      started: state.started,
      state: clone(state.lastState),
      summary: clone(state.lastSummary)
    }),
    getSummary: () => clone(state.lastSummary),
    getRegistryState: () => clone(state.lastState)
  };

  return adapter;
}

export function bootstrapVegetacaoModuleAdapter(config = {}) {
  const adapter = createVegetacaoModuleAdapter({
    ...config,
    useExistingRegistry: config.useExistingRegistry !== false
  });

  adapter.start();
  return adapter;
}

export function buildVegetacaoModuleAdapterSnapshot(config = {}) {
  const adapter = bootstrapVegetacaoModuleAdapter({
    ...config,
    bindGlobal: false
  });

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    summary: adapter.getSummary(),
    state: adapter.getRegistryState()
  };
}