import { publishVegetacaoRuntime, buildVegetacaoRuntimeEnvelope } from './module_runtime.js';

const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};
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

export function extractVegetacaoModuleProject(source = {}) {
  const runtime = safeObject(source.runtime ?? source);
  const session = safeObject(runtime.session ?? runtime.getSession?.() ?? {});
  const project = safeObject(
    runtime.project ??
    runtime.projectContext ??
    session.projectContext ??
    source.project ??
    {}
  );

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

export function extractVegetacaoModuleSession(source = {}) {
  const runtime = safeObject(source.runtime ?? source);
  const session = safeObject(runtime.session ?? runtime.getSession?.() ?? source.session ?? {});
  const snapshot = safeObject(runtime.snapshot ?? runtime.getSnapshot?.() ?? source.snapshot ?? {});
  const moduleState = safeObject(snapshot.moduleState);

  return {
    sessionId: toText(
      session.sessionId ??
      session.id ??
      moduleState.sessionId
    ),
    activeSectorId: toText(
      session.activeSectorId ??
      session.setorAtivoId ??
      moduleState.activeSectorId
    ),
    captures: toArray(session.captures ?? moduleState.captures),
    sectors: toArray(session.sectors ?? moduleState.sectors),
    timeline: toArray(session.timeline),
    projectContext: safeObject(session.projectContext),
    metadata: {
      source: 'module_sync',
      hasRuntimeSnapshot: Boolean(Object.keys(snapshot).length),
      captureCount: toArray(session.captures ?? moduleState.captures).length,
      sectorCount: toArray(session.sectors ?? moduleState.sectors).length
    }
  };
}

export function buildVegetacaoModuleSyncInput(source = {}, options = {}) {
  const project = extractVegetacaoModuleProject(source);
  const session = extractVegetacaoModuleSession(source);

  return {
    project,
    session,
    threshold: toNumber(options.threshold || 60) || 60,
    metadata: {
      source: toText(options.source || 'module_sync'),
      ...safeObject(options.metadata)
    }
  };
}

export function buildVegetacaoModuleSyncEnvelope(source = {}, options = {}) {
  const input = buildVegetacaoModuleSyncInput(source, options);

  return buildVegetacaoRuntimeEnvelope(
    input.project,
    {
      sessionId: input.session.sessionId,
      activeSectorId: input.session.activeSectorId,
      captures: input.session.captures,
      sectors: input.session.sectors,
      timeline: input.session.timeline,
      projectContext: input.project,
      metadata: input.metadata
    },
    {
      threshold: input.threshold,
      metadata: input.metadata
    }
  );
}

export function syncVegetacaoModuleRuntime(source = {}, options = {}) {
  const input = buildVegetacaoModuleSyncInput(source, options);

  return publishVegetacaoRuntime(
    input.project,
    {
      sessionId: input.session.sessionId,
      activeSectorId: input.session.activeSectorId,
      captures: input.session.captures,
      sectors: input.session.sectors,
      timeline: input.session.timeline,
      projectContext: input.project,
      metadata: input.metadata
    },
    {
      threshold: input.threshold,
      metadata: input.metadata,
      storage: options.storage,
      emit: options.emit !== false,
      bindGlobal: options.bindGlobal !== false
    }
  );
}

export function createVegetacaoModuleSyncAgent(config = {}) {
  const state = {
    lastSignature: '',
    timer: null,
    isRunning: false
  };

  function resolveSource() {
    if (typeof config.getSource === 'function') {
      return config.getSource();
    }

    if (typeof globalThis !== 'undefined') {
      return globalThis.__APP_SOLO_NB_VEGETACAO__ ?? {};
    }

    return {};
  }

  function buildSignature(source = {}) {
    const session = extractVegetacaoModuleSession(source);
    return [
      toText(session.sessionId),
      toText(session.activeSectorId),
      toArray(session.captures).length,
      toArray(session.sectors).length,
      toArray(session.timeline).length
    ].join('|');
  }

  function run(reason = 'manual') {
    const source = resolveSource();
    const signature = buildSignature(source);

    if (!signature) return null;
    if (state.isRunning) return null;
    if (state.lastSignature === signature && reason !== 'force') return null;

    state.isRunning = true;

    try {
      const payload = syncVegetacaoModuleRuntime(source, {
        threshold: config.threshold,
        storage: config.storage,
        emit: config.emit !== false,
        bindGlobal: config.bindGlobal !== false,
        metadata: {
          reason,
          ...(safeObject(config.metadata))
        }
      });

      state.lastSignature = signature;
      return payload;
    } finally {
      state.isRunning = false;
    }
  }

  function schedule(reason = 'scheduled') {
    if (typeof clearTimeout === 'function' && state.timer) {
      clearTimeout(state.timer);
    }

    if (typeof setTimeout !== 'function') {
      return run(reason);
    }

    state.timer = setTimeout(() => run(reason), toNumber(config.debounceMs || 180) || 180);
    return null;
  }

  function attach() {
    if (typeof globalThis?.addEventListener !== 'function') return false;

    const onChanged = () => schedule('event.changed');
    const onBooted = () => schedule('event.booted');

    globalThis.addEventListener('solo-nb:vegetacao:changed', onChanged);
    globalThis.addEventListener('solo-nb:vegetacao:booted', onBooted);

    return true;
  }

  return {
    run,
    schedule,
    attach,
    getLastSignature: () => state.lastSignature
  };
}

export function bootstrapVegetacaoModuleSync(config = {}) {
  const agent = createVegetacaoModuleSyncAgent(config);
  agent.attach();
  agent.schedule('bootstrap');
  return agent;
}