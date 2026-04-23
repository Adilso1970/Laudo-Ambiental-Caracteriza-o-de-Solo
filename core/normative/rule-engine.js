import { createRuleRegistry } from "./rule-registry.js";
import { normalizeSeverity } from "./severity-model.js";

function getByPath(source, path) {
  if (!source || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
}

function parseExpected(rawExpected) {
  if (rawExpected === "true") return true;
  if (rawExpected === "false") return false;
  if (rawExpected === "null") return null;
  if (!Number.isNaN(Number(rawExpected)) && String(rawExpected).trim() !== "") return Number(rawExpected);
  return rawExpected;
}

function evaluateToken(token, context) {
  const raw = String(token ?? "").trim();
  if (!raw) return false;

  const parts = raw.split("=");
  const path = parts[0]?.trim();

  if (!path) return false;

  if (parts.length === 1) {
    return Boolean(getByPath(context, path));
  }

  const actual = getByPath(context, path);
  const expected = parseExpected(parts.slice(1).join("=").trim());
  return actual === expected;
}

export function evaluateRule(rule, context = {}) {
  const all = Array.isArray(rule?.when?.all) ? rule.when.all : [];
  const any = Array.isArray(rule?.when?.any) ? rule.when.any : [];

  const passAll = all.length === 0 ? true : all.every(token => evaluateToken(token, context));
  const passAny = any.length === 0 ? true : any.some(token => evaluateToken(token, context));

  return passAll && passAny;
}

export function evaluateNormativePack(pack, context = {}) {
  const registry = createRuleRegistry(pack);

  return registry.activeRules
    .filter(rule => evaluateRule(rule, context))
    .map(rule => ({
      id: rule.id,
      theme: rule.theme,
      severity: normalizeSeverity(rule.severity),
      outputType: rule.outputType,
      message: rule.message,
      recommendation: rule.recommendation,
      requires: Array.isArray(rule.requires) ? rule.requires : [],
      version: rule.version ?? registry.version
    }))
    .sort((a, b) => {
      const order = { info: 1, alerta: 2, atencao: 3, critico: 4 };
      return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
    });
}
