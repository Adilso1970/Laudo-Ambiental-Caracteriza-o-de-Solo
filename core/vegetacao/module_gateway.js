import {
  createVegetacaoModuleSyncAgent,
  syncVegetacaoModuleRuntime,
  buildVegetacaoModuleSyncEnvelope
} from './module_sync.js';

import {
  readVegetacaoRuntime,
  buildVegetacaoRuntimeEnvelope
} from './module_runtime.js';

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

function resolveSource(config = {}) {
  if (typeof config.getSource === 'function') {
    return config.getSource();
  }

  if (typeof globalThis !== 'undefined') {
    return globalThis.__APP_SOLO_NB_VEGETACAO__ ?? {};
  }

  return {};
}

function resolveProjectId(payload = {}, fallback = 'projeto-atual') {
  return toText(
    payload?.projectId ??
    payload?.state?.projectId ??
    payload?.artifacts?.projectId ??
    fallback
  ) || fallback;
}

export function createVegetacaoModuleGateway(config = {}) {
  const listeners = new Set();

  const state = {
    started: false,
    lastPayload: null,
    lastEnvelope: null
  };

  const syncAgent = createVegetacaoModuleSyncAgent({
    getSource: () => resolveSource(config),
    threshold: config.threshold,
    storage: config.storage,
    emit: config.emit !== false,
    bindGlobal: config.bindGlobal !== false,
    debounceMs: config.debounceMs,
    metadata: {
      gateway: 'module_gateway',
      ...(safeObject(config.metadata))
    }
  });

  function notify(reason = 'state.changed', payload = null) {
    const snapshot = {
      reason,
      payload: clone(payload ?? state.lastPayload),
      envelope: clone(state.lastEnvelope),
      started: state.started
    };

    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_) {}
    });

    return snapshot;
  }

  function buildEnvelopeFromSource() {
    const source = resolveSource(config);
    const envelope = buildVegetacaoModuleSyncEnvelope(source, {
      threshold: config.threshold,
      metadata: {
        gateway: 'module_gateway',
        ...(safeObject(config.metadata))
      }
    });

    state.lastEnvelope = envelope;
    return envelope;
  }

  function syncNow(reason = 'manual') {
    const source = resolveSource(config);

    const payload = syncVegetacaoModuleRuntime(source, {
      threshold: config.threshold,
      storage: config.storage,
      emit: config.emit !== false,
      bindGlobal: config.bindGlobal !== false,
      metadata: {
        reason,
        gateway: 'module_gateway',
        ...(safeObject(config.metadata))
      }
    });

    if (!payload) {
      return state.lastPayload;
    }

    state.lastPayload = payload;
    buildEnvelopeFromSource();
    notify(`sync.${reason}`, payload);

    if (config.publishGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis.__SOLO_NB_VEGETACAO_MODULE_GATEWAY__ = {
        getState: () => gateway.getState(),
        getPayload: () => gateway.getPayload(),
        getEnvelope: () => gateway.getEnvelope(),
        syncNow: (nextReason = 'manual') => gateway.syncNow(nextReason),
        readStored: (projectId = null) => gateway.readStored(projectId),
        subscribe: (listener) => gateway.subscribe(listener)
      };
    }

    return payload;
  }

  function readStored(projectId = null) {
    const currentProjectId =
      projectId ||
      resolveProjectId(state.lastPayload) ||
      resolveProjectId(state.lastEnvelope) ||
      'projeto-atual';

    return readVegetacaoRuntime(currentProjectId, {
      storage: config.storage
    });
  }

  function start() {
    if (state.started) {
      return gateway.getState();
    }

    state.started = true;
    syncAgent.attach();
    syncAgent.schedule('gateway.start');
    buildEnvelopeFromSource();
    notify('gateway.started', state.lastPayload);

    return gateway.getState();
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

  const gateway = {
    start,
    syncNow,
    subscribe,
    readStored,
    getPayload: () => clone(state.lastPayload),
    getEnvelope: () => clone(state.lastEnvelope),
    getState: () => ({
      started: state.started,
      payload: clone(state.lastPayload),
      envelope: clone(state.lastEnvelope)
    }),
    buildEnvelopeFromSource: () => clone(buildEnvelopeFromSource()),
    buildRuntimeEnvelope: (project = {}, session = {}, options = {}) =>
      clone(buildVegetacaoRuntimeEnvelope(project, session, options))
  };

  return gateway;
}

export function bootstrapVegetacaoModuleGateway(config = {}) {
  const gateway = createVegetacaoModuleGateway(config);
  gateway.start();
  return gateway;
}