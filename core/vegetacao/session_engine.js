import {
  VEGETACAO_CAPTURE_MODES,
  ensureVegetacaoSessionContract,
  normalizeVegetacaoProjectContext,
  createVegetacaoEvidenceRecord,
  getVegetacaoStorageNamespace
} from './schema.js';

const nowIso = () => new Date().toISOString();
const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();

function uid(prefix = 'veg') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(input = '') {
  let hash = 2166136261;
  const text = String(input);

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getStorage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch (_) {}
  return null;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function unique(values = []) {
  return [...new Set(toArray(values).filter(Boolean))];
}

function estimateIndividuals(capture = {}) {
  const explicit = Number(capture.individuos ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return capture.mode === 'arvore_isolada' ? 1 : 0;
}

function estimateAreaM2(capture = {}) {
  const value = Number(
    capture.areaOcupadaM2 ??
    capture.areaEstimativaM2 ??
    capture.area_m2 ??
    0
  );
  return Number.isFinite(value) ? value : 0;
}

function buildFingerprintSeed(capture = {}) {
  const capturedAt = toText(capture.capturedAt || nowIso()).slice(0, 16);
  return [
    toText(capture.mode),
    toText(capture.sectorId),
    capturedAt,
    toText(capture.fileName),
    toText(capture.width),
    toText(capture.height)
  ].filter(Boolean).join('|').toLowerCase();
}

export function buildVegetacaoStorageKey(projectContext = {}) {
  const ctx = normalizeVegetacaoProjectContext(projectContext);
  return `${getVegetacaoStorageNamespace()}:${ctx.projectId || 'projeto-atual'}`;
}

export function hydrateVegetacaoSession(rawSession = {}, projectContext = {}) {
  return ensureVegetacaoSessionContract(rawSession, projectContext);
}

export function loadVegetacaoSession(projectContext = {}) {
  const storage = getStorage();
  const key = buildVegetacaoStorageKey(projectContext);

  if (!storage) {
    return hydrateVegetacaoSession({}, projectContext);
  }

  const raw = storage.getItem(key);
  if (!raw) {
    return hydrateVegetacaoSession({}, projectContext);
  }

  return hydrateVegetacaoSession(parseJson(raw) ?? {}, projectContext);
}

export function saveVegetacaoSession(projectContext = {}, sessionInput = {}) {
  const storage = getStorage();
  const session = hydrateVegetacaoSession(sessionInput, projectContext);
  const key = buildVegetacaoStorageKey(projectContext);

  session.updatedAt = nowIso();
  session.persist = {
    ...(session.persist ?? {}),
    lastSavedAt: session.updatedAt,
    saveCount: Number(session.persist?.saveCount ?? 0) + 1
  };

  if (storage) {
    storage.setItem(key, JSON.stringify(session));
  }

  return session;
}

export function appendVegetacaoTimelineEvent(sessionInput = {}, type = 'evento', payload = {}) {
  const session = hydrateVegetacaoSession(sessionInput);

  session.timeline = toArray(session.timeline);
  session.timeline.push({
    id: uid('evt'),
    type: toText(type) || 'evento',
    at: nowIso(),
    payload: typeof payload === 'object' && payload !== null ? payload : {}
  });

  session.updatedAt = nowIso();
  return session;
}

export function setVegetacaoActiveSector(sessionInput = {}, sectorId = null) {
  const session = hydrateVegetacaoSession(sessionInput);

  session.activeSectorId = sectorId || null;
  session.sectors = toArray(session.sectors).map((sector) => ({
    ...sector,
    ativo: String(sector.id) === String(session.activeSectorId),
    updatedAt: nowIso()
  }));

  return appendVegetacaoTimelineEvent(session, 'setor.ativado', {
    sectorId: session.activeSectorId
  });
}

export function registerVegetacaoCapture(sessionInput = {}, captureInput = {}) {
  const session = hydrateVegetacaoSession(sessionInput);

  const capture = createVegetacaoEvidenceRecord({
    ...captureInput,
    id: captureInput.id || uid('cap'),
    sectorId: captureInput.sectorId || session.activeSectorId || null,
    capturedAt: captureInput.capturedAt || nowIso(),
    fingerprintSeed: captureInput.fingerprintSeed || buildFingerprintSeed({
      ...captureInput,
      sectorId: captureInput.sectorId || session.activeSectorId || null
    })
  });

  capture.localHash = capture.localHash || hashString(
    JSON.stringify({
      fingerprintSeed: capture.fingerprintSeed,
      fileName: capture.fileName,
      mode: capture.mode,
      width: capture.width,
      height: capture.height
    })
  );

  session.captures = toArray(session.captures);
  session.captures.push(capture);
  session.dedupQueue = unique([...(session.dedupQueue ?? []), capture.id]);

  session.analysis = buildVegetacaoPreAnalysis(session);
  session.laudoHook = buildVegetacaoLaudoHook(session);
  session.integration = {
    ...(session.integration ?? {}),
    laudoReady: Boolean(session.captures.length),
    laudoLastPreparedAt: nowIso()
  };

  return appendVegetacaoTimelineEvent(session, 'captura.registrada', {
    captureId: capture.id,
    sectorId: capture.sectorId,
    mode: capture.mode
  });
}

export function markVegetacaoDedupCandidate(sessionInput = {}, captureIds = []) {
  const session = hydrateVegetacaoSession(sessionInput);
  const targetIds = unique(captureIds);

  session.captures = toArray(session.captures).map((capture) => {
    if (!targetIds.includes(capture.id)) return capture;
    return {
      ...capture,
      dedupStatus: 'candidate'
    };
  });

  session.analysis = buildVegetacaoPreAnalysis(session);
  session.laudoHook = buildVegetacaoLaudoHook(session);

  return appendVegetacaoTimelineEvent(session, 'dedup.candidate', {
    captureIds: targetIds
  });
}

export function buildVegetacaoPreAnalysis(sessionInput = {}) {
  const session = hydrateVegetacaoSession(sessionInput);
  const captures = toArray(session.captures);
  const sectors = toArray(session.sectors);

  const bySpeciesMap = new Map();
  const bySectorMap = new Map();
  const byModeMap = new Map();

  let totalIndividuals = 0;
  let totalAreaM2 = 0;
  let pendingDedup = 0;
  let pendingAnalysis = 0;

  captures.forEach((capture) => {
    const species = toText(capture.especie) || 'não identificada';
    const sectorId = toText(capture.sectorId);
    const sectorName = sectors.find((item) => String(item.id) === sectorId)?.nome || 'Sem setor';
    const mode = VEGETACAO_CAPTURE_MODES.includes(capture.mode) ? capture.mode : 'panorama_assistido';
    const individuals = estimateIndividuals(capture);
    const areaM2 = estimateAreaM2(capture);

    totalIndividuals += individuals;
    totalAreaM2 += areaM2;

    if (capture.dedupStatus === 'pending') pendingDedup += 1;
    if (capture.analysisStatus === 'pending') pendingAnalysis += 1;

    if (!bySpeciesMap.has(species)) {
      bySpeciesMap.set(species, { especie: species, individuos: 0, capturas: 0 });
    }
    const speciesEntry = bySpeciesMap.get(species);
    speciesEntry.individuos += individuals;
    speciesEntry.capturas += 1;

    if (!bySectorMap.has(sectorName)) {
      bySectorMap.set(sectorName, {
        setor: sectorName,
        capturas: 0,
        individuos: 0,
        areaOcupadaM2: 0
      });
    }
    const sectorEntry = bySectorMap.get(sectorName);
    sectorEntry.capturas += 1;
    sectorEntry.individuos += individuals;
    sectorEntry.areaOcupadaM2 += areaM2;

    if (!byModeMap.has(mode)) {
      byModeMap.set(mode, { mode, capturas: 0 });
    }
    const modeEntry = byModeMap.get(mode);
    modeEntry.capturas += 1;
  });

  const pendencias = [];
  if (!captures.length) pendencias.push('Sessão sem capturas registradas.');
  if (pendingDedup > 0) pendencias.push(`${pendingDedup} captura(s) aguardando deduplicação futura.`);
  if (pendingAnalysis > 0) pendencias.push(`${pendingAnalysis} captura(s) aguardando análise automática preliminar.`);

  return {
    status: captures.length ? 'preliminary' : 'pending',
    generatedAt: nowIso(),
    resumo: {
      totalCapturas: captures.length,
      totalSetores: sectors.length,
      especiesMapeadas: bySpeciesMap.size,
      individuosEstimados: totalIndividuals,
      areaOcupadaEstimadaM2: Number(totalAreaM2.toFixed(2)),
      pendenciasAbertas: pendencias.length
    },
    porEspecie: [...bySpeciesMap.values()].sort((a, b) => b.individuos - a.individuos),
    porSetor: [...bySectorMap.values()].sort((a, b) => b.capturas - a.capturas),
    porModo: [...byModeMap.values()].sort((a, b) => b.capturas - a.capturas),
    pendencias
  };
}

export function buildVegetacaoLaudoHook(sessionInput = {}) {
  const session = hydrateVegetacaoSession(sessionInput);
  const analysis = session.analysis?.resumo ? session.analysis : buildVegetacaoPreAnalysis(session);
  const ctx = normalizeVegetacaoProjectContext(session.projectContext ?? {});

  return {
    version: 1,
    generatedAt: nowIso(),
    neutralidade: 'laudo_neutro',
    projeto: {
      uf: ctx.uf,
      municipio: ctx.municipio,
      areaHa: ctx.areaHa,
      contextoTerritorial: ctx.contextoTerritorial
    },
    sintese: {
      totalCapturas: analysis.resumo?.totalCapturas ?? 0,
      totalSetores: analysis.resumo?.totalSetores ?? 0,
      especiesMapeadas: analysis.resumo?.especiesMapeadas ?? 0,
      individuosEstimados: analysis.resumo?.individuosEstimados ?? 0,
      areaOcupadaEstimadaM2: analysis.resumo?.areaOcupadaEstimadaM2 ?? 0
    },
    pendencias: toArray(analysis.pendencias),
    metodologiaSugerida: [
      'Levantamento preliminar organizado por sessão e setor ativo.',
      'Resultado preparado para futura deduplicação entre imagens.',
      'Resumo técnico sujeito Ã  validação especializada antes de integração final no laudo.'
    ]
  };
}