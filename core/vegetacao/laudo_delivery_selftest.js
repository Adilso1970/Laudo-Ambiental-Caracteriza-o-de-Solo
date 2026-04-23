import {
  buildVegetacaoLaudoDeliveryPayload,
  buildVegetacaoLaudoDeliverySnapshot,
  buildVegetacaoLaudoGeneratorContract
} from './laudo_delivery_service.js';

import { buildVegetacaoLaudoDeliveryGatewaySnapshot } from './laudo_delivery_gateway.js';
import { buildVegetacaoLaudoDeliveryApiSnapshot } from './laudo_delivery_api.js';

const MODULE_NAME = 'vegetacao';
const TEST_NAME = 'laudo_delivery';

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

export function buildVegetacaoLaudoDeliverySelfTest(model = {}, input = {}, options = {}) {
  const normalizedInput = normalizeInput(input);

  const payload = buildVegetacaoLaudoDeliveryPayload(model, normalizedInput, options);
  const snapshot = buildVegetacaoLaudoDeliverySnapshot(model, normalizedInput, options);
  const contract = buildVegetacaoLaudoGeneratorContract(model, normalizedInput, options);
  const gatewaySnapshot = buildVegetacaoLaudoDeliveryGatewaySnapshot(model, normalizedInput, options);
  const apiSnapshot = buildVegetacaoLaudoDeliveryApiSnapshot(model, normalizedInput, options);

  const checks = [
    createCheck(
      'payload',
      'Payload de entrega do laudo foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.integratedModel),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Snapshot de entrega do laudo foi gerado',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.key),
      { key: snapshot?.key ?? '' }
    ),
    createCheck(
      'contract',
      'Contrato para geradores foi gerado',
      Boolean(contract?.docx && contract?.pdf && contract?.neutral),
      { readyForLaudo: contract?.readyForLaudo ?? false }
    ),
    createCheck(
      'gateway',
      'Gateway de entrega do laudo respondeu',
      Boolean(gatewaySnapshot?.module === MODULE_NAME && gatewaySnapshot?.snapshot),
      { projectId: gatewaySnapshot?.projectId ?? '' }
    ),
    createCheck(
      'api',
      'API de entrega do laudo respondeu',
      Boolean(apiSnapshot?.payload && apiSnapshot?.snapshot && apiSnapshot?.contract),
      { module: apiSnapshot?.module ?? '' }
    ),
    createCheck(
      'section_present',
      'Secao Vegetacao esta presente no modelo integrado',
      toArray(payload?.integratedModel?.sections).some((item) => toText(item?.key) === 'vegetacao_supressao_compensacao'),
      { totalSections: toArray(payload?.integratedModel?.sections).length }
    ),
    createCheck(
      'docx_text',
      'Texto para DOCX foi preparado',
      Boolean(toText(contract?.docx?.sectionText)),
      { length: toText(contract?.docx?.sectionText).length }
    ),
    createCheck(
      'pdf_text',
      'Texto para PDF foi preparado',
      Boolean(toText(contract?.pdf?.sectionText)),
      { length: toText(contract?.pdf?.sectionText).length }
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
      contract: clone(contract),
      gatewaySnapshot: clone(gatewaySnapshot),
      apiSnapshot: clone(apiSnapshot)
    }
  };
}

export function buildVegetacaoLaudoDeliverySelfTestSnapshot(model = {}, input = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliverySelfTest(model, input, options);

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

export function buildVegetacaoLaudoDeliverySelfTestText(model = {}, input = {}, options = {}) {
  const report = buildVegetacaoLaudoDeliverySelfTest(model, input, options);

  return {
    titulo: 'Self-test da entrega do laudo do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0
  };
}