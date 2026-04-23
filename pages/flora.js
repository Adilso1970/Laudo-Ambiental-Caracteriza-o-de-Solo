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
function htmlEsc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
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
function formatVertices(pts){return (pts||[]).map(p=>`${p.lat},${p.lng}`).join("\n");}

function emptyFragmento(){
  return { id: crypto.randomUUID(), classe:"capoeira", poligono:[], estadoConservacao:"medio", pressoes:[], fotosIds:[] };
}
function emptyEspecie(){
  return { id: crypto.randomUUID(), grupo:"flora", nomePopular:"", nomeCientifico:null, confianca:"media", nativa:"nao_sei", ameacada:"nao_sei", evidencia:"observacao", coordenada:{lat:null,lng:null}, fotosIds:[] };
}

export async function renderFlora({ appEl, db, toast, projeto, setProjeto }) {
  projeto.campo.flora = projeto.campo.flora || { fragmentos:[], especies:[] };
  const fragmentos = projeto.campo.flora.fragmentos || [];
  const especies = projeto.campo.flora.especies || [];

  appEl.innerHTML = `
    <h2 style="margin:0 0 6px">Flora</h2>
    <div class="row">
      <span class="badge">Fragmentos: ${fragmentos.length}</span>
      <span class="badge">Espécies: ${especies.length}</span>
    </div>
    <hr/>

    <div class="grid grid-2">
      <section>
        <div class="row" style="justify-content:space-between">
          <h3 style="margin:0">Fragmentos / Cobertura</h3>
          <button id="btnAddFrag">Adicionar</button>
        </div>
        <div id="fragList" style="margin-top:8px"></div>
        <div id="fragEditor"></div>
      </section>

      <section>
        <div class="row" style="justify-content:space-between">
          <h3 style="margin:0">Espécies</h3>
          <button id="btnAddEsp">Adicionar</button>
        </div>
        <div id="espList" style="margin-top:8px"></div>
        <div id="espEditor"></div>
      </section>
    </div>
  `;

  const fragListEl = appEl.querySelector("#fragList");
  const fragEditorEl = appEl.querySelector("#fragEditor");
  const espListEl = appEl.querySelector("#espList");
  const espEditorEl = appEl.querySelector("#espEditor");

  const renderFragList = () => {
    if (!fragmentos.length) {
      fragListEl.innerHTML = `<p class="small">Nenhum fragmento cadastrado.</p>`;
      return;
    }
    fragListEl.innerHTML = `
      <table class="table">
        <thead><tr><th>ID</th><th>Classe</th><th>Conservação</th><th>Fotos</th><th></th></tr></thead>
        <tbody>
          ${fragmentos.map(f => `
            <tr>
              <td><code>${f.id.slice(0,8)}</code></td>
              <td>${f.classe}</td>
              <td>${f.estadoConservacao}</td>
              <td>${(f.fotosIds||[]).length}</td>
              <td class="row">
                <button class="secondary" data-editfrag="${f.id}">Editar</button>
                <button class="danger" data-delfrag="${f.id}">Excluir</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  };

  const renderEspList = () => {
    if (!especies.length) {
      espListEl.innerHTML = `<p class="small">Nenhuma espécie cadastrada.</p>`;
      return;
    }
    espListEl.innerHTML = `
      <table class="table">
        <thead><tr><th>Espécie</th><th>Nativa</th><th>Ameaçada</th><th>Fotos</th><th></th></tr></thead>
        <tbody>
          ${especies.map(s => `
            <tr>
              <td><b>${htmlEsc(s.nomePopular||"-")}</b><div class="small">${htmlEsc(s.nomeCientifico||"")}</div></td>
              <td>${s.nativa}</td>
              <td>${s.ameacada}</td>
              <td>${(s.fotosIds||[]).length}</td>
              <td class="row">
                <button class="secondary" data-editesp="${s.id}">Editar</button>
                <button class="danger" data-delesp="${s.id}">Excluir</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  };

  const renderFragEditor = (item) => {
    fragEditorEl.innerHTML = `
      <hr/>
      <h4 style="margin:0 0 6px">${item.__mode==="edit"?"Editar":"Novo"} fragmento</h4>
      <div class="grid">
        <label>Classe</label>
        <select id="classe">
          ${["aberto","capoeira","mata","riparia","brejo","exoticas"].map(v => `<option value="${v}" ${item.classe===v?"selected":""}>${v}</option>`).join("")}
        </select>

        <label>Estado de conservação</label>
        <select id="cons">
          ${["bom","medio","ruim"].map(v => `<option value="${v}" ${item.estadoConservacao===v?"selected":""}>${v}</option>`).join("")}
        </select>

        <label>Pressões</label>
        <div class="grid grid-3">
          ${["fogo","pastoreio","lixo","corte","invasoras"].map(v => `
            <label class="badge" style="justify-content:flex-start;gap:10px">
              <input type="checkbox" class="press" value="${v}" ${item.pressoes.includes(v)?"checked":""}/>
              <span>${v}</span>
            </label>
          `).join("")}
        </div>

        <label>Polígono (vértices) — opcional</label>
        <textarea id="poly" placeholder="lat,lng por linha">${htmlEsc(formatVertices(item.poligono||[]))}</textarea>

        <div class="row">
          <label class="badge secondary" style="cursor:pointer">
            Anexar foto
            <input id="fotoFrag" type="file" accept="image/*" capture="environment" hidden />
          </label>
          <span class="badge">Fotos: ${(item.fotosIds||[]).length}</span>
        </div>

        <div class="row">
          <button id="saveFrag">Salvar</button>
          <button class="secondary" id="cancelFrag">Cancelar</button>
        </div>
      </div>
    `;

    fragEditorEl.querySelector("#fotoFrag").addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; e.target.value="";
      if (!f) return;
      const photo = await db.addPhoto({ projectId: projeto.id, categoria:"flora", blob:f, lat:null, lng:null, descricao:`Fragmento (${item.classe})` });
      item.fotosIds.push(photo.id);
      projeto.evidencias.fotos.push(photo.id);
      toast("Foto anexada.");
      renderFragEditor(item);
    });

    fragEditorEl.querySelector("#cancelFrag").addEventListener("click", ()=> fragEditorEl.innerHTML="");

    fragEditorEl.querySelector("#saveFrag").addEventListener("click", async () => {
      item.classe = fragEditorEl.querySelector("#classe").value;
      item.estadoConservacao = fragEditorEl.querySelector("#cons").value;
      item.pressoes = Array.from(fragEditorEl.querySelectorAll(".press")).filter(x=>x.checked).map(x=>x.value);
      item.poligono = parseVertices(fragEditorEl.querySelector("#poly").value);

      const idx = fragmentos.findIndex(x=>x.id===item.id);
      if (idx>=0) fragmentos[idx]=item; else fragmentos.unshift(item);

      projeto.campo.flora.fragmentos = fragmentos;
      await setProjeto(projeto);
      toast("Fragmento salvo.");
      fragEditorEl.innerHTML="";
      renderFragList();
    });
  };

  const renderEspEditor = (item) => {
    espEditorEl.innerHTML = `
      <hr/>
      <h4 style="margin:0 0 6px">${item.__mode==="edit"?"Editar":"Nova"} espécie</h4>
      <div class="grid">
        <div class="grid grid-2">
          <div>
            <label>Nome popular *</label>
            <input id="pop" value="${htmlEsc(item.nomePopular)}"/>
          </div>
          <div>
            <label>Nome científico</label>
            <input id="sci" value="${htmlEsc(item.nomeCientifico||"")}"/>
          </div>
        </div>

        <div class="grid grid-3">
          <div>
            <label>Confiança</label>
            <select id="conf">
              ${["alta","media","baixa"].map(v=>`<option value="${v}" ${item.confianca===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Nativa/Exótica</label>
            <select id="nat">
              ${["nativa","exotica","nao_sei"].map(v=>`<option value="${v}" ${item.nativa===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Ameaçada?</label>
            <select id="ame">
              ${["sim","nao","nao_sei"].map(v=>`<option value="${v}" ${item.ameacada===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="grid grid-2">
          <div>
            <label>Coordenada (Lat)</label>
            <input id="lat" value="${item.coordenada?.lat ?? ""}"/>
          </div>
          <div>
            <label>Coordenada (Lng)</label>
            <div class="row">
              <input id="lng" value="${item.coordenada?.lng ?? ""}"/>
              <button class="secondary" id="gpsEsp">GPS</button>
            </div>
          </div>
        </div>

        <div class="row">
          <label class="badge secondary" style="cursor:pointer">
            Anexar foto
            <input id="fotoEsp" type="file" accept="image/*" capture="environment" hidden />
          </label>
          <span class="badge">Fotos: ${(item.fotosIds||[]).length}</span>
        </div>

        <div class="row">
          <button id="saveEsp">Salvar</button>
          <button class="secondary" id="cancelEsp">Cancelar</button>
        </div>
      </div>
    `;

    espEditorEl.querySelector("#gpsEsp").addEventListener("click", async ()=>{
      try{
        const gps=await getGPS();
        espEditorEl.querySelector("#lat").value=gps.lat.toFixed(6);
        espEditorEl.querySelector("#lng").value=gps.lng.toFixed(6);
        toast("GPS capturado.");
      }catch(e){ toast("Falha GPS: "+(e.message||e)); }
    });

    espEditorEl.querySelector("#fotoEsp").addEventListener("change", async (e)=>{
      const f=e.target.files?.[0]; e.target.value="";
      if(!f) return;
      const lat=parseFloat(espEditorEl.querySelector("#lat").value);
      const lng=parseFloat(espEditorEl.querySelector("#lng").value);
      const photo=await db.addPhoto({ projectId: projeto.id, categoria:"flora", blob:f, lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null, descricao:`Flora: ${item.nomePopular||""}`});
      item.fotosIds.push(photo.id);
      projeto.evidencias.fotos.push(photo.id);
      toast("Foto anexada.");
      renderEspEditor(item);
    });

    espEditorEl.querySelector("#cancelEsp").addEventListener("click", ()=> espEditorEl.innerHTML="");

    espEditorEl.querySelector("#saveEsp").addEventListener("click", async ()=>{
      item.nomePopular = espEditorEl.querySelector("#pop").value.trim();
      item.nomeCientifico = espEditorEl.querySelector("#sci").value.trim() || null;
      item.confianca = espEditorEl.querySelector("#conf").value;
      item.nativa = espEditorEl.querySelector("#nat").value;
      item.ameacada = espEditorEl.querySelector("#ame").value;
      const lat=parseFloat(espEditorEl.querySelector("#lat").value);
      const lng=parseFloat(espEditorEl.querySelector("#lng").value);
      item.coordenada = { lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null };

      if (!item.nomePopular) return toast("Informe ao menos o nome popular.");
      const idx=especies.findIndex(x=>x.id===item.id);
      if(idx>=0) especies[idx]=item; else especies.unshift(item);

      projeto.campo.flora.especies = especies;
      await setProjeto(projeto);
      toast("Espécie salva.");
      espEditorEl.innerHTML="";
      renderEspList();
    });
  };

  renderFragList();
  renderEspList();

  appEl.querySelector("#btnAddFrag").addEventListener("click", ()=>{ const f=emptyFragmento(); f.__mode="new"; renderFragEditor(f); });
  appEl.querySelector("#btnAddEsp").addEventListener("click", ()=>{ const s=emptyEspecie(); s.__mode="new"; renderEspEditor(s); });

  fragListEl.addEventListener("click", (e)=>{
    const b=e.target.closest("button"); if(!b) return;
    const edit=b.getAttribute("data-editfrag"); const del=b.getAttribute("data-delfrag");
    if(edit){ const item=structuredClone(fragmentos.find(x=>x.id===edit)); item.__mode="edit"; renderFragEditor(item); }
    if(del){
      if(!confirm("Excluir fragmento?")) return;
      const idx=fragmentos.findIndex(x=>x.id===del); if(idx>=0) fragmentos.splice(idx,1);
      projeto.campo.flora.fragmentos=fragmentos;
      setProjeto(projeto).then(()=>{ toast("Fragmento excluído."); renderFragList(); });
    }
  });

  espListEl.addEventListener("click", (e)=>{
    const b=e.target.closest("button"); if(!b) return;
    const edit=b.getAttribute("data-editesp"); const del=b.getAttribute("data-delesp");
    if(edit){ const item=structuredClone(especies.find(x=>x.id===edit)); item.__mode="edit"; renderEspEditor(item); }
    if(del){
      if(!confirm("Excluir espécie?")) return;
      const idx=especies.findIndex(x=>x.id===del); if(idx>=0) especies.splice(idx,1);
      projeto.campo.flora.especies=especies;
      setProjeto(projeto).then(()=>{ toast("Espécie excluída."); renderEspList(); });
    }
  });
}
