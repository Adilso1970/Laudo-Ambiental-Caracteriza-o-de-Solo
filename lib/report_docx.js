import { createZipStore, downloadBlob, safeFilename } from "./export_zip.js";
import { buildObrigacoes, computeCompleteness } from "./rules.js";

function xmlEsc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

function fmtPtBR(iso) {
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return String(iso || ""); }
}
function nowPtBR() { return new Date().toLocaleString("pt-BR"); }

function statusLabel(st){
  const s = String(st||"pendente");
  if (s==="concluido") return "Concluído";
  if (s==="andamento") return "Em andamento";
  if (s==="nao_aplica") return "Não se aplica";
  return "Pendente";
}
function priLabel(p){
  const s = String(p||"media");
  if (s==="alta") return "Alta";
  if (s==="baixa") return "Baixa";
  return "Média";
}

function normPtBR(s){
  const str = String(s ?? "");
  const a = str.replace(/\bassoriad([oa])s?\b/gi, (m, g1) => {
    const plural = /s$/i.test(m) ? "s" : "";
    const end = String(g1).toLowerCase();
    return "assoread" + end + plural;
  });
  return a.replace(/\bassoriament(os?)\b/gi, "assoreament$1");
}

function p(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function pSmall(text) {
  return `<w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function pBold(text) {
  return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function pH(level, text) {
  const style = level===1 ? "Heading1" : (level===2 ? "Heading2" : "Heading3");
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function pSpacer() { return `<w:p/>`; }

function staticToc() {
  const itens = [
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
    "7.4. Considerações Finais",
    "8. CRONOGRAMA",
    "9. RESPONSABILIDADE TÉCNICA",
    "10. RESPONSÁVEL PELO EMPREENDIMENTO",
    "11. BIBLIOGRAFIA E REFERÊNCIAS LEGAIS",
    "12. ANEXO FOTOGRÁFICO"
  ];
  return [
    pBold("Sumário"),
    ...itens.map(i => p(i))
  ].join("\n");
}

function coverTable({ projeto, meta, score }) {
  const titulo1 = meta?.capa?.linha1 || "LAUDO DE CARACTERIZAÇÃO AMBIENTAL";
  const titulo2 = meta?.capa?.linha2 || "Quadro Ambiental Pré-Obra";
  const municipioUF = `${meta?.municipio || "-"} / ${meta?.uf || "-"}`;
  const tipo = meta?.tipoEmpreendimento || "-";
  const area = meta?.areaHa ? Number(meta.areaHa).toFixed(4) : "0";
  const dt = nowPtBR();
  const comp = `${Number(score || 0)}%`;

  return `
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="0" w:type="auto"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="16" w:space="0" w:color="2f7d32"/>
      <w:left w:val="single" w:sz="16" w:space="0" w:color="2f7d32"/>
      <w:bottom w:val="single" w:sz="16" w:space="0" w:color="2f7d32"/>
      <w:right w:val="single" w:sz="16" w:space="0" w:color="2f7d32"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tblGrid><w:gridCol w:w="9800"/></w:tblGrid>
  <w:tr>
    <w:tc>
      <w:tcPr><w:tcW w:w="9800" w:type="dxa"/></w:tcPr>
      <w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t>LAUDO TÉCNICO</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/><w:sz w:val="30"/></w:rPr><w:t>${xmlEsc(titulo1)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>${xmlEsc(titulo2)}</w:t></w:r></w:p>
      <w:p><w:r><w:t>${xmlEsc(projeto?.name || "-")}</w:t></w:r></w:p>
      <w:p/>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Município/UF: </w:t></w:r><w:r><w:t>${xmlEsc(municipioUF)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Tipo: </w:t></w:r><w:r><w:t>${xmlEsc(tipo)}</w:t></w:r><w:r><w:t xml:space="preserve">    </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Área (ha): </w:t></w:r><w:r><w:t>${xmlEsc(area)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Data/Hora de emissão: </w:t></w:r><w:r><w:t>${xmlEsc(dt)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Completude: </w:t></w:r><w:r><w:t>${xmlEsc(comp)}</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
</w:tbl>`;
}

function pImage(rId, cx, cy, descr) {
  return `
  <w:p>
    <w:r>
      <w:drawing>
        <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:docPr id="1" name="Picture" descr="${xmlEsc(descr||"")}" />
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="0" name="image"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${cx}" cy="${cy}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

const MAX_IMG_DIM = 1600;

async function decodeImageSource(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      if (img.decode) await img.decode();
      else {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(new Error("Falha ao decodificar imagem."));
        });
      }
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return await createImageBitmap(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function clampDims(w,h){
  const max = MAX_IMG_DIM;
  if (!w || !h) return [w||0,h||0];
  const r = Math.min(1, max / Math.max(w,h));
  return [Math.round(w*r), Math.round(h*r)];
}

async function toJpegBytes(blob) {
  const bmp = await decodeImageSource(blob);
  const [cw,ch] = clampDims(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, cw, ch);
  const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  const ab = await jpegBlob.arrayBuffer();
  return { bytes: new Uint8Array(ab), width: cw, height: ch };
}

function headerXml({ projeto }) {
  const dt = nowPtBR();
  const nome = `LAUDO_${(projeto?.name || "Projeto").replace(/[^\w\-]+/g,"_")}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:tabs>
        <w:tab w:val="center" w:pos="4680"/>
        <w:tab w:val="right" w:pos="9360"/>
      </w:tabs>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="10" w:space="1" w:color="2f7d32"/>
      </w:pBdr>
    </w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEsc(dt)}</w:t></w:r>
    <w:r><w:tab/></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:b/></w:rPr><w:t xml:space="preserve">${xmlEsc(nome)}</w:t></w:r>
  </w:p>
</w:hdr>`;
}

function footerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>
</w:ftr>`;
}

function settingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`;
}

export async function downloadDocxLaudo({ projeto, baseLegal, photos }) {
  const obrigacoes = buildObrigacoes(projeto);
  projeto.conformidade.obrigacoes = obrigacoes;

  const meta = projeto.meta || {};
  const scoreRaw = computeCompleteness(projeto);
  const score = typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw?.score ?? 0);

  const bodyParts = [];

  bodyParts.push(coverTable({ projeto, meta, score }));
  bodyParts.push(pSpacer());

  bodyParts.push(pBold("Identificação"));
  bodyParts.push(pSmall(`Solicitante: ${(meta.solicitante && meta.solicitante.nome) || meta.solicitante || "—"}`));
  bodyParts.push(pSmall(`Empresa Consultora: ${(meta.consultora && meta.consultora.nome) || meta.consultora || "—"}`));
  bodyParts.push(pSmall(`Responsável Técnico: ${(meta.responsavelTecnico && meta.responsavelTecnico.nome) || meta.responsavelTecnico || "—"}`));
  bodyParts.push(pSmall("Se estes campos estiverem em branco, preencha no cadastro do projeto (10 itens) e gere o laudo novamente."));
  bodyParts.push(pSpacer());

  bodyParts.push(staticToc());
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"1. APRESENTAÇÃO"));
  bodyParts.push(p("Documento gerado automaticamente a partir do aplicativo de coleta em campo, com base em formulários, checklists e evidências fotográficas georreferenciadas quando disponíveis."));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"2. INTRODUÇÃO"));
  bodyParts.push(p("Este laudo consolida o diagnóstico ambiental preliminar do empreendimento para subsidiar a regularização ambiental e o planejamento técnico da intervenção."));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"3. OBJETIVO"));
  bodyParts.push(p("Consolidar o diagnóstico ambiental preliminar do meio físico e biótico da área, com base em critérios legais e evidências de campo."));
  bodyParts.push(pH(2,"3.1. Objetivos Específicos"));
  bodyParts.push(p("• Caracterizar elementos do meio físico, incluindo água, solo e processos associados."));
  bodyParts.push(p("• Caracterizar elementos do meio biótico, incluindo flora e fauna."));
  bodyParts.push(p("• Consolidar evidências e indicar obrigações ou condicionantes prováveis."));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"4. DESCRIÇÃO DA ÁREA"));
  bodyParts.push(p(`Município/UF: ${meta.municipio || "-"} / ${meta.uf || "-"}`));
  bodyParts.push(p(`Tipo: ${meta.tipoEmpreendimento || "-"}`));
  bodyParts.push(p(`Área (ha) aprox.: ${meta.areaHa ? Number(meta.areaHa).toFixed(4) : "0"}`));
  bodyParts.push(p(`Polígono (vértices): ${(Array.isArray(meta.poligono) ? meta.poligono.length : 0)}`));
  bodyParts.push(p(`Histórico de uso: ${meta.historicoUso?.usoAnterior || "-"}`));
  bodyParts.push(p(`Cobertura vegetal (%): ${meta.coberturaVegetal || "-"}`));
  bodyParts.push(p(`Indícios de APP: ${meta.indiciosAPP?.sim ? "SIM" : "NÃO"} ${meta.indiciosAPP?.onde || ""}`.trim()));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"5. AÇÃO PROPOSTA"));
  const itv = meta.intervencoesPrevistas || {};
  [
    ["Supressão vegetal", itv.supressaoVegetal],
    ["Terraplenagem", itv.terraplenagem],
    ["Drenagem", itv.drenagem],
    ["Travessias", itv.travessias],
    ["Captação de água", itv.captacaoAgua],
    ["Poço", itv.poco],
    ["Lançamento de efluente", itv.lancamentoEfluente],
    ["Intervenção em APP", itv.intervencaoAPP],
    ["Mata Atlântica (suspeita)", itv.mataAtlanticaProvavel]
  ].forEach(([t,v]) => bodyParts.push(p(`- ${t}: ${v ? "SIM" : "NÃO/Não informado"}`)));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"6. PESQUISA DE CAMPO (METODOLOGIA)"));
  bodyParts.push(p("• Análise preliminar documental e registros do projeto."));
  bodyParts.push(p("• Vistoria de campo com registros temáticos, GPS quando disponível e evidências fotográficas."));
  bodyParts.push(p("• Identificação de corpos d’água, fragmentos vegetais, fauna e condições de solo ou processos."));
  bodyParts.push(p("• Consolidação dos achados e aplicação de regras de conformidade para geração de obrigações."));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"7. RESULTADOS E DIAGNÓSTICO AMBIENTAL"));

  bodyParts.push(pH(2,"7.1. Quadro Ambiental (Água / Flora / Fauna / Solo)"));
  bodyParts.push(p(`Corpos d’água: ${(projeto.campo?.agua || []).length}`));
  bodyParts.push(p(`Fragmentos de flora: ${(projeto.campo?.flora?.fragmentos || []).length}`));
  bodyParts.push(p(`Espécies de flora: ${(projeto.campo?.flora?.especies || []).length}`));
  bodyParts.push(p(`Registros de fauna: ${(projeto.campo?.fauna || []).length}`));
  bodyParts.push(p(`Registros de solo/processos: ${(projeto.campo?.soloProcessos || []).length}`));
  bodyParts.push(p(`Evidências fotográficas: ${(photos || []).length}`));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(2,"7.2. Conformidade Legal (Matriz de Obrigações)"));
  if (!obrigacoes.length) {
    bodyParts.push(p("Nenhuma obrigação automática foi gerada pelos gatilhos atuais."));
  } else {
    obrigacoes.forEach((o, idx) => {
      const cod = o.codigo || `QA-OBR-${String(idx+1).padStart(3,"0")}`;
      const base = (o.baseLegalIds || []).join(", ");
      bodyParts.push(p(`${idx+1}) [${cod}] ${o.titulo || "-"}`));
      bodyParts.push(pSmall(`Status: ${statusLabel(o.status)} | Prioridade: ${priLabel(o.prioridade)} | Prazo: ${o.prazo || "-"} | Responsável: ${o.responsavel || "-"}`));
      bodyParts.push(pSmall(`Base legal: ${base || "-"}`));
      if (o.descricao) bodyParts.push(pSmall(normPtBR(o.descricao)));
      if (o.notas) bodyParts.push(pSmall(`Obs.: ${normPtBR(o.notas)}`));
      bodyParts.push(pSpacer());
    });
  }

  bodyParts.push(pH(2,"7.3. Evidências por Obrigação"));
  const photoMap = new Map((photos || []).map(ph => [ph.id, ph]));
  let anyEv = false;
  obrigacoes.forEach((o, idx) => {
    const evIds = (o.evidenciasIds || []).filter(Boolean);
    if (!evIds.length) return;
    anyEv = true;
    const cod = o.codigo || `QA-OBR-${String(idx+1).padStart(3,"0")}`;
    bodyParts.push(pBold(`• [${cod}] ${o.titulo || "-"}`));
    evIds.slice(0, 20).forEach((id) => {
      const ph = photoMap.get(id);
      if (ph) {
        const coord = (ph.lat != null && ph.lng != null) ? ` (${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)})` : "";
        bodyParts.push(pSmall(`- ${fmtPtBR(ph.timestamp || ph.capturedAt)} — ${(ph.categoria || "outros").toUpperCase()} — ${normPtBR(ph.descricao || "")}${coord}`));
      } else {
        bodyParts.push(pSmall(`- ID: ${id}`));
      }
    });
    if (evIds.length > 20) bodyParts.push(pSmall(`(… +${evIds.length - 20} evidências vinculadas)`));
    bodyParts.push(pSpacer());
  });
  if (!anyEv) {
    bodyParts.push(p("Não há evidências vinculadas diretamente a obrigações. Consulte o Anexo Fotográfico."));
  }
  bodyParts.push(pSpacer());

  bodyParts.push(pH(2,"7.4. Considerações Finais"));
  bodyParts.push(p(`Pontuação de completude (0-100): ${score}%.`));
  bodyParts.push(p("O presente documento consolida o quadro ambiental preliminar e as obrigações prováveis para a regularização do empreendimento, devendo ser complementado conforme exigências específicas do município e do órgão licenciador."));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"8. CRONOGRAMA"));
  bodyParts.push(p("Preencher conforme orientações do órgão e cronograma do empreendimento. Os prazos e responsáveis podem ser registrados na matriz."));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"9. RESPONSABILIDADE TÉCNICA"));
  bodyParts.push(p(`Responsável técnico: ${(meta.responsavelTecnico && meta.responsavelTecnico.nome) || meta.responsavelTecnico || "_______________________________"}`));
  bodyParts.push(p(`Registro/ART/RRT: ${meta.responsavelTecnico?.registro || meta.art || "_______________________________"}`));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"10. RESPONSÁVEL PELO EMPREENDIMENTO"));
  bodyParts.push(p(`Empreendimento/Representante: ${meta.responsavelEmpreendimento?.nome || meta.representante || "_______________________________"}`));
  bodyParts.push(p(`CNPJ/CPF: ${meta.responsavelEmpreendimento?.documento || meta.documentoResponsavel || "_______________________________"}`));
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"11. BIBLIOGRAFIA E REFERÊNCIAS LEGAIS"));
  const refs = Array.isArray(baseLegal?.refs) ? baseLegal.refs : [];
  if (!refs.length) {
    bodyParts.push(p("Sem referências legais cadastradas na base local."));
  } else {
    refs.forEach(r => bodyParts.push(p(`- ${r.id || "-"}: ${r.title || "-"}`)));
  }
  bodyParts.push(pSpacer());

  bodyParts.push(pH(1,"12. ANEXO FOTOGRÁFICO"));
  bodyParts.push(p(`Total de fotos no projeto: ${(photos || []).length}.`));
  bodyParts.push(pSpacer());

  const maxImages = 40;
  const orderCats = ["agua","flora","fauna","solo","outros"];
  const catIdx = (c)=> {
    const x = (c || "outros").toLowerCase().trim();
    const i = orderCats.indexOf(x === "solo/processos" ? "solo" : x);
    return i === -1 ? 999 : i;
  };
  const sortTs = (iso)=> {
    const t = Date.parse(iso || "");
    return Number.isFinite(t) ? t : 0;
  };

  const photosToEmbed = (photos || []).slice()
    .sort((a,b)=> (catIdx(a.categoria)-catIdx(b.categoria)) || (sortTs(a.timestamp || a.capturedAt)-sortTs(b.timestamp || b.capturedAt)))
    .slice(0, maxImages);

  const zipEntries = [];

  const contentTypes = () => `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="0" w:after="80" w:line="300" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="180" w:after="80"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="140" w:after="60"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="120" w:after="40"/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr><w:b/><w:sz w:val="22"/></w:rPr>
  </w:style>
</w:styles>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Laudo de Caracterização Ambiental</dc:title>
  <dc:subject>Quadro Ambiental Pré-Obra</dc:subject>
  <dc:creator>Laudo Ambiental NB</dc:creator>
  <cp:lastModifiedBy>Laudo Ambiental NB</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Laudo Ambiental NB</Application>
</Properties>`;

  let docRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
`;

  let embedded = 0;
  let lastCat = null;

  for (let i = 0; i < photosToEmbed.length; i++) {
    const ph = photosToEmbed[i];
    const cat = (ph.categoria || "outros").toLowerCase().trim();

    if (cat !== lastCat) {
      bodyParts.push(pH(2, `Categoria: ${cat.toUpperCase()}`));
      bodyParts.push(pSpacer());
      lastCat = cat;
    }

    const coord = (ph.lat != null && ph.lng != null) ? ` (${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)})` : "";
    const caption = `Foto ${String(i+1).padStart(3,"0")} — ${fmtPtBR(ph.timestamp || ph.capturedAt)} — ${(cat || "outros").toUpperCase()} — ${normPtBR(ph.descricao || "")}${coord}`;

    try {
      const { bytes, width, height } = await toJpegBytes(ph.blob);
      embedded++;

      const imgName = `image${embedded}.jpg`;
      zipEntries.push({ name: `word/media/${imgName}`, data: bytes });

      const rId = `rIdImg${embedded}`;
      docRels += `  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgName}"/>\n`;

      const maxCx = 5486400;
      const maxCy = 6400800;
      const cx0 = Math.round(width * 9525);
      const cy0 = Math.round(height * 9525);
      const ratio = Math.min(maxCx/cx0, maxCy/cy0, 1);
      const cx = Math.round(cx0 * ratio);
      const cy = Math.round(cy0 * ratio);

      bodyParts.push(pSmall(caption));
      bodyParts.push(pImage(rId, cx, cy, caption));
      bodyParts.push(pSpacer());
    } catch (e) {
      bodyParts.push(pSmall(`${caption} (não embutida: erro de decodificação)`));
      bodyParts.push(pSpacer());
      console.warn("Imagem não embutida no DOCX:", ph.id, e);
    }
  }

  docRels += `</Relationships>`;

  if ((photos||[]).length > maxImages) {
    bodyParts.push(pSmall(`(Mais ${(photos||[]).length - maxImages} fotos permanecem no pacote de exportação do projeto.)`));
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyParts.join("\n")}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHdr"/>
      <w:footerReference w:type="default" r:id="rIdFtr"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zipEntries.unshift(
    { name: "[Content_Types].xml", data: new TextEncoder().encode(contentTypes()) },
    { name: "_rels/.rels", data: new TextEncoder().encode(relsRoot) },
    { name: "word/document.xml", data: new TextEncoder().encode(documentXml) },
    { name: "word/_rels/document.xml.rels", data: new TextEncoder().encode(docRels) },
    { name: "word/styles.xml", data: new TextEncoder().encode(styles) },
    { name: "word/settings.xml", data: new TextEncoder().encode(settingsXml()) },
    { name: "word/header1.xml", data: new TextEncoder().encode(headerXml({ projeto })) },
    { name: "word/footer1.xml", data: new TextEncoder().encode(footerXml()) },
    { name: "docProps/core.xml", data: new TextEncoder().encode(core) },
    { name: "docProps/app.xml", data: new TextEncoder().encode(app) }
  );

  const zipBlob = await createZipStore(zipEntries.map(e => ({ name: e.name, data: e.data })));
  const name = safeFilename(projeto.name);
  downloadBlob(zipBlob, `${name}_LAUDO_CARACTERIZACAO_AMBIENTAL.docx`);
}
