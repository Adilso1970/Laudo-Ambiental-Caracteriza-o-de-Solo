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
function emptySolo(){
  return { id: crypto.randomUUID(), tipo:"erosao", severidade:"media", coordenada:{lat:null,lng:null}, descricao:"", fotosIds:[] };
}

export async function renderSolo({ appEl, db, toast, projeto, setProjeto }) {
  const list = projeto.campo?.soloProcessos || [];
  appEl.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div>
        <h2 style="margin:0 0 6px">Solo / Processos</h2>
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
        <thead><tr><th>Tipo</th><th>Severidade</th><th>Coord.</th><th>Fotos</th><th></th></tr></thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td>${r.tipo}</td>
              <td>${r.severidade}</td>
              <td>${r.coordenada?.lat ? `${r.coordenada.lat.toFixed(6)}, ${r.coordenada.lng.toFixed(6)}` : "-"}</td>
              <td>${(r.fotosIds||[]).length}</td>
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
      <div class="grid grid-2">
        <div>
          <label>Tipo</label>
          <select id="tipo">
            ${["erosao","assoreamento","alagamento","declividade","aterro","outro"].map(v=>`<option value="${v}" ${item.tipo===v?"selected":""}>${v}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Severidade</label>
          <select id="sev">
            ${["baixa","media","alta"].map(v=>`<option value="${v}" ${item.severidade===v?"selected":""}>${v}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Coordenada (Lat,Lng)</label>
          <div class="row">
            <input id="lat" placeholder="lat" value="${item.coordenada?.lat ?? ""}"/>
            <input id="lng" placeholder="lng" value="${item.coordenada?.lng ?? ""}"/>
            <button class="secondary" id="gps">GPS</button>
          </div>
        </div>
        <div>
          <label>Fotos</label>
          <div class="row">
            <label class="badge secondary" style="cursor:pointer">
              Anexar foto
              <input id="foto" type="file" accept="image/*" capture="environment" hidden />
            </label>
            <span class="badge">${(item.fotosIds||[]).length}</span>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-top:10px">
        <label>Descrição</label>
        <textarea id="desc" placeholder="Descreva o processo observado...">${htmlEsc(item.descricao)}</textarea>
      </div>

      <div class="row" style="margin-top:10px">
        <button id="save">Salvar</button>
        <button class="secondary" id="cancel">Cancelar</button>
      </div>
    `;

    editorEl.querySelector("#gps").addEventListener("click", async ()=>{
      try{
        const gps=await getGPS();
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
      const photo=await db.addPhoto({ projectId: projeto.id, categoria:"solo", blob:f, lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null, descricao:`Solo: ${item.tipo}` });
      item.fotosIds.push(photo.id);
      projeto.evidencias.fotos.push(photo.id);
      toast("Foto anexada.");
      renderEditor(item);
    });

    editorEl.querySelector("#cancel").addEventListener("click", ()=> editorEl.innerHTML="");

    editorEl.querySelector("#save").addEventListener("click", async ()=>{
      item.tipo = editorEl.querySelector("#tipo").value;
      item.severidade = editorEl.querySelector("#sev").value;
      const lat=parseFloat(editorEl.querySelector("#lat").value);
      const lng=parseFloat(editorEl.querySelector("#lng").value);
      item.coordenada = { lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null };
      item.descricao = editorEl.querySelector("#desc").value.trim();

      const idx=list.findIndex(x=>x.id===item.id);
      if(idx>=0) list[idx]=item; else list.unshift(item);

      projeto.campo.soloProcessos=list;
      await setProjeto(projeto);
      toast("Registro salvo.");
      editorEl.innerHTML="";
      renderList();
    });
  };

  renderList();

  appEl.querySelector("#btnAdd").addEventListener("click", ()=>{
    const s=emptySolo(); s.__mode="new"; renderEditor(s);
  });

  listEl.addEventListener("click",(e)=>{
    const b=e.target.closest("button"); if(!b) return;
    const edit=b.getAttribute("data-edit");
    const del=b.getAttribute("data-del");
    if(edit){ const item=structuredClone(list.find(x=>x.id===edit)); item.__mode="edit"; renderEditor(item); }
    if(del){
      if(!confirm("Excluir registro?")) return;
      const idx=list.findIndex(x=>x.id===del); if(idx>=0) list.splice(idx,1);
      projeto.campo.soloProcessos=list;
      setProjeto(projeto).then(()=>{ toast("Excluído."); renderList(); });
    }
  });
}
