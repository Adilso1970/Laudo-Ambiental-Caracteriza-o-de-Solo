import {
  buildVegetacaoLaudoFinalPackage,
  buildVegetacaoLaudoFinalSnapshot,
  buildVegetacaoLaudoFinalGenerator,
  createVegetacaoLaudoFinalEntrypoint
} from './laudo_final_entrypoint.js';

const MODULE_NAME = 'vegetacao';
const TEST_NAME = 'laudo_final_entrypoint';

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

export function buildVegetacaoLaudoFinalEntrypointSelfTest(model = {}, source = {}, options = {}) {
  const payload = buildVegetacaoLaudoFinalPackage(model, source, options);
  const snapshot = buildVegetacaoLaudoFinalSnapshot(model, source, options);
  const docx = buildVegetacaoLaudoFinalGenerator('docx', model, source, options);
  const pdf = buildVegetacaoLaudoFinalGenerator('pdf', model, source, options);
  const neutral = buildVegetacaoLaudoFinalGenerator('neutral', model, source, options);

  const entrypoint = createVegetacaoLaudoFinalEntrypoint({
    ...options,
    bindGlobal: false
  });

  const checks = [
    createCheck(
      'payload',
      'Entrypoint final gerou payload do laudo',
      Boolean(payload?.module === MODULE_NAME && payload?.generators),
      { module: payload?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Entrypoint final gerou snapshot do laudo',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.snapshot),
      { module: snapshot?.module ?? '' }
    ),
    createCheck(
      'docx_generator',
      'Gerador DOCX final foi preparado',
      Boolean(docx?.generator === 'docx' && docx?.content),
      { generator: docx?.generator ?? '' }
    ),
    createCheck(
      'pdf_generator',
      'Gerador PDF final foi preparado',
      Boolean(pdf?.generator === 'pdf' && pdf?.content),
      { generator: pdf?.generator ?? '' }
    ),
    createCheck(
      'neutral_generator',
      'Gerador neutro final foi preparado',
      Boolean(neutral?.generator === 'neutral' && neutral?.content),
      { generator: neutral?.generator ?? '' }
    ),
    createCheck(
      'entrypoint_instance',
      'Entrypoint final foi instanciado',
      Boolean(
        entrypoint &&
        typeof entrypoint.build === 'function' &&
        typeof entrypoint.buildSnapshot === 'function' &&
        typeof entrypoint.buildGenerator === 'function' &&
        typeof entrypoint.publish === 'function'
      ),
      { module: entrypoint?.module ?? '' }
    ),
    createCheck(
      'entrypoint_build',
      'Entrypoint final respondeu no build',
      Boolean(entrypoint?.build(model, source, options)?.generators),
      { module: entrypoint?.module ?? '' }
    ),
    createCheck(
      'entrypoint_snapshot',
      'Entrypoint final respondeu no snapshot',
      Boolean(entrypoint?.buildSnapshot(model, source, options)?.snapshot),
      { module: entrypoint?.module ?? '' }
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
      neutral: clone(neutral)
    }
  };
}

export function buildVegetacaoLaudoFinalEntrypointSelfTestSnapshot(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalEntrypointSelfTest(model, source, options);

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

export function buildVegetacaoLaudoFinalEntrypointSelfTestText(model = {}, source = {}, options = {}) {
  const report = buildVegetacaoLaudoFinalEntrypointSelfTest(model, source, options);

  return {
    titulo: 'Self-test do entrypoint final do laudo do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0
  };
}