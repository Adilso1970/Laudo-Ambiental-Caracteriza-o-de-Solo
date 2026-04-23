const DB_NAME = "QuadroAmbientalDB";
const DB_VERSION = 1;

export function createEmptyProject(name = "Novo Projeto") {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    meta: {
      uf: "",
      municipio: "",
      tipoEmpreendimento: "condominio",
      areaHa: 0,
      poligono: [],
      plantaUploads: [],
      sateliteAtual: { fileId: "", data: "" },
      sateliteAntiga: { fileId: "", data: "" },
      historicoUso: { usoAnterior: "", indicios: [] },
      intervencoesPrevistas: {
        supressaoVegetal: false,
        terraplenagem: false,
        drenagem: false,
        travessias: false,
        captacaoAgua: false,
        poco: false,
        lancamentoEfluente: false,
        intervencaoAPP: false,
        mataAtlanticaProvavel: false
      }
    },
    campo: {
      agua: [],
      flora: { fragmentos: [], especies: [] },
      fauna: [],
      soloProcessos: []
    },
    evidencias: { fotos: [] }, // lista de IDs (opcional, redundante)
    conformidade: { achados: {}, obrigacoes: [] }
  };
}

export class AmbientalDB {
  constructor() {
    this.db = null;
  }

  async open() {
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("photos")) {
          const store = db.createObjectStore("photos", { keyPath: "id" });
          store.createIndex("byProject", "projectId", { unique: false });
          store.createIndex("byProjectCategoria", ["projectId","categoria"], { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  _tx(storeName, mode = "readonly") {
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async listProjects() {
    const store = this._tx("projects");
    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a,b) => (b.updatedAt||"").localeCompare(a.updatedAt||""));
        resolve(list);
      };
    });
  }

  async getProject(id) {
    const store = this._tx("projects");
    return await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  async putProject(project) {
    const store = this._tx("projects", "readwrite");
    return await new Promise((resolve, reject) => {
      const req = store.put(project);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(project);
    });
  }

  async deleteProject(id) {
    // delete photos too
    const photos = await this.listPhotosByProject(id);
    for (const p of photos) await this.deletePhoto(p.id);

    const store = this._tx("projects", "readwrite");
    return await new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(true);
    });
  }

  async addPhoto({ projectId, categoria, blob, lat, lng, timestamp, descricao }) {
    // timestamp = MOMENTO DA EVIDÃŠNCIA (imutável)
    const ts = timestamp ?? new Date().toISOString();
    const photo = {
      id: crypto.randomUUID(),
      projectId,
      categoria,
      blob,
      lat: lat ?? null,
      lng: lng ?? null,
      timestamp: ts,
      // alias (futuro): mantém compatibilidade caso troquemos o nome do campo
      capturedAt: ts,
      descricao: descricao ?? ""
    };
    const store = this._tx("photos", "readwrite");
    await new Promise((resolve, reject) => {
      const req = store.put(photo);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(true);
    });
    return photo;
  }

  async getPhoto(id) {
    const store = this._tx("photos");
    return await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  async listPhotosByProject(projectId) {
    const store = this._tx("photos");
    const idx = store.index("byProject");
    return await new Promise((resolve, reject) => {
      const req = idx.getAll(projectId);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async listPhotosByProjectAndCategoria(projectId, categoria) {
    const store = this._tx("photos");
    const idx = store.index("byProjectCategoria");
    return await new Promise((resolve, reject) => {
      const req = idx.getAll([projectId, categoria]);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });
  }


  async putPhoto(photo) {
    // Merge seguro: NÃO sobrescreve timestamp/GPS existentes por valores nulos,
    // e NÃO "atualiza" timestamp só porque regravou o registro.
    const existing = photo?.id ? await this.getPhoto(photo.id) : null;

    const merged = {
      ...(existing || {}),
      ...(photo || {})
    };

    // Timestamp imutável (momento da evidência)
    merged.timestamp = (photo && photo.timestamp) ? photo.timestamp : (existing && existing.timestamp) ? existing.timestamp : new Date().toISOString();

    // GPS imutável por padrão: se vier null/undefined, mantém o antigo
    if ((photo?.lat == null) && (existing?.lat != null)) merged.lat = existing.lat;
    if ((photo?.lng == null) && (existing?.lng != null)) merged.lng = existing.lng;

    const store = this._tx("photos", "readwrite");
    await new Promise((resolve, reject) => {
      const req = store.put(merged);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(true);
    });
    return merged;
  }

  async deletePhoto(id) {
    const store = this._tx("photos", "readwrite");
    return await new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(true);
    });
  }
}
