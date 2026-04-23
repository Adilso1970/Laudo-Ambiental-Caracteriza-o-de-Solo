export function createRuleRegistry(pack) {
  const rules = Array.isArray(pack?.rules) ? pack.rules : [];

  return {
    version: pack?.version ?? "0.0.0",
    domain: pack?.domain ?? "undefined",
    rules,
    activeRules: rules.filter(rule => rule?.active !== false),
    byTheme(theme) {
      return this.activeRules.filter(rule => rule?.theme === theme);
    },
    byOutputType(outputType) {
      return this.activeRules.filter(rule => rule?.outputType === outputType);
    }
  };
}
