import {
  loadVegetacaoSession,
  saveVegetacaoSession,
  setVegetacaoActiveSector,
  registerVegetacaoCapture,
  markVegetacaoDedupCandidate,
  appendVegetacaoTimelineEvent,
  buildVegetacaoPreAnalysis,
  buildVegetacaoLaudoHook,
  hydrateVegetacaoSession
} from './session_engine.js';

const nowIso = () => new Date().toISOString();
const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();

function mergeSeedSession(baseSession = {}, seedSession = {}) {
  const merged = {
    ...baseSession,
    ...seedSession,
    projectContext: {
      ...(baseSession.projectContext ?? {}),
      ...(seedSession.projectContext ?? {})
    },
    sectors: toArray(seedSession.sectors).length ? seedSession.sectors : toArray(baseSession.sectors),
    captures: toArray(seedSession.captures).length ? seedSession.captures : toArray(baseSession.captures),
    timeline: toArray(seedSession.timeline).length ? seedSession.timeline : toArray(baseSession.timeline),
    dedupQueue: toArray(seedSession.dedupQueue).length ? seedSession.dedupQueue : toArray(baseSession.dedupQueue),
    analysis: seedSession.analysis ?? baseSession.analysis,
    laudoHook: seedSession.laudoHook ?? baseSession.laudoHook,
    integration: {
      ...(baseSession.integration ?? {}),
      ...(seedSession.integration ?? {})
    },
    persist: {
      ...(baseSession.persist ?? {}),
      ...(seedSession.persist ?? {})
    }
  };

  return hydrateVegetacaoSession(merged, merged.projectContext ?? {});
}

function ensureBootEvent(session = {}) {
  const timeline = toArray(session.timeline);
  const hasBoot = timeline.some((event) => toText(event?.type) === 'sessao.carregada');

  if (hasBoot) return session;

  return appendVegetacaoTimelineEvent(session, 'sessao.carregada', {
    source: 'runtime.boot',
    at: nowIso()
  });
}

function finalizeSession(projectContext = {}, session = {}) {
  const normalized = hydrateVegetacaoSession(session, projectContext);
  normalized.analysis = buildVegetacaoPreAnalysis(normalized);
  normalized.laudoHook = buildVegetacaoLaudoHook(normalized);
  normalized.integration = {
    ...(normalized.integration ?? {}),
    laudoReady: Boolean(normalized.captures?.length),
    laudoLastPreparedAt: nowIso()
  };
  return saveVegetacaoSession(projectContext, normalized);
}

export function bootVegetacaoRuntime(projectContext = {}, seedSession = {}) {
  const persisted = loadVegetacaoSession(projectContext);
  const merged = mergeSeedSession(persisted, seedSession);
  const booted = ensureBootEvent(merged);
  return finalizeSession(projectContext, booted);
}

export function persistVegetacaoSectorChange(projectContext = {}, session = {}, sectorId = null) {
  const nextSession = setVegetacaoActiveSector(session, sectorId);
  return finalizeSession(projectContext, nextSession);
}

export function persistVegetacaoCapture(projectContext = {}, session = {}, captureInput = {}) {
  const nextSession = registerVegetacaoCapture(session, captureInput);
  return finalizeSession(projectContext, nextSession);
}

export function persistVegetacaoDedupCandidates(projectContext = {}, session = {}, captureIds = []) {
  const nextSession = markVegetacaoDedupCandidate(session, captureIds);
  return finalizeSession(projectContext, nextSession);
}

export function persistVegetacaoManualEvent(projectContext = {}, session = {}, type = 'evento.manual', payload = {}) {
  const nextSession = appendVegetacaoTimelineEvent(session, type, payload);
  return finalizeSession(projectContext, nextSession);
}

export function buildVegetacaoModuleState(session = {}) {
  const current = hydrateVegetacaoSession(session, session.projectContext ?? {});
  const analysis = current.analysis?.resumo ? current.analysis : buildVegetacaoPreAnalysis(current);
  const captures = toArray(current.captures);
  const sectors = toArray(current.sectors);

  return {
    sessionId: current.sessionId,
    startedAt: current.startedAt,
    updatedAt: current.updatedAt,
    activeSectorId: current.activeSectorId ?? null,
    resumo: {
      totalCapturas: analysis.resumo?.totalCapturas ?? captures.length,
      totalSetores: analysis.resumo?.totalSetores ?? sectors.length,
      especiesMapeadas: analysis.resumo?.especiesMapeadas ?? 0,
      individuosEstimados: analysis.resumo?.individuosEstimados ?? 0,
      areaOcupadaEstimadaM2: analysis.resumo?.areaOcupadaEstimadaM2 ?? 0,
      pendenciasAbertas: analysis.resumo?.pendenciasAbertas ?? 0
    },
    status: {
      hasCaptures: captures.length > 0,
      hasSectors: sectors.length > 0,
      hasActiveSector: Boolean(current.activeSectorId),
      hasPendingDedup: captures.some((item) => item?.dedupStatus === 'pending'),
      hasPendingAnalysis: captures.some((item) => item?.analysisStatus === 'pending')
    },
    analysis,
    laudoHook: current.laudoHook ?? buildVegetacaoLaudoHook(current),
    timeline: toArray(current.timeline),
    sectors,
    captures
  };
}

export function exportVegetacaoLaudoSnapshot(projectContext = {}, session = {}) {
  const current = finalizeSession(projectContext, session);
  return current.laudoHook ?? buildVegetacaoLaudoHook(current);
}