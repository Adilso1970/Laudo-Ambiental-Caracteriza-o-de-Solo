import { buildVegetacaoLaudoDeliveryPayload, buildVegetacaoLaudoDeliverySnapshot, buildVegetacaoLaudoGeneratorContract } from './laudo_delivery_service.js';
import { buildVegetacaoLaudoDeliveryGatewaySnapshot, publishVegetacaoLaudoDelivery } from './laudo_delivery_gateway.js';
import { ensureVegetacaoLaudoDeliveryApi, buildVegetacaoLaudoDeliveryApiSnapshot } from './laudo_delivery_api.js';
import { ensureVegetacaoLaudoDeliveryBootstrap } from './laudo_delivery_bootstrap.js';
import { buildVegetacaoLaudoDeliverySelfTestSnapshot, buildVegetacaoLaudoDeliverySelfTestText } from './laudo_delivery_selftest.js';
import { buildVegetacaoLaudoDeliveryDiagnosticsSnapshot, buildVegetacaoLaudoDeliveryDiagnosticsText } from './laudo_delivery_diagnostics.js';

const MODULE_NAME = 'vegetacao';
const GLOBAL_KEY = '__SOLO_NB_VEGETACAO_LAUDO_DELIVERY_ORCHESTRATOR__';

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

export function buildVegetacaoLaudoDeliveryOrchestratorPayload(model = {}, input = {}, options = {}) {
  const normalizedInput = normalizeInput(input);

  const payload = buildVegetacaoLaudoDeliveryPayload(model, normalizedInput, options);
  const snapshot = buildVegetacaoLaudoDeliverySnapshot(model, normalizedInput, options);
  const contract = buildVegetacaoLaudoGeneratorContract(model, normalizedInput, options);
  const gateway = buildVegetacaoLaudoDeliveryGatewaySnapshot(model, normalizedInput, options);
  const api = buildVegetacaoLaudoDeliveryApiSnapshot(model, normalizedInput, options);
  const selftest = buildVegetacaoLaudoDeliverySelfTestSnapshot(model, normalizedInput, options);
  const selftestText = buildVegetacaoLaudoDeliverySelfTestText(model, normalizedInput, options);
  const diagnostics = buildVegetacaoLaudoDeliveryDiagnosticsSnapshot(model, normalizedInput, options);
  const diagnosticsText = buildVegetacaoLaudoDeliveryDiagnosticsText(model, normalizedInput, options);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    projectId: resolveProjectId(normalizedInput),
    readyForLaudo: Boolean(payload.readyForLaudo),
    payload,
    snapshot,
    contract,
    gateway,
    api,
    selftest,
    selftestText,
    diagnostics,
    diagnosticsText
  };
}

export function buildVegetacaoLaudoDeliveryOrchestratorSnapshot(model = {}, input = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryOrchestratorPayload(model, input, options);

  return {
    version: report.version,
    module: report.module,
    generatedAt: report.generatedAt,
    projectId: report.projectId,
    readyForLaudo: report.readyForLaudo,
    snapshot: clone(report.snapshot),
    selftest: clone(report.selftest),
    diagnostics: clone(report.diagnostics)
  };
}

export function createVegetacaoLaudoDeliveryOrchestrator(config = {}) {
  const api = ensureVegetacaoLaudoDeliveryApi(config.apiConfig ?? {});
  const bootstrap = ensureVegetacaoLaudoDeliveryBootstrap(config.bootstrapConfig ?? {});

  function build(model = {}, input = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryOrchestratorPayload(
      model,
      input,
      { ...config, ...options }
    );
  }

  function buildSnapshot(model = {}, input = {}, options = {}) {
    return buildVegetacaoLaudoDeliveryOrchestratorSnapshot(
      model,
      input,
      { ...config, ...options }
    );
  }

  function publish(model = {}, input = {}, options = {}) {
    const normalizedInput = normalizeInput(input);

    const published = publishVegetacaoLaudoDelivery(
      model,
      normalizedInput,
      { ...config, ...options }
    );

    const orchestrated = buildVegetacaoLaudoDeliveryOrchestratorPayload(
      model,
      normalizedInput,
      { ...config, ...options }
    );

    const payload = {
      version: 1,
      module: MODULE_NAME,
      generatedAt: new Date().toISOString(),
      projectId: resolveProjectId(normalizedInput),
      published,
      orchestrated
    };

    if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
      globalThis[GLOBAL_KEY] = {
        module: MODULE_NAME,
        build: (nextModel = {}, nextInput = {}, nextOptions = {}) => build(nextModel, nextInput, nextOptions),
        buildSnapshot: (nextModel = {}, nextInput = {}, nextOptions = {}) => buildSnapshot(nextModel, nextInput, nextOptions),
        publish: (nextModel = {}, nextInput = {}, nextOptions = {}) => publish(nextModel, nextInput, nextOptions),
        readStored: (projectId = 'projeto-atual', nextOptions = {}) => api.read(projectId, nextOptions),
        readContract: (projectId = 'projeto-atual', nextOptions = {}) => api.readContract(projectId, nextOptions),
        startBootstrap: () => bootstrap.start(),
        getBootstrapState: () => bootstrap.getState()
      };
    }

    if (config.emit !== false) {
      emit('solo-nb:vegetacao:laudo-delivery-orchestrated', payload);
    }

    return payload;
  }

  return {
    module: MODULE_NAME,
    build,
    buildSnapshot,
    publish,
    readStored: (projectId = 'projeto-atual', options = {}) => api.read(projectId, options),
    readContract: (projectId = 'projeto-atual', options = {}) => api.readContract(projectId, options),
    startBootstrap: () => bootstrap.start(),
    getBootstrapState: () => bootstrap.getState()
  };
}

export function ensureVegetacaoLaudoDeliveryOrchestrator(config = {}) {
  if (typeof globalThis !== 'undefined' && globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const orchestrator = createVegetacaoLaudoDeliveryOrchestrator(config);

  if (config.bindGlobal !== false && typeof globalThis !== 'undefined') {
    globalThis[GLOBAL_KEY] = orchestrator;
  }

  return orchestrator;
}