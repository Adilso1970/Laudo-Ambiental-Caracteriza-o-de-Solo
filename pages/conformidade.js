import { buildObrigacoes, computeCompleteness } from "../lib/rules.js";

function htmlEsc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

const STATUS_OPTS = [
  ["pendente","Pendente"],
  ["andamento","Em andamento"],
  ["concluido","Concluído"],
  ["nao_aplica","Não se aplica"]
];

const PRI_OPTS = [
  ["alta","Alta"],
  ["media","Média"],
  ["baixa","Baixa"]
];

function badgeStatus(st){
  if (st==="concluido") return "ok";
  if (st==="andamento") return "warn";
  if (st==="nao_aplica") return "";
  return "danger";
}

export async function renderConformidade({ appEl, db, toast, projeto, baseLegal, setProjeto }) {
  // Reconciliar obrigações preservando edições do usuário
  projeto.conformidade = projeto.conformidade || { achados:{}, obrigacoes:[] };
  projeto.conformidade.obrigacoes = buildObrigacoes(projeto);

  const obrigacoes = projeto.conformidade.obrigacoes || [];
  const score = computeCompleteness(projeto);

  const refMap = new Map((baseLegal.refs||[]).map(r => [r.id, r]));

  // Fotos do projeto para vínculo
  const fotos = await db.listPhotosByProject(projeto.id);

  const counts = obrigacoes.reduce((acc,o)=>{
    const st=o.status||"pendente";
    acc.total += 1;
    acc[st] = (acc[st]||0)+1;
    acc.aplicaveis += (o.aplicavel===false ? 0 : 1);
    return acc;
  }, { total:0, aplicaveis:0, pendente:0, andamento:0, concluido:0, nao_aplica:0 });

  appEl.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <h2 style="margin:0 0 6px">Conformidade</h2>
        <div class="row" style="flex-wrap:wrap">
          <span class="badge ${score>=85?"ok":score>=60?"warn":"danger"}">Completude: ${score}/100</span>
          <span class="badge">Obrigações: ${counts.total} (aplicáveis: ${counts.aplicaveis})</span>
          <span class="badge danger">Pendentes: ${counts.pendente}</span>
          <span class="badge warn">Andamento: ${counts.andamento}</span>
          <span class="badge ok">Concluídas: ${counts.concluido}</span>
          <span class="badge">N/A: ${counts.nao_aplica}</span>
        </div>
        <div class="small" style="margin-top:6px;color:#2a5b3f">
          Dica: em campo, use <b>Evidências</b> para anexar fotos (GPS+data/hora) e depois vincule aqui nas obrigações.
        </div>
      </div>
      <div class="row">
        <button id="btnRegen" class="secondary">Regerar obrigações</button>
        <button id="btnSave">Salvar</button>
        <button class="secondary" id="btnGoLaudo">Ir para Laudo</button>
      </div>
    </div>

    <hr/>

    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <label class="small">Filtrar status:
          <select id="fStatus">
            <option value="">Todos</option>
            ${STATUS_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}
          </select>
        </label>
        <label class="small">Prioridade:
          <select id="fPri">
            <option value="">Todas</option>
            ${PRI_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}
          </select>
        </label>
        <label class="small">
          <input type="checkbox" id="fSoAplicaveis" checked/> Somente aplicáveis
        </label>
      </div>
      <div class="small" style="color:#666">Clique em <b>Vincular</b> para anexar evidências (fotos) por obrigação.</div>
    </div>

    <div id="obList" style="margin-top:10px"></div>

    <hr/>

    <h3 style="margin:0 0 6px">Checklist rápido (manual)</h3>
    <div class="small">Marque itens que o órgão/município indicar. Isso aparece no laudo como â€œachados declaradosâ€.</div>
    <div class="grid grid-3" style="margin-top:8px">
      ${[
        ["possuiUC","Há Unidade de Conservação na área de influência?"],
        ["possuiZA","Há Zona de Amortecimento aplicável?"],
        ["eivExigido","Município exige EIV para este porte?"],
        ["necessitaEIA","Há indicativo de EIA/RIMA (porte/impacto)?"]
      ].map(([k,label])=>`
        <label class="badge" style="justify-content:flex-start;gap:10px">
          <input type="checkbox" id="${k}" ${(projeto.conformidade.achados||{})[k] ? "checked":""}/>
          <span>${htmlEsc(label)}</span>
        </label>
      `).join("")}
    </div>

    <dialog id="evModal" style="max-width:980px;width:min(980px, 92vw);border:0;border-radius:14px;box-shadow:0 20px 70px rgba(0,0,0,.25);padding:0">
      <div style="padding:16px 16px 0 16px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <div class="small" style="color:#666">Vincular evidências</div>
          <h3 id="evTitle" style="margin:0">Obrigação</h3>
        </div>
        <button id="evClose" class="secondary" style="margin-left:auto">Fechar</button>
      </div>
      <div style="padding:16px">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div class="row" style="gap:10px;flex-wrap:wrap">
            <label class="small">Categoria:
              <select id="evCat">
                <option value="">Todas</option>
                <option value="agua">Água</option>
                <option value="flora">Flora</option>
                <option value="fauna">Fauna</option>
                <option value="solo">Solo/Processos</option>
                <option value="outros">Outros</option>
              </select>
            </label>
            <label class="small">Ordenar:
              <select id="evOrder">
                <option value="desc">Mais recentes</option>
                <option value="asc">Mais antigas</option>
              </select>
            </label>
            <label class="small">Buscar:
              <input id="evSearch" type="text" placeholder="ID ou descrição..." style="min-width:220px" />
            </label>
            <button id="evSelAll" class="secondary">Selecionar tudo</button>
            <button id="evClearAll" class="secondary">Limpar</button>
            <span id="evSelCount" class="small" style="color:#666"></span>

          </div>
          <div class="row">
            <button id="evSave" class="">Salvar vínculos</button>
          </div>
        </div>
        <div id="evGrid" class="grid grid-3" style="margin-top:10px"></div>
      </div>
    </dialog>
  `;

  const obListEl = appEl.querySelector("#obList");
  const fStatus = appEl.querySelector("#fStatus");
  const fPri = appEl.querySelector("#fPri");
  const fSoAplicaveis = appEl.querySelector("#fSoAplicaveis");

  // State modal
  const evModal = appEl.querySelector("#evModal");
  const evTitle = appEl.querySelector("#evTitle");
  const evGrid = appEl.querySelector("#evGrid");
  const evCat = appEl.querySelector("#evCat");
  const evOrder = appEl.querySelector("#evOrder");

  const evSearch = appEl.querySelector("#evSearch");
  const evSelAll = appEl.querySelector("#evSelAll");
  const evClearAll = appEl.querySelector("#evClearAll");
  const evSelCount = appEl.querySelector("#evSelCount");
  let currentObId = null;
  let createdUrls = [];

  function revokeUrls(){
    for (const u of createdUrls) try { URL.revokeObjectURL(u); } catch {}
    createdUrls = [];
  }

  function renderObrigacoes() {
    const st = fStatus.value;
    const pri = fPri.value;
    const soAp = fSoAplicaveis.checked;

    const list = obrigacoes.filter(o=>{
      if (soAp && o.aplicavel===false) return false;
      if (st && (o.status||"pendente")!==st) return false;
      if (pri && (o.prioridade||"media")!==pri) return false;
      return true;
    });

    if (!list.length) {
      obListEl.innerHTML = `<p class="small">Nenhuma obrigação neste filtro.</p>`;
      return;
    }

    obListEl.innerHTML = list.map((o,idx)=>{
      const bl = (o.baseLegalIds||[]).map(id=>{
        const r=refMap.get(id);
        const title = r ? r.title : id;
        const url = r ? r.citation_url : "";
        return url ? `<div class="small"><a href="${url}" target="_blank" rel="noreferrer">${htmlEsc(id)}</a> — ${htmlEsc(title)}</div>`
                   : `<div class="small">${htmlEsc(id)} — ${htmlEsc(title)}</div>`;
      }).join("");

      const evCount = (o.evidenciasIds||[]).length;

      return `
        <div class="card" style="margin:10px 0">
          <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1">
              <div class="row" style="gap:10px;flex-wrap:wrap">
                <span class="badge">${htmlEsc(o.codigo||`#${idx+1}`)}</span>
                <span class="badge ${badgeStatus(o.status)}">${STATUS_OPTS.find(x=>x[0]===(o.status||"pendente"))?.[1]||"Pendente"}</span>
                <span class="badge">${(o.prioridade||"media").toUpperCase()}</span>
                ${o.aplicavel===false ? `<span class="badge">Não aplicável (histórico)</span>` : ``}
              </div>
              <div style="margin-top:6px"><b>${htmlEsc(o.titulo)}</b></div>
              <div class="small" style="margin-top:4px">${htmlEsc(o.descricao)}</div>
            </div>
            <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
              <button class="secondary" data-act="link" data-id="${o.id}">Vincular (${evCount})</button>
              <button class="secondary" data-act="toggleNA" data-id="${o.id}">${o.aplicavel===false ? "Tornar aplicável" : "Marcar N/A"}</button>
            </div>
          </div>

          <div class="grid grid-3" style="margin-top:10px">
            <label class="small">Status
              <select data-field="status" data-id="${o.id}">
                ${STATUS_OPTS.map(([v,l])=>`<option value="${v}" ${v===(o.status||"pendente")?"selected":""}>${l}</option>`).join("")}
              </select>
            </label>
            <label class="small">Prioridade
              <select data-field="prioridade" data-id="${o.id}">
                ${PRI_OPTS.map(([v,l])=>`<option value="${v}" ${v===(o.prioridade||"media")?"selected":""}>${l}</option>`).join("")}
              </select>
            </label>
            <label class="small">Prazo
              <input type="date" data-field="prazo" data-id="${o.id}" value="${htmlEsc(o.prazo||"")}" />
            </label>
            <label class="small">Responsável
              <input type="text" data-field="responsavel" data-id="${o.id}" value="${htmlEsc(o.responsavel||"")}" placeholder="Ex.: Empreendedor / Consultoria" />
            </label>
            <label class="small" style="grid-column: span 2;">Observações
              <input type="text" data-field="notas" data-id="${o.id}" value="${htmlEsc(o.notas||"")}" placeholder="Notas técnicas / condicionantes / ações" />
            </label>
          </div>

          <details style="margin-top:10px">
            <summary class="small">Base legal</summary>
            <div style="margin-top:6px">${bl || `<div class="small">Sem referências cadastradas.</div>`}</div>
          </details>
        </div>
      `;
    }).join("");

    // Wire field updates
    obListEl.querySelectorAll("[data-field]").forEach(el=>{
      el.addEventListener("change", (e)=>{
        const id = el.getAttribute("data-id");
        const field = el.getAttribute("data-field");
        const ob = obrigacoes.find(x=>x.id===id);
        if (!ob) return;
        ob[field] = el.value;
        // Regra: se marcar não aplica -> aplicavel=false
        if (field==="status" && el.value==="nao_aplica") ob.aplicavel = false;
      });
      if (el.tagName==="INPUT") {
        el.addEventListener("input", ()=>{
          const id = el.getAttribute("data-id");
          const field = el.getAttribute("data-field");
          const ob = obrigacoes.find(x=>x.id===id);
          if (!ob) return;
          ob[field] = el.value;
        });
      }
    });

    // Wire actions
    obListEl.querySelectorAll("button[data-act]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        const ob = obrigacoes.find(x=>x.id===id);
        if (!ob) return;

        if (act==="toggleNA") {
          ob.aplicavel = !(ob.aplicavel===false);
          if (ob.aplicavel===false) ob.status = "nao_aplica";
          renderObrigacoes();
          return;
        }

        if (act==="link") {
          await openEvidenceModal(ob);
        }
      });
    });
  }

  async function openEvidenceModal(ob) {
    currentObId = ob.id;
    revokeUrls();
    evTitle.textContent = `${ob.codigo||""} ${ob.titulo}`;
    evCat.value = "";
    evOrder.value = "desc";

    const renderGrid = async ()=>{
      revokeUrls();
      const cat = evCat.value;
      const order = evOrder.value;

      let list = fotos.slice();
      if (cat) list = list.filter(p => (p.categoria||"")===cat);
      const q = (evSearch?.value || "").trim().toLowerCase();
      if (q) list = list.filter(p => (String(p.id||"").toLowerCase().includes(q) || String(p.descricao||"").toLowerCase().includes(q)));
      list.sort((a,b)=> (order==="asc" ? (a.timestamp||"").localeCompare(b.timestamp||"") : (b.timestamp||"").localeCompare(a.timestamp||"")));

      if (!list.length) {
        evGrid.innerHTML = `<p class="small">Sem evidências nesta categoria.</p>`;
        return;
      }

      const linked = new Set(ob.evidenciasIds || []);
      evGrid.innerHTML = list.map(p=>{
        const url = URL.createObjectURL(p.blob);
        createdUrls.push(url);
        const checked = linked.has(p.id) ? "checked" : "";
        const gps = (p.lat!=null && p.lng!=null) ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : "—";
        const dt = p.timestamp ? new Date(p.timestamp).toLocaleString("pt-BR") : "";
        return `
          <label class="card" style="padding:10px;display:block">
            <div class="row" style="justify-content:space-between;align-items:center">
              <span class="badge">${htmlEsc(p.categoria||"")}</span>
              <input type="checkbox" data-photo="${p.id}" ${checked}/>
            </div>
            <img src="${url}" alt="foto" style="width:100%;height:180px;object-fit:cover;border-radius:10px;margin-top:8px"/>
            <div class="small" style="margin-top:8px">${htmlEsc(p.descricao||"")}</div>
            <div class="small">GPS: ${gps}</div>
            <div class="small">${htmlEsc(dt)}</div>
          </label>
        `;
      }).join("");
      // contador de seleção
      if (evSelCount) {
        const checked = evGrid.querySelectorAll('input[type="checkbox"][data-photo]:checked').length;
        evSelCount.textContent = checked ? `${checked} selecionada(s)` : "";
      }
    };

    evCat.onchange = renderGrid;
    evOrder.onchange = renderGrid;
    if (evSearch) evSearch.oninput = ()=>{ renderGrid(); };
    if (evSelAll) evSelAll.onclick = ()=>{
      evGrid.querySelectorAll('input[type="checkbox"][data-photo]').forEach(cb=>cb.checked=true);
      if (evSelCount) evSelCount.textContent = `${evGrid.querySelectorAll('input[type="checkbox"][data-photo]:checked').length} selecionada(s)`;
    };
    if (evClearAll) evClearAll.onclick = ()=>{
      evGrid.querySelectorAll('input[type="checkbox"][data-photo]').forEach(cb=>cb.checked=false);
      if (evSelCount) evSelCount.textContent = "";
    };

    await renderGrid();
    evModal.showModal();
    evGrid.addEventListener('change', (e)=>{
      if (e.target && e.target.matches('input[type="checkbox"][data-photo]')){
        if (evSelCount) {
          const checked = evGrid.querySelectorAll('input[type="checkbox"][data-photo]:checked').length;
          evSelCount.textContent = checked ? `${checked} selecionada(s)` : "";
        }
      }
    });


    appEl.querySelector("#evClose").onclick = ()=>{
      evModal.close();
      revokeUrls();
    };

    appEl.querySelector("#evSave").onclick = ()=>{
      const obNow = obrigacoes.find(x=>x.id===currentObId);
      if (!obNow) return;
      const selected = Array.from(evGrid.querySelectorAll("input[type=checkbox][data-photo]"))
        .filter(cb=>cb.checked)
        .map(cb=>cb.getAttribute("data-photo"));
      obNow.evidenciasIds = selected;
      toast("Evidências vinculadas.");
      evModal.close();
      revokeUrls();
      renderObrigacoes();
    };
  }

  fStatus.onchange = renderObrigacoes;
  fPri.onchange = renderObrigacoes;
  fSoAplicaveis.onchange = renderObrigacoes;

  renderObrigacoes();

  async function saveAll() {
    projeto.conformidade.achados = projeto.conformidade.achados || {};
    for (const k of ["possuiUC","possuiZA","eivExigido","necessitaEIA"]) {
      const el = appEl.querySelector("#"+k);
      if (el) projeto.conformidade.achados[k] = !!el.checked;
    }
    projeto.conformidade.obrigacoes = obrigacoes;
    await setProjeto(projeto);
    toast("Conformidade salva.");
  }

  appEl.querySelector("#btnSave").addEventListener("click", saveAll);

  appEl.querySelector("#btnRegen").addEventListener("click", async ()=>{
    // Regerar mantendo edições
    projeto.conformidade.obrigacoes = obrigacoes;
    projeto.conformidade.obrigacoes = buildObrigacoes(projeto);
    await setProjeto(projeto);
    toast("Obrigações regeneradas.");
    location.hash = "#/conformidade";
    await renderConformidade({ appEl, db, toast, projeto: await db.getProject(projeto.id), baseLegal, setProjeto });
  });

  appEl.querySelector("#btnGoLaudo").addEventListener("click", async ()=> {
    await saveAll();
    location.hash = "#/laudo";
  });
}