export function createSetor(nome = "Setor A", ordem = 1) {
  return {
    setor_id: crypto.randomUUID(),
    nome: String(nome || `Setor ${ordem}`).trim(),
    ordem,
    tipo_setor: "quadrante",
    area_estimativa_m2: 0,
    coordenadas_referencia: {
      lat: null,
      lng: null
    },
    poligono_setor: [],
    status: "aberto"
  };
}

export function createVegetacaoModule(projeto = {}) {
  return {
    contexto: {
      project_id: projeto?.id ?? "",
      area_base_m2: Number(projeto?.meta?.area_m2 ?? 0) || 0,
      area_base_ha: Number(projeto?.meta?.area_ha ?? 0) || 0,
      uf: projeto?.meta?.uf ?? projeto?.meta?.estado ?? "",
      municipio: projeto?.meta?.municipio ?? "",
      bioma: projeto?.meta?.bioma ?? "",
      fitofisionomia_base: projeto?.meta?.fitofisionomia ?? "",
      zona: projeto?.meta?.zona ?? "",
      coordenadas_centro: {
        lat: projeto?.meta?.lat ?? null,
        lng: projeto?.meta?.lng ?? null
      },
      poligono_area: Array.isArray(projeto?.meta?.poligono_area) ? projeto.meta.poligono_area : [],
      app_flag: Boolean(projeto?.meta?.app_flag),
      rl_flag: Boolean(projeto?.meta?.rl_flag),
      uc_flag: Boolean(projeto?.meta?.uc_flag),
      zona_amortecimento_flag: Boolean(projeto?.meta?.zona_amortecimento_flag),
      orgao_licenciador_sugerido: projeto?.meta?.orgao_licenciador ?? "",
      fonte_contexto: "cadastro_projeto"
    },
    estado_operacional: {
      estado_atual: "nao_iniciado",
      ultima_atualizacao: new Date().toISOString(),
      erro_ativo: false,
      mensagem_estado: "Módulo ainda não iniciado."
    },
    sessao_ativa: {
      sessao_id: "",
      status: "nao_iniciada",
      tipo_captura: "arvore_isolada",
      data_inicio: "",
      data_fim: "",
      operador_nome: "",
      gps_status: "indisponivel",
      gps_precision_m: null,
      total_imagens: 0,
      total_setores: 0,
      observacoes_campo: "",
      ativo_setor_id: "",
      setores: [],
      imagens: [],
      individuos: [],
      grupos_vegetacao: []
    },
    sessoes: [],
    catalogo_especies_detectadas: [],
    analise_atual: {
      confianca: {
        identificacao_botanica: 0,
        contagem: 0,
        area: 0,
        enquadramento_legal: 0,
        score_global: 0,
        nivel_resultado: "informativo",
        bloqueios: [],
        ressalvas: []
      },
      resultado_botanico: {
        total_especies_detectadas: 0,
        total_individuos_estimados: 0,
        total_individuos_exatos: 0,
        total_individuos_assistidos: 0,
        total_individuos_estimados_fragmento: 0,
        area_total_ocupada_m2: 0,
        area_total_ocupada_ha: 0,
        metodo_predominante: "informativo",
        especies_resumo: []
      },
      enquadramento_legal: {
        bioma_aplicado: "",
        fitofisionomia_aplicada: "",
        ente_competente_sugerido: "",
        incidencia_app: false,
        incidencia_rl: false,
        incidencia_uc: false,
        incidencia_zona_amortecimento: false,
        mata_atlantica_flag: false,
        especie_ameacada_flag: false,
        restricao_especial_flag: false,
        supressao_status: "nao_conclusiva",
        fundamentos_legais: [],
        necessita_autorizacao: true,
        necessita_validacao_humana: true,
        observacoes_legais: []
      },
      proximo_passo: {
        modulo_prioritario: "VEGETAÇÃO / SUPRESSÃO / COMPENSAÇÃO",
        acao_sugerida: "Iniciar a captura de imagens da vegetação.",
        pendencia_principal: "Sessão ainda não iniciada.",
        checklist_minimo: []
      }
    },
    compensacao_preliminar: {
      compensacao_flag: false,
      tipo_compensacao: "indefinido",
      regra_parametrizada_encontrada: false,
      fonte_regra: "",
      ente_regra: "",
      uf_regra: "",
      municipio_regra: "",
      formula_descricao: "",
      quantidade_preliminar_mudas: null,
      necessita_confirmacao_orgao: true,
      observacoes: []
    },
    integracao_laudo: {
      status_integracao: "nao_gerado",
      metodo_utilizado: "",
      nivel_confianca_textual: "",
      texto_identificacao: "",
      texto_quantificacao: "",
      texto_area: "",
      texto_enquadramento_legal: "",
      texto_compensacao: "",
      texto_conclusao_preliminar: "",
      ressalvas_laudo: [],
      bloco_final_laudo: ""
    }
  };
}

export function ensureVegetacaoModule(projeto = {}) {
  if (!projeto.vegetacao_modulo || typeof projeto.vegetacao_modulo !== "object") {
    projeto.vegetacao_modulo = createVegetacaoModule(projeto);
  }
  return projeto.vegetacao_modulo;
}

export function ensureDefaultSector(sessao) {
  sessao.setores = Array.isArray(sessao.setores) ? sessao.setores : [];

  if (!sessao.setores.length) {
    const setor = createSetor("Setor A", 1);
    sessao.setores.push(setor);
    sessao.ativo_setor_id = setor.setor_id;
  }

  sessao.total_setores = sessao.setores.length;
  return sessao;
}

export function createCaptureSession(tipoCaptura = "arvore_isolada") {
  const setorInicial = createSetor("Setor A", 1);

  return {
    sessao_id: crypto.randomUUID(),
    status: "capturando",
    tipo_captura: tipoCaptura,
    data_inicio: new Date().toISOString(),
    data_fim: "",
    operador_nome: "",
    gps_status: "indisponivel",
    gps_precision_m: null,
    total_imagens: 0,
    total_setores: 1,
    observacoes_campo: "",
    ativo_setor_id: setorInicial.setor_id,
    setores: [setorInicial],
    imagens: [],
    individuos: [],
    grupos_vegetacao: []
  };
}

export function addSector(sessao, nome = "") {
  ensureDefaultSector(sessao);
  const ordem = (sessao.setores?.length || 0) + 1;
  const label = String(nome || "").trim() || `Setor ${String.fromCharCode(64 + ordem)}`;
  const setor = createSetor(label, ordem);

  sessao.setores.push(setor);
  sessao.total_setores = sessao.setores.length;
  sessao.ativo_setor_id = setor.setor_id;
  return setor;
}

export function setActiveSector(sessao, setorId) {
  ensureDefaultSector(sessao);
  const found = sessao.setores.find(item => item.setor_id === setorId);
  if (found) {
    sessao.ativo_setor_id = found.setor_id;
  }
  return sessao;
}

export function getActiveSector(sessao) {
  ensureDefaultSector(sessao);
  return sessao.setores.find(item => item.setor_id === sessao.ativo_setor_id) || sessao.setores[0];
}

export function appendCapturedImage(sessao, imageItem) {
  ensureDefaultSector(sessao);
  sessao.imagens = Array.isArray(sessao.imagens) ? sessao.imagens : [];
  sessao.imagens.push(imageItem);
  sessao.total_imagens = sessao.imagens.length;
  sessao.ultima_atualizacao = new Date().toISOString();
  return sessao;
}

// === VEGETACAO_SESSION_CONTRACT_V1 ===
export const VEGETACAO_CAPTURE_MODES = Object.freeze([
  'arvore_isolada',
  'panorama_assistido',
  'mosaico_setorial'
]);

export const VEGETACAO_ANALYSIS_STATUS = Object.freeze([
  'pending',
  'preliminary',
  'reviewed'
]);

export const VEGETACAO_DEDUP_STATUS = Object.freeze([
  'pending',
  'candidate',
  'validated_unique',
  'merged_duplicate'
]);

const __vegSafeId = (value, prefix = 'veg') => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const __vegToNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const __vegArray = (value) => Array.isArray(value) ? value : [];

export function getVegetacaoStorageNamespace() {
  return 'solo-nb:vegetacao:v1';
}

export function normalizeVegetacaoProjectContext(input = {}) {
  return {
    projectId: String(
      input.projectId ??
      input.id ??
      input.projetoId ??
      input.project_id ??
      'projeto-atual'
    ).trim(),
    uf: String(input.uf ?? '').trim().toUpperCase(),
    municipio: String(input.municipio ?? input.cidade ?? '').trim(),
    areaHa: __vegToNumber(input.areaHa ?? input.area_ha ?? input.area ?? 0),
    contextoTerritorial: String(
      input.contextoTerritorial ??
      input.contexto_territorial ??
      input.contexto ??
      ''
    ).trim()
  };
}

export function createVegetacaoSectorRecord(input = {}) {
  return {
    id: __vegSafeId(input.id, 'setor'),
    nome: String(input.nome ?? input.label ?? input.titulo ?? 'Setor').trim(),
    ordem: __vegToNumber(input.ordem ?? input.index ?? 0),
    ativo: Boolean(input.ativo ?? false),
    observacoes: String(input.observacoes ?? '').trim(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function createVegetacaoEvidenceRecord(input = {}) {
  const mode = String(input.mode ?? input.captureMode ?? input.tipo ?? 'panorama_assistido').trim();

  return {
    id: __vegSafeId(input.id, 'cap'),
    sectorId: input.sectorId ?? input.setorId ?? null,
    mode: VEGETACAO_CAPTURE_MODES.includes(mode) ? mode : 'panorama_assistido',
    fileName: String(input.fileName ?? input.nomeArquivo ?? '').trim(),
    mimeType: String(input.mimeType ?? '').trim(),
    uri: String(input.uri ?? input.url ?? '').trim(),
    width: __vegToNumber(input.width ?? 0),
    height: __vegToNumber(input.height ?? 0),
    capturedAt: input.capturedAt ?? input.createdAt ?? new Date().toISOString(),
    especie: String(input.especie ?? '').trim(),
    individuos: __vegToNumber(input.individuos ?? input.quantidade ?? 0),
    areaOcupadaM2: __vegToNumber(input.areaOcupadaM2 ?? input.areaEstimativaM2 ?? input.area_m2 ?? 0),
    fingerprintSeed: String(input.fingerprintSeed ?? '').trim(),
    localHash: String(input.localHash ?? '').trim(),
    dedupStatus: String(input.dedupStatus ?? 'pending').trim(),
    analysisStatus: String(input.analysisStatus ?? 'pending').trim(),
    tags: __vegArray(input.tags).map((item) => String(item).trim()).filter(Boolean),
    observacoes: String(input.observacoes ?? '').trim(),
    metadata: typeof input.metadata === 'object' && input.metadata !== null ? input.metadata : {}
  };
}

export function ensureVegetacaoSessionContract(input = {}, projectContext = {}) {
  const ctx = normalizeVegetacaoProjectContext({
    ...(input.projectContext ?? {}),
    ...projectContext
  });

  const sectors = __vegArray(input.sectors).map((sector, index) =>
    createVegetacaoSectorRecord({
      ...sector,
      ordem: sector?.ordem ?? index,
      ativo: String(input.activeSectorId ?? input.setorAtivoId ?? '') === String(sector?.id ?? '')
    })
  );

  const captures = __vegArray(input.captures).map((capture) => createVegetacaoEvidenceRecord(capture));
  const timeline = __vegArray(input.timeline).map((event) => ({
    id: __vegSafeId(event?.id, 'evt'),
    type: String(event?.type ?? 'evento').trim(),
    at: event?.at ?? new Date().toISOString(),
    payload: typeof event?.payload === 'object' && event?.payload !== null ? event.payload : {}
  }));

  return {
    version: 1,
    sessionId: __vegSafeId(input.sessionId ?? input.id, 'sess'),
    projectContext: ctx,
    startedAt: input.startedAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    activeSectorId: input.activeSectorId ?? input.setorAtivoId ?? sectors.find((item) => item.ativo)?.id ?? null,
    sectors,
    captures,
    timeline,
    dedupQueue: __vegArray(input.dedupQueue).map((item) => String(item).trim()).filter(Boolean),
    analysis: typeof input.analysis === 'object' && input.analysis !== null ? input.analysis : {
      status: 'pending',
      generatedAt: null,
      resumo: null,
      porEspecie: [],
      porSetor: [],
      porModo: [],
      pendencias: []
    },
    laudoHook: typeof input.laudoHook === 'object' && input.laudoHook !== null ? input.laudoHook : null,
    persist: typeof input.persist === 'object' && input.persist !== null ? input.persist : {
      lastSavedAt: null,
      saveCount: 0
    },
    integration: typeof input.integration === 'object' && input.integration !== null ? input.integration : {
      laudoReady: false,
      laudoLastPreparedAt: null
    }
  };
}
// === /VEGETACAO_SESSION_CONTRACT_V1 ===
