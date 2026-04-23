import { ensureVegetacaoLaudoDeliveryRuntimeBridge } from './laudo_delivery_runtime_bridge.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_RUNTIME_BOOTSTRAP__';

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

export function createVegetacaoLaudoDeliveryRuntimeBootstrap(config = {}) {
  const bridge = ensureVegetacaoLaudoDeliveryRuntimeBridge(config.bridgeConfig ?? {});
  const listeners = new Set();

  const state = {
    started: false,
    lastPayload: null,
    lastSnapshot: null
  };

  function notify(reason = 'runtime_bootstrap.changed') {
    const payload = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      started: state.started,
      payload: clone(state.lastPayload),
      snapshot: clone(state.lastSnapshot)
    };

    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (_) {}
    });

    emit('solo-nb:vegetacao:laudo-delivery-runtime-bootstrap-updated', payload);
    return payload;
  }

  function refresh(model = {}, options = {}) {
    state.lastPayload = bridge.build(model, options);
    state.lastSnapshot = bridge.buildSnapshot(model, options);
    return notify('runtime_bootstrap.refresh');
  }

  function start(model = {}, options = {}) {
    state.started = true;
    bridge.start(model, options);
    refresh(model, options);

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        start: (nextModel = {}, nextOptions = {}) => bootstrap.start(nextModel, nextOptions),
        refresh: (nextModel = {}, nextOptions = {}) => bootstrap.refresh(nextModel, nextOptions),
        publish: (reason = 'manual', nextModel = {}, nextOptions = {}) => bootstrap.publish(reason, nextModel, nextOptions),
        getState: () => bootstrap.getState(),
        getPayload: () => bootstrap.getPayload(),
        getSnapshot: () => bootstrap.getSnapshot(),
        subscribe: (listener) => bootstrap.subscribe(listener)
      };
    }

    return notify('runtime_bootstrap.started');
  }

  function publish(reason = 'manual', model = {}, options = {}) {
    const payload = bridge.publish(reason, model, options);
    state.lastPayload = bridge.build(model, options);
    state.lastSnapshot = bridge.buildSnapshot(model, options);

    notify(`runtime_bootstrap.publish.${reason}`);
    return payload;
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
    refresh,
    publish,
    subscribe,
    getState: () => ({
      started: state.started,
      payload: clone(state.lastPayload),
      snapshot: clone(state.lastSnapshot)
    }),
    getPayload: () => clone(state.lastPayload),
    getSnapshot: () => clone(state.lastSnapshot)
  };

  return bootstrap;
}

export function bootstrapVegetacaoLaudoDeliveryRuntime(config = {}) {
  const bootstrap = createVegetacaoLaudoDeliveryRuntimeBootstrap(config);
  bootstrap.start({}, {});
  return bootstrap;
}

export function ensureVegetacaoLaudoDeliveryRuntimeBootstrap(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoLaudoDeliveryRuntime(config);
}