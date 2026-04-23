import {
  buildVegetacaoLaudoDeliveryPayload,
  buildVegetacaoLaudoDeliverySnapshot,
  buildVegetacaoLaudoGeneratorContract
} from './laudo_delivery_service.js';

import { buildVegetacaoLaudoDeliveryGatewaySnapshot } from './laudo_delivery_gateway.js';
import { buildVegetacaoLaudoDeliveryApiSnapshot } from './laudo_delivery_api.js';
import {
  buildVegetacaoLaudoDeliverySelfTest,
  buildVegetacaoLaudoDeliverySelfTestSnapshot,
  buildVegetacaoLaudoDeliverySelfTestText
} from './laudo_delivery_selftest.js';

const MODULE_NAME = 'vegetacao';
const DIAGNOSTIC_NAME = 'laudo_delivery';

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
    threshold: Number(input.threshold || 60) || 60,
    metadata: safeObject(input.metadata)
  };
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

function buildSignals(payload = {}, snapshot = {}, contract = {}, gateway = {}, api = {}, selftest = {}) {
  return {
    readyForLaudo: Boolean(payload.readyForLaudo),
    totalSections: toNumber(snapshot.totalSections),
    totalAppendices: toNumber(snapshot.totalAppendices),
    totalHooks: toNumber(snapshot.totalHooks),
    hasDocxContract: Boolean(contract.docx),
    hasPdfContract: Boolean(contract.pdf),
    hasNeutralContract: Boolean(contract.neutral),
    gatewayReady: Boolean(gateway.snapshot),
    apiReady: Boolean(api.payload && api.contract),
    selfTestPassed: Boolean(selftest.passed),
    selfTestScore: toNumber(selftest.summary?.score)
  };
}

function buildDecision(signals = {}) {
  if (!signals.hasDocxContract || !signals.hasPdfContract || !signals.hasNeutralContract) {
    return {
      code: 'contract_incomplete',
      label: 'Contrato de entrega incompleto',
      stable: false
    };
  }

  if (!signals.gatewayReady || !signals.apiReady) {
    return {
      code: 'delivery_chain_incomplete',
      label: 'Cadeia de entrega ainda incompleta',
      stable: false
    };
  }

  if (!signals.selfTestPassed) {
    return {
      code: 'selftest_review_required',
      label: 'Self-test requer revisao',
      stable: true
    };
  }

  if (signals.readyForLaudo) {
    return {
      code: 'ready_for_generator_integration',
      label: 'Pronto para integracao com geradores',
      stable: true
    };
  }

  return {
    code: 'delivery_ready_pending_review',
    label: 'Entrega pronta, aguardando revisao tecnica final',
    stable: true
  };
}

export function buildVegetacaoLaudoDeliveryDiagnostics(model = {}, input = {}, options = {}) {
  const normalizedInput = normalizeInput(input);

  const payload = buildVegetacaoLaudoDeliveryPayload(model, normalizedInput, options);
  const snapshot = buildVegetacaoLaudoDeliverySnapshot(model, normalizedInput, options);
  const contract = buildVegetacaoLaudoGeneratorContract(model, normalizedInput, options);
  const gateway = buildVegetacaoLaudoDeliveryGatewaySnapshot(model, normalizedInput, options);
  const api = buildVegetacaoLaudoDeliveryApiSnapshot(model, normalizedInput, options);
  const selftest = buildVegetacaoLaudoDeliverySelfTest(model, normalizedInput, options);
  const selftestSnapshot = buildVegetacaoLaudoDeliverySelfTestSnapshot(model, normalizedInput, options);
  const selftestText = buildVegetacaoLaudoDeliverySelfTestText(model, normalizedInput, options);

  const checks = [
    createCheck(
      'payload',
      'Payload da entrega foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.integratedModel),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Snapshot da entrega foi gerado',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.key),
      { key: snapshot?.key ?? '' }
    ),
    createCheck(
      'contract_docx',
      'Contrato DOCX disponivel',
      Boolean(contract?.docx?.sectionText),
      { length: toText(contract?.docx?.sectionText).length }
    ),
    createCheck(
      'contract_pdf',
      'Contrato PDF disponivel',
      Boolean(contract?.pdf?.sectionText),
      { length: toText(contract?.pdf?.sectionText).length }
    ),
    createCheck(
      'contract_neutral',
      'Contrato neutro disponivel',
      Boolean(contract?.neutral?.sectionText),
      { readyForLaudo: contract?.neutral?.readyForLaudo ?? false }
    ),
    createCheck(
      'gateway',
      'Gateway da entrega respondeu',
      Boolean(gateway?.snapshot),
      { projectId: gateway?.projectId ?? '' }
    ),
    createCheck(
      'api',
      'API da entrega respondeu',
      Boolean(api?.payload && api?.snapshot && api?.contract),
      { module: api?.module ?? '' }
    ),
    createCheck(
      'selftest',
      'Self-test da entrega executou',
      Boolean(selftest?.summary),
      { score: selftest?.summary?.score ?? 0 }
    )
  ];

  const summary = summarizeChecks(checks);
  const signals = buildSignals(payload, snapshot, contract, gateway, api, selftest);
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
      contract: clone(contract),
      gateway: clone(gateway),
      api: clone(api),
      selftest: clone(selftest),
      selftestSnapshot: clone(selftestSnapshot),
      selftestText: clone(selftestText)
    }
  };
}

export function buildVegetacaoLaudoDeliveryDiagnosticsSnapshot(model = {}, input = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryDiagnostics(model, input, options);

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

export function buildVegetacaoLaudoDeliveryDiagnosticsText(model = {}, input = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryDiagnostics(model, input, options);

  return {
    titulo: 'Diagnostico da entrega do laudo do modulo Vegetacao',
    status: report.decision?.label ?? 'Sem status',
    score: report.summary?.score ?? 0,
    totalChecks: report.summary?.total ?? 0,
    passedChecks: report.summary?.passed ?? 0,
    failedChecks: report.summary?.failed ?? 0,
    readyForLaudo: Boolean(report.signals?.readyForLaudo)
  };
}