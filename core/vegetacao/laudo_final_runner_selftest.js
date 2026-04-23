import {
  buildVegetacaoLaudoFinalRun,
  buildVegetacaoLaudoFinalRunSnapshot,
  buildVegetacaoLaudoFinalRunText,
  createVegetacaoLaudoFinalRunner
} from './laudo_final_runner.js';

const MODULE_NAME = 'vegetacao';
const TEST_NAME = 'laudo_final_runner';

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

export function buildVegetacaoLaudoFinalRunnerSelfTest(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoFinalRun(model, source, options);
  const snapshot = buildVegetacaoLaudoFinalRunSnapshot(model, source, options);
  const text = buildVegetacaoLaudoFinalRunText(model, source, options);

  const runner = createVegetacaoLaudoFinalRunner({
    ...options,
    bindGlobal: false,
    emit: false
  });

  const runnerReport = runner.run(model, source, options);
  const runnerSnapshot = runner.runSnapshot(model, source, options);
  const runnerText = runner.runText(model, source, options);

  const checks = [
    createCheck(
      'report',
      'Runner final gerou relatorio completo',
      Boolean(report?.module === MODULE_NAME && report?.final && report?.apply && report?.diagnostics),
      { module: report?.module ?? '' }
    ),
    createCheck(
      'snapshot',
      'Runner final gerou snapshot',
      Boolean(snapshot?.module === MODULE_NAME && snapshot?.status),
      { module: snapshot?.module ?? '' }
    ),
    createCheck(
      'text',
      'Runner final gerou resumo textual',
      Boolean(text?.titulo && typeof text?.readyForLaudo !== 'undefined'),
      { titulo: text?.titulo ?? '' }
    ),
    createCheck(
      'ready_flags',
      'Runner final trouxe payloads de aplicacao',
      Boolean(report?.apply?.docx && report?.apply?.pdf && report?.apply?.neutral),
      {
        hasDocx: Boolean(report?.apply?.docx),
        hasPdf: Boolean(report?.apply?.pdf),
        hasNeutral: Boolean(report?.apply?.neutral)
      }
    ),
    createCheck(
      'runner_instance',
      'Runner final foi instanciado',
      Boolean(
        runner &&
        typeof runner.run === 'function' &&
        typeof runner.runSnapshot === 'function' &&
        typeof runner.runText === 'function' &&
        typeof runner.publish === 'function'
      ),
      { module: runner?.module ?? '' }
    ),
    createCheck(
      'runner_run',
      'Runner instanciado respondeu no run',
      Boolean(runnerReport?.module === MODULE_NAME && runnerReport?.status),
      { module: runnerReport?.module ?? '' }
    ),
    createCheck(
      'runner_snapshot',
      'Runner instanciado respondeu no snapshot',
      Boolean(runnerSnapshot?.module === MODULE_NAME && runnerSnapshot?.status),
      { module: runnerSnapshot?.module ?? '' }
    ),
    createCheck(
      'runner_text',
      'Runner instanciado respondeu no texto',
      Boolean(runnerText?.titulo && runnerText?.status),
      { titulo: runnerText?.titulo ?? '' }
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
      report: clone(report),
      snapshot: clone(snapshot),
      text: clone(text),
      runnerReport: clone(runnerReport),
      runnerSnapshot: clone(runnerSnapshot),
      runnerText: clone(runnerText)
    }
  };
}

export function buildVegetacaoLaudoFinalRunnerSelfTestSnapshot(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoFinalRunnerSelfTest(model, source, options);

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

export function buildVegetacaoLaudoFinalRunnerSelfTestText(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoFinalRunnerSelfTest(model, source, options);

  return {
    titulo: 'Self-test do runner final do laudo do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0
  };
}