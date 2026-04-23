import {
  publishVegetacaoLaudoDelivery,
  readVegetacaoLaudoDelivery,
  readVegetacaoLaudoDeliverySnapshot,
  readVegetacaoLaudoGeneratorContract,
  buildVegetacaoLaudoDeliveryGatewaySnapshot
} from './laudo_delivery_gateway.js';

import {
  buildVegetacaoLaudoDeliveryPayload,
  buildVegetacaoLaudoDeliverySnapshot,
  buildVegetacaoLaudoGeneratorContract
} from './laudo_delivery_service.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_API__';

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

export function createVegetacaoLaudoDeliveryApi(config = {}) {
  function buildPayload(model = {}, input = {}) {
    return buildVegetacaoLaudoDeliveryPayload(model, normalizeInput(input), config);
  }

  function buildSnapshot(model = {}, input = {}) {
    return buildVegetacaoLaudoDeliverySnapshot(model, normalizeInput(input), config);
  }

  function buildContract(model = {}, input = {}) {
    return buildVegetacaoLaudoGeneratorContract(model, normalizeInput(input), config);
  }

  function publish(model = {}, input = {}, options = {}) {
    const normalizedInput = normalizeInput(input);
    const published = publishVegetacaoLaudoDelivery(
      model,
      normalizedInput,
      {
        ...config,
        ...options
      }
    );

    emit('solo-nb:vegetacao:laudo-delivery-api-published', {
      module: MODULE_NAME,
      projectId: resolveProjectId(normalizedInput),
      published
    });

    return published;
  }

  function read(projectId = 'projeto-atual', options = {}) {
    return readVegetacaoLaudoDelivery(projectId, {
      ...config,
      ...options
    });
  }

  function readSnapshot(projectId = 'projeto-atual', options = {}) {
    return readVegetacaoLaudoDeliverySnapshot(projectId, {
      ...config,
      ...options
    });
  }

  function readContract(projectId = 'projeto-atual', options = {}) {
    return readVegetacaoLaudoGeneratorContract(projectId, {
      ...config,
      ...options
    });
  }

  function buildGatewaySnapshot(model = {}, input = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryGatewaySnapshot(
      model,
      normalizeInput(input),
      {
        ...config,
        ...options
      }
    );
  }

  return {
    module: MODULE_NAME,
    buildPayload,
    buildSnapshot,
    buildContract,
    publish,
    read,
    readSnapshot,
    readContract,
    buildGatewaySnapshot
  };
}

export function bootstrapVegetacaoLaudoDeliveryApi(config = {}) {
  const api = createVegetacaoLaudoDeliveryApi(config);

  if (typeof globalThis !== 'undefined') {
    globalThis[GLOBAL_KEY] = api;
  }

  emit('solo-nb:vegetacao:laudo-delivery-api-ready', {
    module: MODULE_NAME
  });

  return api;
}

export function ensureVegetacaoLaudoDeliveryApi(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  return bootstrapVegetacaoLaudoDeliveryApi(config);
}

export function buildVegetacaoLaudoDeliveryApiSnapshot(model = {}, input = {}, options = {}) {
  const api = createVegetacaoLaudoDeliveryApi(options);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    payload: clone(api.buildPayload(model, input)),
    snapshot: clone(api.buildSnapshot(model, input)),
    contract: clone(api.buildContract(model, input)),
    gateway: clone(api.buildGatewaySnapshot(model, input, options))
  };
}