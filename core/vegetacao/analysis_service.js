import { buildVegetacaoDedupAudit } from './dedup_service.js';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function round2(value) {
  return Number(toNumber(value).toFixed(2));
}

export function normalizeVegetacaoAnalysisInput(input = {}) {
  return {
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: toNumber(input.threshold || 60) || 60
  };
}

export function estimateVegetacaoIndividuals(capture = {}) {
  const explicit = toNumber(capture.individuos ?? capture.quantidade);
  if (explicit > 0) return explicit;
  return toText(capture.mode) === 'arvore_isolada' ? 1 : 0;
}

export function estimateVegetacaoAreaM2(capture = {}) {
  return round2(
    capture.areaOcupadaM2 ??
    capture.areaEstimativaM2 ??
    capture.area_m2 ??
    0
  );
}

function buildSectorNameMap(sectors = []) {
  return new Map(
    toArray(sectors).map((sector) => [
      toText(sector.id),
      toText(sector.nome || sector.label || sector.titulo || 'Sem setor')
    ])
  );
}

function summarizeBySpecies(captures = []) {
  const bucket = new Map();

  toArray(captures).forEach((capture) => {
    const key = toText(capture.especie).toLowerCase() || 'nao_identificada';
    if (!bucket.has(key)) {
      bucket.set(key, {
        especie: key === 'nao_identificada' ? 'Nao identificada' : toText(capture.especie),
        capturas: 0,
        individuos: 0,
        areaOcupadaM2: 0
      });
    }

    const item = bucket.get(key);
    item.capturas += 1;
    item.individuos += estimateVegetacaoIndividuals(capture);
    item.areaOcupadaM2 = round2(item.areaOcupadaM2 + estimateVegetacaoAreaM2(capture));
  });

  return [...bucket.values()].sort((a, b) => {
    if (b.individuos !== a.individuos) return b.individuos - a.individuos;
    return b.capturas - a.capturas;
  });
}

function summarizeBySector(captures = [], sectors = []) {
  const sectorNameMap = buildSectorNameMap(sectors);
  const bucket = new Map();

  toArray(captures).forEach((capture) => {
    const sectorId = toText(capture.sectorId || capture.setorId);
    const sectorName = sectorNameMap.get(sectorId) || 'Sem setor';
    const key = sectorId || `sem_setor:${sectorName}`;

    if (!bucket.has(key)) {
      bucket.set(key, {
        sectorId,
        setor: sectorName,
        capturas: 0,
        individuos: 0,
        areaOcupadaM2: 0
      });
    }

    const item = bucket.get(key);
    item.capturas += 1;
    item.individuos += estimateVegetacaoIndividuals(capture);
    item.areaOcupadaM2 = round2(item.areaOcupadaM2 + estimateVegetacaoAreaM2(capture));
  });

  return [...bucket.values()].sort((a, b) => {
    if (b.capturas !== a.capturas) return b.capturas - a.capturas;
    return b.individuos - a.individuos;
  });
}

function summarizeByMode(captures = []) {
  const bucket = new Map();

  toArray(captures).forEach((capture) => {
    const mode = toText(capture.mode) || 'nao_informado';

    if (!bucket.has(mode)) {
      bucket.set(mode, {
        mode,
        capturas: 0,
        individuos: 0,
        areaOcupadaM2: 0
      });
    }

    const item = bucket.get(mode);
    item.capturas += 1;
    item.individuos += estimateVegetacaoIndividuals(capture);
    item.areaOcupadaM2 = round2(item.areaOcupadaM2 + estimateVegetacaoAreaM2(capture));
  });

  return [...bucket.values()].sort((a, b) => b.capturas - a.capturas);
}

function summarizeOverview(captures = [], sectors = [], dedupAudit = null) {
  const totalCapturas = toArray(captures).length;
  const totalSetores = toArray(sectors).length;
  const especiesMapeadas = summarizeBySpecies(captures)
    .filter((item) => toText(item.especie).toLowerCase() !== 'nao identificada')
    .length;

  const individuosEstimados = toArray(captures)
    .reduce((sum, capture) => sum + estimateVegetacaoIndividuals(capture), 0);

  const areaOcupadaEstimadaM2 = round2(
    toArray(captures).reduce((sum, capture) => sum + estimateVegetacaoAreaM2(capture), 0)
  );

  const duplicateCandidates = toNumber(dedupAudit?.duplicateCandidates);
  const duplicateGroups = toNumber(dedupAudit?.duplicateGroups);

  return {
    totalCapturas,
    totalSetores,
    especiesMapeadas,
    individuosEstimados,
    areaOcupadaEstimadaM2,
    duplicateCandidates,
    duplicateGroups
  };
}

function buildPendencias(overview = {}, dedupAudit = null) {
  const pendencias = [];

  if (toNumber(overview.totalCapturas) === 0) {
    pendencias.push('Sessao sem capturas registradas.');
  }

  if (toNumber(overview.totalSetores) === 0) {
    pendencias.push('Sessao sem setores definidos.');
  }

  if (toNumber(dedupAudit?.duplicateCandidates) > 0) {
    pendencias.push(
      `${toNumber(dedupAudit?.duplicateCandidates)} captura(s) candidata(s) a deduplicacao.`
    );
  }

  if (toNumber(overview.especiesMapeadas) === 0 && toNumber(overview.totalCapturas) > 0) {
    pendencias.push('Sem especies mapeadas de forma identificada nesta rodada.');
  }

  return pendencias;
}

function computeStatus(overview = {}, pendencias = []) {
  if (toNumber(overview.totalCapturas) === 0) return 'pending';
  if (toArray(pendencias).length > 0) return 'preliminary';
  return 'ready';
}

export function buildVegetacaoPreAnalysis(input = {}) {
  const normalized = normalizeVegetacaoAnalysisInput(input);
  const dedupAudit = buildVegetacaoDedupAudit({
    captures: normalized.captures,
    sectors: normalized.sectors,
    threshold: normalized.threshold
  });

  const overview = summarizeOverview(
    normalized.captures,
    normalized.sectors,
    dedupAudit
  );

  const porEspecie = summarizeBySpecies(normalized.captures);
  const porSetor = summarizeBySector(normalized.captures, normalized.sectors);
  const porModo = summarizeByMode(normalized.captures);
  const pendencias = buildPendencias(overview, dedupAudit);
  const status = computeStatus(overview, pendencias);

  return {
    generatedAt: new Date().toISOString(),
    sessionId: normalized.sessionId,
    activeSectorId: normalized.activeSectorId,
    status,
    resumo: {
      totalCapturas: overview.totalCapturas,
      totalSetores: overview.totalSetores,
      especiesMapeadas: overview.especiesMapeadas,
      individuosEstimados: overview.individuosEstimados,
      areaOcupadaEstimadaM2: overview.areaOcupadaEstimadaM2,
      duplicateCandidates: overview.duplicateCandidates,
      duplicateGroups: overview.duplicateGroups,
      pendenciasAbertas: pendencias.length
    },
    porEspecie,
    porSetor,
    porModo,
    dedupAudit,
    pendencias,
    recommendation:
      pendencias.length > 0
        ? 'Revisar pendencias antes da consolidacao final no laudo.'
        : 'Pre-analise pronta para integracao futura.'
  };
}

export function buildVegetacaoAnalysisSnapshot(input = {}) {
  const analysis = buildVegetacaoPreAnalysis(input);

  return {
    version: 1,
    module: 'vegetacao',
    generatedAt: analysis.generatedAt,
    status: analysis.status,
    resumo: analysis.resumo,
    recommendation: analysis.recommendation,
    pendencias: analysis.pendencias,
    dedupAudit: analysis.dedupAudit
  };
}