import { createZipStore, downloadBlob, safeFilename, blobToUint8, unzipStore } from "../lib/export_zip.js";
import { runAutomaticAnalysis } from "../core/analysis/analysis-pipeline.js";
import { listProjectsPreferred, saveProjectEverywhere, deleteProjectEverywhere } from "../lib/projects_remote.js";

async function toJpegBytes(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  const bytes = await blobToUint8(jpegBlob);
  return bytes;
}

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 19);
}

function upsertProjectInMemory(projects = [], project = null) {
  if (!project || !project.id) return projects;
  const idx = projects.findIndex((item) => item?.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  projects.sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));
  return projects;
}
function buildAnalysisContext(projeto = {}) {
  const evidencias = projeto?.evidencias ?? projeto?.evidence ?? projeto?.anexos ?? [];
  return {
    ...projeto,
    id: projeto?.id,
    projetoId: projeto?.id,
    projeto: {
      ...(projeto?.projeto ?? {}),
      id: projeto?.id ?? projeto?.projeto?.id ?? null,
      codigo: projeto?.id ?? projeto?.projeto?.codigo ?? ""
    },
    agua: projeto?.agua ?? projeto?.water ?? {},
    flora: projeto?.flora ?? {},
    fauna: projeto?.fauna ?? {},
    solo: projeto?.solo ?? projeto?.soloProcessos ?? projeto?.solo_processos ?? projeto?.processos ?? {},
    evidencias,
    conformidade: projeto?.conformidade ?? projeto?.compliance ?? {},
    laudo: projeto?.laudo ?? projeto?.report ?? {}
  };
}

function formatWorkflowStatus(value = "indefinido") {
  const map = {
    rascunho: "Rascunho",
    em_preenchimento: "Em preenchimento",
    em_revisao_tecnica: "Em revisão técnica",
    com_pendencias: "Com pendências técnicas",
    aprovado_para_emissao: "Apto para emissão",
    emitido: "Emitido",
    arquivado: "Arquivado",
    indisponivel: "Leitura indisponível",
    indefinido: "Indefinido"
  };

  const normalized = String(value ?? "indefinido").trim().toLowerCase();
  return map[normalized] ?? String(value ?? "Indefinido");
}

function formatBlockingReason(reason = "") {
  const raw = String(reason ?? "").trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) {
    return "Nenhuma pendência técnica automática detectada no estado atual.";
  }

  if (normalized.includes("evidenc")) {
    return "Faltam evidências mínimas para liberar tecnicamente o projeto.";
  }

  if (normalized.includes("conform")) {
    return "A conclusão de conformidade precisa de revisão técnica.";
  }

  if (normalized.includes("agua")) {
    return "Existe informação de Água que precisa refletir no laudo.";
  }

  if (normalized.includes("solo")) {
    return "Existe registro em Solo/Processos que exige comprovação técnica.";
  }

  return raw;
}

function getPriorityModule(blockingReasons = []) {
  const first = String((blockingReasons && blockingReasons[0]) || "").trim();
  const normalized = first
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) return "Fluxo geral";

  if (normalized.includes("evidenc")) return "Evidências";
  if (normalized.includes("conform")) return "Conformidade";
  if (normalized.includes("agua")) return "Água";
  if (normalized.includes("solo")) return "Solo/Processos";
  if (normalized.includes("flora")) return "Flora";
  if (normalized.includes("fauna")) return "Fauna";

  return "Fluxo geral";
}

function getNextTechnicalStep(blockingReasons = []) {
  const first = String((blockingReasons && blockingReasons[0]) || "").trim();
  const normalized = first
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) {
    return "Seguir preenchimento normal do fluxo.";
  }

  if (normalized.includes("evidenc")) {
    return "Anexar evidências na seção Evidências.";
  }

  if (normalized.includes("conform")) {
    return "Revisar a seção Conformidade.";
  }

  if (normalized.includes("agua")) {
    return "Revisar Água e depois validar o Laudo.";
  }

  if (normalized.includes("solo")) {
    return "Revisar Solo/Processos e vincular comprovação.";
  }

  return "Revisar os dados técnicos e salvar novamente.";
}

async function buildProjectTechnicalStatus(project) {
  try {
    const analysisResult = await runAutomaticAnalysis(buildAnalysisContext(project), { version: "v1" });
    const summary = analysisResult?.diagnostic?.summary ?? {};
    const findings = analysisResult?.findings ?? {};
    const workflowHints = analysisResult?.workflowHints ?? {};
    const blockingReasons = findings?.emissionGate?.reasons ?? [];

    return {
      label: findings?.emissionGate?.canEmit ? "Apto para emissão" : "Pendência técnica",
      badgeClass: findings?.emissionGate?.canEmit ? "ok" : "warn",
      situation: formatWorkflowStatus(workflowHints?.suggestedStatus ?? "indefinido"),
      occurrences: summary?.total ?? 0,
      primaryReason: formatBlockingReason(blockingReasons[0]),
      nextStep: getNextTechnicalStep(blockingReasons),
      priorityModule: getPriorityModule(blockingReasons)
    };
  } catch (error) {
    console.warn("Falha ao calcular status técnico do projeto:", error);
    return {
      label: "Leitura indisponível",
      badgeClass: "secondary",
      situation: "Leitura indisponível",
      occurrences: 0,
      primaryReason: "Não foi possível consolidar a leitura técnica.",
      nextStep: "Abrir o projeto e salvar novamente para recalcular.",
      priorityModule: "Fluxo geral"
    };
  }
}

export async function renderProjects({ appEl, db, toast, createEmptyProject, baseLegal, onOpen }) {
  const projects = await listProjectsPreferred(db);

  appEl.innerHTML = `
    <section class="pageHero">
      <div>
        <h2>Projetos</h2>
        <p>Ambiente central para criação, abertura, importação e exportação dos projetos do laudo ambiental.</p>
        <div class="small" style="margin-top:8px">Base legal local: <b>${baseLegal.version || "-"}</b></div>
      </div>

      <div class="pageActions">
        <button id="btnNew">Novo projeto</button>
        <label class="fileTrigger secondary" for="fileImport">
          Importar pacote (.zip)
        </label>
        <input id="fileImport" type="file" accept=".zip" hidden />
      </div>
    </section>

    <div id="list" class="projectList"></div>
  `;

  const listEl = appEl.querySelector("#list");

  async function renderList() {
    const latestProjects = await listProjectsPreferred(db);
    projects.length = 0;
    projects.push(...latestProjects);
    if (!projects.length) {
      listEl.innerHTML = `
        <div class="emptyState">
          <h3>Nenhum projeto criado/importado ainda</h3>
          <p>Crie um novo projeto ou importe um pacote para iniciar o fluxo técnico do sistema.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="emptyState">
        <h3>Atualizando status técnico dos projetos…</h3>
        <p>Aguarde um instante enquanto o sistema consolida a leitura automática de cada projeto.</p>
      </div>
    `;

    const enrichedProjects = [];
    for (const project of projects) {
      const technical = await buildProjectTechnicalStatus(project);
      enrichedProjects.push({ project, technical });
    }

    listEl.innerHTML = enrichedProjects.map(({ project: p, technical }) => `
      <article class="projectCard">
        <div>
          <div class="projectTitle">
            <h3>${p.name}</h3>
            <span class="badge ${technical.badgeClass}">${technical.label}</span>
          </div>

          <div class="projectMeta">
            <div class="projectMetaItem">
              <span class="label">Município / UF</span>
              <span class="value">${p.meta?.municipio || "-"} / ${p.meta?.uf || "-"}</span>
            </div>

            <div class="projectMetaItem">
              <span class="label">Atualizado</span>
              <span class="value">${formatDateTime(p.updatedAt)}</span>
            </div>

            <div class="projectMetaItem">
              <span class="label">Identificador</span>
              <span class="value">${p.id || "-"}</span>
            </div>

            <div class="projectMetaItem">
              <span class="label">Situação técnica</span>
              <span class="value">${technical.situation}</span>
            </div>

            <div class="projectMetaItem">
              <span class="label">Ocorrências</span>
              <span class="value">${technical.occurrences}</span>
            </div>

            <div class="projectMetaItem">
              <span class="label">Módulo prioritário</span>
              <span class="value">${technical.priorityModule}</span>
            </div>

            <div class="projectMetaItem" style="grid-column:1 / -1">
              <span class="label">Motivo principal</span>
              <span class="value">${technical.primaryReason}</span>
            </div>

            <div class="projectMetaItem" style="grid-column:1 / -1">
              <span class="label">Próximo passo sugerido</span>
              <span class="value">${technical.nextStep}</span>
            </div>
          </div>
        </div>

        <div class="projectActions">
          <button data-open="${p.id}">Abrir</button>
          <button class="secondary" data-export="${p.id}">Exportar</button>
          <button class="danger" data-del="${p.id}">Excluir</button>
        </div>
      </article>
    `).join("");
  }

  await renderList();

  appEl.querySelector("#btnNew").addEventListener("click", async () => {
    const name = prompt("Nome do projeto (ex.: Condomínio X):");
    if (!name) return;
    const prj = createEmptyProject(name.trim());
    const saved = await saveProjectEverywhere(db, prj);
    upsertProjectInMemory(projects, saved);
    toast("Projeto criado.");
    await renderList();
  });

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const openId = btn.getAttribute("data-open");
    const exportId = btn.getAttribute("data-export");
    const delId = btn.getAttribute("data-del");

    if (openId) return onOpen(openId);

    if (delId) {
      const ok = confirm("Excluir este projeto e todas as evidências?");
      if (!ok) return;

      await deleteProjectEverywhere(db, delId);
      const idx = projects.findIndex(x => x.id === delId);
      if (idx >= 0) projects.splice(idx, 1);

      toast("Projeto excluído.");
      await renderList();
      return;
    }

    if (exportId) {
      const prj = await db.getProject(exportId);
      if (!prj) return;

      const photos = await db.listPhotosByProject(prj.id);

      const exportMeta = photos.map(ph => ({
        id: ph.id,
        categoria: ph.categoria,
        lat: ph.lat,
        lng: ph.lng,
        timestamp: ph.timestamp,
        capturedAt: ph.capturedAt || ph.timestamp,
        descricao: ph.descricao,
        filename: `photos/${ph.id}.jpg`
      }));

      const prjClone = structuredClone(prj);
      prjClone._export = { photos: exportMeta };

      const entries = [];
      entries.push({ name: "project.json", data: new TextEncoder().encode(JSON.stringify(prjClone, null, 2)) });

      for (const ph of photos) {
        const bytes = await toJpegBytes(ph.blob);
        entries.push({ name: `photos/${ph.id}.jpg`, data: bytes });
      }

      const zip = await createZipStore(entries);
      downloadBlob(zip, `${safeFilename(prj.name)}_PACOTE_PROJETO.zip`);
      toast("Pacote exportado.");
      return;
    }
  });

  const fileImport = appEl.querySelector("#fileImport");
  fileImport.addEventListener("change", async () => {
    const file = fileImport.files?.[0];
    fileImport.value = "";
    if (!file) return;

    try {
      const files = await unzipStore(file);
      const pj = files.get("project.json");
      if (!pj) throw new Error("Pacote inválido: project.json não encontrado.");

      const prj = JSON.parse(new TextDecoder().decode(pj));

      prj.id = prj.id || crypto.randomUUID();
      prj.updatedAt = new Date().toISOString();
      const importedBase = await saveProjectEverywhere(db, prj);
      prj.id = importedBase.id;
      prj.updatedAt = importedBase.updatedAt;

      const photosMeta = prj._export?.photos || [];
      for (const meta of photosMeta) {
        const bytes = files.get(meta.filename);
        if (!bytes) continue;

        const blob = new Blob([bytes], { type: "image/jpeg" });
        const photo = {
          id: meta.id || crypto.randomUUID(),
          projectId: prj.id,
          categoria: meta.categoria || "impacto",
          blob,
          lat: meta.lat ?? null,
          lng: meta.lng ?? null,
          timestamp: (meta.capturedAt || meta.timestamp) || new Date().toISOString(),
          capturedAt: (meta.capturedAt || meta.timestamp) || new Date().toISOString(),
          descricao: meta.descricao || ""
        };

        await db.putPhoto(photo);
        prj.evidencias = prj.evidencias || { fotos: [] };
        prj.evidencias.fotos = prj.evidencias.fotos || [];
        if (!prj.evidencias.fotos.includes(photo.id)) prj.evidencias.fotos.push(photo.id);
      }

      const savedImported = await saveProjectEverywhere(db, prj);

      upsertProjectInMemory(projects, savedImported);
      toast("Projeto importado.");
      await renderList();
    } catch (err) {
      console.error(err);
      toast("Falha ao importar: " + (err.message || err));
    }
  });
}
