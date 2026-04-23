const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function safeIsoMinute(value = '') {
  return toText(value).slice(0, 16);
}

function buildReason(label, weight, matched) {
  return {
    label,
    weight,
    matched: Boolean(matched)
  };
}

export function normalizeVegetacaoCaptureForDedup(capture = {}) {
  return {
    id: toText(capture.id),
    sectorId: toText(capture.sectorId ?? capture.setorId),
    mode: toText(capture.mode),
    fileName: toText(capture.fileName ?? capture.nomeArquivo).toLowerCase(),
    mimeType: toText(capture.mimeType).toLowerCase(),
    uri: toText(capture.uri ?? capture.url),
    width: toNumber(capture.width),
    height: toNumber(capture.height),
    capturedAt: toText(capture.capturedAt ?? capture.createdAt),
    capturedMinute: safeIsoMinute(capture.capturedAt ?? capture.createdAt),
    especie: toText(capture.especie).toLowerCase(),
    individuos: toNumber(capture.individuos ?? capture.quantidade),
    areaOcupadaM2: toNumber(capture.areaOcupadaM2 ?? capture.areaEstimativaM2 ?? capture.area_m2),
    fingerprintSeed: toText(capture.fingerprintSeed).toLowerCase(),
    localHash: toText(capture.localHash).toLowerCase()
  };
}

export function getVegetacaoCaptureSimilarity(leftInput = {}, rightInput = {}) {
  const left = normalizeVegetacaoCaptureForDedup(leftInput);
  const right = normalizeVegetacaoCaptureForDedup(rightInput);

  const reasons = [
    buildReason('localHash', 100, left.localHash && left.localHash === right.localHash),
    buildReason('fingerprintSeed', 70, left.fingerprintSeed && left.fingerprintSeed === right.fingerprintSeed),
    buildReason('fileName', 20, left.fileName && left.fileName === right.fileName),
    buildReason('sectorId', 10, left.sectorId && left.sectorId === right.sectorId),
    buildReason('mode', 10, left.mode && left.mode === right.mode),
    buildReason('capturedMinute', 10, left.capturedMinute && left.capturedMinute === right.capturedMinute),
    buildReason('width', 5, left.width > 0 && left.width === right.width),
    buildReason('height', 5, left.height > 0 && left.height === right.height),
    buildReason('especie', 8, left.especie && left.especie === right.especie),
    buildReason('individuos', 4, left.individuos > 0 && left.individuos === right.individuos)
  ];

  const score = reasons
    .filter((item) => item.matched)
    .reduce((sum, item) => sum + item.weight, 0);

  return {
    leftId: left.id,
    rightId: right.id,
    score,
    reasons,
    matchedReasons: reasons.filter((item) => item.matched).map((item) => item.label)
  };
}

function buildAdjacencyMap(candidatePairs = []) {
  const map = new Map();

  candidatePairs.forEach((pair) => {
    if (!map.has(pair.leftId)) map.set(pair.leftId, new Set());
    if (!map.has(pair.rightId)) map.set(pair.rightId, new Set());

    map.get(pair.leftId).add(pair.rightId);
    map.get(pair.rightId).add(pair.leftId);
  });

  return map;
}

export function buildVegetacaoDuplicateGroups(candidatePairs = []) {
  const adjacency = buildAdjacencyMap(candidatePairs);
  const visited = new Set();
  const groups = [];

  adjacency.forEach((neighbors, startId) => {
    if (visited.has(startId)) return;

    const queue = [startId];
    const group = [];

    visited.add(startId);

    while (queue.length) {
      const current = queue.shift();
      group.push(current);

      (adjacency.get(current) || new Set()).forEach((neighbor) => {
        if (visited.has(neighbor)) return;
        visited.add(neighbor);
        queue.push(neighbor);
      });
    }

    groups.push(group.sort());
  });

  return groups.sort((a, b) => b.length - a.length);
}

export function buildVegetacaoDuplicateCandidates(captures = [], options = {}) {
  const threshold = toNumber(options.threshold || 60) || 60;
  const normalized = toArray(captures).map((capture) => normalizeVegetacaoCaptureForDedup(capture));
  const pairs = [];

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const result = getVegetacaoCaptureSimilarity(normalized[i], normalized[j]);
      if (result.score >= threshold) {
        pairs.push(result);
      }
    }
  }

  const ids = [...new Set(
    pairs.flatMap((item) => [item.leftId, item.rightId]).filter(Boolean)
  )];

  const groups = buildVegetacaoDuplicateGroups(pairs);

  return {
    threshold,
    totalCaptures: normalized.length,
    totalPairsChecked: normalized.length > 1 ? (normalized.length * (normalized.length - 1)) / 2 : 0,
    candidatePairs: pairs.sort((a, b) => b.score - a.score),
    candidateIds: ids,
    groups
  };
}

export function buildVegetacaoDedupAudit(input = {}) {
  const captures = toArray(input.captures);
  const sectors = toArray(input.sectors);
  const result = buildVegetacaoDuplicateCandidates(captures, {
    threshold: input.threshold ?? 60
  });

  const sectorsById = new Map(
    sectors.map((sector) => [toText(sector.id), toText(sector.nome || sector.label || 'Setor')])
  );

  const detailedPairs = result.candidatePairs.map((pair) => {
    const left = captures.find((item) => toText(item.id) === pair.leftId) || {};
    const right = captures.find((item) => toText(item.id) === pair.rightId) || {};

    return {
      ...pair,
      leftSectorName: sectorsById.get(toText(left.sectorId)) || 'Sem setor',
      rightSectorName: sectorsById.get(toText(right.sectorId)) || 'Sem setor',
      leftMode: toText(left.mode),
      rightMode: toText(right.mode),
      leftCapturedAt: toText(left.capturedAt),
      rightCapturedAt: toText(right.capturedAt)
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    threshold: result.threshold,
    totalCaptures: result.totalCaptures,
    totalPairsChecked: result.totalPairsChecked,
    duplicateCandidates: result.candidateIds.length,
    duplicateGroups: result.groups.length,
    candidateIds: result.candidateIds,
    groups: result.groups,
    pairs: detailedPairs,
    recommendation:
      result.candidateIds.length > 0
        ? 'Revisar candidatos antes da consolidacao final do laudo.'
        : 'Nenhum candidato relevante detectado nesta rodada.'
  };
}