const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function normalizeProject(project = {}) {
  return {
    projectId: toText(project.projectId ?? project.id ?? project.projetoId ?? project.project_id),
    nomeProjeto: toText(project.nome ?? project.name ?? project.titulo),
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

function normalizeSector(sector = {}) {
  return {
    id: toText(sector.id),
    nome: toText(sector.nome ?? sector.label ?? sector.titulo),
    ativo: Boolean(sector.ativo)
  };
}

function normalizeCapture(capture = {}) {
  return {
    id: toText(capture.id),
    sectorId: toText(capture.sectorId ?? capture.setorId),
    mode: toText(capture.mode),
    fileName: toText(capture.fileName ?? capture.nomeArquivo),
    uri: toText(capture.uri ?? capture.url),
    mimeType: toText(capture.mimeType),
    capturedAt: toText(capture.capturedAt ?? capture.createdAt),
    especie: toText(capture.especie),
    individuos: toNumber(capture.individuos ?? capture.quantidade),
    areaOcupadaM2: toNumber(capture.areaOcupadaM2 ?? capture.areaEstimativaM2 ?? capture.area_m2),
    dedupStatus: toText(capture.dedupStatus || 'pending'),
    analysisStatus: toText(capture.analysisStatus || 'pending')
  };
}

function createIssue(level, code, message, meta = {}) {
  return {
    level,
    code,
    message,
    meta
  };
}

function validateProject(project = {}) {
  const normalized = normalizeProject(project);
  const issues = [];

  if (!normalized.projectId) {
    issues.push(createIssue('error', 'project_missing_id', 'Projeto sem identificador técnico.'));
  }

  if (!normalized.uf) {
    issues.push(createIssue('warning', 'project_missing_uf', 'UF do projeto não informada.'));
  }

  if (!normalized.municipio) {
    issues.push(createIssue('warning', 'project_missing_municipio', 'Município do projeto não informado.'));
  }

  if (normalized.areaHa <= 0) {
    issues.push(createIssue('warning', 'project_missing_area', 'Área do projeto não informada ou zerada.'));
  }

  if (!normalized.contextoTerritorial) {
    issues.push(createIssue('warning', 'project_missing_contexto', 'Contexto territorial ainda não informado.'));
  }

  return {
    normalized,
    issues
  };
}

function validateSectors(sectors = [], activeSectorId = '') {
  const normalized = toArray(sectors).map((sector) => normalizeSector(sector));
  const issues = [];
  const ids = new Set();

  if (!normalized.length) {
    issues.push(createIssue('warning', 'sector_missing_all', 'Sessão sem setores cadastrados.'));
  }

  normalized.forEach((sector, index) => {
    if (!sector.id) {
      issues.push(createIssue('error', 'sector_missing_id', 'Setor sem identificador.', { index }));
    }

    if (!sector.nome) {
      issues.push(createIssue('warning', 'sector_missing_name', 'Setor sem nome.', { index, sectorId: sector.id }));
    }

    if (sector.id) {
      if (ids.has(sector.id)) {
        issues.push(createIssue('error', 'sector_duplicate_id', 'Identificador de setor duplicado.', { sectorId: sector.id }));
      }
      ids.add(sector.id);
    }
  });

  if (activeSectorId && !normalized.some((sector) => sector.id === activeSectorId)) {
    issues.push(createIssue('warning', 'sector_active_not_found', 'Setor ativo não encontrado na lista de setores.', {
      activeSectorId
    }));
  }

  return {
    normalized,
    issues
  };
}

function validateCaptures(captures = [], sectorIds = []) {
  const normalized = toArray(captures).map((capture) => normalizeCapture(capture));
  const issues = [];
  const ids = new Set();
  const validModes = new Set(['arvore_isolada', 'panorama_assistido', 'mosaico_setorial']);
  const validSectorIds = new Set(toArray(sectorIds).filter(Boolean));

  if (!normalized.length) {
    issues.push(createIssue('warning', 'capture_missing_all', 'Sessão sem capturas registradas.'));
  }

  normalized.forEach((capture, index) => {
    if (!capture.id) {
      issues.push(createIssue('error', 'capture_missing_id', 'Captura sem identificador.', { index }));
    }

    if (capture.id) {
      if (ids.has(capture.id)) {
        issues.push(createIssue('error', 'capture_duplicate_id', 'Identificador de captura duplicado.', { captureId: capture.id }));
      }
      ids.add(capture.id);
    }

    if (!capture.mode || !validModes.has(capture.mode)) {
      issues.push(createIssue('warning', 'capture_invalid_mode', 'Modo de captura ausente ou inválido.', {
        captureId: capture.id,
        mode: capture.mode
      }));
    }

    if (!capture.capturedAt) {
      issues.push(createIssue('warning', 'capture_missing_datetime', 'Captura sem data/hora técnica.', {
        captureId: capture.id
      }));
    }

    if (capture.sectorId && validSectorIds.size > 0 && !validSectorIds.has(capture.sectorId)) {
      issues.push(createIssue('warning', 'capture_sector_not_found', 'Captura vinculada a setor inexistente.', {
        captureId: capture.id,
        sectorId: capture.sectorId
      }));
    }

    if (!capture.fileName && !capture.uri) {
      issues.push(createIssue('warning', 'capture_missing_source', 'Captura sem origem de arquivo ou URI.', {
        captureId: capture.id
      }));
    }

    if (!capture.especie) {
      issues.push(createIssue('warning', 'capture_missing_species', 'Captura sem espécie identificada.', {
        captureId: capture.id
      }));
    }

    if (capture.dedupStatus === 'pending') {
      issues.push(createIssue('info', 'capture_pending_dedup', 'Captura aguardando deduplicação futura.', {
        captureId: capture.id
      }));
    }

    if (capture.analysisStatus === 'pending') {
      issues.push(createIssue('info', 'capture_pending_analysis', 'Captura aguardando análise preliminar.', {
        captureId: capture.id
      }));
    }
  });

  return {
    normalized,
    issues
  };
}

function summarizeIssues(issues = []) {
  return {
    total: toArray(issues).length,
    errors: toArray(issues).filter((item) => item.level === 'error').length,
    warnings: toArray(issues).filter((item) => item.level === 'warning').length,
    infos: toArray(issues).filter((item) => item.level === 'info').length
  };
}

function computeGates(projectIssues = [], sectorIssues = [], captureIssues = []) {
  const all = [...projectIssues, ...sectorIssues, ...captureIssues];
  const hasErrors = all.some((item) => item.level === 'error');
  const hasWarnings = all.some((item) => item.level === 'warning');

  return {
    sessionMinimaOk: !hasErrors,
    preAnalisePodeRodar: !hasErrors,
    prontoParaIntegrarNoLaudo: !hasErrors && !hasWarnings
  };
}

export function validateVegetacaoSessionContract(input = {}) {
  const projectValidation = validateProject(input.project ?? {});
  const sectorValidation = validateSectors(
    input.sectors ?? [],
    toText(input.activeSectorId)
  );

  const captureValidation = validateCaptures(
    input.captures ?? [],
    sectorValidation.normalized.map((sector) => sector.id)
  );

  const issues = [
    ...projectValidation.issues,
    ...sectorValidation.issues,
    ...captureValidation.issues
  ];

  return {
    generatedAt: new Date().toISOString(),
    project: projectValidation.normalized,
    activeSectorId: toText(input.activeSectorId),
    sectors: sectorValidation.normalized,
    captures: captureValidation.normalized,
    summary: summarizeIssues(issues),
    gates: computeGates(
      projectValidation.issues,
      sectorValidation.issues,
      captureValidation.issues
    ),
    issues
  };
}

export function buildVegetacaoSessionChecklist(input = {}) {
  const validation = validateVegetacaoSessionContract(input);

  return {
    generatedAt: validation.generatedAt,
    resumo: validation.summary,
    gates: validation.gates,
    checklist: [
      {
        id: 'projeto',
        label: 'Projeto técnico identificado',
        ok: Boolean(validation.project.projectId)
      },
      {
        id: 'setores',
        label: 'Setores estruturados',
        ok: validation.sectors.length > 0
      },
      {
        id: 'capturas',
        label: 'Capturas registradas',
        ok: validation.captures.length > 0
      },
      {
        id: 'sem_erros',
        label: 'Sem erros estruturais',
        ok: validation.summary.errors === 0
      },
      {
        id: 'laudo_ready',
        label: 'Pronto para integrar no laudo',
        ok: Boolean(validation.gates.prontoParaIntegrarNoLaudo)
      }
    ],
    issues: validation.issues
  };
}