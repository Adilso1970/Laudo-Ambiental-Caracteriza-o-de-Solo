import { buildVegetacaoHandoffPackage } from './handoff_service.js';
import { buildVegetacaoReadinessReport } from './readiness_service.js';
import { buildVegetacaoHealthcheckSnapshot } from './healthcheck.js';

const MODULE_NAME = 'vegetacao';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function safeObject(value) {
  return typeof value === 'object' && value !== null ? value : {};
}

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

function normalizeInput(input = {}) {
  return {
    project: safeObject(input.project),
    sessionId: toText(input.sessionId),
    activeSectorId: toText(input.activeSectorId),
    captures: toArray(input.captures),
    sectors: toArray(input.sectors),
    threshold: toNumber(input.threshold || 60) || 60,
    metadata: safeObject(input.metadata)
  };
}

function formatNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(toNumber(value));
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0
  }).format(toNumber(value));
}

function formatLocation(project = {}) {
  const municipio = toText(project.municipio);
  const uf = toText(project.uf).toUpperCase();

  return [municipio, uf].filter(Boolean).join(' - ');
}

function buildProjetoResumo(project = {}) {
  return {
    projectId: toText(project.projectId),
    nomeProjeto: toText(project.nomeProjeto || project.nome || project.name || project.titulo || project.projectId),
    localizacao: formatLocation(project),
    areaHa: toNumber(project.areaHa),
    contextoTerritorial: toText(project.contextoTerritorial)
  };
}

function buildIndicadores(report = {}, handoff = {}) {
  const resumo = safeObject(report.pipeline?.analysis?.resumo);
  const summary = safeObject(handoff.executiveSummary);

  return {
    totalCapturas: toNumber(resumo.totalCapturas || summary.totalCapturas),
    totalSetores: toNumber(resumo.totalSetores || summary.totalSetores),
    especiesMapeadas: toNumber(resumo.especiesMapeadas || summary.especiesMapeadas),
    individuosEstimados: toNumber(resumo.individuosEstimados || summary.individuosEstimados),
    areaOcupadaEstimadaM2: toNumber(resumo.areaOcupadaEstimadaM2 || summary.areaOcupadaEstimadaM2),
    duplicateCandidates: toNumber(resumo.duplicateCandidates || summary.duplicateCandidates),
    pendenciasAbertas: toNumber(resumo.pendenciasAbertas || summary.pendenciasAbertas)
  };
}

function buildMetodologia(report = {}) {
  const pipeline = safeObject(report.pipeline);
  const porModo = toArray(pipeline.analysis?.porModo);
  const modos = porModo
    .map((item) => toText(item.mode))
    .filter(Boolean)
    .map((mode) => {
      if (mode === 'arvore_isolada') return 'árvore isolada';
      if (mode === 'panorama_assistido') return 'panorama assistido';
      if (mode === 'mosaico_setorial') return 'mosaico por setores';
      return mode;
    });

  const metodologia = [
    'O levantamento técnico de vegetação foi estruturado por sessão auditável, com vinculação das capturas ao projeto corrente e aos setores de campo definidos no módulo.',
    'As evidências foram organizadas por setor ativo, mantendo rastreabilidade interna para futura conferência, revisão e consolidação documental.',
    'O processamento atual utiliza pré-análise não destrutiva, com preparação para deduplicação técnica entre imagens e para integração controlada ao laudo final.'
  ];

  if (modos.length > 0) {
    metodologia.push(
      `Nesta rodada foram utilizados os seguintes modos de captura: ${modos.join(', ')}.`
    );
  }

  return metodologia;
}

function buildAchados(report = {}, indicadores = {}) {
  const pipeline = safeObject(report.pipeline);
  const porEspecie = toArray(pipeline.analysis?.porEspecie).slice(0, 5);
  const porSetor = toArray(pipeline.analysis?.porSetor).slice(0, 5);

  const linhas = [
    `Foram registradas ${formatInteger(indicadores.totalCapturas)} captura(s) técnicas distribuídas em ${formatInteger(indicadores.totalSetores)} setor(es) de levantamento.`,
    `A pré-análise consolidada identificou ${formatInteger(indicadores.especiesMapeadas)} espécie(s) mapeada(s), com estimativa de ${formatInteger(indicadores.individuosEstimados)} indivíduo(s) e ocupação aproximada de ${formatNumber(indicadores.areaOcupadaEstimadaM2)} mÂ².`
  ];

  if (porEspecie.length > 0) {
    const resumoEspecies = porEspecie.map((item) => {
      const especie = toText(item.especie || 'Não identificada');
      return `${especie} (${formatInteger(item.individuos)} indivíduo(s))`;
    }).join('; ');

    linhas.push(`Entre os registros com maior representatividade técnica nesta etapa destacam-se: ${resumoEspecies}.`);
  }

  if (porSetor.length > 0) {
    const resumoSetores = porSetor.map((item) => {
      const setor = toText(item.setor || 'Sem setor');
      return `${setor} (${formatInteger(item.capturas)} captura(s))`;
    }).join('; ');

    linhas.push(`A distribuição espacial preliminar por setor indica maior concentração de registros em: ${resumoSetores}.`);
  }

  return linhas;
}

function buildPendencias(report = {}, indicadores = {}) {
  const pendencias = toArray(report.pipeline?.analysis?.pendencias);

  if (pendencias.length > 0) {
    return pendencias.map((item) => toText(item)).filter(Boolean);
  }

  const linhas = [];

  if (indicadores.duplicateCandidates > 0) {
    linhas.push(`${formatInteger(indicadores.duplicateCandidates)} captura(s) permanecem sinalizadas como candidatas Ã  deduplicação técnica.`);
  }

  if (indicadores.pendenciasAbertas > 0) {
    linhas.push(`${formatInteger(indicadores.pendenciasAbertas)} pendência(s) ainda requer(em) revisão especializada antes da consolidação final.`);
  }

  if (linhas.length === 0) {
    linhas.push('No estado atual da sessão, não há pendências técnicas impeditivas para a próxima etapa de integração documental do módulo.');
  }

  return linhas;
}

function buildConclusao(report = {}, indicadores = {}, healthcheck = {}) {
  const decision = safeObject(report.decision);
  const healthSummary = safeObject(healthcheck.summary);

  if (decision.code === 'ready_for_laudo') {
    return 'Os resultados consolidados do módulo Vegetação indicam condição técnica favorável para integração controlada ao laudo, mantendo-se a necessidade de validação especializada final quando aplicável.';
  }

  if (decision.code === 'review_required') {
    return `Os resultados já permitem continuidade técnica do processo, porém a consolidação final no laudo deve considerar revisão das pendências abertas e dos candidatos de deduplicação ainda existentes. Score atual do healthcheck técnico: ${formatInteger(healthSummary.score)}%.`;
  }

  if (decision.code === 'blocked_structure') {
    return 'A consolidação final desta seção ainda depende da correção de inconsistências estruturais da sessão técnica antes da integração definitiva ao laudo.';
  }

  return 'A seção técnica de vegetação foi estruturada e consolidada para continuidade do fluxo documental, permanecendo apta para os próximos tratamentos especializados previstos no app.';
}

export function buildVegetacaoLaudoSection(input = {}) {
  const normalized = normalizeInput(input);
  const report = buildVegetacaoReadinessReport(normalized);
  const handoff = buildVegetacaoHandoffPackage(normalized);
  const healthcheck = buildVegetacaoHealthcheckSnapshot(normalized);

  const projeto = buildProjetoResumo(report.validation?.project ?? normalized.project);
  const indicadores = buildIndicadores(report, handoff);

  return {
    version: 1,
    module: MODULE_NAME,
    generatedAt: new Date().toISOString(),
    readyForLaudo: Boolean(report.decision?.readyForLaudo),
    projeto,
    indicadores,
    secoes: {
      objetivo: [
        'Esta seção apresenta a consolidação técnica preliminar do módulo Vegetação / Supressão / Compensação, com base nas evidências registradas na sessão auditável do projeto.'
      ],
      metodologia: buildMetodologia(report),
      achados: buildAchados(report, indicadores),
      pendencias: buildPendencias(report, indicadores),
      conclusao: [
        buildConclusao(report, indicadores, healthcheck)
      ]
    },
    referenciasInternas: {
      decision: clone(report.decision),
      healthcheck: clone(healthcheck),
      handoffSnapshot: clone(handoff.handoffSnapshot ?? handoff.readinessSummary ?? null)
    }
  };
}

export function buildVegetacaoLaudoSectionSnapshot(input = {}) {
  const section = buildVegetacaoLaudoSection(input);

  return {
    version: section.version,
    module: section.module,
    generatedAt: section.generatedAt,
    readyForLaudo: section.readyForLaudo,
    projeto: section.projeto,
    indicadores: section.indicadores
  };
}

export function buildVegetacaoLaudoSectionText(input = {}) {
  const section = buildVegetacaoLaudoSection(input);

  const blocos = [
    'VEGETAÇÃO / SUPRESSÃO / COMPENSAÇÃO',
    '',
    'OBJETIVO',
    ...section.secoes.objetivo,
    '',
    'METODOLOGIA',
    ...section.secoes.metodologia,
    '',
    'ACHADOS TÉCNICOS',
    ...section.secoes.achados,
    '',
    'PENDÃŠNCIAS E OBSERVAÇÃ•ES',
    ...section.secoes.pendencias,
    '',
    'CONCLUSÃO',
    ...section.secoes.conclusao
  ];

  return blocos.join('\n');
}