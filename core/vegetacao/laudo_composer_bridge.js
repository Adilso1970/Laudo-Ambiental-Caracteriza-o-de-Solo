import {
  buildVegetacaoLaudoIntegrationPayload,
  buildVegetacaoLaudoExportBundle,
  buildVegetacaoLaudoIntegrationSnapshot
} from './laudo_integration_service.js';

const MODULE_NAME = 'vegetacao';
const SECTION_KEY = 'vegetacao_supressao_compensacao';

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

function normalizeInput(input = {}) {
  return {
    project: safeObject(input.project),
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: Number(input.threshold || 60) || 60,
    metadata: safeObject(input.metadata)
  };
}

function normalizeLaudoModel(model = {}) {
  return {
    ...safeObject(model),
    sections: toArray(model.sections),
    appendices: toArray(model.appendices),
    hooks: toArray(model.hooks),
    modules: safeObject(model.modules),
    metadata: safeObject(model.metadata)
  };
}

function buildSectionNode(payload = {}) {
  return {
    key: SECTION_KEY,
    module: MODULE_NAME,
    title: payload?.title || 'Vegetacao / Supressao / Compensacao',
    readyForLaudo: Boolean(payload?.readyForLaudo),
    generatedAt: payload?.generatedAt || new Date().toISOString(),
    text: payload?.sectionText || '',
    snapshot: clone(payload?.sectionSnapshot ?? null),
    appendix: clone(payload?.appendix ?? null)
  };
}

function upsertByKey(items = [], nextItem = {}, keyName = 'key') {
  const normalizedItems = toArray(items);
  const nextKey = toText(nextItem?.[keyName]);

  if (!nextKey) {
    return [...normalizedItems, nextItem];
  }

  const index = normalizedItems.findIndex((item) => toText(item?.[keyName]) === nextKey);

  if (index === -1) {
    return [...normalizedItems, nextItem];
  }

  return normalizedItems.map((item, currentIndex) => {
    if (currentIndex !== index) return item;
    return nextItem;
  });
}

function upsertHook(items = [], nextHook = {}) {
  const normalizedItems = toArray(items);
  const module = toText(nextHook?.module);

  if (!module) {
    return [...normalizedItems, nextHook];
  }

  const index = normalizedItems.findIndex((item) => toText(item?.module) === module);

  if (index === -1) {
    return [...normalizedItems, nextHook];
  }

  return normalizedItems.map((item, currentIndex) => {
    if (currentIndex !== index) return item;
    return nextHook;
  });
}

export function buildVegetacaoLaudoComposerPatch(input = {}) {
  const normalized = normalizeInput(input);
  const payload = buildVegetacaoLaudoIntegrationPayload(normalized);
  const exportBundle = buildVegetacaoLaudoExportBundle(normalized);
  const snapshot = buildVegetacaoLaudoIntegrationSnapshot(normalized);

  return {
    version: 1,
    module: MODULE_NAME,
    key: SECTION_KEY,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(payload?.readyForLaudo),
    section: buildSectionNode(payload),
    appendix: clone(payload?.appendix ?? null),
    laudoHook: clone(payload?.laudoHook ?? null),
    exportBundle: clone(exportBundle),
    snapshot: clone(snapshot)
  };
}

export function applyVegetacaoPatchToLaudoModel(model = {}, input = {}, options = {}) {
  const laudoModel = normalizeLaudoModel(model);
  const patch = buildVegetacaoLaudoComposerPatch(input);
  const mergeMode = toText(options.mergeMode || 'upsert');

  const nextSections =
    mergeMode === 'replace'
      ? [...laudoModel.sections.filter((item) => toText(item?.key) !== SECTION_KEY), patch.section]
      : upsertByKey(laudoModel.sections, patch.section, 'key');

  const nextAppendices = patch.appendix
    ? upsertByKey(laudoModel.appendices, patch.appendix, 'module')
    : laudoModel.appendices;

  const nextHooks = patch.laudoHook
    ? upsertHook(laudoModel.hooks, patch.laudoHook)
    : laudoModel.hooks;

  return {
    ...laudoModel,
    sections: nextSections,
    appendices: nextAppendices,
    hooks: nextHooks,
    modules: {
      ...laudoModel.modules,
      [MODULE_NAME]: {
        patch: clone(patch),
        snapshot: clone(patch.snapshot),
        readyForLaudo: Boolean(patch.readyForLaudo)
      }
    },
    metadata: {
      ...laudoModel.metadata,
      lastVegetacaoIntegrationAt: patch.generatedAt
    }
  };
}

export function buildVegetacaoLaudoComposerSnapshot(model = {}, input = {}, options = {}) {
  const nextModel = applyVegetacaoPatchToLaudoModel(model, input, options);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    totalSections: toArray(nextModel.sections).length,
    totalAppendices: toArray(nextModel.appendices).length,
    totalHooks: toArray(nextModel.hooks).length,
    hasVegetacaoSection: toArray(nextModel.sections).some((item) => toText(item?.key) === SECTION_KEY),
    readyForLaudo: Boolean(nextModel.modules?.[MODULE_NAME]?.readyForLaudo)
  };
}

export function buildVegetacaoLaudoComposerText(model = {}, input = {}, options = {}) {
  const nextModel = applyVegetacaoPatchToLaudoModel(model, input, options);
  const section = toArray(nextModel.sections).find((item) => toText(item?.key) === SECTION_KEY);

  return {
    module: MODULE_NAME,
    key: SECTION_KEY,
    title: toText(section?.title),
    text: toText(section?.text),
    readyForLaudo: Boolean(section?.readyForLaudo)
  };
}