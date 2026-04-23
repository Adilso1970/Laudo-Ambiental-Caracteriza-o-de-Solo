import {
  bootVegetacaoRuntime,
  persistVegetacaoSectorChange,
  persistVegetacaoCapture,
  persistVegetacaoDedupCandidates,
  persistVegetacaoManualEvent,
  buildVegetacaoModuleState,
  exportVegetacaoLaudoSnapshot
} from './runtime.js';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();

function normalizeProjectContext(project = {}) {
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

function safeMode(mode = '') {
  const current = String(mode ?? '').trim();
  if (current === 'arvore_isolada') return 'arvore_isolada';
  if (current === 'mosaico_setorial') return 'mosaico_setorial';
  return 'panorama_assistido';
}

function buildCapturePayload(input = {}, forcedMode = 'panorama_assistido') {
  return {
    ...input,
    mode: safeMode(input.mode ?? forcedMode),
    fileName: String(input.fileName ?? input.nomeArquivo ?? '').trim(),
    mimeType: String(input.mimeType ?? '').trim(),
    uri: String(input.uri ?? input.url ?? '').trim(),
    width: Number(input.width ?? 0) || 0,
    height: Number(input.height ?? 0) || 0,
    especie: String(input.especie ?? '').trim(),
    individuos: Number(input.individuos ?? input.quantidade ?? 0) || 0,
    areaOcupadaM2: Number(input.areaOcupadaM2 ?? input.areaEstimativaM2 ?? input.area_m2 ?? 0) || 0,
    observacoes: String(input.observacoes ?? '').trim(),
    tags: toArray(input.tags).map((item) => String(item).trim()).filter(Boolean),
    metadata: typeof input.metadata === 'object' && input.metadata !== null ? input.metadata : {}
  };
}

function captureSimilarityScore(left = {}, right = {}) {
  let score = 0;

  if (toText(left.localHash) && toText(left.localHash) === toText(right.localHash)) score += 100;
  if (toText(left.fingerprintSeed) && toText(left.fingerprintSeed) === toText(right.fingerprintSeed)) score += 70;
  if (toText(left.sectorId) && toText(left.sectorId) === toText(right.sectorId)) score += 10;
  if (toText(left.mode) && toText(left.mode) === toText(right.mode)) score += 10;
  if (toText(left.fileName) && toText(left.fileName) === toText(right.fileName)) score += 20;
  if (Number(left.width ?? 0) > 0 && Number(left.width ?? 0) === Number(right.width ?? 0)) score += 5;
  if (Number(left.height ?? 0) > 0 && Number(left.height ?? 0) === Number(right.height ?? 0)) score += 5;

  const leftTime = String(left.capturedAt ?? '').slice(0, 16);
  const rightTime = String(right.capturedAt ?? '').slice(0, 16);
  if (leftTime && leftTime === rightTime) score += 10;

  return score;
}

function findLikelyDuplicateIds(session = {}, threshold = 60) {
  const captures = toArray(session.captures);
  const duplicates = new Set();

  for (let i = 0; i < captures.length; i += 1) {
    for (let j = i + 1; j < captures.length; j += 1) {
      const score = captureSimilarityScore(captures[i], captures[j]);
      if (score >= threshold) {
        duplicates.add(captures[i].id);
        duplicates.add(captures[j].id);
      }
    }
  }

  return [...duplicates];
}

function buildDashboardCards(moduleState = {}) {
  const resumo = moduleState.resumo ?? {};
  const status = moduleState.status ?? {};

  return [
    {
      id: 'capturas',
      label: 'Capturas',
      value: resumo.totalCapturas ?? 0,
      tone: status.hasCaptures ? 'ok' : 'attention'
    },
    {
      id: 'setores',
      label: 'Setores',
      value: resumo.totalSetores ?? 0,
      tone: status.hasSectors ? 'ok' : 'attention'
    },
    {
      id: 'especies',
      label: 'Espécies',
      value: resumo.especiesMapeadas ?? 0,
      tone: 'neutral'
    },
    {
      id: 'individuos',
      label: 'Indivíduos',
      value: resumo.individuosEstimados ?? 0,
      tone: 'neutral'
    },
    {
      id: 'area',
      label: 'Área estimada mÂ²',
      value: resumo.areaOcupadaEstimadaM2 ?? 0,
      tone: 'neutral'
    },
    {
      id: 'pendencias',
      label: 'Pendências',
      value: resumo.pendenciasAbertas ?? 0,
      tone: (resumo.pendenciasAbertas ?? 0) > 0 ? 'attention' : 'ok'
    }
  ];
}

function buildTimelineRows(moduleState = {}) {
  return toArray(moduleState.timeline).map((event) => ({
    id: event.id,
    type: event.type,
    at: event.at,
    description: describeTimelineEvent(event)
  }));
}

function describeTimelineEvent(event = {}) {
  const type = String(event.type ?? '').trim();
  const payload = event.payload ?? {};

  if (type === 'sessao.carregada') return 'Sessão de vegetação carregada.';
  if (type === 'setor.ativado') return `Setor ativo alterado para ${payload.sectorId ?? 'não informado'}.`;
  if (type === 'captura.registrada') return `Captura registrada no modo ${payload.mode ?? 'não informado'}.`;
  if (type === 'dedup.candidate') return 'Capturas sinalizadas para futura deduplicação.';
  if (type === 'analise.preliminar.atualizada') return 'Análise preliminar atualizada.';
  if (type === 'laudo.snapshot.gerado') return 'Snapshot do laudo preparado.';
  return type || 'Evento registrado';
}

export function bootVegetacaoFacade(project = {}, seedSession = {}) {
  const projectContext = normalizeProjectContext(project);
  return bootVegetacaoRuntime(projectContext, seedSession);
}

export function activateVegetacaoSector(project = {}, session = {}, sectorId = null) {
  const projectContext = normalizeProjectContext(project);
  return persistVegetacaoSectorChange(projectContext, session, sectorId);
}

export function registerVegetacaoArvoreIsolada(project = {}, session = {}, capture = {}) {
  const projectContext = normalizeProjectContext(project);
  return persistVegetacaoCapture(projectContext, session, buildCapturePayload(capture, 'arvore_isolada'));
}

export function registerVegetacaoPanorama(project = {}, session = {}, capture = {}) {
  const projectContext = normalizeProjectContext(project);
  return persistVegetacaoCapture(projectContext, session, buildCapturePayload(capture, 'panorama_assistido'));
}

export function registerVegetacaoMosaico(project = {}, session = {}, capture = {}) {
  const projectContext = normalizeProjectContext(project);
  return persistVegetacaoCapture(projectContext, session, buildCapturePayload(capture, 'mosaico_setorial'));
}

export function applyVegetacaoPreDedup(project = {}, session = {}, threshold = 60) {
  const projectContext = normalizeProjectContext(project);
  const duplicateIds = findLikelyDuplicateIds(session, threshold);

  if (!duplicateIds.length) {
    return persistVegetacaoManualEvent(projectContext, session, 'analise.preliminar.atualizada', {
      duplicateCandidates: 0,
      threshold
    });
  }

  return persistVegetacaoDedupCandidates(projectContext, session, duplicateIds);
}

export function getVegetacaoViewModel(project = {}, session = {}) {
  const projectContext = normalizeProjectContext(project);
  const moduleState = buildVegetacaoModuleState(session);
  const laudoSnapshot = exportVegetacaoLaudoSnapshot(projectContext, session);

  return {
    projectContext,
    moduleState,
    cards: buildDashboardCards(moduleState),
    timelineRows: buildTimelineRows(moduleState),
    setorOptions: toArray(moduleState.sectors).map((setor) => ({
      value: setor.id,
      label: setor.nome,
      ativo: String(setor.id) === String(moduleState.activeSectorId ?? '')
    })),
    duplicateCandidates: findLikelyDuplicateIds(moduleState),
    laudoSnapshot
  };
}

export function registerVegetacaoTechnicalEvent(project = {}, session = {}, type = 'evento.manual', payload = {}) {
  const projectContext = normalizeProjectContext(project);
  return persistVegetacaoManualEvent(projectContext, session, type, payload);
}