export async function loadNormativePack(version = "v1") {
  const response = await fetch(`/normative/rules.${version}.json`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Falha ao carregar pacote normativo: ${response.status}`);
  }

  const pack = await response.json();
  validateNormativePack(pack);
  return pack;
}

export function validateNormativePack(pack) {
  if (!pack || typeof pack !== "object") {
    throw new Error("Pacote normativo inválido.");
  }

  if (!Array.isArray(pack.rules)) {
    throw new Error("Pacote normativo sem coleção de regras.");
  }

  if (!pack.version) {
    throw new Error("Pacote normativo sem versão.");
  }

  return true;
}
