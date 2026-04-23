import {
  createVegetacaoLaudoFinalApi,
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator
} from './laudo_final_api.js';

const MODULE_NAME = 'vegetacao';
const TEST_NAME = 'laudo_final_api';

const toArray = (value) => Array.isArray(value) ? value : [];
const toText = (value) => String(value ?? '').trim();

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

export function buildVegetacaoLaudoFinalApiSelfTest(model = {}, source = {}, options = {}) {
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

  const apiPayload = api.build(model, source, options);
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
      'API final do laudo foi instanciada',
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
      'Payload final do laudo foi gerado',
      Boolean(payload?.module === MODULE_NAME && payload?.generators),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Snapshot final do laudo foi gerado',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.snapshot),
      { module: snapshot?.module ?? '' }
    ),
    createCheck(
      'docx',
      'Gerador DOCX final foi preparado',
      Boolean(docx?.generator === 'docx' && docx?.content),
      { generator: docx?.generator ?? '' }
    ),
    createCheck(
      'pdf',
      'Gerador PDF final foi preparado',
      Boolean(pdf?.generator === 'pdf' && pdf?.content),
      { generator: pdf?.generator ?? '' }
    ),
    createCheck(
      'neutral',
      'Gerador neutro final foi preparado',
      Boolean(neutral?.generator === 'neutral' && neutral?.content),
      { generator: neutral?.generator ?? '' }
    ),
    createCheck(
      'api_build',
      'API respondeu no build',
      Boolean(apiPayload?.module === MODULE_NAME && apiPayload?.generators),
      { module: apiPayload?.module ?? '' }
    ),
    createCheck(
      'api_snapshot',
      'API respondeu no snapshot',
      Boolean(apiSnapshot?.module === MODULE_NAME && apiSnapshot?.snapshot),
      { module: apiSnapshot?.module ?? '' }
    ),
    createCheck(
      'api_generators',
      'API respondeu para os geradores finais',
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
      docx: clone(docx),
      pdf: clone(pdf),
      neutral: clone(neutral),
      apiPayload: clone(apiPayload),
      apiSnapshot: clone(apiSnapshot),
      apiDiagnostics: clone(apiDiagnostics),
      apiDiagnosticsSnapshot: clone(apiDiagnosticsSnapshot),
      apiOrchestrated: clone(apiOrchestrated),
      apiOrchestratedSnapshot: clone(apiOrchestratedSnapshot)
    }
  };
}

export function buildVegetacaoLaudoFinalApiSelfTestSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalApiSelfTest(model, source, options);

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

export function buildVegetacaoLaudoFinalApiSelfTestText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalApiSelfTest(model, source, options);

  return {
    titulo: 'Self-test da API final do laudo do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0
  };
}