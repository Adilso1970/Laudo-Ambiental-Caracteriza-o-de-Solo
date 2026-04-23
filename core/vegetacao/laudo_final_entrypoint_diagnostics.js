import {
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator
} from './laudo_final_entrypoint.js';

import {
  buildVegetacaoLaudoFinalEntrypointSelfTest,
  buildVegetacaoLaudoFinalEntrypointSelfTestSnapshot,
  buildVegetacaoLaudoFinalEntrypointSelfTestText
} from './laudo_final_entrypoint_selftest.js';

const MODULE_NAME = 'vegetacao';
const DIAGNOSTIC_NAME = 'laudo_final_entrypoint';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();
const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_) {
    return value ?? null;
  }
}

function createCheck(id, label, ok, details = {}) {
  return {
    id,
    label,
    ok: Boolean(ok),
    details
  };
}

function summarizeChecks(checks = []) {
  const total = toArray(checks).length;
  const passed = toArray(checks).filter((item) => item.ok).length;
  const failed = total - passed;

  return {
    total,
    passed,
    failed,
    score: total > 0 ? Math.round((passed / total) * 100) : 0
  };
}

function buildSignals(payload = {}, snapshot = {}, docx = {}, pdf = {}, neutral = {}, selftest = {}) {
  const decision = payload?.decision ?? {};
  const diagnostics = payload?.diagnostics ?? {};
  const snapshotDecision = snapshot?.decision ?? {};

  return {
    readyForLaudo: Boolean(payload?.readyForLaudo),
    hasPayload: Boolean(payload && Object.keys(payload).length),
    hasSnapshot: Boolean(snapshot && Object.keys(snapshot).length),
    hasDocx: Boolean(docx?.content),
    hasPdf: Boolean(pdf?.content),
    hasNeutral: Boolean(neutral?.content),
    decisionCode: toText(decision.code || snapshotDecision.code),
    diagnosticsCode: toText(diagnostics?.decision?.code),
    selfTestPassed: Boolean(selftest?.passed),
    selfTestScore: toNumber(selftest?.summary?.score),
    totalChecks: toNumber(selftest?.summary?.total),
    failedChecks: toNumber(selftest?.summary?.failed)
  };
}

function buildDecision(signals = {}) {
  if (!signals.hasPayload || !signals.hasSnapshot) {
    return {
      code: 'entrypoint_unavailable',
      label: 'Entrypoint final indisponivel',
      stable: false
    };
  }

  if (!signals.hasDocx || !signals.hasPdf || !signals.hasNeutral) {
    return {
      code: 'entrypoint_missing_generators',
      label: 'Geradores do entrypoint final incompletos',
      stable: false
    };
  }

  if (!signals.selfTestPassed) {
    return {
      code: 'entrypoint_selftest_review',
      label: 'Self-test do entrypoint final requer revisao',
      stable: true
    };
  }

  if (signals.readyForLaudo) {
    return {
      code: 'entrypoint_ready',
      label: 'Entrypoint final pronto',
      stable: true
    };
  }

  return {
    code: 'entrypoint_ready_pending_review',
    label: 'Entrypoint final pronto, aguardando revisao final',
    stable: true
  };
}

export function buildVegetacaoLaudoFinalEntrypointDiagnostics(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoFinalPackage(model, source, options);
  const snapshot = buildVegetacaoLaudoFinalSnapshot(model, source, options);
  const docx = buildVegetacaoLaudoFinalGenerator('docx', model, source, options);
  const pdf = buildVegetacaoLaudoFinalGenerator('pdf', model, source, options);
  const neutral = buildVegetacaoLaudoFinalGenerator('neutral', model, source, options);

  const selftest = buildVegetacaoLaudoFinalEntrypointSelfTest(model, source, options);
  const selftestSnapshot = buildVegetacaoLaudoFinalEntrypointSelfTestSnapshot(model, source, options);
  const selftestText = buildVegetacaoLaudoFinalEntrypointSelfTestText(model, source, options);

  const checks = [
    createCheck(
      'payload',
      'Entrypoint final gerou payload',
      Boolean(payload?.module === MODULE_NAME && payload?.generators),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Entrypoint final gerou snapshot',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.snapshot),
      { module: snapshot?.module ?? '' }
    ),
    createCheck(
      'docx',
      'Gerador DOCX final disponivel',
      Boolean(docx?.content && docx?.generator === 'docx'),
      { generator: docx?.generator ?? '' }
    ),
    createCheck(
      'pdf',
      'Gerador PDF final disponivel',
      Boolean(pdf?.content && pdf?.generator === 'pdf'),
      { generator: pdf?.generator ?? '' }
    ),
    createCheck(
      'neutral',
      'Gerador neutro final disponivel',
      Boolean(neutral?.content && neutral?.generator === 'neutral'),
      { generator: neutral?.generator ?? '' }
    ),
    createCheck(
      'selftest',
      'Self-test do entrypoint final executou',
      Boolean(selftest?.summary),
      { score: selftest?.summary?.score ?? 0 }
    ),
    createCheck(
      'decision',
      'Entrypoint final retornou decisao tecnica',
      Boolean(payload?.decision && typeof payload.decision === 'object'),
      { code: payload?.decision?.code ?? '' }
    )
  ];

  const summary = summarizeChecks(checks);
  const signals = buildSignals(payload, snapshot, docx, pdf, neutral, selftest);
  const decision = buildDecision(signals);

  return {
    version: 1,
    module: MODULE_NAME,
    diagnostic: DIAGNOSTIC_NAME,
    generatedAt: new Date().toISOString(),
    decision,
    summary,
    checks,
    signals,
    snapshots: {
      payload: clone(payload),
      snapshot: clone(snapshot),
      docx: clone(docx),
      pdf: clone(pdf),
      neutral: clone(neutral),
      selftest: clone(selftest),
      selftestSnapshot: clone(selftestSnapshot),
      selftestText: clone(selftestText)
    }
  };
}

export function buildVegetacaoLaudoFinalEntrypointDiagnosticsSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalEntrypointDiagnostics(model, source, options);

  return {
    version: report.version,
    module: report.module,
    diagnostic: report.diagnostic,
    generatedAt: report.generatedAt,
    decision: report.decision,
    summary: report.summary,
    signals: report.signals,
    checks: report.checks.map((item) => ({
      id: item.id,
      label: item.label,
      ok: item.ok
    }))
  };
}

export function buildVegetacaoLaudoFinalEntrypointDiagnosticsText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalEntrypointDiagnostics(model, source, options);

  return {
    titulo: 'Diagnostico do entrypoint final do laudo do modulo Vegetacao',
    status: report.decision?.label ?? 'Sem status',
    score: report.summary?.score ?? 0,
    totalChecks: report.summary?.total ?? 0,
    passedChecks: report.summary?.passed ?? 0,
    failedChecks: report.summary?.failed ?? 0,
    readyForLaudo: Boolean(report.signals?.readyForLaudo)
  };
}