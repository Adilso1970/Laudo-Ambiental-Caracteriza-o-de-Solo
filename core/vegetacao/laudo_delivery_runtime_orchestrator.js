import {
  buildVegetacaoLaudoDeliveryRuntimePayload,
  buildVegetacaoLaudoDeliveryRuntimeSnapshot
} from './laudo_delivery_runtime_bridge.js';

import {
  createVegetacaoLaudoDeliveryRuntimeBootstrap,
  ensureVegetacaoLaudoDeliveryRuntimeBootstrap
} from './laudo_delivery_runtime_bootstrap.js';

import {
  createVegetacaoLaudoDeliveryRuntimeApi,
  ensureVegetacaoLaudoDeliveryRuntimeApi
} from './laudo_delivery_runtime_api.js';

import {
  buildVegetacaoLaudoDeliveryRuntimeSelfTest,
  buildVegetacaoLaudoDeliveryRuntimeSelfTestSnapshot,
  buildVegetacaoLaudoDeliveryRuntimeSelfTestText
} from './laudo_delivery_runtime_selftest.js';

import {
  buildVegetacaoLaudoDeliveryRuntimeDiagnostics,
  buildVegetacaoLaudoDeliveryRuntimeDiagnosticsSnapshot,
  buildVegetacaoLaudoDeliveryRuntimeDiagnosticsText
} from './laudo_delivery_runtime_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_RUNTIME_ORCHESTRATOR__';

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

export function buildVegetacaoLaudoDeliveryRuntimeOrchestratorPayload(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoDeliveryRuntimePayload(model, source, options);
  const snapshot = buildVegetacaoLaudoDeliveryRuntimeSnapshot(model, source, options);
  const selftest = buildVegetacaoLaudoDeliveryRuntimeSelfTest(model, source, options);
  const selftestSnapshot = buildVegetacaoLaudoDeliveryRuntimeSelfTestSnapshot(model, source, options);
  const selftestText = buildVegetacaoLaudoDeliveryRuntimeSelfTestText(model, source, options);
  const diagnostics = buildVegetacaoLaudoDeliveryRuntimeDiagnostics(model, source, options);
  const diagnosticsSnapshot = buildVegetacaoLaudoDeliveryRuntimeDiagnosticsSnapshot(model, source, options);
  const diagnosticsText = buildVegetacaoLaudoDeliveryRuntimeDiagnosticsText(model, source, options);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    projectId: payload?.projectId || snapshot?.projectId || 'projeto-atual',
    readyForLaudo: Boolean(payload?.readyForLaudo),
    payload,
    snapshot,
    selftest,
    selftestSnapshot,
    selftestText,
    diagnostics,
    diagnosticsSnapshot,
    diagnosticsText
  };
}

export function buildVegetacaoLaudoDeliveryRuntimeOrchestratorSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryRuntimeOrchestratorPayload(model, source, options);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    projectId: report.projectId,
    readyForLaudo: report.readyForLaudo,
    snapshot: clone(report.snapshot),
    selftest: clone(report.selftestSnapshot),
    diagnostics: clone(report.diagnosticsSnapshot)
  };
}

export function createVegetacaoLaudoDeliveryRuntimeOrchestrator(config = {}) {
  const bootstrap = createVegetacaoLaudoDeliveryRuntimeBootstrap({
    ...config,
    bindGlobal: false
  });

  const api = createVegetacaoLaudoDeliveryRuntimeApi({
    ...config,
    bindGlobal: false
  });

  function build(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryRuntimeOrchestratorPayload(
      model,
      source,
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryRuntimeOrchestratorSnapshot(
      model,
      source,
      { ...config, ...options }
    );
  }

  function start(model = {}, options = {}) {
    const result = bootstrap.start(model, options);

    emit('solo-nb:vegetacao:laudo-delivery-runtime-orchestrator-started', {
      module: MODULE_NAME,
      state: result
    });

    return result;
  }

  function publish(reason = 'manual', model = {}, options = {}) {
    const result = bootstrap.publish(reason, model, options);
    const orchestrated = build(model, {}, options);

    const payload = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      result,
      orchestrated
    };

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        build: (nextModel = {}, nextSource = {}, nextOptions = {}) => build(nextModel, nextSource, nextOptions),
        buildSnapshot: (nextModel = {}, nextSource = {}, nextOptions = {}) => buildSnapshot(nextModel, nextSource, nextOptions),
        start: (nextModel = {}, nextOptions = {}) => start(nextModel, nextOptions),
        publish: (nextReason = 'manual', nextModel = {}, nextOptions = {}) => publish(nextReason, nextModel, nextOptions),
        getBootstrapState: () => clone(bootstrap.getState()),
        getApiState: () => ({
          bridge: clone(api.getBridgeState()),
          bootstrap: clone(api.getBootstrapState()),
          payload: clone(api.getPayload()),
          snapshot: clone(api.getSnapshot())
        })
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-delivery-runtime-orchestrated', payload);
    }

    return payload;
  }

  return {
    module: MODULE_NAME,
    build,
    buildSnapshot,
    start,
    publish,
    getBootstrapState: () => clone(bootstrap.getState()),
    getApiState: () => ({
      bridge: clone(api.getBridgeState()),
      bootstrap: clone(api.getBootstrapState()),
      payload: clone(api.getPayload()),
      snapshot: clone(api.getSnapshot())
    })
  };
}

export function ensureVegetacaoLaudoDeliveryRuntimeOrchestrator(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const bootstrap = ensureVegetacaoLaudoDeliveryRuntimeBootstrap(config.bootstrapConfig ?? {});
  const api = ensureVegetacaoLaudoDeliveryRuntimeApi(config.apiConfig ?? {});
  const orchestrator = createVegetacaoLaudoDeliveryRuntimeOrchestrator(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = {
      module: MODULE_NAME,
      build: (model = {}, source = {}, options = {}) => orchestrator.build(model, source, options),
      buildSnapshot: (model = {}, source = {}, options = {}) => orchestrator.buildSnapshot(model, source, options),
      start: (model = {}, options = {}) => orchestrator.start(model, options),
      publish: (reason = 'manual', model = {}, options = {}) => orchestrator.publish(reason, model, options),
      getBootstrapState: () => clone(bootstrap.getState()),
      getApiState: () => ({
        bridge: clone(api.getBridgeState()),
        bootstrap: clone(api.getBootstrapState()),
        payload: clone(api.getPayload()),
        snapshot: clone(api.getSnapshot())
      })
    };
  }

  return globalThis?.[GLOBAL_KEY] || orchestrator;
}