import {
  ensureVegetacaoModule,
  createCaptureSession,
  appendCapturedImage,
  addSector,
  setActiveSector,
  getActiveSector,
  ensureDefaultSector
} from "../core/vegetacao/schema.js";

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)[1];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function getCurrentPositionSafe() {
  if (!("geolocation" in navigator)) {
    return {
      gps_status: "indisponivel",
      lat: null,
      lng: null,
      precisao: null
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          gps_status: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: pos.coords.accuracy ?? null
        });
      },
      () => {
        resolve({
          gps_status: "parcial",
          lat: null,
          lng: null,
          precisao: null
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

async function startCamera(videoEl, statusEl) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Câmera não suportada neste navegador.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" }
    },
    audio: false
  });

  videoEl.srcObject = stream;
  await videoEl.play();
  statusEl.textContent = "Câmera ativa.";
  return stream;
}

function stopCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 19);
}

function getCaptureLabel(value = "") {
  const map = {
    arvore_isolada: "Árvore isolada",
    panorama_assistido: "Panorama assistido",
    mosaico_setorial: "Mosaico por setores"
  };
  return map[value] || value || "-";
}

function getAreaText(contexto = {}) {
  const ha = Number(contexto?.area_base_ha || 0);
  const m2 = Number(contexto?.area_base_m2 || 0);

  if (ha > 0) return `${ha} ha`;
  if (m2 > 0) return `${m2} m²`;
  return "-";
}

function buildResumoSessao(sessao, contexto) {
  const activeSector = getActiveSector(sessao);

  return `
    <div class="vegInfoGrid">
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Sessão</span>
        <strong>${sessao?.sessao_id || "-"}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Modo de captura</span>
        <strong>${getCaptureLabel(sessao?.tipo_captura)}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Imagens</span>
        <strong>${sessao?.total_imagens ?? 0}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Setores</span>
        <strong>${sessao?.total_setores ?? 0}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Setor ativo</span>
        <strong>${activeSector?.nome || "-"}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Área-base do projeto</span>
        <strong>${getAreaText(contexto)}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">Município / UF</span>
        <strong>${contexto?.municipio || "-"} / ${contexto?.uf || "-"}</strong>
      </div>
      <div class="vegInfoCard">
        <span class="vegInfoLabel">GPS</span>
        <strong>${sessao?.gps_status || "-"}</strong>
      </div>
    </div>
  `;
}

function buildSetoresHtml(sessao) {
  ensureDefaultSector(sessao);

  return `
    <div class="vegSectorList">
      ${sessao.setores.map((setor) => `
        <button
          type="button"
          class="vegSectorChip ${setor.setor_id === sessao.ativo_setor_id ? "active" : ""}"
          data-setor-id="${setor.setor_id}"
        >
          ${setor.nome}
        </button>
      `).join("")}
    </div>
  `;
}

function buildMiniaturesHtml(sessao) {
  const imagens = sessao?.imagens || [];
  const setores = sessao?.setores || [];

  if (!imagens.length) {
    return `
      <div class="vegEmptyState">
        Nenhuma imagem capturada nesta sessão.
      </div>
    `;
  }

  return `
    <div class="vegThumbGrid">
      ${imagens.map((item, index) => {
        const setor = setores.find(s => s.setor_id === item.setor_id);
        return `
          <article class="vegThumbCard">
            <img src="${item.preview_url}" alt="Captura ${index + 1}" />
            <div class="vegThumbMeta">
              <strong>Imagem ${index + 1}</strong>
              <span>${formatDateTime(item.timestamp)}</span>
              <span>Setor: ${setor?.nome || "-"}</span>
              <span>Modo: ${getCaptureLabel(item.capture_mode)}</span>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function buildTimelineHtml(sessao) {
  const imagens = sessao?.imagens || [];
  const setores = sessao?.setores || [];

  if (!imagens.length) {
    return `
      <div class="vegEmptyState">
        A timeline da sessão será exibida após a primeira captura.
      </div>
    `;
  }

  return `
    <div class="vegTimeline">
      ${imagens.map((item, index) => {
        const setor = setores.find(s => s.setor_id === item.setor_id);
        return `
          <div class="vegTimelineItem">
            <div class="vegTimelineIndex">${index + 1}</div>
            <div class="vegTimelineBody">
              <strong>${formatDateTime(item.timestamp)}</strong>
              <span>Setor ${setor?.nome || "-"}</span>
              <span>${getCaptureLabel(item.capture_mode)}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export async function renderVegetacaoSupressao({ appEl, projeto, setProjeto, toast }) {
  const modulo = ensureVegetacaoModule(projeto);
  ensureDefaultSector(modulo.sessao_ativa);

  let stream = null;
  let captureMode = modulo?.sessao_ativa?.tipo_captura || "arvore_isolada";

  appEl.innerHTML = `
    <section class="vegModuleShell">
      <div class="vegHero">
        <div class="vegHeroMain">
          <div class="moduleEyebrow">Levantamento automatizado de vegetação</div>
          <h2>Vegetação / Supressão / Compensação</h2>
          <p>
            Sessão guiada por setores para reduzir sobreposição de imagens e preparar a análise automática com maior rastreabilidade.
          </p>
        </div>

        <div class="vegHeroMeta">
          <span class="badge secondary">Projeto: ${projeto?.name || "-"}</span>
          <span class="badge secondary">UF: ${modulo?.contexto?.uf || "-"}</span>
          <span class="badge secondary">Município: ${modulo?.contexto?.municipio || "-"}</span>
          <span class="badge secondary">Área-base: ${getAreaText(modulo?.contexto || {})}</span>
        </div>
      </div>

      <div class="vegCaptureGrid">
        <div class="vegPanel">
          <div class="vegPanelHeader">
            <h3>Câmera</h3>
            <span id="vegCameraStatus" class="badge secondary">Aguardando início</span>
          </div>

          <div class="vegCameraBox">
            <video id="vegVideo" playsinline autoplay muted></video>
          </div>

          <div class="vegModeRow">
            <button id="vegModeArvore" class="secondary" type="button">Árvore isolada</button>
            <button id="vegModePanorama" class="secondary" type="button">Panorama assistido</button>
            <button id="vegModeSetor" class="secondary" type="button">Mosaico por setores</button>
          </div>

          <div class="vegActionRow">
            <button id="vegOpenCamera" type="button">Abrir câmera</button>
            <button id="vegCapture" type="button" class="secondary">Capturar imagem</button>
            <button id="vegFinalize" type="button" class="secondary">Finalizar sessão</button>
          </div>
        </div>

        <div class="vegPanel">
          <div class="vegPanelHeader">
            <h3>Sessão ativa</h3>
            <span id="vegSessionStatus" class="badge secondary">${modulo?.sessao_ativa?.status || "nao_iniciada"}</span>
          </div>

          <div id="vegResumoSessao">
            ${buildResumoSessao(modulo.sessao_ativa, modulo.contexto)}
          </div>

          <div class="vegPanelSub">
            <label>Setores do levantamento</label>
            <div class="vegSectorToolbar">
              <input id="vegNewSectorName" type="text" placeholder="Nome do novo setor" />
              <button id="vegAddSector" type="button" class="secondary">Adicionar setor</button>
            </div>
            <div id="vegSectorList">
              ${buildSetoresHtml(modulo.sessao_ativa)}
            </div>
          </div>

          <div class="vegPanelSub">
            <label>Observações de campo</label>
            <textarea id="vegObs" placeholder="Descreva rapidamente o cenário capturado.">${modulo?.sessao_ativa?.observacoes_campo || ""}</textarea>
          </div>
        </div>
      </div>

      <div class="vegPanel">
        <div class="vegPanelHeader">
          <h3>Timeline da sessão</h3>
          <span class="badge secondary">Ordem auditável</span>
        </div>
        <div id="vegTimeline">
          ${buildTimelineHtml(modulo.sessao_ativa)}
        </div>
      </div>

      <div class="vegPanel">
        <div class="vegPanelHeader">
          <h3>Miniaturas da sessão</h3>
          <span class="badge secondary">Levantamento atual</span>
        </div>
        <div id="vegMiniatures">
          ${buildMiniaturesHtml(modulo.sessao_ativa)}
        </div>
      </div>
    </section>
  `;

  const videoEl = appEl.querySelector("#vegVideo");
  const cameraStatusEl = appEl.querySelector("#vegCameraStatus");
  const sessionStatusEl = appEl.querySelector("#vegSessionStatus");
  const resumoEl = appEl.querySelector("#vegResumoSessao");
  const sectorListEl = appEl.querySelector("#vegSectorList");
  const timelineEl = appEl.querySelector("#vegTimeline");
  const miniaturesEl = appEl.querySelector("#vegMiniatures");
  const obsEl = appEl.querySelector("#vegObs");
  const newSectorInputEl = appEl.querySelector("#vegNewSectorName");

  function markModeButtons() {
    const map = {
      arvore_isolada: "#vegModeArvore",
      panorama_assistido: "#vegModePanorama",
      mosaico_setorial: "#vegModeSetor"
    };

    Object.values(map).forEach(sel => {
      const btn = appEl.querySelector(sel);
      if (btn) btn.classList.add("secondary");
    });

    const active = appEl.querySelector(map[captureMode]);
    if (active) active.classList.remove("secondary");
  }

  function syncUiFromSession() {
    ensureDefaultSector(modulo.sessao_ativa);
    sessionStatusEl.textContent = modulo?.sessao_ativa?.status || "nao_iniciada";
    resumoEl.innerHTML = buildResumoSessao(modulo.sessao_ativa, modulo.contexto);
    sectorListEl.innerHTML = buildSetoresHtml(modulo.sessao_ativa);
    timelineEl.innerHTML = buildTimelineHtml(modulo.sessao_ativa);
    miniaturesEl.innerHTML = buildMiniaturesHtml(modulo.sessao_ativa);
  }

  async function persistModulo(toastMessage = "") {
    modulo.sessao_ativa.observacoes_campo = obsEl.value.trim();
    modulo.estado_operacional.ultima_atualizacao = new Date().toISOString();
    projeto.vegetacao_modulo = modulo;
    await setProjeto(projeto, { toastMessage, refreshAfterSave: false });
  }

  appEl.querySelector("#vegModeArvore").addEventListener("click", () => {
    captureMode = "arvore_isolada";
    markModeButtons();
  });

  appEl.querySelector("#vegModePanorama").addEventListener("click", () => {
    captureMode = "panorama_assistido";
    markModeButtons();
  });

  appEl.querySelector("#vegModeSetor").addEventListener("click", () => {
    captureMode = "mosaico_setorial";
    markModeButtons();
  });

  appEl.querySelector("#vegAddSector").addEventListener("click", async () => {
    try {
      const name = newSectorInputEl.value.trim();
      addSector(modulo.sessao_ativa, name);
      newSectorInputEl.value = "";
      modulo.estado_operacional.mensagem_estado = "Novo setor adicionado à sessão.";
      await persistModulo("Setor adicionado ao levantamento.");
      syncUiFromSession();
    } catch (error) {
      console.error(error);
      toast("Falha ao adicionar setor.");
    }
  });

  sectorListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-setor-id]");
    if (!btn) return;

    try {
      setActiveSector(modulo.sessao_ativa, btn.getAttribute("data-setor-id"));
      await persistModulo("");
      syncUiFromSession();
    } catch (error) {
      console.error(error);
    }
  });

  appEl.querySelector("#vegOpenCamera").addEventListener("click", async () => {
    try {
      if (!modulo.sessao_ativa?.sessao_id || modulo.sessao_ativa?.status === "nao_iniciada" || modulo.sessao_ativa?.status === "concluida") {
        modulo.sessao_ativa = createCaptureSession(captureMode);
        modulo.estado_operacional.estado_atual = "captura_em_andamento";
        modulo.estado_operacional.mensagem_estado = "Sessão de levantamento iniciada.";
      } else {
        modulo.sessao_ativa.tipo_captura = captureMode;
        ensureDefaultSector(modulo.sessao_ativa);
      }

      const gps = await getCurrentPositionSafe();
      modulo.sessao_ativa.gps_status = gps.gps_status;
      modulo.sessao_ativa.gps_precision_m = gps.precisao;

      stream = await startCamera(videoEl, cameraStatusEl);
      await persistModulo("Sessão de vegetação iniciada.");
      syncUiFromSession();
      markModeButtons();
    } catch (error) {
      console.error(error);
      cameraStatusEl.textContent = "Falha na câmera";
      toast("Não foi possível abrir a câmera.");
    }
  });

  appEl.querySelector("#vegCapture").addEventListener("click", async () => {
    try {
      if (!stream) {
        toast("Abra a câmera antes de capturar.");
        return;
      }

      ensureDefaultSector(modulo.sessao_ativa);
      const activeSector = getActiveSector(modulo.sessao_ativa);

      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth || 1280;
      canvas.height = videoEl.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      const previewUrl = canvas.toDataURL("image/jpeg", 0.86);
      const blob = dataUrlToBlob(previewUrl);
      const gps = await getCurrentPositionSafe();

      const imageItem = {
        imagem_id: crypto.randomUUID(),
        sessao_id: modulo.sessao_ativa.sessao_id,
        setor_id: activeSector?.setor_id || "",
        ordem_captura: (modulo.sessao_ativa.total_imagens || 0) + 1,
        timestamp: new Date().toISOString(),
        arquivo_local: "",
        thumbnail_local: "",
        hash_visual: "",
        lat: gps.lat,
        lng: gps.lng,
        precisao_gps_m: gps.precisao,
        direcao_aproximada: null,
        tipo_imagem: captureMode === "arvore_isolada" ? "isolada" : (captureMode === "panorama_assistido" ? "panorama" : "quadro"),
        capture_mode: captureMode,
        status_processamento: "pendente",
        sobreposicao_suspeita: false,
        duplicidade_score: 0,
        observacao: obsEl.value.trim(),
        preview_url: previewUrl,
        blob_ref: blob
      };

      appendCapturedImage(modulo.sessao_ativa, imageItem);
      modulo.estado_operacional.estado_atual = "captura_em_andamento";
      modulo.estado_operacional.mensagem_estado = "Imagem adicionada à sessão.";

      await persistModulo("Imagem capturada no levantamento vegetal.");
      syncUiFromSession();
    } catch (error) {
      console.error(error);
      toast("Falha ao capturar a imagem.");
    }
  });

  appEl.querySelector("#vegFinalize").addEventListener("click", async () => {
    try {
      if (modulo?.sessao_ativa?.status === "nao_iniciada") {
        toast("Nenhuma sessão iniciada.");
        return;
      }

      stopCamera(stream);
      stream = null;
      cameraStatusEl.textContent = "Sessão finalizada";
      modulo.sessao_ativa.status = "concluida";
      modulo.sessao_ativa.data_fim = new Date().toISOString();
      modulo.estado_operacional.estado_atual = "resultado_preliminar";
      modulo.estado_operacional.mensagem_estado = "Sessão pronta para análise automática.";

      await persistModulo("Sessão de vegetação finalizada.");
      syncUiFromSession();
    } catch (error) {
      console.error(error);
      toast("Falha ao finalizar a sessão.");
    }
  });

  obsEl.addEventListener("change", async () => {
    try {
      await persistModulo("");
    } catch (error) {
      console.error(error);
    }
  });

  markModeButtons();
  syncUiFromSession();
}

// === VEGETACAO_PAGE_RUNTIME_V1 ===
const __soloVegToText = (value) => String(value ?? '').trim();
const __soloVegToNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function __soloVegFindRoot() {
  if (typeof document === 'undefined') return null;

  return (
    document.querySelector('[data-page="vegetacao"]') ||
    document.querySelector('[data-module="vegetacao"]') ||
    document.querySelector('#vegetacao-supressao-page') ||
    document.querySelector('#page-vegetacao') ||
    document.querySelector('.page-vegetacao') ||
    document.querySelector('[data-vegetacao-root]')
  );
}

function __soloVegReadProjectContext(root) {
  const dataset = root?.dataset ?? {};
  const globalProject =
    (typeof window !== 'undefined' && (
      window.__APP_CURRENT_PROJECT__ ||
      window.__CURRENT_PROJECT__ ||
      window.__SOLO_NB_PROJECT__ ||
      window.__PROJECT__
    )) || {};

  return {
    projectId: __soloVegToText(
      dataset.projectId ??
      globalProject.projectId ??
      globalProject.id ??
      globalProject.projetoId ??
      globalProject.project_id ??
      'projeto-atual'
    ),
    uf: __soloVegToText(dataset.uf ?? globalProject.uf).toUpperCase(),
    municipio: __soloVegToText(dataset.municipio ?? globalProject.municipio ?? globalProject.cidade),
    areaHa: __soloVegToNumber(dataset.areaHa ?? globalProject.areaHa ?? globalProject.area_ha ?? globalProject.area),
    contextoTerritorial: __soloVegToText(
      dataset.contextoTerritorial ??
      globalProject.contextoTerritorial ??
      globalProject.contexto_territorial ??
      globalProject.contexto
    )
  };
}

function __soloVegEmit(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function __soloVegApplySnapshotToRoot(root, snapshot) {
  if (!root || !snapshot) return;

  const resumo = snapshot.moduleState?.resumo ?? {};
  const status = snapshot.moduleState?.status ?? {};

  root.dataset.vegetacaoSessionId = __soloVegToText(snapshot.moduleState?.sessionId);
  root.dataset.vegetacaoActiveSectorId = __soloVegToText(snapshot.moduleState?.activeSectorId);
  root.dataset.vegetacaoTotalCapturas = String(resumo.totalCapturas ?? 0);
  root.dataset.vegetacaoTotalSetores = String(resumo.totalSetores ?? 0);
  root.dataset.vegetacaoEspeciesMapeadas = String(resumo.especiesMapeadas ?? 0);
  root.dataset.vegetacaoIndividuosEstimados = String(resumo.individuosEstimados ?? 0);
  root.dataset.vegetacaoAreaOcupadaM2 = String(resumo.areaOcupadaEstimadaM2 ?? 0);
  root.dataset.vegetacaoPendencias = String(resumo.pendenciasAbertas ?? 0);
  root.dataset.vegetacaoHasCaptures = String(Boolean(status.hasCaptures));
  root.dataset.vegetacaoHasPendingDedup = String(Boolean(status.hasPendingDedup));
  root.dataset.vegetacaoHasPendingAnalysis = String(Boolean(status.hasPendingAnalysis));
}

async function __soloVegBootPageRuntime() {
  if (typeof window === 'undefined') return;
  if (window.__soloVegPageRuntimeBound) return;

  window.__soloVegPageRuntimeBound = true;

  try {
    const root = __soloVegFindRoot();
    const project = __soloVegReadProjectContext(root);
    const module = await import('../core/vegetacao/controller.js');

    const adapter = module.createVegetacaoPageAdapter({
      project,
      getSession: () => window.__SOLO_NB_VEGETACAO_SESSION__ ?? null,
      setSession: (nextSession) => {
        window.__SOLO_NB_VEGETACAO_SESSION__ = nextSession ?? null;
        return window.__SOLO_NB_VEGETACAO_SESSION__;
      }
    });

    const sync = (payload = {}) => {
      const snapshot = payload.snapshot ?? adapter.getSnapshot?.() ?? null;
      const session = payload.session ?? adapter.getSession?.() ?? null;

      __soloVegApplySnapshotToRoot(root, snapshot);

      window.__APP_SOLO_NB_VEGETACAO__ = {
        adapter,
        project,
        snapshot,
        session,
        getSnapshot: () => adapter.getSnapshot(),
        getSession: () => adapter.getSession(),
        setActiveSector: (sectorId) => adapter.setActiveSector(sectorId),
        captureArvoreIsolada: (capture) => adapter.captureArvoreIsolada(capture),
        capturePanorama: (capture) => adapter.capturePanorama(capture),
        captureMosaico: (capture) => adapter.captureMosaico(capture),
        runPreDedup: (threshold = 60) => adapter.runPreDedup(threshold),
        appendEvent: (type, eventPayload) => adapter.appendEvent(type, eventPayload)
      };

      return { snapshot, session };
    };

    adapter.onChange((payload) => {
      const state = sync(payload);
      __soloVegEmit('solo-nb:vegetacao:changed', {
        reason: payload.reason ?? 'state.changed',
        snapshot: state.snapshot,
        session: state.session
      });
    });

    const bootResult = adapter.boot(window.__SOLO_NB_VEGETACAO_SESSION__ ?? null);
    const current = sync({
      reason: 'runtime.boot',
      snapshot: adapter.getSnapshot(),
      session: adapter.getSession()
    });

    __soloVegEmit('solo-nb:vegetacao:booted', {
      bootResult,
      snapshot: current.snapshot,
      session: current.session
    });
  } catch (error) {
    console.error('[Vegetacao] Falha ao iniciar runtime da página.', error);
    __soloVegEmit('solo-nb:vegetacao:error', {
      message: error?.message ?? 'Falha ao iniciar módulo Vegetação.'
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void __soloVegBootPageRuntime();
    }, { once: true });
  } else {
    void __soloVegBootPageRuntime();
  }
}
// === /VEGETACAO_PAGE_RUNTIME_V1 ===

// === VEGETACAO_HEADER_BIND_V1 ===
(function () {
  if (typeof window === 'undefined') return;
  if (window.__soloVegTopHeaderFixBound) return;
  window.__soloVegTopHeaderFixBound = true;

  function getRoot() {
    if (typeof __soloVegFindRoot === 'function') {
      return __soloVegFindRoot();
    }

    if (typeof document === 'undefined') return null;

    return (
      document.querySelector('[data-page="vegetacao"]') ||
      document.querySelector('[data-module="vegetacao"]') ||
      document.querySelector('#vegetacao-supressao-page') ||
      document.querySelector('#page-vegetacao') ||
      document.querySelector('.page-vegetacao') ||
      document.querySelector('[data-vegetacao-root]')
    );
  }

  function norm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function hasText(node, text) {
    return norm(node && node.textContent).indexOf(norm(text)) >= 0;
  }

  function hasAllTexts(node, texts) {
    return texts.every(function (text) {
      return hasText(node, text);
    });
  }

  function smallest(nodes) {
    return nodes
      .filter(Boolean)
      .sort(function (a, b) {
        return String(a.textContent || '').length - String(b.textContent || '').length;
      })[0] || null;
  }

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  function applyTopFix() {
    var root = getRoot();
    if (!root) return;

    var nodes = [root].concat(toArray(root.querySelectorAll('section, article, div')));

    var topCard = smallest(
      nodes.filter(function (node) {
        return hasAllTexts(node, ['FLUXO TECNICO DO LAUDO', 'MODULO ATUAL', 'PROJETO', 'FLUXO', 'MODO']);
      })
    );

    if (!topCard) return;

    topCard.classList.add('veg-top-card-fix');

    var directChildren = toArray(topCard.children).filter(function (node) {
      return node && node.nodeType === 1;
    });

    var metricHost =
      smallest(
        directChildren.filter(function (node) {
          return hasAllTexts(node, ['MODULO ATUAL', 'PROJETO', 'FLUXO', 'MODO']);
        })
      ) ||
      smallest(
        toArray(topCard.querySelectorAll('section, article, div')).filter(function (node) {
          return node !== topCard && hasAllTexts(node, ['MODULO ATUAL', 'PROJETO', 'FLUXO', 'MODO']);
        })
      );

    var introHost = directChildren.filter(function (node) {
      return node !== metricHost;
    })[0] || null;

    if (introHost) {
      introHost.classList.add('veg-top-intro-fix');
    }

    if (metricHost) {
      metricHost.classList.add('veg-top-metrics-fix');
    }

    var titleRow = smallest(
      toArray(topCard.querySelectorAll('div, header, h1, h2, h3, p, span')).filter(function (node) {
        return hasText(node, 'VEGETACAO') && hasText(node, 'PROJETO EM EDICAO');
      })
    );

    if (titleRow) {
      titleRow.classList.add('veg-top-title-row-fix');
    }

    var projectLine = smallest(
      toArray(topCard.querySelectorAll('div, p, span, strong')).filter(function (node) {
        return hasText(node, 'PROJETO ATUAL');
      })
    );

    if (projectLine) {
      projectLine.classList.add('veg-top-project-line-fix');
    }

    if (metricHost) {
      ['MODULO ATUAL', 'PROJETO', 'FLUXO', 'MODO'].forEach(function (label) {
        var metricCard = smallest(
          toArray(metricHost.querySelectorAll('section, article, div')).filter(function (node) {
            return node !== metricHost && hasText(node, label);
          })
        );

        if (metricCard) {
          metricCard.classList.add('veg-top-metric-card-fix');
        }
      });
    }
  }

  function runFix() {
    window.requestAnimationFrame(function () {
      applyTopFix();
      window.requestAnimationFrame(applyTopFix);
    });
  }

  window.addEventListener('solo-nb:vegetacao:booted', runFix);
  window.addEventListener('solo-nb:vegetacao:changed', runFix);
  window.addEventListener('resize', runFix);

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runFix, { once: true });
    } else {
      runFix();
    }
  }
})();
// === /VEGETACAO_HEADER_BIND_V1 ===
