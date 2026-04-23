async function loadJsonPack(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Falha ao carregar pacote auxiliar: ${response.status} | ${path}`);
  }

  return response.json();
}

export async function loadRecommendationPolicies(version = "v1") {
  return loadJsonPack(`/normative/recommendation-policies.${version}.json`);
}

export async function loadLaudoSnippets(version = "v1") {
  return loadJsonPack(`/normative/laudo-snippets.${version}.json`);
}
