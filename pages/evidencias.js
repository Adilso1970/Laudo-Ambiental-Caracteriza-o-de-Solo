async function getGPS() {
  return await new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalização não suportada."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// --- Normalização de imagens: salva SEMPRE como JPEG para não quebrar DOCX/PDF e reduzir tamanho.
// Observação: se o navegador não conseguir decodificar o arquivo (ex.: HEIC em alguns PCs),
// informamos o usuário para converter para JPG/PNG antes.
const MAX_IMG_DIM = 2200; // px (limite de dimensão maior)
const JPEG_QUALITY = 0.86;

async function decodeImageSource(blob) {
  try {
    return await createImageBitmap(blob);
  } catch (e) {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      if (img.decode) await img.decode();
      else {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(new Error("The source image could not be decoded."));
        });
      }
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function toJpegBlob(blob) {
  const src = await decodeImageSource(blob);
  const srcW = src.width;
  const srcH = src.height;

  const scale = Math.min(1, MAX_IMG_DIM / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(src, 0, 0, outW, outH);

  const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!jpegBlob) throw new Error("Falha ao converter imagem para JPEG.");
  return jpegBlob;
}

function htmlEsc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

export async function renderEvidencias({ appEl, db, toast, projeto, setProjeto }) {
  const photos = await db.listPhotosByProject(projeto.id);
  const counts = photos.reduce((m,p)=>{m[p.categoria]=(m[p.categoria]||0)+1; return m;},{});


  // Mapa reverso: evidência -> obrigações (códigos) onde foi vinculada
  const usedBy = new Map();
  const obs = (projeto.conformidade?.obrigacoes || []);
  obs.forEach((o, idx) => {
    const cod = o.codigo || `QA-OBR-${String(idx+1).padStart(3,"0")}`;
    (o.evidenciasIds || []).filter(Boolean).forEach((eid) => {
      if (!usedBy.has(eid)) usedBy.set(eid, []);
      usedBy.get(eid).push(cod);
    });
  });
  appEl.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div>
        <h2 style="margin:0 0 6px">Evidências</h2>
        <div class="small">Total: <b>${photos.length}</b></div>
      </div>
      <div class="row">
        <select id="cat">
          ${["agua","flora","fauna","solo","app","impacto","borda"].map(v=>`<option value="${v}">${v}</option>`).join("")}
        </select>
        <label class="badge secondary" style="cursor:pointer">
          Anexar foto
          <input id="file" type="file" accept="image/*" capture="environment" hidden />
        </label>
        <button class="secondary" id="gps">GPS</button>
      </div>
    </div>

    <div class="row" style="margin-top:8px">
      ${Object.keys(counts).sort().map(k=>`<span class="badge">${k}: ${counts[k]}</span>`).join("")}
    </div>

    <hr/>
    <div id="grid" class="grid grid-3"></div>
  `;

  let lastGPS = { lat: null, lng: null };
  appEl.querySelector("#gps").addEventListener("click", async ()=>{
    try{
      lastGPS = await getGPS();
      toast(`GPS: ${lastGPS.lat.toFixed(6)}, ${lastGPS.lng.toFixed(6)}`);
    }catch(e){ toast("Falha GPS: "+(e.message||e)); }
  });

  appEl.querySelector("#file").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0]; e.target.value="";
    if(!f) return;
    const categoria = appEl.querySelector("#cat").value;
    const desc = prompt("Descrição (opcional):") || "";

    let blobToSave = f;
    try {
      blobToSave = await toJpegBlob(f);
    } catch (err) {
      console.error(err);
      const msg = (err && err.message) ? err.message : String(err);
      toast("Falha ao processar imagem. Se for HEIC, converta para JPG/PNG. Detalhe: " + msg);
      return;
    }

    const photo = await db.addPhoto({
      projectId: projeto.id,
      categoria,
      blob: blobToSave,
      lat: lastGPS.lat,
      lng: lastGPS.lng,
      descricao: desc
    });
    projeto.evidencias.fotos = projeto.evidencias.fotos || [];
    projeto.evidencias.fotos.push(photo.id);
    await setProjeto(projeto);
    toast("Foto adicionada.");
    renderEvidencias({ appEl, db, toast, projeto, setProjeto }); // refresh
  });

  const gridEl = appEl.querySelector("#grid");

  gridEl.innerHTML = photos.map(p => {
    const url = URL.createObjectURL(p.blob);
    const coord = (p.lat!=null && p.lng!=null) ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "-";
    const used = (usedBy.get(p.id) || []);
    const usedHtml = used.length ? `<div class="small">Vinculada a: <b>${used.join(", ")}</b></div>` : "";
    return `
      <div class="card" style="padding:10px">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span class="badge">${p.categoria}</span>
          <button class="danger" data-del="${p.id}" title="Excluir">X</button>
        </div>
        <img src="${url}" style="width:100%;border-radius:12px;margin-top:8px" />
        <div class="small" style="margin-top:8px">${htmlEsc(p.descricao||"")}</div>
        <div class="small">GPS: ${coord}</div>
        ${usedHtml}
        <div class="small">Capturado em: ${((p.capturedAt||p.timestamp)||"").replace("T"," ").slice(0,19)}</div>
      </div>
    `;
  }).join("");

  gridEl.addEventListener("click", async (e)=>{
    const delId = e.target.closest("button")?.getAttribute("data-del");
    if(!delId) return;
    if(!confirm("Excluir esta evidência?")) return;
    await db.deletePhoto(delId);
    projeto.evidencias.fotos = (projeto.evidencias.fotos||[]).filter(id=>id!==delId);
    // also remove from any records that reference it (best effort)
    (projeto.campo?.agua||[]).forEach(a => a.fotosIds = (a.fotosIds||[]).filter(id=>id!==delId));
    (projeto.campo?.flora?.fragmentos||[]).forEach(f => f.fotosIds = (f.fotosIds||[]).filter(id=>id!==delId));
    (projeto.campo?.flora?.especies||[]).forEach(s => s.fotosIds = (s.fotosIds||[]).filter(id=>id!==delId));
    (projeto.campo?.fauna||[]).forEach(f => f.evidenciasIds = (f.evidenciasIds||[]).filter(id=>id!==delId));
    (projeto.campo?.soloProcessos||[]).forEach(s => s.fotosIds = (s.fotosIds||[]).filter(id=>id!==delId));
    await setProjeto(projeto);
    toast("Evidência excluída.");
    renderEvidencias({ appEl, db, toast, projeto, setProjeto });
  });
}
