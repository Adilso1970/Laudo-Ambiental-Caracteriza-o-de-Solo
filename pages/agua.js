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

function emptyAgua() {
  return {
    id: crypto.randomUUID(),
    tipo: "corrego",
    regime: "nao_sei",
    largura_m: null,
    coordenada: { lat: null, lng: null },
    observacoes: "",
    fotosIds: []
  };
}

export async function renderAgua({ appEl, db, toast, projeto, setProjeto }) {
  const list = projeto.campo?.agua || [];
  appEl.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div>
        <h2 style="margin:0 0 6px">Água — Inventário</h2>
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
      listEl.innerHTML = `<p>Nenhum registro ainda. Adicione corpos d’água/nascentes/drenagens encontrados.</p>`;
      return;
    }
    listEl.innerHTML = `
      <table class="table">
        <thead><tr><th>ID</th><th>Tipo</th><th>Regime</th><th>Coord.</th><th>Fotos</th><th>Ações</th></tr></thead>
        <tbody>
          ${list.map(a => `
            <tr>
              <td><code>${a.id.slice(0,8)}</code></td>
              <td>${a.tipo}</td>
              <td>${a.regime}</td>
              <td>${a.coordenada?.lat ? `${a.coordenada.lat.toFixed(6)}, ${a.coordenada.lng.toFixed(6)}` : "-"}</td>
              <td>${(a.fotosIds||[]).length}</td>
              <td class="row">
                <button class="secondary" data-edit="${a.id}">Editar</button>
                <button class="danger" data-del="${a.id}">Excluir</button>
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
      <h3 style="margin:0 0 6px">${item.__mode==="edit" ? "Editar" : "Novo"} registro</h3>
      <div class="grid grid-2">
        <div>
          <label>Tipo</label>
          <select id="tipo">
            ${["nascente","corrego","rio","lagoa","brejo","drenagem"].map(t => `<option value="${t}" ${item.tipo===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Regime</label>
          <select id="regime">
            ${["perene","intermitente","efemero","nao_sei"].map(t => `<option value="${t}" ${item.regime===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Largura (m) (se aplicável)</label>
          <input id="largura" type="number" step="0.1" value="${item.largura_m ?? ""}" />
        </div>
        <div>
          <label>Coordenada (Lat,Lng)</label>
          <div class="row">
            <input id="lat" placeholder="lat" value="${item.coordenada?.lat ?? ""}" />
            <input id="lng" placeholder="lng" value="${item.coordenada?.lng ?? ""}" />
            <button class="secondary" id="btnGPS">GPS</button>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-top:10px">
        <label>Observações</label>
        <textarea id="obs" placeholder="Assoreamento, erosão, odor, lixo, etc.">${htmlEsc(item.observacoes)}</textarea>
      </div>

      <div class="row" style="margin-top:10px">
        <label class="badge secondary" style="cursor:pointer">
          Anexar foto
          <input id="foto" type="file" accept="image/*" capture="environment" hidden />
        </label>
        <span class="badge">Fotos vinculadas: ${(item.fotosIds||[]).length}</span>
      </div>

      <div class="row" style="margin-top:10px">
        <button id="btnSave">Salvar</button>
        <button class="secondary" id="btnCancel">Cancelar</button>
      </div>
    `;

    editorEl.querySelector("#btnGPS").addEventListener("click", async () => {
      try {
        const gps = await getGPS();
        editorEl.querySelector("#lat").value = gps.lat.toFixed(6);
        editorEl.querySelector("#lng").value = gps.lng.toFixed(6);
        toast("GPS capturado.");
      } catch (e) {
        toast("Falha GPS: " + (e.message || e));
      }
    });

    editorEl.querySelector("#foto").addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      try {
        const lat = parseFloat(editorEl.querySelector("#lat").value);
        const lng = parseFloat(editorEl.querySelector("#lng").value);
        const photo = await db.addPhoto({
          projectId: projeto.id,
          categoria: "agua",
          blob: f,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          descricao: `Água (${editorEl.querySelector("#tipo").value})`
        });
        item.fotosIds = item.fotosIds || [];
        item.fotosIds.push(photo.id);
        projeto.evidencias.fotos = projeto.evidencias.fotos || [];
        projeto.evidencias.fotos.push(photo.id);
        toast("Foto anexada.");
        renderEditor(item);
      } catch (err) {
        toast("Erro ao anexar foto: " + (err.message || err));
      }
    });

    editorEl.querySelector("#btnCancel").addEventListener("click", () => {
      editorEl.innerHTML = "";
    });

    editorEl.querySelector("#btnSave").addEventListener("click", async () => {
      item.tipo = editorEl.querySelector("#tipo").value;
      item.regime = editorEl.querySelector("#regime").value;
      const w = parseFloat(editorEl.querySelector("#largura").value);
      item.largura_m = Number.isFinite(w) ? w : null;
      const lat = parseFloat(editorEl.querySelector("#lat").value);
      const lng = parseFloat(editorEl.querySelector("#lng").value);
      item.coordenada = { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null };
      item.observacoes = editorEl.querySelector("#obs").value.trim();

      // upsert
      const idx = list.findIndex(x => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.unshift(item);

      projeto.campo.agua = list;
      await setProjeto(projeto);
      toast("Registro salvo.");
      editorEl.innerHTML = "";
      renderList();
    });
  };

  renderList();

  appEl.querySelector("#btnAdd").addEventListener("click", () => {
    const a = emptyAgua();
    a.__mode = "new";
    renderEditor(a);
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const editId = btn.getAttribute("data-edit");
    const delId = btn.getAttribute("data-del");
    if (editId) {
      const item = structuredClone(list.find(x => x.id === editId));
      item.__mode = "edit";
      renderEditor(item);
    }
    if (delId) {
      const ok = confirm("Excluir este registro?");
      if (!ok) return;
      const idx = list.findIndex(x => x.id === delId);
      if (idx >= 0) list.splice(idx, 1);
      projeto.campo.agua = list;
      setProjeto(projeto).then(()=> {
        toast("Registro excluído.");
        renderList();
      });
    }
  });
}
