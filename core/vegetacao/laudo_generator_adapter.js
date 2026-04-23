import {
  ensureVegetacaoLaudoFinalApi,
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator
} from './laudo_final_api.js';

const MODULE_NAME = 'vegetacao';
const SECTION_KEY = 'vegetacao_supressao_compensacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_GENERATOR_ADAPTER__';

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

function normalizeGenerator(generator = 'neutral') {
  const current = toText(generator).toLowerCase();
  if (current === 'docx') return 'docx';
  if (current === 'pdf') return 'pdf';
  return 'neutral';
}

function buildSectionNodeFromGenerator(generatorPayload = {}, fallbackTitle = 'Vegetacao / Supressao / Compensacao') {
  const content = safeObject(generatorPayload.content);

  return {
    key: toText(generatorPayload.sectionKey || SECTION_KEY),
    module: toText(generatorPayload.module || MODULE_NAME),
    title: toText(content.sectionTitle || fallbackTitle),
    text: toText(content.sectionText),
    readyForLaudo: Boolean(generatorPayload.readyForLaudo),
    snapshot: clone(content.sectionSnapshot ?? null)
  };
}

function upsertSection(sections = [], nextSection = {}) {
  const normalized = toArray(sections);
  const key = toText(nextSection.key);

  if (!key) {
    return [...normalized, nextSection];
  }

  const index = normalized.findIndex((item) => toText(item?.key) === key);

  if (index === -1) {
    return [...normalized, nextSection];
  }

  return normalized.map((item, currentIndex) => {
    if (currentIndex !== index) return item;
    return nextSection;
  });
}

function upsertHook(hooks = [], nextHook = {}) {
  const normalized = toArray(hooks);
  const module = toText(nextHook.module);

  if (!module) {
    return [...normalized, nextHook];
  }

  const index = normalized.findIndex((item) => toText(item?.module) === module);

  if (index === -1) {
    return [...normalized, nextHook];
  }

  return normalized.map((item, currentIndex) => {
    if (currentIndex !== index) return item;
    return nextHook;
  });
}

function normalizeLaudoModel(model = {}) {
  return {
    ...safeObject(model),
    sections: toArray(model.sections),
    appendices: toArray(model.appendices),
    hooks: toArray(model.hooks),
    metadata: safeObject(model.metadata),
    modules: safeObject(model.modules)
  };
}

export function buildVegetacaoLaudoGeneratorAdapterPayload(model = {}, source = null, options = {}) {
  const api = ensureVegetacaoLaudoFinalApi(options.apiConfig ?? {});

  const finalPackage = buildVegetacaoLaudoFinalPackage(model, source, options);
  const finalSnapshot = buildVegetacaoLaudoFinalSnapshot(model, source, options);

  const docx = buildVegetacaoLaudoFinalGenerator('docx', model, source, options);
  const pdf = buildVegetacaoLaudoFinalGenerator('pdf', model, source, options);
  const neutral = buildVegetacaoLaudoFinalGenerator('neutral', model, source, options);

  const normalizedModel = normalizeLaudoModel(model);

  const docxSection = buildSectionNodeFromGenerator(docx);
  const pdfSection = buildSectionNodeFromGenerator(pdf);
  const neutralSection = buildSectionNodeFromGenerator(neutral);

  return {
    version: 1,
    module: MODULE_NAME,
    key: SECTION_KEY,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(finalPackage.readyForLaudo),
    package: clone(finalPackage),
    snapshot: clone(finalSnapshot),
    generators: {
      docx: clone(docx),
      pdf: clone(pdf),
      neutral: clone(neutral)
    },
    models: {
      docx: {
        ...normalizedModel,
        sections: upsertSection(normalizedModel.sections, docxSection),
        hooks: upsertHook(normalizedModel.hooks, finalPackage.generators?.neutral?.content ?? {})
      },
      pdf: {
        ...normalizedModel,
        sections: upsertSection(normalizedModel.sections, pdfSection),
        hooks: upsertHook(normalizedModel.hooks, finalPackage.generators?.neutral?.content ?? {})
      },
      neutral: {
        ...normalizedModel,
        sections: upsertSection(normalizedModel.sections, neutralSection),
        hooks: upsertHook(normalizedModel.hooks, finalPackage.generators?.neutral?.content ?? {})
      }
    },
    apiModule: api.module
  };
}

export function buildVegetacaoLaudoGeneratorAdapterSnapshot(model = {}, source = null, options = {}) {
  const payload = buildVegetacaoLaudoGeneratorAdapterPayload(model, source, options);

  return {
    version: payload.version,
    module: payload.module,
    key: payload.key,
    generatedAt: payload.generatedAt,
    readyForLaudo: payload.readyForLaudo,
    totalSectionsDocx: toArray(payload.models?.docx?.sections).length,
    totalSectionsPdf: toArray(payload.models?.pdf?.sections).length,
    totalSectionsNeutral: toArray(payload.models?.neutral?.sections).length
  };
}

export function buildVegetacaoLaudoGeneratorModel(generator = 'neutral', model = {}, source = null, options = {}) {
  const payload = buildVegetacaoLaudoGeneratorAdapterPayload(model, source, options);
  const selected = normalizeGenerator(generator);

  return clone(payload.models?.[selected] ?? payload.models?.neutral ?? null);
}

export function createVegetacaoLaudoGeneratorAdapter(config = {}) {
  function build(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoGeneratorAdapterPayload(
      model,
      source,
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoGeneratorAdapterSnapshot(
      model,
      source,
      { ...config, ...options }
    );
  }

  function buildModel(generator = 'neutral', model = {}, source = null, options = {}) {
    return buildVegetacaoLaudoGeneratorModel(
      generator,
      model,
      source,
      { ...config, ...options }
    );
  }

  function publish(model = {}, source = null, options = {}) {
    const payload = build(model, source, options);

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        build: (nextModel = {}, nextSource = null, nextOptions = {}) => build(nextModel, nextSource, nextOptions),
        buildSnapshot: (nextModel = {}, nextSource = null, nextOptions = {}) => buildSnapshot(nextModel, nextSource, nextOptions),
        buildModel: (generator = 'neutral', nextModel = {}, nextSource = null, nextOptions = {}) =>
          buildModel(generator, nextModel, nextSource, nextOptions),
        publish: (nextModel = {}, nextSource = null, nextOptions = {}) => publish(nextModel, nextSource, nextOptions)
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-generator-adapter-published', payload);
    }

    return payload;
  }

  return {
    module: MODULE_NAME,
    build,
    buildSnapshot,
    buildModel,
    publish
  };
}

export function ensureVegetacaoLaudoGeneratorAdapter(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const adapter = createVegetacaoLaudoGeneratorAdapter(config);

  if (typeof globalThis !== 'undefined' && config.bindGlobal !== false) {
    globalThis[GLOBAL_KEY] = adapter;
  }

  return adapter;
}