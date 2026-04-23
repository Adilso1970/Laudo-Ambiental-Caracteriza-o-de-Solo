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

const MODULE_NAME = 'vegetacao';
const TEST_NAME = 'laudo_delivery_runtime';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();

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

function normalizeSource(source = {}) {
  const runtime = safeObject(source);
  const session = safeObject(runtime.session ?? runtime.getSession?.() ?? {});
  const snapshot = safeObject(runtime.snapshot ?? runtime.getSnapshot?.() ?? {});
  const moduleState = safeObject(snapshot.moduleState);
  const project = safeObject(runtime.project ?? session.projectContext ?? {});

  return {
    project,
    sessionId: toText(session.sessionId ?? session.id ?? moduleState.sessionId),
    activeSectorId: toText(session.activeSectorId ?? session.setorAtivoId ?? moduleState.activeSectorId),
    captures: toArray(session.captures ?? moduleState.captures),
    sectors: toArray(session.sectors ?? moduleState.sectors)
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

export function buildVegetacaoLaudoDeliveryRuntimeSelfTest(model = {}, source = {}, options = {}) {
  const normalizedSource = normalizeSource(source);

  const payload = buildVegetacaoLaudoDeliveryRuntimePayload(
    model,
    source,
    options
  );

  const snapshot = buildVegetacaoLaudoDeliveryRuntimeSnapshot(
    model,
    source,
    options
  );

  const bootstrap = createVegetacaoLaudoDeliveryRuntimeBootstrap({
    ...options,
    bindGlobal: false
  });

  const api = createVegetacaoLaudoDeliveryRuntimeApi({
    ...options,
    bindGlobal: false
  });

  const bootstrapState = bootstrap.getState();
  const bridgeState = api.getBridgeState();
  const apiSnapshot = {
    module: api.module,
    payload: api.build(model, source, options),
    snapshot: api.buildSnapshot(model, source, options)
  };

  const checks = [
    createCheck(
      'runtime_payload',
      'Payload runtime da entrega foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.payload && payload?.contract),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'runtime_snapshot',
      'Snapshot runtime da entrega foi gerado',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.snapshot),
      { projectId: snapshot?.projectId ?? '' }
    ),
    createCheck(
      'bootstrap',
      'Bootstrap runtime foi instanciado',
      Boolean(bootstrap && typeof bootstrap.start === 'function' && typeof bootstrap.publish === 'function'),
      { started: bootstrapState?.started ?? false }
    ),
    createCheck(
      'api',
      'API runtime foi instanciada',
      Boolean(api && typeof api.start === 'function' && typeof api.publish === 'function'),
      { module: api?.module ?? '' }
    ),
    createCheck(
      'bridge_state',
      'Bridge runtime retornou estado',
      Boolean(bridgeState && typeof bridgeState === 'object'),
      { started: bridgeState?.started ?? false }
    ),
    createCheck(
      'api_payload',
      'API runtime gerou payload',
      Boolean(apiSnapshot?.payload?.payload && apiSnapshot?.payload?.snapshot),
      { module: apiSnapshot?.module ?? '' }
    ),
    createCheck(
      'api_snapshot',
      'API runtime gerou snapshot',
      Boolean(apiSnapshot?.snapshot?.snapshot),
      { projectId: apiSnapshot?.snapshot?.projectId ?? '' }
    ),
    createCheck(
      'runtime_source',
      'Fonte runtime foi normalizada',
      Boolean(normalizedSource?.project && normalizedSource?.sessionId !== undefined),
      {
        sessionId: normalizedSource?.sessionId ?? '',
        captures: toArray(normalizedSource?.captures).length,
        sectors: toArray(normalizedSource?.sectors).length
      }
    )
  ];

  const summary = summarizeChecks(checks);

  return {
    version: 1,
    module: MODULE_NAME,
    test: TEST_NAME,
    generatedAt: new Date().toISOString(),
    passed: summary.failed === 0,
    summary,
    checks,
    snapshots: {
      payload: clone(payload),
      snapshot: clone(snapshot),
      bootstrapState: clone(bootstrapState),
      bridgeState: clone(bridgeState),
      apiSnapshot: clone(apiSnapshot),
      source: clone(normalizedSource)
    }
  };
}

export function buildVegetacaoLaudoDeliveryRuntimeSelfTestSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryRuntimeSelfTest(model, source, options);

  return {
    version: report.version,
    module: report.module,
    test: report.test,
    generatedAt: report.generatedAt,
    passed: report.passed,
    summary: report.summary,
    checks: report.checks.map((item) => ({
      id: item.id,
      label: item.label,
      ok: item.ok
    }))
  };
}

export function buildVegetacaoLaudoDeliveryRuntimeSelfTestText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliveryRuntimeSelfTest(model, source, options);

  return {
    titulo: 'Self-test da ponte runtime da entrega do laudo do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0
  };
}