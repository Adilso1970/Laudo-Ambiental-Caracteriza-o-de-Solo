import { runAutomaticAnalysis } from "../core/analysis/analysis-pipeline.js";
import { runWorkflowAuditStage } from "../core/workflow/workflow-audit-pipeline.js";

const $ = (id) => document.getElementById(id);

const state = {
  context: null,
  result: null
};

const els = {
  jsonInput: $("jsonInput"),
  btnLoadExample: $("btnLoadExample"),
  btnRun: $("btnRun"),
  btnDownloadJson: $("btnDownloadJson"),
  btnDownloadTxt: $("btnDownloadTxt"),
  statusbar: $("statusbar"),
  kpiTotal: $("kpiTotal"),
  kpiStatus: $("kpiStatus"),
  kpiEmit: $("kpiEmit"),
  kpiBlock: $("kpiBlock"),
  severityChips: $("severityChips"),
  textSuggestions: $("textSuggestions"),
  findingsList: $("findingsList"),
  workflowOutput: $("workflowOutput")
};

function setStatus(message, isError = false) {
  els.statusbar.textContent = message;
  els.statusbar.style.color = isError ? "#ffd2d2" : "#b7c2e0";
  els.statusbar.style.borderColor = isError ? "rgba(214,69,69,0.45)" : "rgba(255,255,255,0.10)";
}

function safeJsonParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error };
  }
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderSeverity(summary = {}) {
  const bySeverity = summary?.bySeverity ?? {};
  const chips = [
    { label: `Crítico: ${bySeverity.critico ?? 0}`, className: "chip crit" },
    { label: `Atenção: ${bySeverity.atencao ?? 0}`, className: "chip warn" },
    { label: `Alerta: ${bySeverity.alerta ?? 0}`, className: "chip warn" },
    { label: `Info: ${bySeverity.info ?? 0}`, className: "chip ok" }
  ];

  els.severityChips.innerHTML = chips
    .map((chip) => `<span class="${chip.className}">${chip.label}</span>`)
    .join("");
}

function renderTextSuggestions(textSuggestions = {}) {
  const lines = [];
  lines.push("RESUMO TÉCNICO:");
  lines.push(textSuggestions?.resumoTecnico ?? "-");
  lines.push("");
  lines.push("CONFORMIDADE:");
  lines.push(textSuggestions?.conformidade ?? "-");
  lines.push("");
  lines.push("PENDÊNCIAS:");
  lines.push(textSuggestions?.pendencias ?? "-");
  lines.push("");
  lines.push("RECOMENDAÇÕES:");
  lines.push(textSuggestions?.recomendacoes ?? "-");
  els.textSuggestions.textContent = lines.join("\n");
}

function renderFindings(result = {}) {
  const items = result?.findings?.items ?? [];
  const recommendations = result?.recommendations?.items ?? [];

  if (!items.length) {
    els.findingsList.innerHTML = '<div class="item"><strong>Nenhuma ocorrência detectada.</strong><span>O núcleo automático não identificou pendências ou inconsistências para o contexto informado.</span></div>';
    return;
  }

  const recommendationMap = new Map(
    recommendations.map((item) => [item.sourceId, item])
  );

  els.findingsList.innerHTML = items.map((item) => {
    const rec = recommendationMap.get(item.id);

    return `
      <div class="item">
        <strong>[${String(item.severity ?? "").toUpperCase()}] ${item.message ?? "-"}</strong>
        <div>Tema: ${item.theme ?? "-"}</div>
        <div>Tipo: ${item.outputType ?? "-"}</div>
        <div>Recomendação base: ${item.recommendation ?? "-"}</div>
        <div>Responsável sugerido: ${rec?.owner ?? "-"}</div>
        <div>Ação requerida: ${rec?.actionRequired ?? "-"}</div>
        <div>Prazo: ${rec?.deadlineClass ?? "-"}</div>
      </div>
    `;
  }).join("");
}

function renderWorkflow(result = {}) {
  const workflow = result?.workflow ?? {};
  const decision = workflow?.decision ?? {};
  const policy = decision?.policy ?? {};
  const snapshot = workflow?.snapshot ?? {};

  const lines = [];
  lines.push(`Status anterior: ${workflow?.previousStatus ?? "-"}`);
  lines.push(`Status solicitado: ${workflow?.requestedTarget ?? "-"}`);
  lines.push(`Status final: ${workflow?.finalStatus ?? "-"}`);
  lines.push(`Transição aceita: ${workflow?.accepted ? "SIM" : "NÃO"}`);
  lines.push(`Próximas transições: ${(workflow?.nextAllowedTransitions ?? []).join(", ") || "-"}`);
  lines.push("");
  lines.push(`Aprovação direta: ${policy?.canApprove ? "SIM" : "NÃO"}`);
  lines.push(`Pode seguir para revisão: ${policy?.canMoveToReview ? "SIM" : "NÃO"}`);
  lines.push(`Status alvo da política: ${policy?.targetStatus ?? "-"}`);
  lines.push("");
  lines.push(`Bloqueios: ${(policy?.blockingReasons ?? []).join(" | ") || "nenhum"}`);
  lines.push(`Revisões: ${(policy?.reviewReasons ?? []).join(" | ") || "nenhum"}`);
  lines.push("");
  lines.push("Snapshot resumido:");
  lines.push(JSON.stringify(snapshot, null, 2));

  els.workflowOutput.textContent = lines.join("\n");
}

function updateKpis(result = {}) {
  const total = result?.diagnostic?.summary?.total ?? 0;
  const blocking = (result?.workflow?.decision?.policy?.blockingReasons ?? []).length;
  const status = result?.workflow?.finalStatus ?? result?.workflowHints?.suggestedStatus ?? "-";
  const canEmit = result?.findings?.emissionGate?.canEmit;

  els.kpiTotal.textContent = String(total);
  els.kpiStatus.textContent = status;
  els.kpiEmit.textContent = canEmit ? "APTO" : "BLOQUEADO";
  els.kpiBlock.textContent = String(blocking);
}

function buildTxtReport(result = {}) {
  const lines = [];
  lines.push("DIAGNÓSTICO TÉCNICO APLICADO");
  lines.push(`Executado em: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(result?.diagnostic?.humanReport ?? "Sem relatório humano.");
  lines.push("");
  lines.push("TEXTO TÉCNICO SUGERIDO");
  lines.push("----------------------");
  lines.push(`Resumo técnico: ${result?.textSuggestions?.resumoTecnico ?? "-"}`);
  lines.push(`Conformidade: ${result?.textSuggestions?.conformidade ?? "-"}`);
  lines.push(`Pendências: ${result?.textSuggestions?.pendencias ?? "-"}`);
  lines.push(`Recomendações: ${result?.textSuggestions?.recomendacoes ?? "-"}`);
  lines.push("");
  lines.push("WORKFLOW");
  lines.push("--------");
  lines.push(`Status final: ${result?.workflow?.finalStatus ?? "-"}`);
  lines.push(`Transição aceita: ${result?.workflow?.accepted ? "SIM" : "NÃO"}`);
  lines.push(`Bloqueios: ${(result?.workflow?.decision?.policy?.blockingReasons ?? []).join(" | ") || "nenhum"}`);
  lines.push(`Revisões: ${(result?.workflow?.decision?.policy?.reviewReasons ?? []).join(" | ") || "nenhum"}`);
  return lines.join("\n");
}

async function loadExampleContext() {
  setStatus("Carregando contexto de exemplo...");
  const response = await fetch("/normative/example-context.v1.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar example-context.v1.json (${response.status})`);
  }
  const payload = await response.json();
  state.context = payload;
  els.jsonInput.value = JSON.stringify(payload, null, 2);
  setStatus("Contexto de exemplo carregado.");
}

async function runAnalysis() {
  const parsed = safeJsonParse(els.jsonInput.value);

  if (!parsed.ok) {
    setStatus(`JSON inválido: ${parsed.error.message}`, true);
    return;
  }

  try {
    setStatus("Executando análise técnica...");
    state.context = parsed.value;

    const analysis = await runAutomaticAnalysis(parsed.value, { version: "v1" });
    const workflow = runWorkflowAuditStage({
      analysisResult: analysis,
      currentStatus: "em_preenchimento",
      actor: "validador_tecnico",
      reason: "execucao_manual_diagnostico",
      metadata: { origem: "diagnostico-tecnico.html" },
      projectContext: analysis?.diagnostic?.normalizedContext ?? parsed.value
    });

    const result = {
      ...analysis,
      workflow
    };

    state.result = result;

    updateKpis(result);
    renderSeverity(result?.diagnostic?.summary);
    renderTextSuggestions(result?.textSuggestions);
    renderFindings(result);
    renderWorkflow(result);

    const finalStatus = workflow?.finalStatus ?? "-";
    const total = result?.diagnostic?.summary?.total ?? 0;
    setStatus(`Análise concluída com sucesso. Ocorrências: ${total}. Status final sugerido: ${finalStatus}.`);
  } catch (error) {
    console.error(error);
    setStatus(`Falha na execução: ${error.message}`, true);
  }
}

function downloadJsonResult() {
  if (!state.result) {
    setStatus("Execute a análise antes de baixar o resultado JSON.", true);
    return;
  }

  const filename = `diagnostico_tecnico_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  downloadBlob(filename, JSON.stringify(state.result, null, 2), "application/json;charset=utf-8");
  setStatus("Resultado JSON gerado com sucesso.");
}

function downloadTxtResult() {
  if (!state.result) {
    setStatus("Execute a análise antes de baixar o relatório TXT.", true);
    return;
  }

  const filename = `diagnostico_tecnico_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  downloadBlob(filename, buildTxtReport(state.result), "text/plain;charset=utf-8");
  setStatus("Relatório TXT gerado com sucesso.");
}

els.btnLoadExample.addEventListener("click", loadExampleContext);
els.btnRun.addEventListener("click", runAnalysis);
els.btnDownloadJson.addEventListener("click", downloadJsonResult);
els.btnDownloadTxt.addEventListener("click", downloadTxtResult);

loadExampleContext().catch((error) => {
  console.error(error);
  setStatus(`Falha ao carregar exemplo inicial: ${error.message}`, true);
});

