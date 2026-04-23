import {
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator,
  ensureVegetacaoLaudoFinalEntrypoint
} from './laudo_final_entrypoint.js';

import {
  buildVegetacaoLaudoFinalOrchestratorPayload,
  buildVegetacaoLaudoFinalOrchestratorSnapshot,
  ensureVegetacaoLaudoFinalOrchestrator
} from './laudo_final_orchestrator.js';

import {
  buildVegetacaoLaudoFinalEntrypointDiagnostics,
  buildVegetacaoLaudoFinalEntrypointDiagnosticsSnapshot,
  buildVegetacaoLaudoFinalEntrypointDiagnosticsText
} from './laudo_final_entrypoint_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_FINAL_API__';

const toText = (value) => String(value ?? '').trim();

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

function resolveSource(source = null, config = {}) {
  if (source && typeof source === 'object') {
    return source;
  }

  return resolveRuntimeSource(config);
}

function normalizeGenerator(generator = 'neutral') {
  const current = toText(generator).toLowerCase();
  if (current === 'docx') return 'docx';
  if (current === 'pdf') return 'pdf';
  return 'neutral';
}

export function createVegetacaoLaudoFinalApi(config = {}) {
  const entrypoint = ensureVegetacaoLaudoFinalEntrypoint(config.entrypointConfig ?? {});
  const orchestrator = ensureVegetacaoLaudoFinalOrchestrator(config.orchestratorConfig ?? {});

  function build(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalPackage(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalSnapshot(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildGenerator(generator = 'neutral', model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalGenerator(
      normalizeGenerator(generator),
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildDiagnostics(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalEntrypointDiagnostics(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildDiagnosticsSnapshot(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalEntrypointDiagnosticsSnapshot(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildDiagnosticsText(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalEntrypointDiagnosticsText(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildOrchestrated(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalOrchestratorPayload(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildOrchestratedSnapshot(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalOrchestratorSnapshot(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function publish(reason = 'manual', model = {}, source = null, options = {}) {
    const resolvedSource = resolveSource(source, config);

    const entrypointResult = entrypoint.publish(
      reason,
      model,
      resolvedSource,
      { ...config, ...options }
    );

    const orchestrated = orchestrator.publish(
      reason,
      model,
      resolvedSource,
      { ...config, ...options }
    );

    const published = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      entrypointResult,
      orchestrated,
      payload: build(model, resolvedSource, options),
      snapshot: buildSnapshot(model, resolvedSource, options)
    };

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        build: (nextModel = {}, nextSource = null, nextOptions = {}) => build(nextModel, nextSource, nextOptions),
        buildSnapshot: (nextModel = {}, nextSource = null, nextOptions = {}) => buildSnapshot(nextModel, nextSource, nextOptions),
        buildGenerator: (generator = 'neutral', nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildGenerator(generator, nextModel, nextSource, nextOptions),
        buildDiagnostics: (nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildDiagnostics(nextModel, nextSource, nextOptions),
        buildDiagnosticsSnapshot: (nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildDiagnosticsSnapshot(nextModel, nextSource, nextOptions),
        buildDiagnosticsText: (nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildDiagnosticsText(nextModel, nextSource, nextOptions),
        buildOrchestrated: (nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildOrchestrated(nextModel, nextSource, nextOptions),
        buildOrchestratedSnapshot: (nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildOrchestratedSnapshot(nextModel, nextSource, nextOptions),
        publish: (nextReason = 'manual', nextModel = {}, nextSource = null, nextOptions = {}) =>
          publish(nextReason, nextModel, nextSource, nextOptions)
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-final-api-published', published);
    }

    return published;
  }

  return {
    module: MODULE_NAME,
    build,
    buildSnapshot,
    buildGenerator,
    buildDiagnostics,
    buildDiagnosticsSnapshot,
    buildDiagnosticsText,
    buildOrchestrated,
    buildOrchestratedSnapshot,
    publish
  };
}

export function bootstrapVegetacaoLaudoFinalApi(config = {}) {
  const api = createVegetacaoLaudoFinalApi(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = api;
  }

  emit('solo-nb:vegetacao:laudo-final-api-ready', {
    module: MODULE_NAME
  });

  return api;
}

export function ensureVegetacaoLaudoFinalApi(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoLaudoFinalApi(config);
}