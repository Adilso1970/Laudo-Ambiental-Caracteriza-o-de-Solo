import { createEmptyProject } from "./db.js";

function deepClone(value) {
  const normalized = value ?? null;
  return normalized === null ? null : JSON.parse(JSON.stringify(normalized));
}

function sortProjects(list = []) {
  return [...list].sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));
}

function ensureProjectShape(project = {}, fallbackName = "Novo Projeto") {
  const base = {
    ...createEmptyProject(fallbackName),
    ...(project || {})
  };

  base.id = base.id || crypto.randomUUID();
  base.name = String(base.name || fallbackName || "Novo Projeto").trim() || "Novo Projeto";
  base.description = String(base.description || "").trim();
  base.status = ["rascunho", "em_andamento", "concluido", "arquivado"].includes(base.status)
    ? base.status
    : "rascunho";
  base.createdAt = base.createdAt || new Date().toISOString();
  base.updatedAt = new Date().toISOString();

  if (!base.meta || typeof base.meta !== "object" || Array.isArray(base.meta)) {
    base.meta = {};
  }

  if (!base.evidencias || typeof base.evidencias !== "object" || Array.isArray(base.evidencias)) {
    base.evidencias = { fotos: [] };
  }

  if (!Array.isArray(base.evidencias.fotos)) {
    base.evidencias.fotos = [];
  }

  return base;
}

export function normalizeRemoteProject(row = {}) {
  return ensureProjectShape(deepClone(row) || {}, row?.name || row?.nome || "Novo Projeto");
}

export async function listRemoteProjects() {
  return [];
}

export async function getRemoteProject(id) {
  return null;
}

export async function saveRemoteProject(project) {
  return ensureProjectShape(project, project?.name || "Novo Projeto");
}

export async function deleteRemoteProject(id) {
  return true;
}

export async function listProjectsPreferred(db) {
  let localProjects = [];
  try {
    localProjects = await db.listProjects();
  } catch (error) {
    console.warn("Falha ao carregar projetos locais:", error);
  }
  return sortProjects(localProjects);
}

export async function openProjectEverywhere(db, id) {
  if (!id) return null;
  try {
    return await db.getProject(id);
  } catch (error) {
    console.warn("Falha ao abrir projeto local:", error);
    return null;
  }
}

export async function saveProjectEverywhere(db, project) {
  const normalized = ensureProjectShape(project, project?.name || "Novo Projeto");
  await db.putProject(normalized);
  return normalized;
}

export async function deleteProjectEverywhere(db, id) {
  try {
    await db.deleteProject(id);
  } catch (error) {
    console.warn("Falha ao excluir projeto local:", error);
  }
  return true;
}