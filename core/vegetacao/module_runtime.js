import {
  buildVegetacaoModuleArtifacts,
  buildVegetacaoModuleState,
  buildVegetacaoModuleIntegrationEnvelope,
  saveVegetacaoModuleArtifacts,
  readVegetacaoModuleArtifacts
} from './module_service.js';

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

export function normalizeVegetacaoRuntimeProject(project = {}) {
  return {
    projectId: toText(
      project.projectId ??
      project.id ??
      project.projetoId ??
      project.project_id ??
      'projeto-atual'
    ),
    nome: toText(project.nome ?? project.name ?? project.titulo),
    uf: toText(project.uf).toUpperCase(),
    municipio: toText(project.municipio ?? project.cidade),
    areaHa: toNumber(project.areaHa ?? project.area_ha ?? project.area),
    contextoTerritorial: toText(
      project.contextoTerritorial ??
      project.contexto_territorial ??
      project.contexto
    )
  };
}

export function normalizeVegetacaoRuntimeSession(session = {}) {
  return {
    sessionId: toText(session.sessionId ?? session.id),
    activeSectorId: toText(session.activeSectorId ?? session.setorAtivoId),
    captures: toArray(session.captures),
    sectors: toArray(session.sectors),
    timeline: toArray(session.timeline),
    projectContext: safeObject(session.projectContext),
    metadata: safeObject(session.metadata)
  };
}

export function buildVegetacaoRuntimeInput(project = {}, session = {}, options = {}) {
  const normalizedProject = normalizeVegetacaoRuntimeProject({
    ...safeObject(session?.projectContext),
    ...safeObject(project)
  });

  const normalizedSession = normalizeVegetacaoRuntimeSession(session);

  return {
    project: normalizedProject,
    sessionId: normalizedSession.sessionId,
    activeSectorId: normalizedSession.activeSectorId,
    captures: normalizedSession.captures,
    sectors: normalizedSession.sectors,
    threshold: toNumber(options.threshold || 60) || 60,
    metadata: {
      source: toText(options.source || 'module_runtime'),
      timelineLength: normalizedSession.timeline.length,
      ...safeObject(options.metadata)
    }
  };
}

export function buildVegetacaoRuntimeState(project = {}, session = {}, options = {}) {
  const input = buildVegetacaoRuntimeInput(project, session, options);
  const moduleState = buildVegetacaoModuleState(input);
  const artifacts = buildVegetacaoModuleArtifacts(input);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    projectId: toText(moduleState.projectId),
    sessionId: toText(input.sessionId),
    state: moduleState,
    artifacts
  };
}

export function buildVegetacaoRuntimeEnvelope(project = {}, session = {}, options = {}) {
  const input = buildVegetacaoRuntimeInput(project, session, options);
  return buildVegetacaoModuleIntegrationEnvelope(input);
}

export function publishVegetacaoRuntime(project = {}, session = {}, options = {}) {
  const input = buildVegetacaoRuntimeInput(project, session, options);
  const artifacts = saveVegetacaoModuleArtifacts(input, {
    storage: options.storage,
    emit: options.emit !== false
  });

  const state = buildVegetacaoModuleState(input);
  const envelope = buildVegetacaoModuleIntegrationEnvelope(input);

  const payload = {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    projectId: toText(state.projectId),
    sessionId: toText(input.sessionId),
    state,
    artifacts,
    envelope
  };

  if (options.bindGlobal !== false && typeof globalThis !== 'undefined') {
    globalThis.__SOLO_NB_VEGETACAO_MODULE__ = payload;
  }

  if (options.emit !== false && typeof globalThis?.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent('solo-nb:vegetacao:module-runtime-updated', {
      detail: payload
    }));
  }

  return payload;
}

export function readVegetacaoRuntime(projectId = 'projeto-atual', options = {}) {
  const artifacts = readVegetacaoModuleArtifacts(projectId, {
    storage: options.storage
  });

  if (!artifacts) return null;

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    projectId: toText(projectId),
    state: clone(artifacts?.readinessSummary ?? null),
    artifacts
  };
}