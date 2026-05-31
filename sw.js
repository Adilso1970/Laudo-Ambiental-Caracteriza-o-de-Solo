// CACHE_BUST: 20260531-101816-local-fix
const CACHE_NAME = 'ambiental-offline-20260531-101816';
const PRECACHE_URLS = [
  "./",
  "./app.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/marca-nb.webp",
  "./auth_bootstrap.js",
  "./core/analysis/analysis-pipeline.js",
  "./core/analysis/aux-pack-loader.js",
  "./core/analysis/consistency-engine.js",
  "./core/analysis/context-normalizer.js",
  "./core/analysis/diagnostic-summary.js",
  "./core/analysis/findings-engine.js",
  "./core/analysis/recommendation-engine.js",
  "./core/analysis/technical-text-composer.js",
  "./core/auth/auth_config.js",
  "./core/normative/normative-loader.js",
  "./core/normative/rule-engine.js",
  "./core/normative/rule-registry.js",
  "./core/normative/severity-model.js",
  "./core/vegetacao/controller.js",
  "./core/vegetacao/facade.js",
  "./core/vegetacao/runtime.js",
  "./core/vegetacao/schema.js",
  "./core/vegetacao/session_engine.js",
  "./data/base_legal.json",
  "./index.html",
  "./lib/db.js",
  "./lib/export_zip.js",
  "./lib/projects_remote.js",
  "./lib/report_docx.js",
  "./lib/report_pdf.js",
  "./lib/rules.js",
  "./manifest.webmanifest",
  "./normative/audit-policy.v1.json",
  "./normative/context-schema.v1.json",
  "./normative/example-context.v1.json",
  "./normative/laudo-snippets.v1.json",
  "./normative/recommendation-policies.v1.json",
  "./normative/rules.v1.json",
  "./normative/sources.json",
  "./normative/workflow-statuses.v1.json",
  "./pages/agua.js",
  "./pages/conformidade.js",
  "./pages/evidencias.js",
  "./pages/fauna.js",
  "./pages/flora.js",
  "./pages/laudo.js",
  "./pages/projects.js",
  "./pages/solo.js",
  "./pages/vegetacao_supressao.js",
  "./pages/wizard_10_itens.js",
  "./styles/app.css",
  "./sw.js",
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('./index.html')) || (await cache.match('./'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, response.clone())).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(req).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
