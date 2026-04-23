import {
  buildVegetacaoLaudoDeliveryPayload,
  buildVegetacaoLaudoDeliverySnapshot,
  buildVegetacaoLaudoGeneratorContract
} from './laudo_delivery_service.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_GATEWAY__';
const STORAGE_PREFIX = 'solo-nb:vegetacao:laudo-delivery:v1';

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

function resolveStorage(customStorage) {
  if (customStorage) return customStorage;

  try {
    return globalThis?.localStorage ?? null;
  } catch (_) {
    return null;
  }
}

function emit(name, detail) {
  if (typeof globalThis?.dispatchEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
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

function resolveProjectId(input = {}) {
  const project = safeObject(input.project);
  return toText(
    project.projectId ??
    project.id ??
    project.projetoId ??
    project.project_id ??
    'projeto-atual'
  ) || 'projeto-atual';
}

export function buildVegetacaoLaudoDeliveryStorageKey(projectId = 'projeto-atual') {
  return `${STORAGE_PREFIX}:${toText(projectId) || 'projeto-atual'}`;
}

export function publishVegetacaoLaudoDelivery(model = {}, input = {}, options = {}) {
  const normalizedInput = normalizeInput(input);
  const payload = buildVegetacaoLaudoDeliveryPayload(model, normalizedInput, options);
  const snapshot = buildVegetacaoLaudoDeliverySnapshot(model, normalizedInput, options);
  const contract = buildVegetacaoLaudoGeneratorContract(model, normalizedInput, options);

  const storage = resolveStorage(options.storage);
  const projectId = resolveProjectId(normalizedInput);
  const storageKey = buildVegetacaoLaudoDeliveryStorageKey(projectId);

  const published = {
    version: 1,
    module: MODULE_NAME,
    key: payload.key,
    generatedAt: new Date().toISOString(),
    projectId,
    readyForLaudo: Boolean(payload.readyForLaudo),
    payload,
    snapshot,
    contract
  };

  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify(published));
    } catch (_) {}
  }

  if (options.bindGlobal !== false && typeof globalThis !== 'undefined') {
    globalThis.__SOLO_NB_VEGETACAO_LAUDO_DELIVERY__ = published;
    globalThis[GLOBAL_KEY] = {
      module: MODULE_NAME,
      projectId,
      storageKey,
      getPublished: () => clone(published),
      getSnapshot: () => clone(snapshot),
      getContract: () => clone(contract),
      readStored: () => readVegetacaoLaudoDelivery(projectId, { storage }),
      readSnapshot: () => readVegetacaoLaudoDeliverySnapshot(projectId, { storage })
    };
  }

  if (options.emit !== false) {
    emit('solo-nb:vegetacao:laudo-delivery-published', published);
  }

  return published;
}

export function readVegetacaoLaudoDelivery(projectId = 'projeto-atual', options = {}) {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;

  try {
    const raw = storage.getItem(buildVegetacaoLaudoDeliveryStorageKey(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function readVegetacaoLaudoDeliverySnapshot(projectId = 'projeto-atual', options = {}) {
  const stored = readVegetacaoLaudoDelivery(projectId, options);
  return stored ? clone(stored.snapshot ?? null) : null;
}

export function readVegetacaoLaudoGeneratorContract(projectId = 'projeto-atual', options = {}) {
  const stored = readVegetacaoLaudoDelivery(projectId, options);
  return stored ? clone(stored.contract ?? null) : null;
}

export function buildVegetacaoLaudoDeliveryGatewaySnapshot(model = {}, input = {}, options = {}) {
  const normalizedInput = normalizeInput(input);
  const payload = buildVegetacaoLaudoDeliveryPayload(model, normalizedInput, options);
  const snapshot = buildVegetacaoLaudoDeliverySnapshot(model, normalizedInput, options);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    projectId: resolveProjectId(normalizedInput),
    key: payload.key,
    readyForLaudo: Boolean(payload.readyForLaudo),
    snapshot
  };
}