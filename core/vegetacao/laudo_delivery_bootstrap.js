import { ensureVegetacaoLaudoDeliveryApi } from './laudo_delivery_api.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_BOOTSTRAP__';

const toText = (value) => String(value ?? '').trim();
const toArray = (value) => Array.isArray(value) ? value : [];

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
    sessionId: toText(session.sessionId ?? session.id ?? moduleState.sessionId),
    activeSectorId: toText(session.activeSectorId ?? session.setorAtivoId ?? moduleState.activeSectorId),
    captures: toArray(session.captures ?? moduleState.captures),
    sectors: toArray(session.sectors ?? moduleState.sectors),
    threshold: 60,
    metadata: {
      source: 'laudo_delivery_bootstrap.runtime_source'
    }
  };
}

export function createVegetacaoLaudoDeliveryBootstrap(config = {}) {
  const api = ensureVegetacaoLaudoDeliveryApi(config.apiConfig ?? {});
  const listeners = new Set();

  const state = {
    started: false,
    lastPublished: null,
    lastSnapshot: null
  };

  function notify(reason = 'bootstrap.changed') {
    const payload = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      started: state.started,
      published: clone(state.lastPublished),
      snapshot: clone(state.lastSnapshot)
    };

    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (_) {}
    });

    emit('solo-nb:vegetacao:laudo-delivery-bootstrap-updated', payload);
    return payload;
  }

  function buildCurrentInput() {
    return extractInputFromRuntimeSource(resolveRuntimeSource(config));
  }

  function publish(model = {}, input = null, options = {}) {
    const resolvedInput = input ?? buildCurrentInput();

    state.lastPublished = api.publish(
      model,
      resolvedInput,
      options
    );

    state.lastSnapshot = api.buildGatewaySnapshot(
      model,
      resolvedInput,
      options
    );

    return notify('bootstrap.publish');
  }

  function start() {
    state.started = true;

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        start: (model = {}, input = null, options = {}) => bootstrap.start(model, input, options),
        publish: (model = {}, input = null, options = {}) => bootstrap.publish(model, input, options),
        getState: () => bootstrap.getState(),
        getPublished: () => bootstrap.getPublished(),
        getSnapshot: () => bootstrap.getSnapshot(),
        readStored: (projectId = 'projeto-atual', options = {}) => bootstrap.readStored(projectId, options),
        readContract: (projectId = 'projeto-atual', options = {}) => bootstrap.readContract(projectId, options),
        subscribe: (listener) => bootstrap.subscribe(listener)
      };
    }

    return publish({}, null, {});
  }

  function readStored(projectId = 'projeto-atual', options = {}) {
    return clone(api.read(projectId, options));
  }

  function readContract(projectId = 'projeto-atual', options = {}) {
    return clone(api.readContract(projectId, options));
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

  const bootstrap = {
    start,
    publish,
    readStored,
    readContract,
    subscribe,
    getState: () => ({
      started: state.started,
      published: clone(state.lastPublished),
      snapshot: clone(state.lastSnapshot)
    }),
    getPublished: () => clone(state.lastPublished),
    getSnapshot: () => clone(state.lastSnapshot)
  };

  return bootstrap;
}

export function bootstrapVegetacaoLaudoDelivery(config = {}) {
  const bootstrap = createVegetacaoLaudoDeliveryBootstrap(config);
  bootstrap.start();
  return bootstrap;
}

export function ensureVegetacaoLaudoDeliveryBootstrap(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoLaudoDelivery(config);
}