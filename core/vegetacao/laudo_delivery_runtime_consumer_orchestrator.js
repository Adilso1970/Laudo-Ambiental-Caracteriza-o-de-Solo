import {
  buildVegetacaoLaudoRuntimeConsumerPayload,
  buildVegetacaoLaudoRuntimeConsumerSnapshot,
  buildVegetacaoLaudoRuntimeGeneratorInput,
  createVegetacaoLaudoRuntimeConsumer
} from './laudo_delivery_runtime_consumer.js';

import {
  buildVegetacaoLaudoRuntimeConsumerSelfTest,
  buildVegetacaoLaudoRuntimeConsumerSelfTestSnapshot,
  buildVegetacaoLaudoRuntimeConsumerSelfTestText
} from './laudo_delivery_runtime_consumer_selftest.js';

import {
  buildVegetacaoLaudoRuntimeConsumerDiagnostics,
  buildVegetacaoLaudoRuntimeConsumerDiagnosticsSnapshot,
  buildVegetacaoLaudoRuntimeConsumerDiagnosticsText
} from './laudo_delivery_runtime_consumer_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_RUNTIME_CONSUMER_ORCHESTRATOR__';

const toText = (value) => String(value ?? '').trim();
const toArray = (value) => Array.isArray(value) ? value : [];

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

function buildDecision(diagnostics = {}) {
  const decision = diagnostics?.decision ?? {};
  const summary = diagnostics?.summary ?? {};
  const signals = diagnostics?.signals ?? {};

  if (!summary || typeof summary !== 'object') {
    return {
      code: 'consumer_runtime_orchestrator_unavailable',
      label: 'Orquestrador indisponivel',
      stable: false
    };
  }

  if (decision.code === 'consumer_runtime_incomplete' || decision.code === 'consumer_runtime_missing_generator_inputs') {
    return {
      code: 'consumer_runtime_blocked',
      label: 'Consumer runtime bloqueado',
      stable: false
    };
  }

  if (signals.readyForLaudo && summary.failed === 0) {
    return {
      code: 'consumer_runtime_ready',
      label: 'Consumer runtime pronto',
      stable: true
    };
  }

  return {
    code: 'consumer_runtime_review',
    label: 'Consumer runtime em revisao',
    stable: true
  };
}

export function buildVegetacaoLaudoRuntimeConsumerOrchestratorPayload(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoRuntimeConsumerPayload(model, source, options);
  const snapshot = buildVegetacaoLaudoRuntimeConsumerSnapshot(model, source, options);
  const docx = buildVegetacaoLaudoRuntimeGeneratorInput('docx', model, source, options);
  const pdf = buildVegetacaoLaudoRuntimeGeneratorInput('pdf', model, source, options);
  const neutral = buildVegetacaoLaudoRuntimeGeneratorInput('neutral', model, source, options);

  const selftest = buildVegetacaoLaudoRuntimeConsumerSelfTest(model, source, options);
  const selftestSnapshot = buildVegetacaoLaudoRuntimeConsumerSelfTestSnapshot(model, source, options);
  const selftestText = buildVegetacaoLaudoRuntimeConsumerSelfTestText(model, source, options);

  const diagnostics = buildVegetacaoLaudoRuntimeConsumerDiagnostics(model, source, options);
  const diagnosticsSnapshot = buildVegetacaoLaudoRuntimeConsumerDiagnosticsSnapshot(model, source, options);
  const diagnosticsText = buildVegetacaoLaudoRuntimeConsumerDiagnosticsText(model, source, options);

  const decision = buildDecision(diagnostics);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    key: payload?.key || 'vegetacao_supressao_compensacao',
    readyForLaudo: Boolean(payload?.readyForLaudo),
    decision,
    payload,
    snapshot,
    generators: {
      docx: clone(docx),
      pdf: clone(pdf),
      neutral: clone(neutral)
    },
    selftest,
    selftestSnapshot,
    selftestText,
    diagnostics,
    diagnosticsSnapshot,
    diagnosticsText
  };
}

export function buildVegetacaoLaudoRuntimeConsumerOrchestratorSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoRuntimeConsumerOrchestratorPayload(model, source, options);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    key: report.key,
    readyForLaudo: report.readyForLaudo,
    decision: clone(report.decision),
    snapshot: clone(report.snapshot),
    selftest: clone(report.selftestSnapshot),
    diagnostics: clone(report.diagnosticsSnapshot)
  };
}

export function createVegetacaoLaudoRuntimeConsumerOrchestrator(config = {}) {
  const consumer = createVegetacaoLaudoRuntimeConsumer({
    ...config,
    bindGlobal: false
  });

  function build(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoRuntimeConsumerOrchestratorPayload(
      model,
      source,
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, source = {}, options = {}) {
    return buildVegetacaoLaudoRuntimeConsumerOrchestratorSnapshot(
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

  function publish(reason = 'manual', model = {}, source = {}, options = {}) {
    const consumerResult = consumer.publish(model, source, { ...config, ...options });
    const orchestrated = build(model, source, options);

    const published = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      consumerResult,
      orchestrated
    };

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        build: (nextModel = {}, nextSource = {}, nextOptions = {}) => build(nextModel, nextSource, nextOptions),
        buildSnapshot: (nextModel = {}, nextSource = {}, nextOptions = {}) => buildSnapshot(nextModel, nextSource, nextOptions),
        buildGenerator: (generator = 'neutral', nextModel = {}, nextSource = {}, nextOptions = {}) =>
          buildGenerator(generator, nextModel, nextSource, nextOptions),
        publish: (nextReason = 'manual', nextModel = {}, nextSource = {}, nextOptions = {}) =>
          publish(nextReason, nextModel, nextSource, nextOptions)
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-delivery-runtime-consumer-orchestrated', published);
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

export function ensureVegetacaoLaudoRuntimeConsumerOrchestrator(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const orchestrator = createVegetacaoLaudoRuntimeConsumerOrchestrator(config)

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = orchestrator;
  }

  return orchestrator;
}