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
function emptyFauna(){
  return { id: crypto.randomUUID(), grupo:"aves", metodo:"avistamento", nomePopular:"", nomeCientifico:null, confianca:"media", ameacada:"nao_sei", habitat:"mata", coordenada:{lat:null,lng:null}, evidenciasIds:[] };
}

export async function renderFauna({ appEl, db, toast, projeto, setProjeto }) {
  const list = projeto.campo?.fauna || [];
  appEl.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div>
        <h2 style="margin:0 0 6px">Fauna</h2>
        <div class="small">Registros: <b>${list.length}</b></div>
      </div>
      <div class="row">
        <button id="btnAdd">Adicionar</button>
      </div>
    </div>
    <hr/>
    <div id="list"></div>
    <div id="editor"></div>
  `;

  const listEl = appEl.querySelector("#list");
  const editorEl = appEl.querySelector("#editor");

  const renderList = () => {
    if (!list.length) {
      listEl.innerHTML = `<p class="small">Nenhum registro ainda.</p>`;
      return;
    }
    listEl.innerHTML = `
      <table class="table">
        <thead><tr><th>Espécie</th><th>Grupo</th><th>Método</th><th>Ameaçada</th><th>Evidências</th><th></th></tr></thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td><b>${htmlEsc(r.nomePopular||"-")}</b><div class="small">${htmlEsc(r.nomeCientifico||"")}</div></td>
              <td>${r.grupo}</td>
              <td>${r.metodo}</td>
              <td>${r.ameacada}</td>
              <td>${(r.evidenciasIds||[]).length}</td>
              <td class="row">
                <button class="secondary" data-edit="${r.id}">Editar</button>
                <button class="danger" data-del="${r.id}">Excluir</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  };

  const renderEditor = (item) => {
    editorEl.innerHTML = `
      <hr/>
      <h3 style="margin:0 0 6px">${item.__mode==="edit"?"Editar":"Novo"} registro</h3>
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
            <label>Grupo</label>
            <select id="grupo">
              ${["aves","mamiferos","herpetofauna","outros"].map(v=>`<option value="${v}" ${item.grupo===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Método</label>
            <select id="metodo">
              ${["avistamento","audio","vestigio","camera"].map(v=>`<option value="${v}" ${item.metodo===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Confiança</label>
            <select id="conf">
              ${["alta","media","baixa"].map(v=>`<option value="${v}" ${item.confianca===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="grid grid-3">
          <div>
            <label>Ameaçada?</label>
            <select id="ame">
              ${["sim","nao","nao_sei"].map(v=>`<option value="${v}" ${item.ameacada===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Habitat</label>
            <select id="hab">
              ${["mata","borda","agua","campo","brejo"].map(v=>`<option value="${v}" ${item.habitat===v?"selected":""}>${v}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Coordenada</label>
            <div class="row">
              <input id="lat" placeholder="lat" value="${item.coordenada?.lat ?? ""}"/>
              <input id="lng" placeholder="lng" value="${item.coordenada?.lng ?? ""}"/>
              <button class="secondary" id="gps">GPS</button>
            </div>
          </div>
        </div>

        <div class="row">
          <label class="badge secondary" style="cursor:pointer">
            Anexar evidência (foto)
            <input id="foto" type="file" accept="image/*" capture="environment" hidden />
          </label>
          <span class="badge">Evidências: ${(item.evidenciasIds||[]).length}</span>
        </div>

        <div class="row">
          <button id="btnSave">Salvar</button>
          <button class="secondary" id="btnCancel">Cancelar</button>
        </div>
      </div>
    `;

    editorEl.querySelector("#gps").addEventListener("click", async ()=>{
      try{
        const gps = await getGPS();
        editorEl.querySelector("#lat").value=gps.lat.toFixed(6);
        editorEl.querySelector("#lng").value=gps.lng.toFixed(6);
        toast("GPS capturado.");
      }catch(e){ toast("Falha GPS: "+(e.message||e)); }
    });

    editorEl.querySelector("#foto").addEventListener("change", async (e)=>{
      const f=e.target.files?.[0]; e.target.value="";
      if(!f) return;
      const lat=parseFloat(editorEl.querySelector("#lat").value);
      const lng=parseFloat(editorEl.querySelector("#lng").value);
      const photo=await db.addPhoto({ projectId: projeto.id, categoria:"fauna", blob:f, lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null, descricao:`Fauna: ${item.nomePopular||""}` });
      item.evidenciasIds.push(photo.id);
      projeto.evidencias.fotos.push(photo.id);
      toast("Evidência anexada.");
      renderEditor(item);
    });

    editorEl.querySelector("#btnCancel").addEventListener("click", ()=> editorEl.innerHTML="");

    editorEl.querySelector("#btnSave").addEventListener("click", async ()=>{
      item.nomePopular = editorEl.querySelector("#pop").value.trim();
      item.nomeCientifico = editorEl.querySelector("#sci").value.trim() || null;
      item.grupo = editorEl.querySelector("#grupo").value;
      item.metodo = editorEl.querySelector("#metodo").value;
      item.confianca = editorEl.querySelector("#conf").value;
      item.ameacada = editorEl.querySelector("#ame").value;
      item.habitat = editorEl.querySelector("#hab").value;
      const lat=parseFloat(editorEl.querySelector("#lat").value);
      const lng=parseFloat(editorEl.querySelector("#lng").value);
      item.coordenada = { lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null };
      if(!item.nomePopular) return toast("Informe o nome popular.");

      const idx=list.findIndex(x=>x.id===item.id);
      if(idx>=0) list[idx]=item; else list.unshift(item);

      projeto.campo.fauna = list;
      await setProjeto(projeto);
      toast("Registro salvo.");
      editorEl.innerHTML="";
      renderList();
    });
  };

  renderList();

  appEl.querySelector("#btnAdd").addEventListener("click", ()=>{
    const f=emptyFauna(); f.__mode="new"; renderEditor(f);
  });

  listEl.addEventListener("click",(e)=>{
    const b=e.target.closest("button"); if(!b) return;
    const edit=b.getAttribute("data-edit");
    const del=b.getAttribute("data-del");
    if(edit){ const item=structuredClone(list.find(x=>x.id===edit)); item.__mode="edit"; renderEditor(item); }
    if(del){
      if(!confirm("Excluir registro?")) return;
      const idx=list.findIndex(x=>x.id===del); if(idx>=0) list.splice(idx,1);
      projeto.campo.fauna=list;
      setProjeto(projeto).then(()=>{ toast("Excluído."); renderList(); });
    }
  });
}
