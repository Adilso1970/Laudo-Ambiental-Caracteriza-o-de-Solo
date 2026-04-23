import { buildVegetacaoPreAnalysis, buildVegetacaoAnalysisSnapshot } from './analysis_service.js';
import {
  buildVegetacaoLaudoHook,
  buildVegetacaoLaudoResumoTextual,
  publishVegetacaoLaudoHook
} from './laudo_bridge.js';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

export function normalizeVegetacaoPipelineInput(input = {}) {
  return {
    project: input.project ?? {},
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: toNumber(input.threshold || 60) || 60,
    metadata: typeof input.metadata === 'object' && input.metadata !== null
      ? input.metadata
      : {}
  };
}

function buildLaudoHookInput(normalized = {}, analysis = {}) {
  const resumo = analysis?.resumo ?? {};

  return {
    project: normalized.project,
    generatedAt: analysis?.generatedAt || new Date().toISOString(),
    sessionId: normalized.sessionId,
    sessionStatus: toText(analysis?.status),
    activeSectorId: normalized.activeSectorId,
    totalCapturas: toNumber(resumo.totalCapturas),
    totalSetores: toNumber(resumo.totalSetores),
    especiesMapeadas: toNumber(resumo.especiesMapeadas),
    individuosEstimados: toNumber(resumo.individuosEstimados),
    areaOcupadaEstimadaM2: toNumber(resumo.areaOcupadaEstimadaM2),
    pendenciasAbertas: toNumber(resumo.pendenciasAbertas),
    duplicateCandidates: toNumber(resumo.duplicateCandidates),
    pendingDedup: toNumber(analysis?.dedupAudit?.duplicateCandidates),
    pendingAnalysis: toNumber(resumo.pendenciasAbertas),
    ultimoModoCaptura: toText(analysis?.porModo?.[0]?.mode),
    ultimoModoCapturaLabel: toText(analysis?.porModo?.[0]?.mode || 'nao_informado'),
    ultimaCapturaEm: toText(
      normalized.captures.length
        ? normalized.captures[normalized.captures.length - 1]?.capturedAt
        : ''
    ),
    laudoSnapshot: buildVegetacaoAnalysisSnapshot({
      sessionId: normalized.sessionId,
      activeSectorId: normalized.activeSectorId,
      captures: normalized.captures,
      sectors: normalized.sectors,
      threshold: normalized.threshold
    })
  };
}

export function buildVegetacaoPipeline(input = {}) {
  const normalized = normalizeVegetacaoPipelineInput(input);

  const analysis = buildVegetacaoPreAnalysis({
    sessionId: normalized.sessionId,
    activeSectorId: normalized.activeSectorId,
    captures: normalized.captures,
    sectors: normalized.sectors,
    threshold: normalized.threshold
  });

  const laudoHook = buildVegetacaoLaudoHook(
    buildLaudoHookInput(normalized, analysis)
  );

  const laudoResumo = buildVegetacaoLaudoResumoTextual(laudoHook);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: new Date().toISOString(),
    metadata: normalized.metadata,
    analysis,
    laudoHook,
    laudoResumo
  };
}

export function publishVegetacaoPipeline(input = {}, options = {}) {
  const pipeline = buildVegetacaoPipeline(input);
  const storage = options.storage;
  const emit = options.emit !== false;

  const publishedHook = publishVegetacaoLaudoHook(
    {
      project: pipeline.laudoHook?.project ?? {},
      generatedAt: pipeline.laudoHook?.generatedAt,
      sessionId: pipeline.laudoHook?.technicalSummary?.sessionId,
      sessionStatus: pipeline.laudoHook?.technicalSummary?.sessionStatus,
      activeSectorId: pipeline.laudoHook?.technicalSummary?.activeSectorId,
      totalCapturas: pipeline.laudoHook?.technicalSummary?.totalCapturas,
      totalSetores: pipeline.laudoHook?.technicalSummary?.totalSetores,
      especiesMapeadas: pipeline.laudoHook?.technicalSummary?.especiesMapeadas,
      individuosEstimados: pipeline.laudoHook?.technicalSummary?.individuosEstimados,
      areaOcupadaEstimadaM2: pipeline.laudoHook?.technicalSummary?.areaOcupadaEstimadaM2,
      pendenciasAbertas: pipeline.laudoHook?.technicalSummary?.pendenciasAbertas,
      duplicateCandidates: pipeline.laudoHook?.technicalSummary?.duplicateCandidates,
      pendingDedup: pipeline.laudoHook?.technicalSummary?.pendingDedup,
      pendingAnalysis: pipeline.laudoHook?.technicalSummary?.pendingAnalysis,
      ultimoModoCaptura: pipeline.laudoHook?.technicalSummary?.ultimoModoCaptura,
      ultimoModoCapturaLabel: pipeline.laudoHook?.technicalSummary?.ultimoModoCapturaLabel,
      ultimaCapturaEm: pipeline.laudoHook?.technicalSummary?.ultimaCapturaEm,
      laudoSnapshot: pipeline.laudoHook?.laudoSnapshot
    },
    { storage, emit }
  );

  return {
    ...pipeline,
    laudoHook: publishedHook
  };
}

export function buildVegetacaoPipelineSnapshot(input = {}) {
  const pipeline = buildVegetacaoPipeline(input);

  return {
    version: pipeline.version,
    module: pipeline.module,
    generatedAt: pipeline.generatedAt,
    resumo: {
      status: pipeline.analysis?.status || 'pending',
      totalCapturas: pipeline.analysis?.resumo?.totalCapturas || 0,
      totalSetores: pipeline.analysis?.resumo?.totalSetores || 0,
      especiesMapeadas: pipeline.analysis?.resumo?.especiesMapeadas || 0,
      individuosEstimados: pipeline.analysis?.resumo?.individuosEstimados || 0,
      areaOcupadaEstimadaM2: pipeline.analysis?.resumo?.areaOcupadaEstimadaM2 || 0,
      duplicateCandidates: pipeline.analysis?.resumo?.duplicateCandidates || 0,
      pendenciasAbertas: pipeline.analysis?.resumo?.pendenciasAbertas || 0,
      readyForLaudo: Boolean(pipeline.laudoHook?.readyForLaudo)
    }
  };
}