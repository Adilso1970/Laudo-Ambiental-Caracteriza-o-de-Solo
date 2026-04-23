import {
  ensureVegetacaoLaudoDeliveryRuntimeBridge,
  buildVegetacaoLaudoDeliveryRuntimePayload,
  buildVegetacaoLaudoDeliveryRuntimeSnapshot
} from './laudo_delivery_runtime_bridge.js';

import {
  ensureVegetacaoLaudoDeliveryRuntimeBootstrap
} from './laudo_delivery_runtime_bootstrap.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_RUNTIME_API__';

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

export function createVegetacaoLaudoDeliveryRuntimeApi(config = {}) {
  const bridge = ensureVegetacaoLaudoDeliveryRuntimeBridge(config.bridgeConfig ?? {});
  const bootstrap = ensureVegetacaoLaudoDeliveryRuntimeBootstrap(config.bootstrapConfig ?? {});

  function build(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryRuntimePayload(
      model,
      source,
      {
        ...config,
        ...options
      }
    );
  }

  function buildSnapshot(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryRuntimeSnapshot(
      model,
      source,
      {
        ...config,
        ...options
      }
    );
  }

  function start(model = {}, options = {}) {
    const result = bootstrap.start(model, options);

    emit('solo-nb:vegetacao:laudo-delivery-runtime-api-started', {
      module: MODULE_NAME,
      state: result
    });

    return result;
  }

  function publish(reason = 'manual', model = {}, options = {}) {
    const result = bootstrap.publish(reason, model, options);

    emit('solo-nb:vegetacao:laudo-delivery-runtime-api-published', {
      module: MODULE_NAME,
      reason,
      result
    });

    return result;
  }

  function refresh(model = {}, options = {}) {
    const result = bootstrap.refresh(model, options);

    emit('solo-nb:vegetacao:laudo-delivery-runtime-api-refreshed', {
      module: MODULE_NAME,
      result
    });

    return result;
  }

  function subscribe(listener) {
    return bootstrap.subscribe(listener);
  }

  const api = {
    module: MODULE_NAME,
    build,
    buildSnapshot,
    start,
    publish,
    refresh,
    getBridgeState: () => clone(bridge.getState()),
    getBootstrapState: () => clone(bootstrap.getState()),
    getPayload: () => clone(bootstrap.getPayload()),
    getSnapshot: () => clone(bootstrap.getSnapshot()),
    subscribe
  };

  return api;
}

export function bootstrapVegetacaoLaudoDeliveryRuntimeApi(config = {}) {
  const api = createVegetacaoLaudoDeliveryRuntimeApi(config);

  if (typeof globalThis !== 'undefined') {
    globalThis[GLOBAL_KEY] = api;
  }

  api.start({}, {});

  return api;
}

export function ensureVegetacaoLaudoDeliveryRuntimeApi(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoLaudoDeliveryRuntimeApi(config);
}