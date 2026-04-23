const MODULE_NAME = 'vegetacao';
const MODULE_VERSION = 1;

const toText = (value) => String(value ?? '').trim();

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

export const VEGETACAO_MODULE_MANIFEST = Object.freeze({
  module: MODULE_NAME,
  version: MODULE_VERSION,
  layer: 'core',
  title: 'Vegetacao / Supressao / Compensacao',
  description: 'Manifesto tecnico do modulo Vegetacao para integracao controlada futura.',
  entrypoints: Object.freeze({
    publicApi: './module_api.js',
    bootstrap: './module_bootstrap.js',
    adapter: './module_adapter.js',
    registry: './module_registry.js',
    gateway: './module_gateway.js',
    sync: './module_sync.js',
    runtime: './module_runtime.js',
    moduleService: './module_service.js',
    healthcheck: './healthcheck.js',
    index: './index.js'
  }),
  contracts: Object.freeze({
    session: './schema.js',
    validator: './validator.js',
    analysis: './analysis_service.js',
    pipeline: './pipeline.js',
    readiness: './readiness_service.js',
    handoff: './handoff_service.js',
    laudoBridge: './laudo_bridge.js'
  }),
  globals: Object.freeze({
    runtimeSource: '__APP_SOLO_NB_VEGETACAO__',
    runtimePublished: '__SOLO_NB_VEGETACAO_MODULE__',
    registry: '__SOLO_NB_VEGETACAO_MODULE_REGISTRY__',
    adapter: '__SOLO_NB_VEGETACAO_MODULE_ADAPTER__',
    bootstrap: '__SOLO_NB_VEGETACAO_MODULE_BOOTSTRAP__',
    api: '__SOLO_NB_VEGETACAO_MODULE_API__',
    laudoHook: '__SOLO_NB_VEGETACAO_LAUDO_HOOK__',
    preanalysis: '__SOLO_NB_VEGETACAO_PREANALYSIS__'
  }),
  storage: Object.freeze({
    laudoHookPrefix: 'solo-nb:laudo-hook:v1',
    moduleArtifactsPrefix: 'solo-nb:vegetacao:module:v1',
    sessionPrefix: 'solo-nb:vegetacao:v1'
  }),
  events: Object.freeze([
    'solo-nb:vegetacao:booted',
    'solo-nb:vegetacao:changed',
    'solo-nb:vegetacao:preanalysis-ready',
    'solo-nb:laudo:vegetacao-hook-updated',
    'solo-nb:vegetacao:module-artifacts-updated',
    'solo-nb:vegetacao:module-runtime-updated',
    'solo-nb:vegetacao:registry-started',
    'solo-nb:vegetacao:registry-updated',
    'solo-nb:vegetacao:module-adapter-updated',
    'solo-nb:vegetacao:module-bootstrap-updated',
    'solo-nb:vegetacao:module-api-started',
    'solo-nb:vegetacao:module-api-synced'
  ]),
  requiredInputs: Object.freeze([
    'project.projectId',
    'project.uf',
    'project.municipio',
    'sessionId',
    'activeSectorId',
    'captures[]',
    'sectors[]'
  ]),
  outputs: Object.freeze([
    'module state',
    'pipeline snapshot',
    'readiness summary',
    'handoff snapshot',
    'healthcheck snapshot',
    'laudo hook'
  ])
});

export function getVegetacaoModuleManifest() {
  return clone(VEGETACAO_MODULE_MANIFEST);
}

export function getVegetacaoModuleEntrypoints() {
  return clone(VEGETACAO_MODULE_MANIFEST.entrypoints);
}

export function getVegetacaoModuleContracts() {
  return clone(VEGETACAO_MODULE_MANIFEST.contracts);
}

export function getVegetacaoModuleGlobals() {
  return clone(VEGETACAO_MODULE_MANIFEST.globals);
}

export function getVegetacaoModuleEvents() {
  return clone(VEGETACAO_MODULE_MANIFEST.events);
}

export function getVegetacaoModuleStorageManifest() {
  return clone(VEGETACAO_MODULE_MANIFEST.storage);
}

export function buildVegetacaoModuleConsumerGuide() {
  return {
    module: MODULE_NAME,
    version: MODULE_VERSION,
    title: VEGETACAO_MODULE_MANIFEST.title,
    publicApi: VEGETACAO_MODULE_MANIFEST.entrypoints.publicApi,
    bootstrap: VEGETACAO_MODULE_MANIFEST.entrypoints.bootstrap,
    runtimeSourceGlobal: VEGETACAO_MODULE_MANIFEST.globals.runtimeSource,
    requiredInputs: clone(VEGETACAO_MODULE_MANIFEST.requiredInputs),
    outputs: clone(VEGETACAO_MODULE_MANIFEST.outputs),
    events: clone(VEGETACAO_MODULE_MANIFEST.events)
  };
}

export function resolveVegetacaoModuleEventName(name = '') {
  const normalized = toText(name);
  return VEGETACAO_MODULE_MANIFEST.events.find((item) => item === normalized) || '';
}