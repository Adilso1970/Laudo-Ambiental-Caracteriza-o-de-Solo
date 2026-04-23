// CACHE_BUST: 20260422-223333-short-publish
const CACHE_NAME = 'solo-nb-offline-20260422-181001';
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
  "./core/analysis/index.js",
  "./core/analysis/recommendation-engine.js",
  "./core/analysis/sample-context.js",
  "./core/analysis/technical-text-composer.js",
  "./core/audit/audit-log.js",
  "./core/audit/index.js",
  "./core/audit/snapshot-manager.js",
  "./core/auth/auth_config.js",
  "./core/normative/index.js",
  "./core/normative/normative-loader.js",
  "./core/normative/rule-engine.js",
  "./core/normative/rule-registry.js",
  "./core/normative/severity-model.js",
  "./core/vegetacao/analysis_service.js",
  "./core/vegetacao/controller.js",
  "./core/vegetacao/dedup_service.js",
  "./core/vegetacao/facade.js",
  "./core/vegetacao/handoff_service.js",
  "./core/vegetacao/healthcheck.js",
  "./core/vegetacao/index.js",
  "./core/vegetacao/laudo_apply.js",
  "./core/vegetacao/laudo_apply_selftest.js",
  "./core/vegetacao/laudo_bridge.js",
  "./core/vegetacao/laudo_composer_bridge.js",
  "./core/vegetacao/laudo_delivery_api.js",
  "./core/vegetacao/laudo_delivery_bootstrap.js",
  "./core/vegetacao/laudo_delivery_diagnostics.js",
  "./core/vegetacao/laudo_delivery_gateway.js",
  "./core/vegetacao/laudo_delivery_orchestrator.js",
  "./core/vegetacao/laudo_delivery_runtime_api.js",
  "./core/vegetacao/laudo_delivery_runtime_bootstrap.js",
  "./core/vegetacao/laudo_delivery_runtime_bridge.js",
  "./core/vegetacao/laudo_delivery_runtime_consumer.js",
  "./core/vegetacao/laudo_delivery_runtime_consumer_diagnostics.js",
  "./core/vegetacao/laudo_delivery_runtime_consumer_orchestrator.js",
  "./core/vegetacao/laudo_delivery_runtime_diagnostics.js",
  "./core/vegetacao/laudo_delivery_runtime_orchestrator.js",
  "./core/vegetacao/laudo_delivery_runtime_selftest.js",
  "./core/vegetacao/laudo_delivery_selftest.js",
  "./core/vegetacao/laudo_delivery_service.js",
  "./core/vegetacao/laudo_final_api.js",
  "./core/vegetacao/laudo_final_api_diagnostics.js",
  "./core/vegetacao/laudo_final_api_selftest.js",
  "./core/vegetacao/laudo_final_entrypoint.js",
  "./core/vegetacao/laudo_final_entrypoint_diagnostics.js",
  "./core/vegetacao/laudo_final_entrypoint_selftest.js",
  "./core/vegetacao/laudo_final_orchestrator.js",
  "./core/vegetacao/laudo_final_runner.js",
  "./core/vegetacao/laudo_final_runner_selftest.js",
  "./core/vegetacao/laudo_generator_adapter.js",
  "./core/vegetacao/laudo_integration_service.js",
  "./core/vegetacao/laudo_real_hook.js",
  "./core/vegetacao/laudo_section_builder.js",
  "./core/vegetacao/module_adapter.js",
  "./core/vegetacao/module_api.js",
  "./core/vegetacao/module_bootstrap.js",
  "./core/vegetacao/module_diagnostics.js",
  "./core/vegetacao/module_gateway.js",
  "./core/vegetacao/module_manifest.js",
  "./core/vegetacao/module_registry.js",
  "./core/vegetacao/module_runtime.js",
  "./core/vegetacao/module_selftest.js",
  "./core/vegetacao/module_service.js",
  "./core/vegetacao/module_sync.js",
  "./core/vegetacao/pipeline.js",
  "./core/vegetacao/readiness_service.js",
  "./core/vegetacao/runtime.js",
  "./core/vegetacao/schema.js",
  "./core/vegetacao/session_engine.js",
  "./core/vegetacao/validator.js",
  "./core/workflow/approval-policy.js",
  "./core/workflow/index.js",
  "./core/workflow/status-machine.js",
  "./core/workflow/workflow-audit-pipeline.js",
  "./core/workflow/workflow-engine.js",
  "./data/base_legal.json",
  "./dev/diagnostico-tecnico.js",
  "./diagnostico-tecnico.html",
  "./index.html",
  "./lib/db.js",
  "./lib/export_zip.js",
  "./lib/projects_remote.js",
  "./lib/report_docx.js",
  "./lib/report_pdf.js",
  "./lib/rules.js",
  "./lib/supabase_browser.js",
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
  "./ui_text_fix.DISABLED.js"
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