import {
  buildVegetacaoLaudoDeliveryRuntimePayload,
  buildVegetacaoLaudoDeliveryRuntimeSnapshot
} from './laudo_delivery_runtime_bridge.js';

import {
  createVegetacaoLaudoDeliveryRuntimeBootstrap
} from './laudo_delivery_runtime_bootstrap.js';

import {
  createVegetacaoLaudoDeliveryRuntimeApi
} from './laudo_delivery_runtime_api.js';

import {
  buildVegetacaoLaudoDeliveryRuntimeSelfTest,
  buildVegetacaoLaudoDeliveryRuntimeSelfTestSnapshot,
  buildVegetacaoLaudoDeliveryRuntimeSelfTestText
} from './laudo_delivery_runtime_selftest.js';

const MODULE_NAME = 'vegetacao';
const DIAGNOSTIC_NAME = 'laudo_delivery_runtime';

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

function buildSignals(payload = {}, snapshot = {}, bootstrapState = {}, apiState = {}, selftest = {}) {
  const contract = safeObject(payload.contract);
  const bridgeSnapshot = safeObject(snapshot.snapshot);

  return {
    readyForLaudo: Boolean(payload.readyForLaudo),
    hasPayload: Boolean(payload.payload),
    hasSnapshot: Boolean(snapshot.snapshot),
    hasDocxContract: Boolean(contract.docx),
    hasPdfContract: Boolean(contract.pdf),
    hasNeutralContract: Boolean(contract.neutral),
    bootstrapStarted: Boolean(bootstrapState.started),
    apiHasPayload: Boolean(apiState.payload),
    apiHasSnapshot: Boolean(apiState.snapshot),
    selfTestPassed: Boolean(selftest.passed),
    selfTestScore: toNumber(selftest.summary?.score),
    totalSections: toNumber(bridgeSnapshot.totalSections),
    totalAppendices: toNumber(bridgeSnapshot.totalAppendices),
    totalHooks: toNumber(bridgeSnapshot.totalHooks)
  };
}

function buildDecision(signals = {}) {
  if (!signals.hasPayload || !signals.hasSnapshot) {
    return {
      code: 'runtime_chain_incomplete',
      label: 'Cadeia runtime incompleta',
      stable: false
    };
  }

  if (!signals.hasDocxContract || !signals.hasPdfContract || !signals.hasNeutralContract) {
    return {
      code: 'runtime_contract_incomplete',
      label: 'Contrato runtime incompleto',
      stable: false
    };
  }

  if (!signals.bootstrapStarted || !signals.apiHasPayload || !signals.apiHasSnapshot) {
    return {
      code: 'runtime_bootstrap_review',
      label: 'Bootstrap runtime requer revisao',
      stable: true
    };
  }

  if (!signals.selfTestPassed) {
    return {
      code: 'runtime_selftest_review',
      label: 'Self-test runtime requer revisao',
      stable: true
    };
  }

  if (signals.readyForLaudo) {
    return {
      code: 'runtime_ready_for_generator',
      label: 'Runtime pronto para geradores',
      stable: true
    };
  }

  return {
    code: 'runtime_ready_pending_review',
    label: 'Runtime pronto, aguardando revisao final',
    stable: true
  };
}

export function buildVegetacaoLaudoDeliveryRuntimeDiagnostics(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoDeliveryRuntimePayload(model, source, options);
  const snapshot = buildVegetacaoLaudoDeliveryRuntimeSnapshot(model, source, options);

  const bootstrap = createVegetacaoLaudoDeliveryRuntimeBootstrap({
    ...options,
    bindGlobal: false
  });

  const api = createVegetacaoLaudoDeliveryRuntimeApi({
    ...options,
    bindGlobal: false
  });

  const bootstrapState = bootstrap.getState();
  const apiState = {
    payload: api.build(model, source, options),
    snapshot: api.buildSnapshot(model, source, options),
    bridgeState: api.getBridgeState(),
    bootstrapState: api.getBootstrapState()
  };

  const selftest = buildVegetacaoLaudoDeliveryRuntimeSelfTest(model, source, options);
  const selftestSnapshot = buildVegetacaoLaudoDeliveryRuntimeSelfTestSnapshot(model, source, options);
  const selftestText = buildVegetacaoLaudoDeliveryRuntimeSelfTestText(model, source, options);

  const checks = [
    createCheck(
      'runtime_payload',
      'Payload runtime foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.payload && payload?.contract),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'runtime_snapshot',
      'Snapshot runtime foi gerado',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.snapshot),
      { projectId: snapshot?.projectId ?? '' }
    ),
    createCheck(
      'docx_contract',
      'Contrato DOCX runtime disponivel',
      Boolean(payload?.contract?.docx?.sectionText),
      { length: toText(payload?.contract?.docx?.sectionText).length }
    ),
    createCheck(
      'pdf_contract',
      'Contrato PDF runtime disponivel',
      Boolean(payload?.contract?.pdf?.sectionText),
      { length: toText(payload?.contract?.pdf?.sectionText).length }
    ),
    createCheck(
      'neutral_contract',
      'Contrato neutro runtime disponivel',
      Boolean(payload?.contract?.neutral?.sectionText),
      { readyForLaudo: payload?.contract?.neutral?.readyForLaudo ?? false }
    ),
    createCheck(
      'bootstrap_instance',
      'Bootstrap runtime foi instanciado',
      Boolean(bootstrap && typeof bootstrap.start === 'function' && typeof bootstrap.publish === 'function'),
      { started: bootstrapState?.started ?? false }
    ),
    createCheck(
      'api_instance',
      'API runtime foi instanciada',
      Boolean(api && typeof api.start === 'function' && typeof api.publish === 'function'),
      { module: api?.module ?? '' }
    ),
    createCheck(
      'api_payload',
      'API runtime gerou payload',
      Boolean(apiState?.payload?.payload && apiState?.payload?.contract),
      { module: apiState?.payload?.module ?? '' }
    ),
    createCheck(
      'api_snapshot',
      'API runtime gerou snapshot',
      Boolean(apiState?.snapshot?.snapshot),
      { projectId: apiState?.snapshot?.projectId ?? '' }
    ),
    createCheck(
      'selftest',
      'Self-test runtime executou',
      Boolean(selftest?.summary),
      { score: selftest?.summary?.score ?? 0 }
    )
  ];

  const summary = summarizeChecks(checks);
  const signals = buildSignals(payload, snapshot, bootstrapState, apiState, selftest);
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
      bootstrapState: clone(bootstrapState),
      apiState: clone(apiState),
      selftest: clone(selftest),
      selftestSnapshot: clone(selftestSnapshot),
      selftestText: clone(selftestText)
    }
  };
}

export function buildVegetacaoLaudoDeliveryRuntimeDiagnosticsSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryRuntimeDiagnostics(model, source, options);

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

export function buildVegetacaoLaudoDeliveryRuntimeDiagnosticsText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryRuntimeDiagnostics(model, source, options);

  return {
    titulo: 'Diagnostico runtime da entrega do laudo do modulo Vegetacao',
    status: report.decision?.label ?? 'Sem status',
    score: report.summary?.score ?? 0,
    totalChecks: report.summary?.total ?? 0,
    passedChecks: report.summary?.passed ?? 0,
    failedChecks: report.summary?.failed ?? 0,
    readyForLaudo: Boolean(report.signals?.readyForLaudo)
  };
}