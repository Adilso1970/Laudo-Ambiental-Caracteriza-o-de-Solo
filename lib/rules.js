export async function loadBaseLegalLocal() {
  const res = await fetch("./data/base_legal.json");
  if (!res.ok) throw new Error("Falha ao carregar base_legal.json");
  return await res.json();
}

export async function syncBaseLegalOnline() {
  // Netlify Functions (quando app estiver publicado). Em localhost pode falhar.
  const res = await fetch("/.netlify/functions/base-legal");
  if (!res.ok) throw new Error("Falha ao buscar base legal online");
  return await res.json();
}

export function buildObrigacoes(projeto) {
  // Gera obrigações automáticas por gatilhos, mas preserva o que o usuário já editou
  // (status, prazo, responsável, notas, vínculos de evidências).
  const prev = Array.isArray(projeto?.conformidade?.obrigacoes) ? projeto.conformidade.obrigacoes : [];
  const prevMap = new Map();
  for (const o of prev) {
    const key = o.key || `${o.titulo||""}||${(o.baseLegalIds||[]).slice().sort().join(",")}`;
    prevMap.set(key, o);
  }

  const next = [];
  const usedPrevKeys = new Set();

  const meta = projeto.meta || {};
  const interv = meta.intervencoesPrevistas || {};
  const agua = projeto.campo?.agua || [];
  const flora = projeto.campo?.flora?.especies || [];
  const fauna = projeto.campo?.fauna || [];

  const makeKey = (titulo, baseLegalIds) => `${titulo}||${(baseLegalIds||[]).slice().sort().join(",")}`;

  const merge = (base, extraEvidenceIds = []) => {
    const key = base.key;
    const prevO = prevMap.get(key);
    if (prevO) usedPrevKeys.add(key);

    const merged = {
      // defaults / base
      ...base,
      // preserve user fields if exist
      ...(prevO ? {
        id: prevO.id || base.id,
        codigo: prevO.codigo || base.codigo,
        status: prevO.status ?? base.status,
        prioridade: prevO.prioridade ?? base.prioridade,
        prazo: prevO.prazo ?? base.prazo,
        responsavel: prevO.responsavel ?? base.responsavel,
        notas: prevO.notas ?? base.notas,
        aplicavel: prevO.aplicavel ?? base.aplicavel,
      } : {}),
    };

    const ev = new Set([...(prevO?.evidenciasIds || []), ...(base.evidenciasIds || []), ...(extraEvidenceIds || [])]);
    merged.evidenciasIds = Array.from(ev).filter(Boolean);

    return merged;
  };

  const push = (titulo, descricao, baseLegalIds, evidenciasIds = [], prioridade = "media") => {
    const key = makeKey(titulo, baseLegalIds);
    const base = {
      id: crypto.randomUUID(),
      key,
      codigo: "", // atribuído depois
      titulo,
      descricao,
      baseLegalIds,
      evidenciasIds: Array.from(new Set(evidenciasIds)).filter(Boolean),
      status: "pendente", // pendente | andamento | concluido | nao_aplica
      prioridade,        // alta | media | baixa
      prazo: "",
      responsavel: "",
      notas: "",
      aplicavel: true,
      auto: true
    };
    next.push(merge(base));
  };

  // --- Gatilhos ---

  // 1) Água -> APP
  if (agua.length > 0) {
    const ev = [];
    for (const a of agua) (a.fotosIds || []).forEach(id => ev.push(id));
    push(
      "Delimitar APP e compatibilizar implantação",
      "Há registros de corpos d’água/nascentes/drenagens. Delimitar APPs aplicáveis, compatibilizar a implantação do empreendimento e definir medidas de proteção (afastamentos, drenagem, controle de erosão e assoreamento).",
      ["LEI_12651_2012"],
      ev,
      "alta"
    );
  }

  // 2) Intervenção em APP
  if (interv.intervencaoAPP === true) {
    push(
      "Avaliar autorização/intervenção e condicionantes em APP",
      "Foi indicada intervenção prevista em área sensível/APP. Avaliar necessidade de autorizações específicas, condicionantes do órgão competente e medidas de compensação/mitigação, conforme rito do licenciamento.",
      ["LEI_12651_2012", "CONAMA_237_1997"],
      [],
      "alta"
    );
  }

  // 3) Passivo/contaminação
  const indicios = (meta.historicoUso?.indicios || []).map(s => String(s).toLowerCase());
  const alvo = ["posto","oficina","industria","indústria","descarte","mancha","odor","aterro","tanque","resíduo","residuo"];
  if (indicios.some(x => alvo.includes(x))) {
    push(
      "Triagem de passivo ambiental (CONAMA 420/2009)",
      "O histórico/indícios apontam possibilidade de passivo ambiental. Recomenda-se triagem e, se necessário, investigação por etapas, definindo amostragem e parÃ¢metros compatíveis (solo/água subterrÃ¢nea).",
      ["CONAMA_420_2009"],
      [],
      "alta"
    );
  }

  // 4) Captação/poço -> outorga
  if (interv.captacaoAgua === true || interv.poco === true) {
    push(
      "Avaliar outorga/regularização do uso da água",
      "Foi indicada captação de água e/ou poço. Avaliar necessidade de outorga/regularização, incluindo enquadramento de águas subterrÃ¢neas e requisitos locais do órgão gestor.",
      ["LEI_9433_1997", "CONAMA_396_2008"],
      [],
      "media"
    );
  }

  // 5) Espécies ameaçadas
  const ameacadas = [...flora, ...fauna].filter(x => (x.ameacada || x.ameaçada) === "sim");
  if (ameacadas.length > 0) {
    push(
      "Medidas específicas para espécies ameaçadas",
      "Foram registradas espécies ameaçadas (ou indicação de ameaça). Recomenda-se reforço do diagnóstico e medidas específicas (evitar supressão/impacto, manejo/monitoramento e condicionantes do órgão competente).",
      ["PORTARIA_MMA_148_2022"],
      [],
      "alta"
    );
  }

  // 6) Mata Atlântica provável
  if (interv.mataAtlanticaProvavel === true) {
    push(
      "Regras específicas para Mata AtlÃ¢ntica",
      "Foi indicada provável inserção em área de Mata AtlÃ¢ntica. Aplicam-se regras específicas para supressão/estágio sucessional e autorizações correlatas.",
      ["LEI_11428_2006"],
      [],
      "alta"
    );
  }

  // 7) Supressão vegetal (gatilho do 10 itens)
  if (interv.supressaoVegetal === true) {
    push(
      "Avaliar supressão vegetal e compensações",
      "Foi indicada supressão vegetal. Avaliar autorizações, critérios locais e condicionantes; definir compensações/plantios e medidas de mitigação.",
      ["CONAMA_369_2006", "LEI_12651_2012"],
      [],
      "alta"
    );
  }

  // 8) Terraplenagem / drenagem
  if (interv.terraplenagem === true || interv.drenagem === true || interv.travessiasDrenagens === true) {
    push(
      "Controle de erosão, sedimentos e drenagem",
      "Há previsão de terraplenagem/drenagem/travessias. Implementar medidas de controle de erosão e sedimentos, proteção de taludes, caixas de retenção e boas práticas construtivas.",
      ["CONAMA_237_1997"],
      [],
      "media"
    );
  }

  // 9) % permeável (estrutura do laudo modelo)
  if (typeof meta.areaPermeavelPercent === "number" && meta.areaPermeavelPercent > 0) {
    push(
      "Verificar atendimento de percentual mínimo de permeabilidade",
      "Registrar e verificar o atendimento do percentual mínimo de permeabilidade do solo exigido para o empreendimento (ex.: 20%), conforme diretrizes locais e do processo.",
      ["CONAMA_237_1997"],
      [],
      "media"
    );
  }

  // Atribuir códigos estáveis (QA-OBR-001...) respeitando existentes
  let n = 1;
  for (const o of next) {
    if (!o.codigo) {
      o.codigo = `QA-OBR-${String(n).padStart(3,"0")}`;
    }
    n += 1;
  }

  // Mantém obrigações antigas que não estão mais aplicáveis (não apaga)
  for (const [key, o] of prevMap.entries()) {
    if (usedPrevKeys.has(key)) continue;
    next.push({
      ...o,
      key: o.key || key,
      aplicavel: false,
      auto: o.auto ?? true
    });
  }

  // Atribui códigos sequenciais se ainda não existirem (estável para laudo e rastreio)
  next.forEach((o, i) => {
    if (!o.codigo || !String(o.codigo).trim()) {
      o.codigo = `QA-OBR-${String(i+1).padStart(3,"0")}`;
    }
  });


  return next;
}

export function computeCompleteness(projeto) {
  // Pontuação simples (0-100) para ajudar a não gerar laudo incompleto.
  const meta = projeto.meta || {};
  const required = [
    !!meta.uf,
    !!meta.municipio,
    !!meta.tipoEmpreendimento,
    Array.isArray(meta.poligono) && meta.poligono.length >= 3,
    meta.areaHa > 0
  ];
  const aguaOk = (projeto.campo?.agua || []).length > 0;
  const floraOk = (projeto.campo?.flora?.fragmentos || []).length > 0 || (projeto.campo?.flora?.especies || []).length > 0;
  const faunaOk = (projeto.campo?.fauna || []).length > 0;
  const fotosCount = (projeto.evidencias?.fotos || []).length;

  let score = 0;
  score += required.filter(Boolean).length * 12; // 60
  score += (aguaOk ? 10 : 0);
  score += (floraOk ? 10 : 0);
  score += (faunaOk ? 10 : 0);
  score += (fotosCount >= 10 ? 10 : (fotosCount >= 3 ? 6 : (fotosCount >= 1 ? 3 : 0)));

  return Math.min(100, score);
}

// Aproximação para área/perímetro (não substitui levantamento topográfico)
export function approxAreaPerimeterHa(polygonLatLng) {
  if (!Array.isArray(polygonLatLng) || polygonLatLng.length < 3) return { areaHa: 0, perimeterM: 0 };
  const R = 6371000;
  const lat0 = polygonLatLng.reduce((s,p)=>s+p.lat,0)/polygonLatLng.length * Math.PI/180;
  const proj = (p) => {
    const x = R * (p.lng * Math.PI/180) * Math.cos(lat0);
    const y = R * (p.lat * Math.PI/180);
    return {x,y};
  };
  const pts = polygonLatLng.map(proj);
  let area = 0;
  let per = 0;
  for (let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    area += pts[i].x*pts[j].y - pts[j].x*pts[i].y;
    const dx=pts[j].x-pts[i].x, dy=pts[j].y-pts[i].y;
    per += Math.hypot(dx,dy);
  }
  area = Math.abs(area)/2;
  return { areaHa: area/10000, perimeterM: per };
}
