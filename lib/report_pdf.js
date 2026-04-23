
import { safeFilename } from "./export_zip.js";
import { buildObrigacoes, computeCompleteness } from "./rules.js";

function esc(s){
  return String(s||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function fmtDT(ts){
  if(!ts) return "";
  try { return new Date(ts).toLocaleString("pt-BR"); } catch { return String(ts); }
}


function normPtBR(s){
  const str = String(s ?? "");
  // Correções ortográficas pontuais (pt-BR)
  // "assoriado/assoriada/assoriados/assoriadas" -> "assoreado/assoreada/..."
  const a = str.replace(/\bassoriad([oa])s?\b/gi, (m, g1) => {
    const plural = /s$/i.test(m) ? "s" : "";
    const end = String(g1).toLowerCase();
    return "assoread" + end + plural;
  });
  // "assoriamento/assoriamentos" -> "assoreamento/assoreamentos"
  return a.replace(/\bassoriament(os?)\b/gi, "assoreament$1");
}
async function blobToDataUrl(blob){
  return await new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onerror = ()=>reject(r.error||new Error("Falha ao ler imagem"));
    r.onload = ()=>resolve(String(r.result||""));
    r.readAsDataURL(blob);
  });
}

/**
 * PDF estável via impressão do navegador:
 * - Gera HTML completo do laudo
 * - Abre em nova janela e chama window.print()
 * - Usuário escolhe "Salvar como PDF"
 */
export async function downloadPdfLaudo({ projeto, baseLegal, photos }) {
  const meta = projeto.meta || {};
  const nome = projeto.name || "Projeto";
  const dt = new Date().toLocaleString("pt-BR");
  const completenessRaw = computeCompleteness(projeto);
  const completeness = (typeof completenessRaw === "number") ? completenessRaw : Number(completenessRaw?.score ?? 0);

  const refMap = new Map((baseLegal?.refs || []).map(r=>[r.id,r]));
  const obrigacoes = (projeto.conformidade?.obrigacoes && projeto.conformidade.obrigacoes.length)
    ? projeto.conformidade.obrigacoes
    : buildObrigacoes(projeto);

  const photoMap = new Map((photos||[]).map(p=>[p.id,p]));
  const dataUrlCache = new Map();

  async function getImgSrc(photoId){
    const ph = photoMap.get(photoId);
    if(!ph || !ph.blob) return "";
    if(dataUrlCache.has(photoId)) return dataUrlCache.get(photoId);
    const url = await blobToDataUrl(ph.blob);
    dataUrlCache.set(photoId, url);
    return url;
  }

  // Agrupamento por categoria
  const byCat = {};
  (photos||[]).forEach(p=>{
    const cat = (p.categoria||"outros");
    if(!byCat[cat]) byCat[cat]=[];
    byCat[cat].push(p);
  });
  Object.values(byCat).forEach(arr=>arr.sort((a,b)=>String(a.capturedAt||a.timestamp||"").localeCompare(String(b.capturedAt||b.timestamp||""))));

  // Índice (sumário simples)
  const toc = [
    "1. APRESENTAÇÃO",
    "2. INTRODUÇÃO",
    "3. OBJETIVO",
    "3.1. Objetivos Específicos",
    "4. DESCRIÇÃO DA ÁREA",
    "5. AÇÃO PROPOSTA",
    "6. PESQUISA DE CAMPO (METODOLOGIA)",
    "7. RESULTADOS E DIAGNÓSTICO AMBIENTAL",
    "7.1. Quadro Ambiental (Água / Flora / Fauna / Solo)",
    "7.2. Conformidade Legal (Matriz de Obrigações)",
    "7.3. Evidências por Obrigação",
    "8. CRONOGRAMA",
    "9. RESPONSABILIDADE TÉCNICA",
    "10. RESPONSÁVEL PELO EMPREENDIMENTO",
    "11. BIBLIOGRAFIA E REFERÊNCIAS LEGAIS",
    "12. ANEXO FOTOGRÁFICO"
  ];

  // Monta HTML
  const styles = `
    <style>
      @page { size: A4; margin: 16mm; }
      body{ font-family: Arial, sans-serif; color:#111; }
      .cover{ border:2px solid #1B5E20; padding:14mm; border-radius:10px; }
      h1{ margin:0; font-size:20px; }
      h2{ margin:18px 0 8px; font-size:15px; border-bottom:1px solid #ddd; padding-bottom:6px;}
      h3{ margin:12px 0 6px; font-size:13px; }
      .muted{ color:#555; font-size:12px; }
      .kv{ margin-top:10px; font-size:12px; }
      .kv div{ margin:3px 0; }
      .toc li,.toc div{ margin:3px 0; }
      table{ width:100%; border-collapse:collapse; font-size:11px; }
      th,td{ border:1px solid #ddd; padding:6px; vertical-align:top; }
      th{ background:#f2f6f2; }
      .badge{ display:inline-block; padding:2px 8px; border-radius:999px; background:#e8f5e9; border:1px solid #c8e6c9; font-size:11px; }
      .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
      .photo{ border:1px solid #eee; border-radius:8px; padding:6px; }
      .photo img{ width:100%; height:160px; object-fit:cover; border-radius:6px; }
      .small{ font-size:11px; color:#333; margin-top:4px; }
      .pagebreak{ page-break-after: always; }
    </style>
  `;

  const cover = `
    <div class="cover">
      <div class="badge">LAUDO TÉCNICO</div>
      <h1>LAUDO DE CARACTERIZAÇÃO AMBIENTAL</h1>
      <h2 style="margin:0; font-size:16px; font-weight:600;">Quadro Ambiental Pré-Obra</h2>
      <div class="muted">${esc(nome)}</div>
      <div class="kv">
        <div><b>Município/UF:</b> ${esc(meta.municipio || "-")}/${esc(meta.uf || "-")}</div>
        <div><b>Tipo:</b> ${esc(meta.tipoEmpreendimento || "-")} &nbsp; <b>Área (ha):</b> ${meta.areaHa ? Number(meta.areaHa).toFixed(4) : "0"}</div>
        <div><b>Data/Hora de emissão:</b> ${esc(dt)}</div>
        <div><b>Completude:</b> ${completeness}%</div>
      </div>
    </div>
  `;

  const secToc = `<h2>Sumário</h2><div class="toc">${toc.map(i=>`<div>${esc(i)}</div>`).join("")}</div>`;
  const secIdentificacao = `<h2>Identificação</h2>
    <div class="kv">
      <div><b>Solicitante:</b> ${esc((meta.solicitante && meta.solicitante.nome) || meta.solicitante || "—")}</div>
      <div><b>Empresa Consultora:</b> ${esc((meta.consultora && meta.consultora.nome) || meta.consultora || "—")}</div>
      <div><b>Responsável Técnico:</b> ${esc((meta.responsavelTecnico && meta.responsavelTecnico.nome) || meta.responsavelTecnico || "—")}</div>
      <div class="muted">Se estes campos estiverem em branco, preencha no cadastro do projeto (10 itens) e gere o laudo novamente.</div>
    </div>`;


  const secApresentacao = `<h2>1. APRESENTAÇÃO</h2>
    <div class="muted">Documento gerado automaticamente a partir do aplicativo de coleta em campo (fotos georreferenciadas, formulários e checklists).</div>`;

  const secIntroducao = `<h2>2. INTRODUÇÃO</h2>
    <div class="muted">Este laudo consolida o diagnóstico ambiental preliminar para subsidiar a regularização ambiental e o planejamento do empreendimento.</div>`;

  const secObjetivo = `<h2>3. OBJETIVO</h2>
    <div class="muted">Consolidar o diagnóstico ambiental preliminar (meio físico e biótico) para subsidiar a regularização/licenciamento do empreendimento, com base em critérios legais e evidências de campo.</div>
    <h3>3.1. Objetivos Específicos</h3>
    <ul>
      <li>Caracterizar elementos do meio físico (água, solo/processos) e do meio biótico (flora e fauna).</li>
      <li>Identificar áreas sensíveis (APP, unidades de conservação e zonas de amortecimento) quando aplicável.</li>
      <li>Consolidar evidências de campo (fotos e registros) e indicar obrigações/condicionantes prováveis.</li>
    </ul>`;

  const secDescricao = `<h2>4. DESCRIÇÃO DA ÁREA</h2>
    <div class="kv">
      <div><b>Polígono:</b> ${(Array.isArray(meta.poligono) ? meta.poligono.length : 0)} vértices</div>
      <div><b>Histórico de uso:</b> ${esc(meta.historicoUso?.usoAnterior || "")}</div>
      <div><b>Cobertura vegetal (%):</b> ${esc(meta.coberturaVegetal || "")}</div>
      <div><b>Indícios de APP:</b> ${meta.indiciosAPP?.sim ? "SIM" : "NÃO"} ${esc(meta.indiciosAPP?.onde || "")}</div>
    </div>`;

  
  const secAcaoProposta = (() => {
    const itv = meta.intervencoesPrevistas || {};
    const itens = [
      ["Supressão vegetal", itv.supressaoVegetal],
      ["Terraplenagem", itv.terraplenagem],
      ["Drenagem", itv.drenagem],
      ["Travessias", itv.travessias],
      ["Captação de água", itv.captacaoAgua],
      ["Poço", itv.poco],
      ["Lançamento de efluente", itv.lancamentoEfluente],
      ["Intervenção em APP", itv.intervencaoAPP],
      ["Mata Atlântica (suspeita)", itv.mataAtlanticaProvavel],
    ];
    return `<h2>5. AÇÃO PROPOSTA</h2>
      <div class="muted">Síntese do empreendimento e das intervenções previstas (quando informadas no cadastro do projeto).</div>
      <ul>${itens.map(([t,v])=>`<li>${esc(t)}: <b>${v ? "SIM" : "NÃO/Não informado"}</b></li>`).join("")}</ul>`;
  })();

  const secPesquisaCampo = `<h2>6. PESQUISA DE CAMPO (METODOLOGIA)</h2>
    <ul>
      <li>Análise preliminar documental e registros do projeto.</li>
      <li>Vistoria de campo com registros (GPS quando disponível) e evidências fotográficas.</li>
      <li>Identificação e registro de corpos d’água, vegetação/fragmentos, fauna e condições de solo/processos.</li>
      <li>Consolidação dos achados e aplicação de regras de conformidade para geração de obrigações/condicionantes.</li>
    </ul>`;

  const secResultados = `<h2>7. RESULTADOS E DIAGNÓSTICO AMBIENTAL</h2>
    <div class="muted">Síntese dos registros do meio físico e biótico, com indicação de obrigações/condicionantes prováveis e evidências associadas.</div>`;
const secQuadro = `<h3>7.1. Quadro Ambiental (Água / Flora / Fauna / Solo)</h3>
    <div class="kv">
      <div><b>Corpos d’água:</b> ${(projeto.campo?.agua||[]).length}</div>
      <div><b>Fragmentos de flora:</b> ${(projeto.campo?.flora?.fragmentos||[]).length}</div>
      <div><b>Espécies de flora:</b> ${(projeto.campo?.flora?.especies||[]).length}</div>
      <div><b>Registros de fauna:</b> ${(projeto.campo?.fauna||[]).length}</div>
      <div><b>Solo/Processos:</b> ${(projeto.campo?.soloProcessos||[]).length}</div>
      <div><b>Evidências fotográficas:</b> ${(photos||[]).length}</div>
    </div>`;

  const matrixRows = obrigacoes.map((o,idx)=>{
    const cod = esc(o.codigo || `QA-OBR-${String(idx+1).padStart(3,"0")}`);
    const base = (o.baseLegalIds||[]).map(id=>{
      const r=refMap.get(id);
      return r ? `${id} (${r.title})` : id;
    }).join("; ");
    return `<tr>
      <td>${cod}</td>
      <td>${esc(o.titulo||"")}</td>
      <td>${esc(o.status||"pendente")}</td>
      <td>${esc(o.prioridade||"media")}</td>
      <td>${esc(o.prazo||"")}</td>
      <td>${esc(o.responsavel||"")}</td>
      <td>${esc(base)}</td>
    </tr>`;
  }).join("");

  const secMatriz = `<h3>7.2. Conformidade Legal (Matriz de Obrigações)</h3>
    ${obrigacoes.length ? `<table>
      <thead><tr>
        <th>Código</th><th>Obrigação</th><th>Status</th><th>Pri.</th><th>Prazo</th><th>Responsável</th><th>Base legal</th>
      </tr></thead>
      <tbody>${matrixRows}</tbody>
    </table>` : `<div class="muted">Nenhuma obrigação automática foi gerada pelos gatilhos atuais.</div>`}
  `;

  // Evidências por obrigação (com miniaturas; limita para não estourar)
  let secEvs = `<h3>7.3. Evidências por Obrigação</h3>`;
  const obsWithEv = obrigacoes.filter(o=>Array.isArray(o.evidenciasIds) && o.evidenciasIds.length);
  if(!obsWithEv.length){
    secEvs += `<div class="muted">Não há evidências vinculadas diretamente a obrigações. Consulte o Anexo Fotográfico.</div>`;
  } else {
    for (const o of obsWithEv) {
      const evIds = (o.evidenciasIds||[]).filter(Boolean).slice(0, 6);
      secEvs += `<h3>${esc(o.codigo||"")} — ${esc(o.titulo||"")}</h3><div class="grid">`;
      for (const id of evIds) {
        const ph = photoMap.get(id);
        if(!ph) continue;
        const src = await getImgSrc(id);
        const coord = (ph.lat!=null && ph.lng!=null) ? `${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)}` : "—";
        secEvs += `<div class="photo">
            <img src="${src}" />
            <div class="small"><b>${esc((ph.categoria||"outros").toUpperCase())}</b> — ${esc(normPtBR(ph.descricao||""))}</div>
            <div class="small">GPS: ${esc(coord)} | Capturado: ${esc(fmtDT(ph.capturedAt||ph.timestamp))}</div>
            <div class="small">ID: ${esc(ph.id)}</div>
          </div>`;
      }
      secEvs += `</div>`;
    }
  }

  const secCrono = `<h2>8. CRONOGRAMA</h2>
    <div class="muted">Preencher conforme orientações do órgão e cronograma do empreendimento. Os prazos e responsáveis podem ser registrados na Matriz.</div>`;

  const secRespTec = `<h2>9. RESPONSABILIDADE TÉCNICA</h2>
    <div class="kv">
      <div><b>Responsável técnico:</b> ${esc((meta.responsavelTecnico && meta.responsavelTecnico.nome) || meta.responsavelTecnico || "_______________________________")}</div>
      <div><b>Registro/ART/RRT:</b> ${esc(meta.responsavelTecnico?.registro || meta.art || "_______________________________")}</div>
    </div>`;

  const secRespEmp = `<h2>10. RESPONSÁVEL PELO EMPREENDIMENTO</h2>
    <div class="kv">
      <div><b>Empreendimento/Representante:</b> ${esc(meta.responsavelEmpreendimento?.nome || meta.representante || "_______________________________")}</div>
      <div><b>CNPJ/CPF:</b> ${esc(meta.responsavelEmpreendimento?.documento || meta.documentoResponsavel || "_______________________________")}</div>
    </div>`;

  
      const secReferencias = (() => {
    const refs = Array.isArray(baseLegal?.refs) ? baseLegal.refs : [];
    if(!refs.length) return `<h2>11. BIBLIOGRAFIA E REFERÊNCIAS LEGAIS</h2><div class="muted">Sem referências legais cadastradas na base local.</div>`;
    const items = refs.map(r => `<li><b>${esc(r.id || "")}</b>${r?.title ? " — " + esc(r.title) : ""}</li>`).join("");
    return `<h2>11. BIBLIOGRAFIA E REFERÊNCIAS LEGAIS</h2><ul>${items}</ul>`;
  })();
const secConclusao = `<h3>7.4. Considerações Finais</h3>
    <div class="muted">O presente documento consolida o quadro ambiental preliminar e as obrigações prováveis para a regularização do empreendimento, devendo ser complementado conforme exigências específicas do município/órgão licenciador.</div>`;

  // Anexo fotográfico por categoria
  let secAnexo = `<h2>12. ANEXO FOTOGRÁFICO</h2>`;
  const cats = Object.keys(byCat).sort();
  for (const cat of cats) {
    const arr = byCat[cat] || [];
    if(!arr.length) continue;
    secAnexo += `<h3>${esc(cat.toUpperCase())}</h3><div class="grid">`;
    for (const ph of arr.slice(0, 30)) { // limite por categoria
      const src = await getImgSrc(ph.id);
      const coord = (ph.lat!=null && ph.lng!=null) ? `${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)}` : "—";
      secAnexo += `<div class="photo">
        <img src="${src}" />
        <div class="small">${esc(normPtBR(ph.descricao||""))}</div>
        <div class="small">GPS: ${esc(coord)} | Capturado: ${esc(fmtDT(ph.capturedAt||ph.timestamp))}</div>
      </div>`;
    }
    secAnexo += `</div>`;
  }

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>${esc(safeFilename("LAUDO_"+nome))}</title>
    ${styles}
  </head><body>
    ${cover}
    ${secIdentificacao}
    ${secToc}
    ${secApresentacao}
    ${secIntroducao}
    ${secObjetivo}
    ${secDescricao}
    ${secAcaoProposta}
    ${secPesquisaCampo}
    ${secResultados}
    ${secQuadro}
    ${secMatriz}
    ${secEvs}
    ${secConclusao}
    ${secCrono}
    ${secRespTec}
    ${secRespEmp}
    ${secReferencias}
    ${secAnexo}
    <script>
      window.onload = () => { setTimeout(()=>{ try{ window.print(); }catch(e){} }, 350); };
    </script>
  </body></html>`;

  const w = window.open("", "_blank");
  if(!w){
    alert("Não foi possível abrir a janela do PDF. Verifique bloqueio de pop-up.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}





