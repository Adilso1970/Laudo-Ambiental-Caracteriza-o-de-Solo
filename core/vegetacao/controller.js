import {
  bootVegetacaoFacade,
  activateVegetacaoSector,
  registerVegetacaoArvoreIsolada,
  registerVegetacaoPanorama,
  registerVegetacaoMosaico,
  applyVegetacaoPreDedup,
  getVegetacaoViewModel,
  registerVegetacaoTechnicalEvent
} from './facade.js';

const noop = () => {};
const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

function normalizeProject(project = {}) {
  return {
    projectId: String(
      project.projectId ??
      project.id ??
      project.projetoId ??
      project.project_id ??
      'projeto-atual'
    ).trim(),
    uf: String(project.uf ?? '').trim().toUpperCase(),
    municipio: String(project.municipio ?? project.cidade ?? '').trim(),
    areaHa: Number(project.areaHa ?? project.area_ha ?? project.area ?? 0) || 0,
    contextoTerritorial: String(
      project.contextoTerritorial ??
      project.contexto_territorial ??
      project.contexto ??
      ''
    ).trim()
  };
}

function createMemoryStore(initialSession = null) {
  let value = initialSession;
  return {
    get() {
      return value;
    },
    set(nextValue) {
      value = nextValue;
      return value;
    }
  };
}

function buildSnapshot(project = {}, session = null) {
  return getVegetacaoViewModel(project, session ?? {});
}

function safeStore(store = {}) {
  const fallback = createMemoryStore(null);

  return {
    get: typeof store.get === 'function' ? store.get : fallback.get,
    set: typeof store.set === 'function' ? store.set : fallback.set
  };
}

function ensureTimelineEvent(project = {}, session = {}, type = 'evento.manual', payload = {}) {
  return registerVegetacaoTechnicalEvent(project, session, type, payload);
}

export function createVegetacaoController(options = {}) {
  const listeners = new Set();

  const store = safeStore({
    get: options.getSession,
    set: options.setSession
  });

  const state = {
    project: normalizeProject(options.project ?? {}),
    session: null,
    snapshot: null,
    booted: false
  };

  function notify(reason = 'state.changed') {
    state.snapshot = buildSnapshot(state.project, state.session);
    const payload = {
      reason,
      project: clone(state.project),
      session: clone(state.session),
      snapshot: clone(state.snapshot)
    };

    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (_) {}
    });

    return payload;
  }

  function commit(nextSession, reason = 'session.updated') {
    state.session = nextSession ?? null;
    store.set(state.session);
    return notify(reason);
  }

  function currentSession() {
    if (state.session) return state.session;
    return store.get() ?? null;
  }

  function currentSnapshot() {
    if (state.snapshot) return state.snapshot;
    state.snapshot = buildSnapshot(state.project, currentSession());
    return state.snapshot;
  }

  function boot(seedSession = null) {
    const bootInput = seedSession ?? currentSession() ?? {};
    let nextSession = bootVegetacaoFacade(state.project, bootInput);

    nextSession = ensureTimelineEvent(
      state.project,
      nextSession,
      'analise.preliminar.atualizada',
      {
        source: 'controller.boot',
        duplicateCandidates: toArray(currentSnapshot()?.duplicateCandidates).length
      }
    );

    state.booted = true;
    return commit(nextSession, 'controller.boot');
  }

  function setProject(nextProject = {}) {
    state.project = normalizeProject({
      ...state.project,
      ...nextProject
    });

    state.snapshot = buildSnapshot(state.project, currentSession());
    return notify('project.updated');
  }

  function activateSector(sectorId = null) {
    const nextSession = activateVegetacaoSector(
      state.project,
      currentSession() ?? {},
      sectorId
    );
    return commit(nextSession, 'sector.activated');
  }

  function registerCapture(mode = 'panorama_assistido', capture = {}) {
    const baseSession = currentSession() ?? {};
    let nextSession = null;

    if (mode === 'arvore_isolada') {
      nextSession = registerVegetacaoArvoreIsolada(state.project, baseSession, capture);
    } else if (mode === 'mosaico_setorial') {
      nextSession = registerVegetacaoMosaico(state.project, baseSession, capture);
    } else {
      nextSession = registerVegetacaoPanorama(state.project, baseSession, capture);
    }

    return commit(nextSession, 'capture.registered');
  }

  function registerArvoreIsolada(capture = {}) {
    return registerCapture('arvore_isolada', capture);
  }

  function registerPanorama(capture = {}) {
    return registerCapture('panorama_assistido', capture);
  }

  function registerMosaico(capture = {}) {
    return registerCapture('mosaico_setorial', capture);
  }

  function runPreDedup(threshold = 60) {
    const nextSession = applyVegetacaoPreDedup(
      state.project,
      currentSession() ?? {},
      threshold
    );
    return commit(nextSession, 'dedup.precheck');
  }

  function appendTechnicalEvent(type = 'evento.manual', payload = {}) {
    const nextSession = registerVegetacaoTechnicalEvent(
      state.project,
      currentSession() ?? {},
      type,
      payload
    );
    return commit(nextSession, 'timeline.appended');
  }

  function subscribe(listener = noop) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function hydrate(seedSession = null) {
    state.session = seedSession ?? currentSession() ?? null;
    state.snapshot = buildSnapshot(state.project, state.session);
    return notify('controller.hydrated');
  }

  function getState() {
    return {
      booted: state.booted,
      project: clone(state.project),
      session: clone(currentSession()),
      snapshot: clone(currentSnapshot())
    };
  }

  return {
    boot,
    hydrate,
    subscribe,
    getState,
    getSession: () => clone(currentSession()),
    getSnapshot: () => clone(currentSnapshot()),
    setProject,
    activateSector,
    registerCapture,
    registerArvoreIsolada,
    registerPanorama,
    registerMosaico,
    runPreDedup,
    appendTechnicalEvent
  };
}

export function createVegetacaoMemoryController(project = {}, initialSession = null) {
  const memory = createMemoryStore(initialSession);
  return createVegetacaoController({
    project,
    getSession: () => memory.get(),
    setSession: (nextSession) => memory.set(nextSession)
  });
}

export function createVegetacaoPageAdapter(config = {}) {
  const controller = createVegetacaoController(config);

  return {
    boot: (seedSession = null) => controller.boot(seedSession),
    onChange: (listener) => controller.subscribe(listener),
    getSnapshot: () => controller.getSnapshot(),
    getSession: () => controller.getSession(),
    setProject: (project) => controller.setProject(project),
    setActiveSector: (sectorId) => controller.activateSector(sectorId),
    captureArvoreIsolada: (capture) => controller.registerArvoreIsolada(capture),
    capturePanorama: (capture) => controller.registerPanorama(capture),
    captureMosaico: (capture) => controller.registerMosaico(capture),
    runPreDedup: (threshold = 60) => controller.runPreDedup(threshold),
    appendEvent: (type, payload) => controller.appendTechnicalEvent(type, payload)
  };
}