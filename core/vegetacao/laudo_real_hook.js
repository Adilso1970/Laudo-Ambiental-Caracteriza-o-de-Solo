import {
  applyVegetacaoToDocxLaudo,
  applyVegetacaoToPdfLaudo,
  applyVegetacaoToNeutralLaudo,
  buildVegetacaoLaudoFinalRunSnapshot,
  buildVegetacaoLaudoFinalRunText
} from './index.js';

const toText = (value) => String(value ?? '').trim();

function normalizeGenerator(generator = 'neutral') {
  const current = toText(generator).toLowerCase();
  if (current === 'docx') return 'docx';
  if (current === 'pdf') return 'pdf';
  return 'neutral';
}

export function integrateVegetacaoIntoLaudoModel({
  generator = 'neutral',
  model = {},
  source = null,
  options = {}
} = {}) {
  const kind = normalizeGenerator(generator);

  if (kind === 'docx') {
    return applyVegetacaoToDocxLaudo(model, source, options);
  }

  if (kind === 'pdf') {
    return applyVegetacaoToPdfLaudo(model, source, options);
  }

  return applyVegetacaoToNeutralLaudo(model, source, options);
}

export function buildVegetacaoLaudoGenerationValidation({
  model = {},
  source = null,
  options = {}
} = {}) {
  return {
    snapshot: buildVegetacaoLaudoFinalRunSnapshot(model, source, options),
    text: buildVegetacaoLaudoFinalRunText(model, source, options)
  };
}