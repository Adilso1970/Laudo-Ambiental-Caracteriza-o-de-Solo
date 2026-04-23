import {
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator,
  createVegetacaoLaudoFinalEntrypoint,
  ensureVegetacaoLaudoFinalEntrypoint
} from './laudo_final_entrypoint.js';

import {
  buildVegetacaoLaudoFinalEntrypointSelfTest,
  buildVegetacaoLaudoFinalEntrypointSelfTestSnapshot,
  buildVegetacaoLaudoFinalEntrypointSelfTestText
} from './laudo_final_entrypoint_selftest.js';

import {
  buildVegetacaoLaudoFinalEntrypointDiagnostics,
  buildVegetacaoLaudoFinalEntrypointDiagnosticsSnapshot,
  buildVegetacaoLaudoFinalEntrypointDiagnosticsText
} from './laudo_final_entrypoint_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_FINAL_ORCHESTRATOR__';

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

function buildDecision(diagnostics = {}, selftest = {}) {
  const diagDecision = diagnostics?.decision ?? {};
  const diagSummary = diagnostics?.summary ?? {};
  const selfSummary = selftest?.summary ?? {};

  if (!diagDecision || typeof diagDecision !== 'object') {
    return {
      code: 'laudo_final_orchestrator_unavailable',
      label: 'Orquestrador final indisponivel',
      stable: false
    };
  }

  if (diagDecision.code === 'entrypoint_unavailable' || diagDecision.code === 'entrypoint_missing_generators') {
    return {
      code: 'laudo_final_orchestrator_blocked',
      label: 'Orquestrador final bloqueado',
      stable: false
    };
  }

  if ((diagSummary.failed ?? 0) === 0 && (selfSummary.failed ?? 0) === 0) {
    return {
      code: 'laudo_final_orchestrator_ready',
      label: 'Orquestrador final pronto',
      stable: true
    };
  }

  return {
    code: 'laudo_final_orchestrator_review',
    label: 'Orquestrador final em revisao',
    stable: true
  };
}

export function buildVegetacaoLaudoFinalOrchestratorPayload(model = {}, source = null, options = {}) {
  const resolvedSource = resolveSource(source, options);

  const payload = buildVegetacaoLaudoFinalPackage(model, resolvedSource, options);
  const snapshot = buildVegetacaoLaudoFinalSnapshot(model, resolvedSource, options);
  const docx = buildVegetacaoLaudoFinalGenerator('docx', model, resolvedSource, options);
  const pdf = buildVegetacaoLaudoFinalGenerator('pdf', model, resolvedSource, options);
  const neutral = buildVegetacaoLaudoFinalGenerator('neutral', model, resolvedSource, options);

  const selftest = buildVegetacaoLaudoFinalEntrypointSelfTest(model, resolvedSource, options);
  const selftestSnapshot = buildVegetacaoLaudoFinalEntrypointSelfTestSnapshot(model, resolvedSource, options);
  const selftestText = buildVegetacaoLaudoFinalEntrypointSelfTestText(model, resolvedSource, options);

  const diagnostics = buildVegetacaoLaudoFinalEntrypointDiagnostics(model, resolvedSource, options);
  const diagnosticsSnapshot = buildVegetacaoLaudoFinalEntrypointDiagnosticsSnapshot(model, resolvedSource, options);
  const diagnosticsText = buildVegetacaoLaudoFinalEntrypointDiagnosticsText(model, resolvedSource, options);

  const decision = buildDecision(diagnostics, selftest);

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

export function buildVegetacaoLaudoFinalOrchestratorSnapshot(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoFinalOrchestratorPayload(model, source, options);

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

export function createVegetacaoLaudoFinalOrchestrator(config = {}) {
  const entrypoint = createVegetacaoLaudoFinalEntrypoint({
    ...config,
    bindGlobal: false
  });

  function build(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalOrchestratorPayload(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalOrchestratorSnapshot(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function buildGenerator(generator = 'neutral', model = {}, source = null, options = {}) {
    const selected = normalizeGenerator(generator);
    const report = build(model, source, options);
    return clone(report.generators[selected] ?? report.generators.neutral ?? null);
  }

  function publish(reason = 'manual', model = {}, source = null, options = {}) {
    const resolvedSource = resolveSource(source, config);

    const entrypointResult = entrypoint.publish(
      reason,
      model,
      resolvedSource,
      { ...config, ...options }
    );

    const orchestrated = build(model, resolvedSource, options);

    const published = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      reason,
      entrypointResult,
      orchestrated
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
      emit('solo-nb:vegetacao:laudo-final-orchestrated', published);
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

export function ensureVegetacaoLaudoFinalOrchestrator(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const entrypoint = ensureVegetacaoLaudoFinalEntrypoint(config.entrypointConfig ?? {});
  const orchestrator = createVegetacaoLaudoFinalOrchestrator(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = {
      module: MODULE_NAME,
      build: (model = {}, source = null, options = {}) => orchestrator.build(model, source, options),
      buildSnapshot: (model = {}, source = null, options = {}) => orchestrator.buildSnapshot(model, source, options),
      buildGenerator: (generator = 'neutral', model = {}, source = null, options = {}) =>
        orchestrator.buildGenerator(generator, model, source, options),
      publish: (reason = 'manual', model = {}, source = null, options = {}) =>
        orchestrator.publish(reason, model, source, options),
      entrypointModule: entrypoint?.module || MODULE_NAME
    };
  }

  return globalThis?.[GLOBAL_KEY] || orchestrator;
}