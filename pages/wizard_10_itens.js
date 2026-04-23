import { approxAreaPerimeterHa } from "../lib/rules.js";

function htmlEsc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

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

function parseVertices(text) {
  const pts = [];
  const lines = String(text||"").split(/\n+/).map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    const parts = l.split(/[;, ]+/).filter(Boolean);
    if (parts.length < 2) continue;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
  }
  return pts;
}

function formatVertices(pts) {
  return (pts||[]).map(p => `${p.lat},${p.lng}`).join("\n");
}

export async function renderWizard10({ appEl, db, toast, projeto, baseLegal, setProjeto }) {
  const meta = projeto.meta || {};
  const interv = meta.intervencoesPrevistas || {};
  const vertsText = formatVertices(meta.poligono || []);

  appEl.innerHTML = `
    <h2 style="margin:0 0 6px">10 itens — Dados essenciais</h2>
    <div class="small">Projeto atual: <b>${htmlEsc(projeto.name)}</b></div>
    <hr/>

    <div class="grid grid-2">
      <div>
        <label>UF *</label>
        <input id="uf" maxlength="2" placeholder="SP" value="${htmlEsc(meta.uf)}"/>
      </div>
      <div>
        <label>Município *</label>
        <input id="municipio" placeholder="Indaiatuba" value="${htmlEsc(meta.municipio)}"/>
      </div>
      <div>
        <label>Tipo *</label>
        <select id="tipo">
          <option value="condominio" ${meta.tipoEmpreendimento==="condominio"?"selected":""}>Condomínio</option>
          <option value="loteamento" ${meta.tipoEmpreendimento==="loteamento"?"selected":""}>Loteamento</option>
          <option value="misto" ${meta.tipoEmpreendimento==="misto"?"selected":""}>Misto</option>
        </select>
      </div>
      <div>
        <label>Área (ha) aprox. *</label>
        <input id="areaHa" type="number" step="0.0001" value="${meta.areaHa || 0}"/>
        <div class="small">O app calcula automaticamente a partir do polígono (aproximação).</div>
      </div>
    </div>

    <hr/>

    <h3 style="margin:0 0 6px">Polígono da área (vértices)</h3>
    <div class="small">Digite um vértice por linha: <code>lat,lng</code> (SIRGAS/WGS84). Mínimo 3 pontos.</div>
    <div class="grid">
      <textarea id="verts" placeholder="-22.12345,-47.12345">${htmlEsc(vertsText)}</textarea>
      <div class="row">
        <button class="secondary" id="btnGPS">Adicionar vértice do GPS</button>
        <button class="secondary" id="btnCalc">Calcular área/perímetro</button>
        <span id="calcOut" class="badge">Área: ${meta.areaHa ? meta.areaHa.toFixed(4) : "0"} ha</span>
      </div>
    </div>

    <hr/>

    <h3 style="margin:0 0 6px">Intervenções previstas (documental)</h3>
    <div class="grid grid-3">
      ${[
        ["supressaoVegetal","Supressão vegetal"],
        ["terraplenagem","Terraplenagem (corte/aterro)"],
        ["drenagem","Drenagem (galerias/bacias)"],
        ["travessias","Travessias/obras em drenagens"],
        ["captacaoAgua","Captação de água"],
        ["poco","Poço"],
        ["lancamentoEfluente","Lançamento de efluente"],
        ["intervencaoAPP","Intervenção em APP/área sensível"],
        ["mataAtlanticaProvavel","Mata Atlântica provável"]
      ].map(([k,label]) => `
        <label class="badge" style="justify-content:flex-start;gap:10px">
          <input type="checkbox" id="chk_${k}" ${interv[k] ? "checked":""} />
          <span>${label}</span>
        </label>
      `).join("")}
    </div>

    <hr/>

    <h3 style="margin:0 0 6px">Histórico de uso do terreno</h3>
    <div class="grid grid-2">
      <div>
        <label>Uso anterior (texto livre)</label>
        <textarea id="usoAnterior" placeholder="Ex.: pastagem, agrícola, área abandonada...">${htmlEsc(meta.historicoUso?.usoAnterior || "")}</textarea>
      </div>
      <div>
        <label>Indícios (gatilhos de passivo/CONAMA 420) — selecione se houver</label>
        <div class="grid">
          ${["posto","oficina","industria","descarte","mancha","odor"].map(v => `
            <label class="badge" style="justify-content:flex-start;gap:10px">
              <input type="checkbox" class="indicio" value="${v}" ${(meta.historicoUso?.indicios || []).map(x=>String(x).toLowerCase()).includes(v)?"checked":""}/>
              <span>${v}</span>
            </label>
          `).join("")}
        </div>
      </div>
    </div>

    <hr/>

    <h3 style="margin:0 0 6px">Imagens (satelite/planta)</h3>
    <div class="small">Opcional no MVP: as imagens podem ser anexadas como evidências (não são analisadas automaticamente).</div>
    <div class="row" style="margin-top:8px">
      <label class="badge secondary" style="cursor:pointer">
        Anexar Satélite Atual
        <input id="satAtual" type="file" accept="image/*" hidden />
      </label>
      <label class="badge secondary" style="cursor:pointer">
        Anexar Satélite Antiga
        <input id="satAntiga" type="file" accept="image/*" hidden />
      </label>
      <label class="badge secondary" style="cursor:pointer">
        Anexar Planta (PDF/Imagem)
        <input id="planta" type="file" accept="image/*,application/pdf" hidden />
      </label>
    </div>
    <div id="imgInfo" class="small" style="margin-top:8px"></div>

    <hr/>

    <div class="row">
      <button id="btnSave">Salvar</button>
      <button class="secondary" id="btnNext">Ir para Conformidade</button>
    </div>

    <div class="small" style="margin-top:10px">
      Referências base do diagnóstico/licenciamento (automáticas no laudo): CONAMA 237/1997, CONAMA 01/1986, Lei 12.651/2012, etc. (ver seção â€œLaudoâ€).
    </div>
  `;

  const vertsEl = appEl.querySelector("#verts");
  const calcOut = appEl.querySelector("#calcOut");
  const imgInfo = appEl.querySelector("#imgInfo");

  function refreshImgInfo() {
    const sA = meta.sateliteAtual?.fileId ? "OK" : "—";
    const sB = meta.sateliteAntiga?.fileId ? "OK" : "—";
    const pl = (meta.plantaUploads || []).length ? `${meta.plantaUploads.length} arquivo(s)` : "—";
    imgInfo.innerHTML = `
      <div class="kv">
        <div>Satélite atual</div><div>${sA}</div>
        <div>Satélite antiga</div><div>${sB}</div>
        <div>Planta</div><div>${pl}</div>
      </div>
    `;
  }
  refreshImgInfo();

  async function handleUpload(file, categoria, setToMetaFn) {
    if (!file) return;
    // PDFs: guardar como "evidência" sem gps
    const blob = file;
    const photo = await db.addPhoto({
      projectId: projeto.id,
      categoria,
      blob,
      lat: null,
      lng: null,
      timestamp: new Date().toISOString(),
      descricao: file.name
    });
    projeto.evidencias.fotos = projeto.evidencias.fotos || [];
    if (!projeto.evidencias.fotos.includes(photo.id)) projeto.evidencias.fotos.push(photo.id);
    setToMetaFn(photo.id);
    await setProjeto(projeto);
    toast("Anexo salvo como evidência.");
    refreshImgInfo();
  }

  appEl.querySelector("#btnGPS").addEventListener("click", async () => {
    try {
      const gps = await getGPS();
      const pts = parseVertices(vertsEl.value);
      pts.push(gps);
      vertsEl.value = formatVertices(pts);
      toast("Vértice adicionado.");
    } catch (e) {
      toast("Falha GPS: " + (e.message || e));
    }
  });

  appEl.querySelector("#btnCalc").addEventListener("click", () => {
    const pts = parseVertices(vertsEl.value);
    const { areaHa, perimeterM } = approxAreaPerimeterHa(pts);
    calcOut.textContent = `Área: ${areaHa.toFixed(4)} ha â€¢ Perímetro: ${perimeterM.toFixed(1)} m`;
    appEl.querySelector("#areaHa").value = areaHa.toFixed(4);
  });

  // uploads
  appEl.querySelector("#satAtual").addEventListener("change", async (e) => {
    await handleUpload(e.target.files?.[0], "impacto", (id)=>{ meta.sateliteAtual = { fileId: id, data: new Date().toISOString().slice(0,10) }; });
  });
  appEl.querySelector("#satAntiga").addEventListener("change", async (e) => {
    await handleUpload(e.target.files?.[0], "impacto", (id)=>{ meta.sateliteAntiga = { fileId: id, data: new Date().toISOString().slice(0,10) }; });
  });
  appEl.querySelector("#planta").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleUpload(f, "impacto", (id)=>{ meta.plantaUploads = meta.plantaUploads || []; meta.plantaUploads.push({ fileId: id, name: f.name }); });
  });

  appEl.querySelector("#btnSave").addEventListener("click", async () => {
    meta.uf = appEl.querySelector("#uf").value.trim().toUpperCase();
    meta.municipio = appEl.querySelector("#municipio").value.trim();
    meta.tipoEmpreendimento = appEl.querySelector("#tipo").value;
    meta.areaHa = parseFloat(appEl.querySelector("#areaHa").value) || 0;

    const pts = parseVertices(vertsEl.value);
    meta.poligono = pts;

    // interventions
    meta.intervencoesPrevistas = meta.intervencoesPrevistas || {};
    for (const k of Object.keys(meta.intervencoesPrevistas)) {
      const el = appEl.querySelector(`#chk_${k}`);
      if (el) meta.intervencoesPrevistas[k] = !!el.checked;
    }

    meta.historicoUso = meta.historicoUso || { usoAnterior:"", indicios:[] };
    meta.historicoUso.usoAnterior = appEl.querySelector("#usoAnterior").value.trim();
    meta.historicoUso.indicios = Array.from(appEl.querySelectorAll(".indicio")).filter(x=>x.checked).map(x=>x.value);

    // auto calc if possible
    if (pts.length >= 3) {
      const { areaHa } = approxAreaPerimeterHa(pts);
      if (areaHa > 0) meta.areaHa = areaHa;
    }

    projeto.meta = meta;
    await setProjeto(projeto);

    // validations
    if (!meta.uf || !meta.municipio || pts.length < 3 || !(meta.areaHa > 0)) {
      toast("Salvo, mas faltam campos essenciais (UF, Município, Polígono, Área).");
    } else {
      toast("Dados essenciais salvos.");
    }
  });

  appEl.querySelector("#btnNext").addEventListener("click", () => {
    location.hash = "#/conformidade";
  });
}
