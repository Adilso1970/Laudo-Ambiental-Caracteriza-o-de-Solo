const NB_PWA_STATE = {
  deferredPrompt: null,
  installed: false
};

async function registerNbServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    return !!reg;
  } catch (err) {
    console.warn('[PWA] Falha ao registrar service worker:', err);
    return false;
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  NB_PWA_STATE.deferredPrompt = event;
  window.dispatchEvent(new CustomEvent('nb-pwa-install-available'));
});

window.addEventListener('appinstalled', () => {
  NB_PWA_STATE.installed = true;
  NB_PWA_STATE.deferredPrompt = null;
  window.dispatchEvent(new CustomEvent('nb-pwa-installed'));
});

window.__NB_PWA__ = {
  async promptInstall() {
    if (!NB_PWA_STATE.deferredPrompt) return false;
    NB_PWA_STATE.deferredPrompt.prompt();
    const choice = await NB_PWA_STATE.deferredPrompt.userChoice;
    NB_PWA_STATE.deferredPrompt = null;
    return choice?.outcome === 'accepted';
  },
  isInstallAvailable() {
    return !!NB_PWA_STATE.deferredPrompt;
  }
};

registerNbServiceWorker();