import {
  ensureVegetacaoLaudoGeneratorAdapter,
  buildVegetacaoLaudoGeneratorAdapterPayload,
  buildVegetacaoLaudoGeneratorAdapterSnapshot,
  buildVegetacaoLaudoGeneratorModel
} from './laudo_generator_adapter.js';

const MODULE_NAME = 'vegetacao';
const SECTION_KEY = 'vegetacao_supressao_compensacao';

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

function normalizeGenerator(generator = 'neutral') {
  const current = toText(generator).toLowerCase();
  if (current === 'docx') return 'docx';
  if (current === 'pdf') return 'pdf';
  return 'neutral';
}

function buildApplyResult(generator = 'neutral', model = {}, source = null, options = {}) {
  const selected = normalizeGenerator(generator);

  const payload = buildVegetacaoLaudoGeneratorAdapterPayload(
    model,
    source,
    options
  );

  const snapshot = buildVegetacaoLaudoGeneratorAdapterSnapshot(
    model,
    source,
    options
  );

  const nextModel = buildVegetacaoLaudoGeneratorModel(
    selected,
    model,
    source,
    options
  );

  const generatorNode = clone(payload?.generators?.[selected] ?? payload?.generators?.neutral ?? null);
  const finalPackage = clone(payload?.package ?? null);
  const finalSnapshot = clone(payload?.snapshot ?? null);

  return {
    version: 1,
    module: MODULE_NAME,
    generator: selected,
    key: SECTION_KEY,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(payload?.readyForLaudo),
    model: nextModel,
    generatorNode,
    package: finalPackage,
    snapshot: finalSnapshot,
    adapterSnapshot: clone(snapshot)
  };
}

export function applyVegetacaoToLaudoModel(generator = 'neutral', model = {}, source = null, options = {}) {
  return buildApplyResult(generator, model, source, options);
}

export function applyVegetacaoToDocxLaudo(model = {}, source = null, options = {}) {
  return buildApplyResult('docx', model, source, options);
}

export function applyVegetacaoToPdfLaudo(model = {}, source = null, options = {}) {
  return buildApplyResult('pdf', model, source, options);
}

export function applyVegetacaoToNeutralLaudo(model = {}, source = null, options = {}) {
  return buildApplyResult('neutral', model, source, options);
}

export function buildVegetacaoLaudoApplySnapshot(generator = 'neutral', model = {}, source = null, options = {}) {
  const result = buildApplyResult(generator, model, source, options);

  return {
    version: result.version,
    module: result.module,
    generator: result.generator,
    key: result.key,
    generatedAt: result.generatedAt,
    readyForLaudo: result.readyForLaudo,
    totalSections: Array.isArray(result?.model?.sections) ? result.model.sections.length : 0,
    totalHooks: Array.isArray(result?.model?.hooks) ? result.model.hooks.length : 0
  };
}

export function createVegetacaoLaudoApply(config = {}) {
  const adapter = ensureVegetacaoLaudoGeneratorAdapter({
    ...config,
    bindGlobal: false
  });

  return {
    module: MODULE_NAME,
    adapterModule: adapter?.module || MODULE_NAME,
    apply: (generator = 'neutral', model = {}, source = null, options = {}) =>
      applyVegetacaoToLaudoModel(generator, model, source, { ...config, ...options }),
    applyDocx: (model = {}, source = null, options = {}) =>
      applyVegetacaoToDocxLaudo(model, source, { ...config, ...options }),
    applyPdf: (model = {}, source = null, options = {}) =>
      applyVegetacaoToPdfLaudo(model, source, { ...config, ...options }),
    applyNeutral: (model = {}, source = null, options = {}) =>
      applyVegetacaoToNeutralLaudo(model, source, { ...config, ...options }),
    buildSnapshot: (generator = 'neutral', model = {}, source = null, options = {}) =>
      buildVegetacaoLaudoApplySnapshot(generator, model, source, { ...config, ...options })
  };
}