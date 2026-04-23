import { buildVegetacaoLaudoSection, buildVegetacaoLaudoSectionSnapshot, buildVegetacaoLaudoSectionText } from './laudo_section_builder.js';
import { buildVegetacaoHandoffPackage } from './handoff_service.js';
import { buildVegetacaoReadinessSummary } from './readiness_service.js';
import { buildVegetacaoHealthcheckSnapshot } from './healthcheck.js';
import { buildVegetacaoLaudoHook } from './laudo_bridge.js';

const MODULE_NAME = 'vegetacao';
const MODULE_TITLE = 'Vegetacao / Supressao / Compensacao';

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

function normalizeInput(input = {}) {
  return {
    project: safeObject(input.project),
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: toNumber(input.threshold || 60) || 60,
    metadata: safeObject(input.metadata)
  };
}

function buildHookInput(section = {}, readiness = {}, handoff = {}, normalized = {}) {
  const indicadores = safeObject(section.indicadores);
  const projeto = safeObject(section.projeto);
  const decision = safeObject(readiness.decision);
  const pipelineSnapshot = safeObject(handoff.readinessSummary?.pipelineSnapshot);
  const resumo = safeObject(pipelineSnapshot.resumo);

  return {
    project: {
      ...safeObject(normalized.project),
      ...projeto
    },
    generatedAt: section.generatedAt || new Date().toISOString(),
    sessionId: toText(normalized.sessionId),
    sessionStatus: toText(decision.code || resumo.status || 'pending'),
    activeSectorId: toText(normalized.activeSectorId),
    totalCapturas: toNumber(indicadores.totalCapturas),
    totalSetores: toNumber(indicadores.totalSetores),
    especiesMapeadas: toNumber(indicadores.especiesMapeadas),
    individuosEstimados: toNumber(indicadores.individuosEstimados),
    areaOcupadaEstimadaM2: toNumber(indicadores.areaOcupadaEstimadaM2),
    pendenciasAbertas: toNumber(indicadores.pendenciasAbertas),
    duplicateCandidates: toNumber(indicadores.duplicateCandidates),
    pendingDedup: toNumber(indicadores.duplicateCandidates),
    pendingAnalysis: toNumber(indicadores.pendenciasAbertas),
    ultimoModoCaptura: '',
    ultimoModoCapturaLabel: '',
    ultimaCapturaEm: '',
    laudoSnapshot: buildVegetacaoLaudoSectionSnapshot(normalized)
  };
}

function buildAppendix(section = {}, healthcheck = {}, readiness = {}, handoff = {}) {
  return {
    module: MODULE_NAME,
    title: MODULE_TITLE,
    generatedAt: section.generatedAt || new Date().toISOString(),
    readyForLaudo: Boolean(section.readyForLaudo),
    referencias: {
      healthcheck: clone(healthcheck),
      readiness: clone(readiness),
      handoff: clone(handoff)
    }
  };
}

export function buildVegetacaoLaudoIntegrationPayload(input = {}) {
  const normalized = normalizeInput(input);

  const section = buildVegetacaoLaudoSection(normalized);
  const sectionSnapshot = buildVegetacaoLaudoSectionSnapshot(normalized);
  const sectionText = buildVegetacaoLaudoSectionText(normalized);
  const handoff = buildVegetacaoHandoffPackage(normalized);
  const readiness = buildVegetacaoReadinessSummary(normalized);
  const healthcheck = buildVegetacaoHealthcheckSnapshot(normalized);
  const laudoHook = buildVegetacaoLaudoHook(
    buildHookInput(section, readiness, handoff, normalized)
  );
  const appendix = buildAppendix(section, healthcheck, readiness, handoff);

  return {
    version: 1,
    module: MODULE_NAME,
    title: MODULE_TITLE,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(section.readyForLaudo),
    section,
    sectionSnapshot,
    sectionText,
    laudoHook,
    appendix,
    references: {
      handoff: clone(handoff),
      readiness: clone(readiness),
      healthcheck: clone(healthcheck)
    }
  };
}

export function buildVegetacaoLaudoExportBundle(input = {}) {
  const payload = buildVegetacaoLaudoIntegrationPayload(input);

  return {
    version: payload.version,
    module: payload.module,
    title: payload.title,
    generatedAt: payload.generatedAt,
    readyForLaudo: payload.readyForLaudo,
    docx: {
      sectionTitle: payload.title,
      sectionText: payload.sectionText,
      sectionSnapshot: clone(payload.sectionSnapshot)
    },
    pdf: {
      sectionTitle: payload.title,
      sectionText: payload.sectionText,
      sectionSnapshot: clone(payload.sectionSnapshot)
    },
    laudoHook: clone(payload.laudoHook),
    appendix: clone(payload.appendix)
  };
}

export function buildVegetacaoLaudoIntegrationSnapshot(input = {}) {
  const payload = buildVegetacaoLaudoIntegrationPayload(input);

  return {
    version: payload.version,
    module: payload.module,
    title: payload.title,
    generatedAt: payload.generatedAt,
    readyForLaudo: payload.readyForLaudo,
    projeto: clone(payload.section?.projeto ?? null),
    indicadores: clone(payload.section?.indicadores ?? null),
    decision: clone(payload.references?.readiness?.decision ?? null)
  };
}