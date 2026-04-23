const STORAGE_NAMESPACE = 'solo-nb:laudo-hook:v1';

const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};
const toArray = (value) => Array.isArray(value) ? value : [];

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

export function buildVegetacaoLaudoStorageKey(projectId = 'projeto-atual') {
  return `${STORAGE_NAMESPACE}:${toText(projectId) || 'projeto-atual'}:vegetacao`;
}

export function normalizeVegetacaoLaudoProject(project = {}) {
  return {
    projectId: toText(
      project.projectId ??
      project.id ??
      project.projetoId ??
      project.project_id ??
      'projeto-atual'
    ),
    nomeProjeto: toText(
      project.nome ??
      project.name ??
      project.titulo ??
      ''
    ),
    uf: toText(project.uf ?? '').toUpperCase(),
    municipio: toText(project.municipio ?? project.cidade ?? ''),
    areaHa: toNumber(project.areaHa ?? project.area_ha ?? project.area ?? 0),
    contextoTerritorial: toText(
      project.contextoTerritorial ??
      project.contexto_territorial ??
      project.contexto ??
      ''
    )
  };
}

export function computeVegetacaoLaudoReady(summary = {}) {
  const pendenciasAbertas = toNumber(summary.pendenciasAbertas);
  const duplicateCandidates = toNumber(summary.duplicateCandidates);
  const pendingDedup = toNumber(summary.pendingDedup);
  const pendingAnalysis = toNumber(summary.pendingAnalysis);

  return (
    pendenciasAbertas === 0 &&
    duplicateCandidates === 0 &&
    pendingDedup === 0 &&
    pendingAnalysis === 0
  );
}

export function buildVegetacaoLaudoHook(input = {}) {
  const project = normalizeVegetacaoLaudoProject(input.project ?? {});
  const summary = {
    sessionId: toText(input.sessionId),
    sessionStatus: toText(input.sessionStatus),
    activeSectorId: toText(input.activeSectorId),
    totalCapturas: toNumber(input.totalCapturas),
    totalSetores: toNumber(input.totalSetores),
    especiesMapeadas: toNumber(input.especiesMapeadas),
    individuosEstimados: toNumber(input.individuosEstimados),
    areaOcupadaEstimadaM2: toNumber(input.areaOcupadaEstimadaM2),
    pendenciasAbertas: toNumber(input.pendenciasAbertas),
    duplicateCandidates: toNumber(input.duplicateCandidates),
    pendingDedup: toNumber(input.pendingDedup),
    pendingAnalysis: toNumber(input.pendingAnalysis),
    ultimoModoCaptura: toText(input.ultimoModoCaptura),
    ultimoModoCapturaLabel: toText(input.ultimoModoCapturaLabel),
    ultimaCapturaEm: toText(input.ultimaCapturaEm)
  };

  const readyForLaudo = computeVegetacaoLaudoReady(summary);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: input.generatedAt || new Date().toISOString(),
    readyForLaudo,
    project,
    technicalSummary: summary,
    laudoSnapshot: safeClone(input.laudoSnapshot ?? null),
    methodologicalGuardrails: [
      'Resumo preliminar sujeito a validacao tecnica.',
      'Deduplicacao automatica permanece nao destrutiva nesta fase.',
      'Integracao com laudo preparada de forma isolada.'
    ]
  };
}

export function readVegetacaoLaudoHook(projectId = 'projeto-atual', storage = globalThis?.localStorage) {
  if (!storage) return null;

  try {
    const raw = storage.getItem(buildVegetacaoLaudoStorageKey(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveVegetacaoLaudoHook(projectId = 'projeto-atual', hook = {}, storage = globalThis?.localStorage) {
  if (!storage) return hook;

  try {
    storage.setItem(
      buildVegetacaoLaudoStorageKey(projectId),
      JSON.stringify(hook)
    );
  } catch (_) {}

  return hook;
}

export function publishVegetacaoLaudoHook(input = {}, options = {}) {
  const hook = buildVegetacaoLaudoHook(input);
  const projectId = hook?.project?.projectId || 'projeto-atual';
  const storage = options.storage ?? globalThis?.localStorage;

  saveVegetacaoLaudoHook(projectId, hook, storage);

  if (options.emit !== false && typeof globalThis?.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent('solo-nb:laudo:vegetacao-hook-updated', {
      detail: hook
    }));
  }

  return hook;
}

export function buildVegetacaoLaudoResumoTextual(hook = {}) {
  const project = hook?.project ?? {};
  const summary = hook?.technicalSummary ?? {};

  return {
    titulo: 'Vegetacao / Supressao / Compensacao',
    projeto: toText(project.nomeProjeto || project.projectId),
    localizacao: [toText(project.municipio), toText(project.uf)].filter(Boolean).join(' - '),
    areaHa: toNumber(project.areaHa),
    totalCapturas: toNumber(summary.totalCapturas),
    totalSetores: toNumber(summary.totalSetores),
    especiesMapeadas: toNumber(summary.especiesMapeadas),
    individuosEstimados: toNumber(summary.individuosEstimados),
    areaOcupadaEstimadaM2: toNumber(summary.areaOcupadaEstimadaM2),
    pendenciasAbertas: toNumber(summary.pendenciasAbertas),
    prontoParaLaudo: Boolean(hook?.readyForLaudo),
    guardrails: toArray(hook?.methodologicalGuardrails)
  };
}