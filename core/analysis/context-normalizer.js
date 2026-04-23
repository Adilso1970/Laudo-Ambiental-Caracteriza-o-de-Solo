function pickFirstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "sim", "yes", "1"].includes(normalized)) return true;
    if (["false", "nao", "não", "no", "0", ""].includes(normalized)) return false;
  }
  return Boolean(value);
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeStatus(value, fallback = "indefinido") {
  const raw = String(value ?? fallback).trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "regular") return "conforme";
  return raw;
}

function countEvidence(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value.items)) return value.items.length;
    if (typeof value.quantidade === "number") return value.quantidade;
  }
  return 0;
}

export function normalizeProjectContext(raw = {}) {
  const projeto      = pickFirstDefined([raw.projeto, raw.project, raw.projetos, {}]) ?? {};
  const agua         = pickFirstDefined([raw.agua, raw.water, {}]) ?? {};
  const flora        = pickFirstDefined([raw.flora, {}]) ?? {};
  const fauna        = pickFirstDefined([raw.fauna, {}]) ?? {};
  const solo         = pickFirstDefined([raw.solo, raw.soloProcessos, raw.solo_processos, raw.processos, {}]) ?? {};
  const evidencias   = pickFirstDefined([raw.evidencias, raw.evidence, raw.anexos, []]);
  const conformidade = pickFirstDefined([raw.conformidade, raw.compliance, {}]) ?? {};
  const laudo        = pickFirstDefined([raw.laudo, raw.report, {}]) ?? {};

  const projetoId = pickFirstDefined([
    projeto.id,
    projeto.codigo,
    projeto.uuid,
    raw.id,
    raw.projetoId
  ]);

  return {
    projeto: {
      id: Boolean(projetoId),
      codigo: String(projetoId ?? "")
    },
    agua: {
      alteracaoIdentificada: toBoolean(
        pickFirstDefined([
          agua.alteracaoIdentificada,
          agua.alterado,
          agua.temAlteracao,
          agua.irregularidade,
          false
        ])
      )
    },
    flora: {
      impactoIdentificado: toBoolean(
        pickFirstDefined([
          flora.impactoIdentificado,
          flora.impacto,
          flora.alteracao,
          false
        ])
      )
    },
    fauna: {
      impactoIdentificado: toBoolean(
        pickFirstDefined([
          fauna.impactoIdentificado,
          fauna.impacto,
          fauna.alteracao,
          false
        ])
      )
    },
    solo: {
      indicioRelevante: toBoolean(
        pickFirstDefined([
          solo.indicioRelevante,
          solo.indicio,
          solo.alteracaoRelevante,
          solo.contaminacaoSuspeita,
          false
        ])
      )
    },
    evidencias: {
      quantidade: toNumber(
        pickFirstDefined([
          countEvidence(evidencias),
          evidencias.quantidade,
          0
        ]),
        0
      )
    },
    conformidade: {
      status: normalizeStatus(
        pickFirstDefined([
          conformidade.status,
          conformidade.resultado,
          conformidade.situacao,
          "indefinido"
        ])
      )
    },
    laudo: {
      temObservacaoAgua: toBoolean(
        pickFirstDefined([
          laudo.temObservacaoAgua,
          laudo.observacaoAgua,
          laudo.mencionaAgua,
          false
        ])
      )
    },
    meta: {
      normalizedAt: new Date().toISOString(),
      sourceMode: "local-first"
    },
    _raw: raw
  };
}
