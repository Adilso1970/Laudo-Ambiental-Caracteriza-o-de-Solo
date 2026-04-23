import {
  buildVegetacaoLaudoComposerPatch,
  applyVegetacaoPatchToLaudoModel,
  buildVegetacaoLaudoComposerSnapshot
} from './laudo_composer_bridge.js';

import {
  buildVegetacaoLaudoIntegrationPayload,
  buildVegetacaoLaudoExportBundle,
  buildVegetacaoLaudoIntegrationSnapshot
} from './laudo_integration_service.js';

import { buildVegetacaoDiagnosticsSnapshot } from './module_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const SECTION_KEY = 'vegetacao_supressao_compensacao';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

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
    threshold: toNumber(input.threshold || 60) || 60,
    metadata: safeObject(input.metadata)
  };
}

function normalizeModel(model = {}) {
  return {
    ...safeObject(model),
    sections: toArray(model.sections),
    appendices: toArray(model.appendices),
    hooks: toArray(model.hooks),
    modules: safeObject(model.modules),
    metadata: safeObject(model.metadata)
  };
}

function buildGeneratorNodes(model = {}) {
  const sections = toArray(model.sections).map((section) => ({
    key: toText(section.key),
    title: toText(section.title),
    text: toText(section.text),
    readyForLaudo: Boolean(section.readyForLaudo)
  }));

  const appendices = toArray(model.appendices).map((appendix) => ({
    module: toText(appendix.module),
    title: toText(appendix.title),
    generatedAt: toText(appendix.generatedAt),
    readyForLaudo: Boolean(appendix.readyForLaudo)
  }));

  const hooks = toArray(model.hooks).map((hook) => ({
    module: toText(hook.module),
    readyForLaudo: Boolean(hook.readyForLaudo)
  }));

  return {
    sections,
    appendices,
    hooks
  };
}

function buildNeutralContract(integrationPayload = {}, integratedModel = {}) {
  const section = safeObject(integrationPayload.section);
  const snapshot = safeObject(integrationPayload.sectionSnapshot);

  return {
    module: MODULE_NAME,
    key: SECTION_KEY,
    title: toText(integrationPayload.title),
    readyForLaudo: Boolean(integrationPayload.readyForLaudo),
    projeto: clone(section.projeto ?? null),
    indicadores: clone(section.indicadores ?? null),
    sectionText: toText(integrationPayload.sectionText),
    sectionSnapshot: clone(snapshot),
    modelSnapshot: {
      totalSections: toArray(integratedModel.sections).length,
      totalAppendices: toArray(integratedModel.appendices).length,
      totalHooks: toArray(integratedModel.hooks).length
    }
  };
}

export function buildVegetacaoLaudoDeliveryPayload(model = {}, input = {}, options = {}) {
  const normalizedModel = normalizeModel(model);
  const normalizedInput = normalizeInput(input);

  const composerPatch = buildVegetacaoLaudoComposerPatch(normalizedInput);
  const integratedModel = applyVegetacaoPatchToLaudoModel(
    normalizedModel,
    normalizedInput,
    { mergeMode: toText(options.mergeMode || 'upsert') }
  );

  const composerSnapshot = buildVegetacaoLaudoComposerSnapshot(
    normalizedModel,
    normalizedInput,
    { mergeMode: toText(options.mergeMode || 'upsert') }
  );

  const integrationPayload = buildVegetacaoLaudoIntegrationPayload(normalizedInput);
  const exportBundle = buildVegetacaoLaudoExportBundle(normalizedInput);
  const integrationSnapshot = buildVegetacaoLaudoIntegrationSnapshot(normalizedInput);
  const diagnosticsSnapshot = buildVegetacaoDiagnosticsSnapshot(normalizedInput);
  const generatorNodes = buildGeneratorNodes(integratedModel);
  const neutralContract = buildNeutralContract(integrationPayload, integratedModel);

  return {
    version: 1,
    module: MODULE_NAME,
    key: SECTION_KEY,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(integrationPayload.readyForLaudo),
    composerPatch,
    integratedModel: clone(integratedModel),
    composerSnapshot,
    integrationPayload,
    integrationSnapshot,
    diagnosticsSnapshot,
    generatorAdapters: {
      docx: {
        title: toText(integrationPayload.title),
        sections: clone(generatorNodes.sections),
        appendices: clone(generatorNodes.appendices),
        hooks: clone(generatorNodes.hooks),
        sectionText: toText(exportBundle.docx?.sectionText)
      },
      pdf: {
        title: toText(integrationPayload.title),
        sections: clone(generatorNodes.sections),
        appendices: clone(generatorNodes.appendices),
        hooks: clone(generatorNodes.hooks),
        sectionText: toText(exportBundle.pdf?.sectionText)
      },
      neutral: neutralContract
    }
  };
}

export function buildVegetacaoLaudoDeliverySnapshot(model = {}, input = {}, options = {}) {
  const payload = buildVegetacaoLaudoDeliveryPayload(model, input, options);

  return {
    version: payload.version,
    module: payload.module,
    key: payload.key,
    generatedAt: payload.generatedAt,
    readyForLaudo: payload.readyForLaudo,
    totalSections: toArray(payload.integratedModel?.sections).length,
    totalAppendices: toArray(payload.integratedModel?.appendices).length,
    totalHooks: toArray(payload.integratedModel?.hooks).length,
    decision: clone(payload.integrationSnapshot?.decision ?? null),
    diagnostics: clone(payload.diagnosticsSnapshot?.decision ?? null)
  };
}

export function buildVegetacaoLaudoGeneratorContract(model = {}, input = {}, options = {}) {
  const payload = buildVegetacaoLaudoDeliveryPayload(model, input, options);

  return {
    version: payload.version,
    module: payload.module,
    key: payload.key,
    generatedAt: payload.generatedAt,
    readyForLaudo: payload.readyForLaudo,
    docx: clone(payload.generatorAdapters.docx),
    pdf: clone(payload.generatorAdapters.pdf),
    neutral: clone(payload.generatorAdapters.neutral)
  };
}