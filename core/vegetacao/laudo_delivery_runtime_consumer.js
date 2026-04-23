import {
  buildVegetacaoLaudoDeliveryRuntimeOrchestratorPayload,
  buildVegetacaoLaudoDeliveryRuntimeOrchestratorSnapshot,
  ensureVegetacaoLaudoDeliveryRuntimeOrchestrator
} from './laudo_delivery_runtime_orchestrator.js';

const MODULE_NAME = 'vegetacao';
const SECTION_KEY = 'vegetacao_supressao_compensacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_RUNTIME_CONSUMER__';

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

function normalizeGenerator(generator = '') {
  const current = toText(generator).toLowerCase();
  if (current === 'pdf') return 'pdf';
  if (current === 'docx') return 'docx';
  return 'neutral';
}

function buildGeneratorPayload(orchestrated = {}, generator = 'neutral') {
  const payload = safeObject(orchestrated.payload);
  const contract = safeObject(payload.contract);
  const selected = normalizeGenerator(generator);

  if (selected === 'docx') {
    return {
      generator: 'docx',
      sectionKey: SECTION_KEY,
      module: MODULE_NAME,
      readyForLaudo: Boolean(contract?.docx),
      content: clone(contract.docx ?? null)
    };
  }

  if (selected === 'pdf') {
    return {
      generator: 'pdf',
      sectionKey: SECTION_KEY,
      module: MODULE_NAME,
      readyForLaudo: Boolean(contract?.pdf),
      content: clone(contract.pdf ?? null)
    };
  }

  return {
    generator: 'neutral',
    sectionKey: SECTION_KEY,
    module: MODULE_NAME,
    readyForLaudo: Boolean(contract?.neutral),
    content: clone(contract.neutral ?? null)
  };
}

function buildConsumerSignals(orchestrated = {}) {
  const payload = safeObject(orchestrated.payload);
  const snapshot = safeObject(orchestrated.snapshot);
  const diagnostics = safeObject(orchestrated.diagnostics);
  const selftest = safeObject(orchestrated.selftest);

  return {
    readyForLaudo: Boolean(orchestrated.readyForLaudo),
    hasPayload: Boolean(payload && Object.keys(payload).length),
    hasSnapshot: Boolean(snapshot && Object.keys(snapshot).length),
    diagnosticsScore: Number(diagnostics?.summary?.score ?? 0) || 0,
    selfTestScore: Number(selftest?.summary?.score ?? 0) || 0,
    diagnosticsPassed: Boolean(diagnostics?.decision?.stable),
    selfTestPassed: Boolean(selftest?.passed)
  };
}

export function buildVegetacaoLaudoRuntimeConsumerPayload(model = {}, source = {}, options = {}) {
  const orchestrated = buildVegetacaoLaudoDeliveryRuntimeOrchestratorPayload(
    model,
    source,
    options
  );

  const signals = buildConsumerSignals(orchestrated);

  return {
    version: 1,
    module: MODULE_NAME,
    key: SECTION_KEY,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(orchestrated.readyForLaudo),
    signals,
    generators: {
      docx: buildGeneratorPayload(orchestrated, 'docx'),
      pdf: buildGeneratorPayload(orchestrated, 'pdf'),
      neutral: buildGeneratorPayload(orchestrated, 'neutral')
    },
    snapshot: clone(orchestrated.snapshot),
    diagnostics: clone(orchestrated.diagnostics),
    selftest: clone(orchestrated.selftest)
  };
}

export function buildVegetacaoLaudoRuntimeConsumerSnapshot(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoRuntimeConsumerPayload(model, source, options);
  const orchestratorSnapshot = buildVegetacaoLaudoDeliveryRuntimeOrchestratorSnapshot(
    model,
    source,
    options
  );

  return {
    version: payload.version,
    module: payload.module,
    key: payload.key,
    generatedAt: payload.generatedAt,
    readyForLaudo: payload.readyForLaudo,
    signals: payload.signals,
    orchestratorSnapshot: clone(orchestratorSnapshot)
  };
}

export function buildVegetacaoLaudoRuntimeGeneratorInput(generator = 'neutral', model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoRuntimeConsumerPayload(model, source, options);
  const selected = normalizeGenerator(generator);

  return clone(payload.generators[selected] ?? payload.generators.neutral);
}

export function createVegetacaoLaudoRuntimeConsumer(config = {}) {
  const orchestrator = ensureVegetacaoLaudoDeliveryRuntimeOrchestrator(config.orchestratorConfig ?? {});

  function build(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoRuntimeConsumerPayload(
      model,
      source,
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoRuntimeConsumerSnapshot(
      model,
      source,
      { ...config, ...options }
    );
  }

  function buildGenerator(generator = 'neutral', model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoRuntimeGeneratorInput(
      generator,
      model,
      source,
      { ...config, ...options }
    );
  }

  function publish(reason = 'manual', model = {}, options = {}) {
    const result = orchestrator.publish(reason, model, options);
    const payload = build(model, {}, options);

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
        build: (nextModel = {}, nextSource = {}, nextOptions = {}) => build(nextModel, nextSource, nextOptions),
        buildSnapshot: (nextModel = {}, nextSource = {}, nextOptions = {}) => buildSnapshot(nextModel, nextSource, nextOptions),
        buildGenerator: (generator = 'neutral', nextModel = {}, nextSource = {}, nextOptions = {}) =>
          buildGenerator(generator, nextModel, nextSource, nextOptions),
        publish: (nextReason = 'manual', nextModel = {}, nextOptions = {}) => publish(nextReason, nextModel, nextOptions)
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-delivery-runtime-consumed', published);
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

export function ensureVegetacaoLaudoRuntimeConsumer(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const consumer = createVegetacaoLaudoRuntimeConsumer(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = consumer;
  }

  return consumer;
}