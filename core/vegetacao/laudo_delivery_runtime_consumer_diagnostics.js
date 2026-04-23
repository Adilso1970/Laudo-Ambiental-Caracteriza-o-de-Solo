import {
  buildVegetacaoLaudoRuntimeConsumerPayload,
  buildVegetacaoLaudoRuntimeConsumerSnapshot,
  buildVegetacaoLaudoRuntimeGeneratorInput
} from './laudo_delivery_runtime_consumer.js';

import {
  buildVegetacaoLaudoRuntimeConsumerSelfTest,
  buildVegetacaoLaudoRuntimeConsumerSelfTestSnapshot,
  buildVegetacaoLaudoRuntimeConsumerSelfTestText
} from './laudo_delivery_runtime_consumer_selftest.js';

const MODULE_NAME = 'vegetacao';
const DIAGNOSTIC_NAME = 'laudo_delivery_runtime_consumer';

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
  return {
    readyForLaudo: Boolean(payload.readyForLaudo),
    hasPayload: Boolean(payload && Object.keys(payload).length),
    hasSnapshot: Boolean(snapshot && Object.keys(snapshot).length),
    hasDocx: Boolean(docx?.content),
    hasPdf: Boolean(pdf?.content),
    hasNeutral: Boolean(neutral?.content),
    diagnosticsSections: toNumber(snapshot?.orchestratorSnapshot?.snapshot?.totalSections),
    diagnosticsAppendices: toNumber(snapshot?.orchestratorSnapshot?.snapshot?.totalAppendices),
    diagnosticsHooks: toNumber(snapshot?.orchestratorSnapshot?.snapshot?.totalHooks),
    selfTestPassed: Boolean(selftest?.passed),
    selfTestScore: toNumber(selftest?.summary?.score)
  };
}

function buildDecision(signals = {}) {
  if (!signals.hasPayload || !signals.hasSnapshot) {
    return {
      code: 'consumer_runtime_incomplete',
      label: 'Consumer runtime incompleto',
      stable: false
    };
  }

  if (!signals.hasDocx || !signals.hasPdf || !signals.hasNeutral) {
    return {
      code: 'consumer_runtime_missing_generator_inputs',
      label: 'Entradas dos geradores incompletas',
      stable: false
    };
  }

  if (!signals.selfTestPassed) {
    return {
      code: 'consumer_runtime_selftest_review',
      label: 'Self-test do consumer runtime requer revisao',
      stable: true
    };
  }

  if (signals.readyForLaudo) {
    return {
      code: 'consumer_runtime_ready_for_generator',
      label: 'Consumer runtime pronto para geradores',
      stable: true
    };
  }

  return {
    code: 'consumer_runtime_ready_pending_review',
    label: 'Consumer runtime pronto, aguardando revisao final',
    stable: true
  };
}

export function buildVegetacaoLaudoRuntimeConsumerDiagnostics(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoRuntimeConsumerPayload(model, source, options);
  const snapshot = buildVegetacaoLaudoRuntimeConsumerSnapshot(model, source, options);
  const docx = buildVegetacaoLaudoRuntimeGeneratorInput('docx', model, source, options);
  const pdf = buildVegetacaoLaudoRuntimeGeneratorInput('pdf', model, source, options);
  const neutral = buildVegetacaoLaudoRuntimeGeneratorInput('neutral', model, source, options);

  const selftest = buildVegetacaoLaudoRuntimeConsumerSelfTest(model, source, options);
  const selftestSnapshot = buildVegetacaoLaudoRuntimeConsumerSelfTestSnapshot(model, source, options);
  const selftestText = buildVegetacaoLaudoRuntimeConsumerSelfTestText(model, source, options);

  const checks = [
    createCheck(
      'payload',
      'Payload do consumer runtime foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.generators),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Snapshot do consumer runtime foi gerado',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.signals),
      { key: snapshot?.key ?? '' }
    ),
    createCheck(
      'docx',
      'Entrada DOCX disponivel',
      Boolean(docx?.content && docx?.generator === 'docx'),
      { generator: docx?.generator ?? '' }
    ),
    createCheck(
      'pdf',
      'Entrada PDF disponivel',
      Boolean(pdf?.content && pdf?.generator === 'pdf'),
      { generator: pdf?.generator ?? '' }
    ),
    createCheck(
      'neutral',
      'Entrada neutra disponivel',
      Boolean(neutral?.content && neutral?.generator === 'neutral'),
      { generator: neutral?.generator ?? '' }
    ),
    createCheck(
      'selftest',
      'Self-test do consumer runtime executou',
      Boolean(selftest?.summary),
      { score: selftest?.summary?.score ?? 0 }
    ),
    createCheck(
      'orchestrator_snapshot',
      'Snapshot do orquestrador runtime veio embarcado',
      Boolean(snapshot?.orchestratorSnapshot),
      {
        totalSections: snapshot?.orchestratorSnapshot?.snapshot?.totalSections ?? 0
      }
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

export function buildVegetacaoLaudoRuntimeConsumerDiagnosticsSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoRuntimeConsumerDiagnostics(model, source, options);

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

export function buildVegetacaoLaudoRuntimeConsumerDiagnosticsText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoRuntimeConsumerDiagnostics(model, source, options);

  return {
    titulo: 'Diagnostico do consumer runtime da entrega do laudo do modulo Vegetacao',
    status: report.decision?.label ?? 'Sem status',
    score: report.summary?.score ?? 0,
    totalChecks: report.summary?.total ?? 0,
    passedChecks: report.summary?.passed ?? 0,
    failedChecks: report.summary?.failed ?? 0,
    readyForLaudo: Boolean(report.signals?.readyForLaudo)
  };
}