import {
  createVegetacaoLaudoFinalApi,
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator
} from './laudo_final_api.js';

import {
  buildVegetacaoLaudoFinalApiSelfTest,
  buildVegetacaoLaudoFinalApiSelfTestSnapshot,
  buildVegetacaoLaudoFinalApiSelfTestText
} from './laudo_final_api_selftest.js';

const MODULE_NAME = 'vegetacao';
const DIAGNOSTIC_NAME = 'laudo_final_api';

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
  const orchestrated = payload?.orchestrated ?? {};
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
    orchestratedCode: toText(orchestrated?.decision?.code),
    selfTestPassed: Boolean(selftest?.passed),
    selfTestScore: toNumber(selftest?.summary?.score),
    totalChecks: toNumber(selftest?.summary?.total),
    failedChecks: toNumber(selftest?.summary?.failed)
  };
}

function buildDecision(signals = {}) {
  if (!signals.hasPayload || !signals.hasSnapshot) {
    return {
      code: 'final_api_unavailable',
      label: 'API final indisponivel',
      stable: false
    };
  }

  if (!signals.hasDocx || !signals.hasPdf || !signals.hasNeutral) {
    return {
      code: 'final_api_missing_generators',
      label: 'Geradores da API final incompletos',
      stable: false
    };
  }

  if (!signals.selfTestPassed) {
    return {
      code: 'final_api_selftest_review',
      label: 'Self-test da API final requer revisao',
      stable: true
    };
  }

  if (signals.readyForLaudo) {
    return {
      code: 'final_api_ready',
      label: 'API final pronta',
      stable: true
    };
  }

  return {
    code: 'final_api_ready_pending_review',
    label: 'API final pronta, aguardando revisao final',
    stable: true
  };
}

export function buildVegetacaoLaudoFinalApiDiagnostics(model = {}, source = {}, options = {}) {
  const api = createVegetacaoLaudoFinalApi({
    ...options,
    bindGlobal: false,
    emit: false
  });

  const payload = buildVegetacaoLaudoFinalPackage(model, source, options);
  const snapshot = buildVegetacaoLaudoFinalSnapshot(model, source, options);
  const docx = buildVegetacaoLaudoFinalGenerator('docx', model, source, options);
  const pdf = buildVegetacaoLaudoFinalGenerator('pdf', model, source, options);
  const neutral = buildVegetacaoLaudoFinalGenerator('neutral', model, source, options);

  const selftest = buildVegetacaoLaudoFinalApiSelfTest(model, source, options);
  const selftestSnapshot = buildVegetacaoLaudoFinalApiSelfTestSnapshot(model, source, options);
  const selftestText = buildVegetacaoLaudoFinalApiSelfTestText(model, source, options);

  const apiBuild = api.build(model, source, options);
  const apiSnapshot = api.buildSnapshot(model, source, options);
  const apiDocx = api.buildGenerator('docx', model, source, options);
  const apiPdf = api.buildGenerator('pdf', model, source, options);
  const apiNeutral = api.buildGenerator('neutral', model, source, options);
  const apiDiagnostics = api.buildDiagnostics(model, source, options);
  const apiDiagnosticsSnapshot = api.buildDiagnosticsSnapshot(model, source, options);
  const apiOrchestrated = api.buildOrchestrated(model, source, options);
  const apiOrchestratedSnapshot = api.buildOrchestratedSnapshot(model, source, options);

  const checks = [
    createCheck(
      'api_instance',
      'API final foi instanciada',
      Boolean(
        api &&
        typeof api.build === 'function' &&
        typeof api.buildSnapshot === 'function' &&
        typeof api.buildGenerator === 'function' &&
        typeof api.buildDiagnostics === 'function' &&
        typeof api.buildOrchestrated === 'function' &&
        typeof api.publish === 'function'
      ),
      { module: api?.module ?? '' }
    ),
    createCheck(
      'payload',
      'Payload final foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.generators),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Snapshot final foi gerado',
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
      'Self-test da API final executou',
      Boolean(selftest?.summary),
      { score: selftest?.summary?.score ?? 0 }
    ),
    createCheck(
      'api_build',
      'API respondeu no build',
      Boolean(apiBuild?.module === MODULE_NAME && apiBuild?.generators),
      { module: apiBuild?.module ?? '' }
    ),
    createCheck(
      'api_snapshot',
      'API respondeu no snapshot',
      Boolean(apiSnapshot?.module === MODULE_NAME && apiSnapshot?.snapshot),
      { module: apiSnapshot?.module ?? '' }
    ),
    createCheck(
      'api_generators',
      'API respondeu nos geradores',
      Boolean(apiDocx?.content && apiPdf?.content && apiNeutral?.content),
      {
        docx: apiDocx?.generator ?? '',
        pdf: apiPdf?.generator ?? '',
        neutral: apiNeutral?.generator ?? ''
      }
    ),
    createCheck(
      'api_diagnostics',
      'API respondeu no diagnostico final',
      Boolean(apiDiagnostics?.decision && apiDiagnosticsSnapshot?.decision),
      { code: apiDiagnostics?.decision?.code ?? '' }
    ),
    createCheck(
      'api_orchestrated',
      'API respondeu no orquestrador final',
      Boolean(apiOrchestrated?.decision && apiOrchestratedSnapshot?.decision),
      { code: apiOrchestrated?.decision?.code ?? '' }
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
      selftestText: clone(selftestText),
      apiBuild: clone(apiBuild),
      apiSnapshot: clone(apiSnapshot),
      apiDiagnostics: clone(apiDiagnostics),
      apiDiagnosticsSnapshot: clone(apiDiagnosticsSnapshot),
      apiOrchestrated: clone(apiOrchestrated),
      apiOrchestratedSnapshot: clone(apiOrchestratedSnapshot)
    }
  };
}

export function buildVegetacaoLaudoFinalApiDiagnosticsSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalApiDiagnostics(model, source, options);

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

export function buildVegetacaoLaudoFinalApiDiagnosticsText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalApiDiagnostics(model, source, options);

  return {
    titulo: 'Diagnostico da API final do laudo do modulo Vegetacao',
    status: report.decision?.label ?? 'Sem status',
    score: report.summary?.score ?? 0,
    totalChecks: report.summary?.total ?? 0,
    passedChecks: report.summary?.passed ?? 0,
    failedChecks: report.summary?.failed ?? 0,
    readyForLaudo: Boolean(report.signals?.readyForLaudo)
  };
}