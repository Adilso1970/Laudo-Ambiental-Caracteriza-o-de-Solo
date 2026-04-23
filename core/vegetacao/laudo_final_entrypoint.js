import {
  ensureVegetacaoLaudoRuntimeConsumerOrchestrator,
  buildVegetacaoLaudoRuntimeConsumerOrchestratorPayload,
  buildVegetacaoLaudoRuntimeConsumerOrchestratorSnapshot
} from './laudo_delivery_runtime_consumer_orchestrator.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_FINAL_ENTRYPOINT__';

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

function extractGenerator(orchestrated = {}, generator = 'neutral') {
  const selected = normalizeGenerator(generator);
  const generators = safeObject(orchestrated.generators);

  return clone(generators[selected] ?? generators.neutral ?? null);
}

export function buildVegetacaoLaudoFinalPackage(model = {}, source = null, options = {}) {
  const resolvedSource = resolveSource(source, options);

  const orchestrated = buildVegetacaoLaudoRuntimeConsumerOrchestratorPayload(
    model,
    resolvedSource,
    options
  );

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(orchestrated.readyForLaudo),
    key: orchestrated.key ?? 'vegetacao_supressao_compensacao',
    decision: clone(orchestrated.decision ?? null),
    diagnostics: clone(orchestrated.diagnostics ?? null),
    selftest: clone(orchestrated.selftest ?? null),
    generators: {
      docx: extractGenerator(orchestrated, 'docx'),
      pdf: extractGenerator(orchestrated, 'pdf'),
      neutral: extractGenerator(orchestrated, 'neutral')
    },
    snapshot: clone(orchestrated.snapshot ?? null)
  };
}

export function buildVegetacaoLaudoFinalSnapshot(model = {}, source = null, options = {}) {
  const resolvedSource = resolveSource(source, options);

  return buildVegetacaoLaudoRuntimeConsumerOrchestratorSnapshot(
    model,
    resolvedSource,
    options
  );
}

export function buildVegetacaoLaudoFinalGenerator(generator = 'neutral', model = {}, source = null, options = {}) {
  const payload = buildVegetacaoLaudoFinalPackage(model, source, options);
  const selected = normalizeGenerator(generator);

  return clone(payload.generators[selected] ?? payload.generators.neutral ?? null);
}

export function createVegetacaoLaudoFinalEntrypoint(config = {}) {
  const orchestrator = ensureVegetacaoLaudoRuntimeConsumerOrchestrator(config.orchestratorConfig ?? {});

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
      generator,
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function publish(reason = 'manual', model = {}, source = null, options = {}) {
    const resolvedSource = resolveSource(source, config);

    const result = orchestrator.publish(
      reason,
      model,
      resolvedSource,
      { ...config, ...options }
    );

    const payload = build(model, resolvedSource, options);

    const published = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      result,
      payload
    };

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        build: (nextModel = {}, nextSource = null, nextOptions = {}) => build(nextModel, nextSource, nextOptions),
        buildSnapshot: (nextModel = {}, nextSource = null, nextOptions = {}) => buildSnapshot(nextModel, nextSource, nextOptions),
        buildGenerator: (generator = 'neutral', nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildGenerator(generator, nextModel, nextSource, nextOptions),
        publish: (nextReason = 'manual', nextModel = {}, nextSource = null, nextOptions = {}) =>
          publish(nextReason, nextModel, nextSource, nextOptions)
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-final-entrypoint-published', published);
    }

    return published;
  }

  return {
    module: MODULE_NAME,
    build,
    buildSnapshot,
    buildGenerator,
    publish
  };
}

export function ensureVegetacaoLaudoFinalEntrypoint(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const entrypoint = createVegetacaoLaudoFinalEntrypoint(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = entrypoint;
  }

  return entrypoint;
}