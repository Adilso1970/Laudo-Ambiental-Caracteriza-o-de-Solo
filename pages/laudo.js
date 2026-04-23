import { createZipStore, downloadBlob, safeFilename, blobToUint8 } from "../lib/export_zip.js";
import { buildObrigacoes, computeCompleteness } from "../lib/rules.js";

async function toJpegBytesSafe(blob) {
  // Export do pacote não pode falhar por causa de 1 imagem.
  // Tenta converter para JPEG; se não der, exporta o blob original.
  try {
    const src = await (async () => {
      try { return await createImageBitmap(blob); }
      catch {
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
          if (img.decode) await img.decode();
          else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          return img;
        } finally { URL.revokeObjectURL(url); }
      }
    })();

    const maxDim = 1600;
    const w0 = src.width, h0 = src.height;
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(src, 0, 0, w, h);
    const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!jpegBlob) throw new Error("Falha ao converter");
    return await blobToUint8(jpegBlob);
  } catch (e) {
    console.warn("Export: imagem não convertida, usando blob original.", e);
    return await blobToUint8(blob);
  }
}

export async function renderLaudo({ appEl, db, toast, projeto, baseLegal, setProjeto, syncBaseLegalOnline }) {
  const photos = await db.listPhotosByProject(projeto.id);
  const score = computeCompleteness(projeto);
  const obrigacoes = buildObrigacoes(projeto);

  const meta = projeto.meta || {};

  appEl.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div>
        <h2 style="margin:0 0 6px">Laudo</h2>
        <div class="row">
          <span class="badge ${score>=85?"ok":score>=60?"warn":"danger"}">Completude: ${score}/100</span>
          <span class="badge">Fotos: ${photos.length}</span>
          <span class="badge">Obrigações: ${obrigacoes.length}</span>
        </div>
      </div>
      <div class="row">
        <button id="btnPDF">Gerar PDF</button>
        <button id="btnDOCX">Gerar DOCX</button>
        <button class="secondary" id="btnExport">Exportar pacote</button>
      </div>
    </div>

    <hr/>

    <div class="kv">
      <div>Projeto</div><div><b>${projeto.name}</b></div>
      <div>Município/UF</div><div>${meta.municipio || "-"} / ${meta.uf || "-"}</div>
      <div>Tipo</div><div>${meta.tipoEmpreendimento || "-"}</div>
      <div>Área (ha) aprox.</div><div>${meta.areaHa ? meta.areaHa.toFixed(4) : "0"}</div>
      <div>Base legal (local)</div><div>${baseLegal.version || "-"}</div>
    </div>

    <hr/>

    <div class="row">
      <button class="secondary" id="btnSync">Sincronizar base legal (online)</button>
      <span class="small">No MVP, a sincronização apenas consulta a Function; a base local é a referência offline.</span>
    </div>

    <hr/>

    <h3 style="margin:0 0 6px">Regras de bloqueio</h3>
    <div class="small">
      O app permite gerar laudo a qualquer momento, mas recomenda fortemente completar: UF, Município, Polígono (≥ 3 vértices), Área > 0 e pelo menos 10 fotos.
      <br/>No PDF, as fotos são embutidas por categoria e ordenadas por data/hora (com índice cronológico).

    <hr/>

    <h3 style="margin:0 0 6px">Revisão final (checklist)</h3>
    <div id="revBox" class="card" style="padding:12px;background:#f7fbf8;border:1px solid #dbeee0">
      <div class="small" style="margin-bottom:8px">O app aponta pendências para evitar laudo incompleto.</div>
      <div id="revList" class="small"></div>
    </div>
    </div>
  `;

  // Checklist automático
  const issues = [];
  const pol = meta.poligono || [];
  if (!meta.uf) issues.push("• UF não informada.");
  if (!meta.municipio) issues.push("• Município não informado.");
  if (!meta.tipoEmpreendimento) issues.push("• Tipo do empreendimento não informado.");
  if (!meta.areaHa || meta.areaHa <= 0) issues.push("• Área (ha) não calculada ou = 0.");
  if (!Array.isArray(pol) || pol.length < 3) issues.push("• Polígono com menos de 3 vértices.");
  if ((photos||[]).length < 10) issues.push(`• Menos de 10 fotos (${(photos||[]).length}).`);

  // Conformidade
  const aplicaveis = obrigacoes.filter(o => o.aplicavel !== false && (o.status||"pendente") !== "nao_aplica");
  const pendentes = aplicaveis.filter(o => (o.status||"pendente")==="pendente");
  const semEvid = aplicaveis.filter(o => !(o.evidenciasIds||[]).filter(Boolean).length);

  if (pendentes.length) issues.push(`• Obrigações pendentes: ${pendentes.length}.`);
  if (semEvid.length) issues.push(`• Obrigações sem evidências vinculadas: ${semEvid.length}.`);

  // Evidências
  const semGPS = (photos||[]).filter(p => p.lat==null || p.lng==null);
  const semDesc = (photos||[]).filter(p => !(p.descricao||"").trim());
  if (semGPS.length) issues.push(`• Fotos sem GPS: ${semGPS.length}.`);
  if (semDesc.length) issues.push(`• Fotos sem descrição: ${semDesc.length}.`);

  const revListEl = appEl.querySelector("#revList");
  if (revListEl) {
    revListEl.innerHTML = issues.length
      ? `<ul style="margin:0;padding-left:18px">${issues.map(i=>`<li>${i}</li>`).join("")}</ul>`
      : `<span class="badge ok">Tudo pronto para gerar laudo.</span>`;
  }

  appEl.querySelector("#btnSync").addEventListener("click", async ()=>{
    try{
      const online = await syncBaseLegalOnline();
      toast("Base legal online disponível: " + (online.version || "sem versão"));
    }catch(e){
      toast("Sem conexão ou Function indisponível: " + (e.message || e));
    }
  });

  appEl.querySelector("#btnPDF").addEventListener("click", async ()=>{
    try{
      // Atualiza obrigações antes
      projeto.conformidade.obrigacoes = obrigacoes;
      await setProjeto(projeto);
      const pdfMod = await import(`../lib/report_pdf.js?v=${Date.now()}`);
      await pdfMod.downloadPdfLaudo({ projeto, baseLegal, photos });
      toast("PDF gerado.");
    }catch(e){ console.error(e); toast("Falha PDF: " + (e.message || e)); }
  });

  appEl.querySelector("#btnDOCX").addEventListener("click", async ()=>{
    try{
      projeto.conformidade.obrigacoes = obrigacoes;
      await setProjeto(projeto);
      const docxMod = await import(`../lib/report_docx.js?v=${Date.now()}`);
      await docxMod.downloadDocxLaudo({ projeto, baseLegal, photos });
      toast("DOCX gerado.");
    }catch(e){ console.error(e); toast("Falha DOCX: " + (e.message || e)); }
  });

  appEl.querySelector("#btnExport").addEventListener("click", async ()=>{
    try{
      const prjClone = structuredClone(projeto);
      const exportMeta = photos.map(ph => ({
        id: ph.id,
        categoria: ph.categoria,
        lat: ph.lat,
        lng: ph.lng,
        timestamp: ph.timestamp,
        descricao: ph.descricao,
        filename: `photos/${ph.id}.jpg`
      }));
      prjClone._export = { photos: exportMeta, exportedAt: new Date().toISOString() };

      const entries = [];
      entries.push({ name: "project.json", data: new TextEncoder().encode(JSON.stringify(prjClone, null, 2)) });

      for (const ph of photos) {
        const bytes = await toJpegBytesSafe(ph.blob);
        entries.push({ name: `photos/${ph.id}.jpg`, data: bytes });
      }

      const zip = await createZipStore(entries);
      downloadBlob(zip, `${safeFilename(projeto.name)}_PACOTE_PROJETO.zip`);
      toast("Pacote exportado.");
    }catch(e){ console.error(e); toast("Falha export: " + (e.message || e)); }
  });
}

