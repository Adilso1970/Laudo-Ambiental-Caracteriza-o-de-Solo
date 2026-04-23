import {
  ensureVegetacaoLaudoFinalApi
} from './laudo_final_api.js';

import {
  ensureVegetacaoLaudoGeneratorAdapter
} from './laudo_generator_adapter.js';

import {
  applyVegetacaoToDocxLaudo,
  applyVegetacaoToPdfLaudo,
  applyVegetacaoToNeutralLaudo
} from './laudo_apply.js';

import {
  buildVegetacaoLaudoApplySelfTestSnapshot,
  buildVegetacaoLaudoApplySelfTestText
} from './laudo_apply_selftest.js';

import {
  buildVegetacaoLaudoFinalApiDiagnosticsSnapshot,
  buildVegetacaoLaudoFinalApiDiagnosticsText
} from './laudo_final_api_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_FINAL_RUNNER__';

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

function safeObject(value) {
  return typeof value === 'object' && value !== null ? value : {};
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

function buildApplyResult(generator = 'neutral', model = {}, source = null, options = {}) {
  const current = normalizeGenerator(generator);

  if (current === 'docx') {
    return applyVegetacaoToDocxLaudo(model, source, options);
  }

  if (current === 'pdf') {
    return applyVegetacaoToPdfLaudo(model, source, options);
  }

  return applyVegetacaoToNeutralLaudo(model, source, options);
}

function buildStatus(finalApiDiagnostics = {}, applySelfTest = {}) {
  const diagDecision = safeObject(finalApiDiagnostics.decision);
  const diagSummary = safeObject(finalApiDiagnostics.summary);
  const selfSummary = safeObject(applySelfTest.summary);

  return {
    code: toText(diagDecision.code || 'unknown'),
    label: toText(diagDecision.label || 'Sem status'),
    stable: Boolean(diagDecision.stable),
    scoreDiagnostics: Number(diagSummary.score ?? 0) || 0,
    scoreApply: Number(selfSummary.score ?? 0) || 0,
    passedDiagnostics: Number(diagSummary.failed ?? 1) === 0,
    passedApply: Number(selfSummary.failed ?? 1) === 0
  };
}

export function buildVegetacaoLaudoFinalRun(model = {}, source = null, options = {}) {
  const resolvedSource = resolveSource(source, options);

  const api = ensureVegetacaoLaudoFinalApi(options.apiConfig ?? {});
  const adapter = ensureVegetacaoLaudoGeneratorAdapter(options.adapterConfig ?? {});

  const finalPayload = api.build(model, resolvedSource, options);
  const finalSnapshot = api.buildSnapshot(model, resolvedSource, options);
  const diagnosticsSnapshot = buildVegetacaoLaudoFinalApiDiagnosticsSnapshot(model, resolvedSource, options);
  const diagnosticsText = buildVegetacaoLaudoFinalApiDiagnosticsText(model, resolvedSource, options);

  const applyDocx = buildApplyResult('docx', model, resolvedSource, options);
  const applyPdf = buildApplyResult('pdf', model, resolvedSource, options);
  const applyNeutral = buildApplyResult('neutral', model, resolvedSource, options);

  const applySelfTestSnapshot = buildVegetacaoLaudoApplySelfTestSnapshot(model, resolvedSource, options);
  const applySelfTestText = buildVegetacaoLaudoApplySelfTestText(model, resolvedSource, options);

  const status = buildStatus(diagnosticsSnapshot, applySelfTestSnapshot);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(finalPayload?.readyForLaudo),
    status,
    final: {
      payload: clone(finalPayload),
      snapshot: clone(finalSnapshot)
    },
    diagnostics: {
      snapshot: clone(diagnosticsSnapshot),
      text: clone(diagnosticsText)
    },
    apply: {
      docx: clone(applyDocx),
      pdf: clone(applyPdf),
      neutral: clone(applyNeutral),
      selfTestSnapshot: clone(applySelfTestSnapshot),
      selfTestText: clone(applySelfTestText)
    },
    adapter: {
      module: adapter?.module || MODULE_NAME
    }
  };
}

export function buildVegetacaoLaudoFinalRunSnapshot(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoFinalRun(model, source, options);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    readyForLaudo: report.readyForLaudo,
    status: clone(report.status),
    finalSnapshot: clone(report.final?.snapshot ?? null),
    diagnosticsSnapshot: clone(report.diagnostics?.snapshot ?? null),
    applySelfTestSnapshot: clone(report.apply?.selfTestSnapshot ?? null)
  };
}

export function buildVegetacaoLaudoFinalRunText(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoFinalRun(model, source, options);

  return {
    titulo: 'Runner final do laudo do modulo Vegetacao',
    status: report.status?.label ?? 'Sem status',
    readyForLaudo: Boolean(report.readyForLaudo),
    diagnosticsScore: report.status?.scoreDiagnostics ?? 0,
    applyScore: report.status?.scoreApply ?? 0
  };
}

export function createVegetacaoLaudoFinalRunner(config = {}) {
  function run(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalRun(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function runSnapshot(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalRunSnapshot(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function runText(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoFinalRunText(
      model,
      resolveSource(source, config),
      { ...config, ...options }
    );
  }

  function publish(model = {}, source = null, options = {}) {
    const report = run(model, source, options);

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        run: (nextModel = {}, nextSource = null, nextOptions = {}) => run(nextModel, nextSource, nextOptions),
        runSnapshot: (nextModel = {}, nextSource = null, nextOptions = {}) => runSnapshot(nextModel, nextSource, nextOptions),
        runText: (nextModel = {}, nextSource = null, nextOptions = {}) => runText(nextModel, nextSource, nextOptions),
        publish: (nextModel = {}, nextSource = null, nextOptions = {}) => publish(nextModel, nextSource, nextOptions)
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-final-runner-published', report);
    }

    return report;
  }

  return {
    module: MODULE_NAME,
    run,
    runSnapshot,
    runText,
    publish
  };
}

export function ensureVegetacaoLaudoFinalRunner(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const runner = createVegetacaoLaudoFinalRunner(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = runner;
  }

  return runner;
}