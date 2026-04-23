import { bootstrapVegetacaoModuleGateway, createVegetacaoModuleGateway } from './module_gateway.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_MODULE_REGISTRY__';

const toText = (value) => String(value ?? '').trim();

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

function canDispatch() {
  return typeof globalThis?.dispatchEvent === 'function';
}

function emitRegistryEvent(name, detail) {
  if (!canDispatch()) return;

  globalThis.dispatchEvent(new CustomEvent(name, {
    detail
  }));
}

function buildRegistrySnapshot(state = {}) {
  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    started: Boolean(state.started),
    lastReason: toText(state.lastReason),
    payload: clone(state.payload),
    envelope: clone(state.envelope),
    stored: clone(state.stored)
  };
}

export function createVegetacaoModuleRegistry(config = {}) {
  const listeners = new Set();

  const gateway = createVegetacaoModuleGateway({
    ...config,
    metadata: {
      registry: 'module_registry',
      ...(safeObject(config.metadata))
    }
  });

  const state = {
    started: false,
    lastReason: '',
    payload: null,
    envelope: null,
    stored: null,
    unsubscribeGateway: null
  };

  function notify(reason = 'registry.changed') {
    state.lastReason = reason;

    const snapshot = buildRegistrySnapshot(state);

    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_) {}
    });

    emitRegistryEvent('solo-nb:vegetacao:registry-updated', snapshot);

    return snapshot;
  }

  function syncFromGateway(reason = 'gateway.sync') {
    state.payload = gateway.getPayload();
    state.envelope = gateway.getEnvelope();

    const payloadProjectId =
      state.payload?.projectId ||
      state.payload?.state?.projectId ||
      state.envelope?.projectId ||
      state.envelope?.state?.projectId ||
      'projeto-atual';

    state.stored = gateway.readStored(payloadProjectId);

    return notify(reason);
  }

  function start() {
    if (state.started) {
      return registry.getState();
    }

    state.started = true;

    gateway.start();

    if (!state.unsubscribeGateway) {
      state.unsubscribeGateway = gateway.subscribe((gatewayState) => {
        state.payload = gatewayState?.payload ?? gateway.getPayload();
        state.envelope = gatewayState?.envelope ?? gateway.getEnvelope();

        const projectId =
          state.payload?.projectId ||
          state.payload?.state?.projectId ||
          state.envelope?.projectId ||
          state.envelope?.state?.projectId ||
          'projeto-atual';

        state.stored = gateway.readStored(projectId);

        notify('gateway.updated');
      });
    }

    syncFromGateway('registry.started');

    if (typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        getState: () => registry.getState(),
        getPayload: () => registry.getPayload(),
        getEnvelope: () => registry.getEnvelope(),
        getStored: () => registry.getStored(),
        syncNow: (reason = 'manual') => registry.syncNow(reason),
        readStored: (projectId = null) => registry.readStored(projectId),
        subscribe: (listener) => registry.subscribe(listener)
      };
    }

    emitRegistryEvent('solo-nb:vegetacao:registry-started', registry.getState());

    return registry.getState();
  }

  function stop() {
    if (typeof state.unsubscribeGateway === 'function') {
      state.unsubscribeGateway();
      state.unsubscribeGateway = null;
    }

    state.started = false;
    return notify('registry.stopped');
  }

  function syncNow(reason = 'manual') {
    gateway.syncNow(reason);
    return syncFromGateway(`registry.sync.${reason}`);
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

  function readStored(projectId = null) {
    const fallbackProjectId =
      projectId ||
      state.payload?.projectId ||
      state.payload?.state?.projectId ||
      state.envelope?.projectId ||
      state.envelope?.state?.projectId ||
      'projeto-atual';

    state.stored = gateway.readStored(fallbackProjectId);
    return clone(state.stored);
  }

  const registry = {
    start,
    stop,
    syncNow,
    subscribe,
    readStored,
    getPayload: () => clone(state.payload),
    getEnvelope: () => clone(state.envelope),
    getStored: () => clone(state.stored),
    getState: () => buildRegistrySnapshot(state)
  };

  return registry;
}

export function bootstrapVegetacaoModuleRegistry(config = {}) {
  const registry = createVegetacaoModuleRegistry(config);
  registry.start();
  return registry;
}

export function ensureVegetacaoModuleRegistry(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const registry = bootstrapVegetacaoModuleRegistry(config);

  if (typeof globalThis !== 'undefined') {
    return globalThis[GLOBAL_KEY] || registry;
  }

  return registry;
}

export function buildVegetacaoModuleRegistrySnapshot(config = {}) {
  const gateway = bootstrapVegetacaoModuleGateway({
    ...config,
    emit: false,
    bindGlobal: false,
    metadata: {
      registrySnapshot: true,
      ...(safeObject(config.metadata))
    }
  });

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    payload: gateway.getPayload(),
    envelope: gateway.getEnvelope()
  };
}