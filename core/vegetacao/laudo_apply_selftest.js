import {
  applyVegetacaoToLaudoModel,
  applyVegetacaoToDocxLaudo,
  applyVegetacaoToPdfLaudo,
  applyVegetacaoToNeutralLaudo,
  buildVegetacaoLaudoApplySnapshot,
  createVegetacaoLaudoApply
} from './laudo_apply.js';

const MODULE_NAME = 'vegetacao';
const TEST_NAME = 'laudo_apply';

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

export function buildVegetacaoLaudoApplySelfTest(model = {}, source = null, options = {}) {
  const generic = applyVegetacaoToLaudoModel('neutral', model, source, options);
  const docx = applyVegetacaoToDocxLaudo(model, source, options);
  const pdf = applyVegetacaoToPdfLaudo(model, source, options);
  const neutral = applyVegetacaoToNeutralLaudo(model, source, options);

  const genericSnapshot = buildVegetacaoLaudoApplySnapshot('neutral', model, source, options);
  const docxSnapshot = buildVegetacaoLaudoApplySnapshot('docx', model, source, options);
  const pdfSnapshot = buildVegetacaoLaudoApplySnapshot('pdf', model, source, options);

  const api = createVegetacaoLaudoApply({
    ...options
  });

  const apiDocx = api.applyDocx(model, source, options);
  const apiPdf = api.applyPdf(model, source, options);
  const apiNeutral = api.applyNeutral(model, source, options);
  const apiSnapshot = api.buildSnapshot('neutral', model, source, options);

  const checks = [
    createCheck(
      'generic_apply',
      'Aplicacao generica foi gerada',
      Boolean(generic?.module === MODULE_NAME && generic?.model),
      { generator: generic?.generator ?? '' }
    ),
    createCheck(
      'docx_apply',
      'Aplicacao DOCX foi gerada',
      Boolean(docx?.generator === 'docx' && docx?.model),
      { generator: docx?.generator ?? '' }
    ),
    createCheck(
      'pdf_apply',
      'Aplicacao PDF foi gerada',
      Boolean(pdf?.generator === 'pdf' && pdf?.model),
      { generator: pdf?.generator ?? '' }
    ),
    createCheck(
      'neutral_apply',
      'Aplicacao neutra foi gerada',
      Boolean(neutral?.generator === 'neutral' && neutral?.model),
      { generator: neutral?.generator ?? '' }
    ),
    createCheck(
      'docx_sections',
      'Modelo DOCX recebeu secoes',
      Array.isArray(docx?.model?.sections) && docx.model.sections.length > 0,
      { totalSections: Array.isArray(docx?.model?.sections) ? docx.model.sections.length : 0 }
    ),
    createCheck(
      'pdf_sections',
      'Modelo PDF recebeu secoes',
      Array.isArray(pdf?.model?.sections) && pdf.model.sections.length > 0,
      { totalSections: Array.isArray(pdf?.model?.sections) ? pdf.model.sections.length : 0 }
    ),
    createCheck(
      'snapshots',
      'Snapshots do apply foram gerados',
      Boolean(genericSnapshot?.module && docxSnapshot?.module && pdfSnapshot?.module),
      {
        genericGenerator: genericSnapshot?.generator ?? '',
        docxGenerator: docxSnapshot?.generator ?? '',
        pdfGenerator: pdfSnapshot?.generator ?? ''
      }
    ),
    createCheck(
      'api_instance',
      'API do apply foi instanciada',
      Boolean(
        api &&
        typeof api.apply === 'function' &&
        typeof api.applyDocx === 'function' &&
        typeof api.applyPdf === 'function' &&
        typeof api.applyNeutral === 'function' &&
        typeof api.buildSnapshot === 'function'
      ),
      { module: api?.module ?? '' }
    ),
    createCheck(
      'api_apply',
      'API do apply respondeu',
      Boolean(apiDocx?.model && apiPdf?.model && apiNeutral?.model),
      {
        docxGenerator: apiDocx?.generator ?? '',
        pdfGenerator: apiPdf?.generator ?? '',
        neutralGenerator: apiNeutral?.generator ?? ''
      }
    ),
    createCheck(
      'api_snapshot',
      'API do apply gerou snapshot',
      Boolean(apiSnapshot?.module === MODULE_NAME),
      { generator: apiSnapshot?.generator ?? '' }
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
      generic: clone(generic),
      docx: clone(docx),
      pdf: clone(pdf),
      neutral: clone(neutral),
      genericSnapshot: clone(genericSnapshot),
      docxSnapshot: clone(docxSnapshot),
      pdfSnapshot: clone(pdfSnapshot),
      apiDocx: clone(apiDocx),
      apiPdf: clone(apiPdf),
      apiNeutral: clone(apiNeutral),
      apiSnapshot: clone(apiSnapshot)
    }
  };
}

export function buildVegetacaoLaudoApplySelfTestSnapshot(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoApplySelfTest(model, source, options);

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

export function buildVegetacaoLaudoApplySelfTestText(model = {}, source = null, options = {}) {
  const report = buildVegetacaoLaudoApplySelfTest(model, source, options);

  return {
    titulo: 'Self-test do apply final do laudo do modulo Vegetacao',
    status: report.passed ? 'OK' : 'REVIEW_REQUIRED',
    score: report?.summary?.score ?? 0,
    totalChecks: report?.summary?.total ?? 0,
    passedChecks: report?.summary?.passed ?? 0,
    failedChecks: report?.summary?.failed ?? 0
  };
}