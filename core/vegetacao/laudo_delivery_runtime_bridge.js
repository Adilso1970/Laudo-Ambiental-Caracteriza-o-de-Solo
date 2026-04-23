import { ensureVegetacaoLaudoDeliveryOrchestrator } from './laudo_delivery_orchestrator.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_RUNTIME_BRIDGE__';

const toArray = (value) => Array.isArray(value) ? value : [];
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

function emit(name, detail) {
  if (typeof globalThis?.dispatchEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}

export function resolveVegetacaoRuntimeSource(config = {}) {
  if (typeof config.getSource === 'function') {
    return config.getSource();
  }

  if (typeof globalThis !== 'undefined') {
    return globalThis.__APP_SOLO_NB_VEGETACAO__ ?? {};
  }

  return {};
}

export function extractVegetacaoRuntimeInput(source = {}) {
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
      source: 'laudo_delivery_runtime_bridge.runtime_source'
    }
  };
}

function buildSignature(input = {}) {
  return [
    toText(input.sessionId),
    toText(input.activeSectorId),
    toArray(input.captures).length,
    toArray(input.sectors).length
  ].join('|');
}

export function buildVegetacaoLaudoDeliveryRuntimePayload(model = {}, source = {}, options = {}) {
  const input = extractVegetacaoRuntimeInput(source);
  const orchestrator = ensureVegetacaoLaudoDeliveryOrchestrator(options.orchestratorConfig ?? {});

  return orchestrator.build(
    model,
    input,
    options
  );
}

export function buildVegetacaoLaudoDeliveryRuntimeSnapshot(model = {}, source = {}, options = {}) {
  const input = extractVegetacaoRuntimeInput(source);
  const orchestrator = ensureVegetacaoLaudoDeliveryOrchestrator(options.orchestratorConfig ?? {});

  return orchestrator.buildSnapshot(
    model,
    input,
    options
  );
}

export function createVegetacaoLaudoDeliveryRuntimeBridge(config = {}) {
  const orchestrator = ensureVegetacaoLaudoDeliveryOrchestrator(config.orchestratorConfig ?? {});
  const listeners = new Set();

  const state = {
    started: false,
    lastSignature: '',
    lastPayload: null,
    timer: null,
    isPublishing: false
  };

  function notify(reason = 'runtime_bridge.changed') {
    const payload = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      started: state.started,
      lastSignature: state.lastSignature,
      payload: clone(state.lastPayload)
    };

    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (_) {}
    });

    emit('solo-nb:vegetacao:laudo-delivery-runtime-bridge-updated', payload);
    return payload;
  }

  function resolveInput() {
    return extractVegetacaoRuntimeInput(resolveVegetacaoRuntimeSource(config));
  }

  function publish(reason = 'manual', model = {}, options = {}) {
    const input = resolveInput();
    const signature = buildSignature(input);

    if (state.isPublishing) {
      return state.lastPayload;
    }

    state.isPublishing = true;

    try {
      state.lastPayload = orchestrator.publish(
        model,
        input,
        {
          ...config,
          ...options
        }
      );

      state.lastSignature = signature;
      return notify(`runtime_bridge.publish.${reason}`);
    } finally {
      state.isPublishing = false;
    }
  }

  function schedule(reason = 'scheduled', model = {}, options = {}) {
    if (typeof clearTimeout === 'function' && state.timer) {
      clearTimeout(state.timer);
    }

    const run = () => {
      const input = resolveInput();
      const signature = buildSignature(input);

      if (!options.force && signature && signature === state.lastSignature) {
        return state.lastPayload;
      }

      return publish(reason, model, options);
    };

    if (typeof setTimeout !== 'function') {
      return run();
    }

    state.timer = setTimeout(run, Number(config.debounceMs || 220) || 220);
    return null;
  }

  function attach(model = {}, options = {}) {
    if (typeof globalThis?.addEventListener !== 'function') {
      return false;
    }

    const onChanged = () => schedule('event.changed', model, options);
    const onBooted = () => schedule('event.booted', model, options);
    const onPreanalysis = () => schedule('event.preanalysis', model, options);

    globalThis.addEventListener('solo-nb:vegetacao:changed', onChanged);
    globalThis.addEventListener('solo-nb:vegetacao:booted', onBooted);
    globalThis.addEventListener('solo-nb:vegetacao:preanalysis-ready', onPreanalysis);

    return true;
  }

  function start(model = {}, options = {}) {
    state.started = true;
    attach(model, options);

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        start: (nextModel = {}, nextOptions = {}) => bridge.start(nextModel, nextOptions),
        publish: (nextReason = 'manual', nextModel = {}, nextOptions = {}) => bridge.publish(nextReason, nextModel, nextOptions),
        schedule: (nextReason = 'scheduled', nextModel = {}, nextOptions = {}) => bridge.schedule(nextReason, nextModel, nextOptions),
        build: (nextModel = {}, nextOptions = {}) => bridge.build(nextModel, nextOptions),
        buildSnapshot: (nextModel = {}, nextOptions = {}) => bridge.buildSnapshot(nextModel, nextOptions),
        getState: () => bridge.getState(),
        subscribe: (listener) => bridge.subscribe(listener)
      };
    }

    return publish('start', model, options);
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

  const bridge = {
    start,
    publish,
    schedule,
    build: (model = {}, options = {}) => buildVegetacaoLaudoDeliveryRuntimePayload(model, resolveVegetacaoRuntimeSource(config), {
      ...config,
      ...options
    }),
    buildSnapshot: (model = {}, options = {}) => buildVegetacaoLaudoDeliveryRuntimeSnapshot(model, resolveVegetacaoRuntimeSource(config), {
      ...config,
      ...options
    }),
    subscribe,
    getState: () => ({
      started: state.started,
      lastSignature: state.lastSignature,
      payload: clone(state.lastPayload)
    })
  };

  return bridge;
}

export function bootstrapVegetacaoLaudoDeliveryRuntimeBridge(config = {}) {
  const bridge = createVegetacaoLaudoDeliveryRuntimeBridge(config);
  bridge.start({}, {});
  return bridge;
}

export function ensureVegetacaoLaudoDeliveryRuntimeBridge(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoLaudoDeliveryRuntimeBridge(config);
}