(function (global) {
  if (!global || global.__finPwaRegisterLoaded) return;
  global.__finPwaRegisterLoaded = true;

  var LOCALHOST_ENABLE_KEY = '__fin_pwa_enable_sw_localhost__';
  var SW_URL = '/service-worker.js';
  var PWA_POST_UPDATE_MENU_REDIRECT_KEY = 'fin_pwa_post_update_menu_patchnotes';
  var PWA_LAST_ACTIVATED_SW_VERSION_KEY = 'fin_pwa_last_activated_sw_version';
  var PWA_LAST_ACTIVATED_SW_AT_KEY = 'fin_pwa_last_activated_sw_at';
  var PWA_PREV_ACTIVATED_SW_VERSION_KEY = 'fin_pwa_prev_activated_sw_version';
  var PWA_LAST_UPDATE_CHANGED_ASSETS_KEY = 'fin_pwa_last_update_changed_assets';
  function t(key, fallback, vars) {
    var api = global.FinI18n || null;
    return api && typeof api.t === 'function'
      ? api.t(key, vars, fallback)
      : (fallback || key);
  }

  var registrationPromise = null;
  var reloadAfterUpdate = false;
  var allowReloadOnControllerChange = false;
  var updatePromptOpen = false;
  var deferredInstallPromptEvent = null;

  var pwaUiRoot = null;
  var pwaInstallButton = null;
  var pwaToastStack = null;
  var pwaUpdateToast = null;
  var pwaConfirmModal = null;
  var pwaConfirmTitle = null;
  var pwaConfirmMessage = null;
  var pwaConfirmPrimaryBtn = null;
  var pwaConfirmSecondaryBtn = null;
  var pwaConfirmCloseBtn = null;
  var pwaConfirmResolver = null;
  var pwaUiWired = false;
  var lastOrientationLockAttemptTs = 0;

  function safeLsGet(key, fallback) {
    try {
      if (!global.localStorage) return fallback;
      var raw = global.localStorage.getItem(String(key || ''));
      return raw == null ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  }

  function safeLsSet(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(String(key || ''), String(value == null ? '' : value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeLsRemove(key) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.removeItem(String(key || ''));
      return true;
    } catch (_) {
      return false;
    }
  }

  function markPostUpdateMenuRedirectPending() {
    safeLsSet(PWA_POST_UPDATE_MENU_REDIRECT_KEY, '1');
  }

  function isPostUpdateMenuRedirectPending() {
    return String(safeLsGet(PWA_POST_UPDATE_MENU_REDIRECT_KEY, '') || '') === '1';
  }

  function clearPostUpdateMenuRedirectPending() {
    safeLsRemove(PWA_POST_UPDATE_MENU_REDIRECT_KEY);
  }

  function rememberActivatedSwVersion(version) {
    var swVersion = String(version || '').trim();
    if (!swVersion) return;

    var prev = String(safeLsGet(PWA_LAST_ACTIVATED_SW_VERSION_KEY, '') || '').trim();
    if (prev && prev !== swVersion) {
      safeLsSet(PWA_PREV_ACTIVATED_SW_VERSION_KEY, prev);
    }

    safeLsSet(PWA_LAST_ACTIVATED_SW_VERSION_KEY, swVersion);
    safeLsSet(PWA_LAST_ACTIVATED_SW_AT_KEY, new Date().toISOString());
  }

  function rememberActivatedSwChangeSet(changedAssets, previousVersion) {
    try {
      var list = Array.isArray(changedAssets) ? changedAssets
        .map(function (x) { return String(x || '').trim(); })
        .filter(Boolean)
        .slice(0, 200)
        : [];
      safeLsSet(PWA_LAST_UPDATE_CHANGED_ASSETS_KEY, JSON.stringify(list));
    } catch (_) {
      safeLsSet(PWA_LAST_UPDATE_CHANGED_ASSETS_KEY, '[]');
    }

    var prev = String(previousVersion || '').trim();
    if (prev) safeLsSet(PWA_PREV_ACTIVATED_SW_VERSION_KEY, prev);
  }

  function buildPostUpdateMenuUrl() {
    var url = new URL('/menu.html', global.location && global.location.origin ? global.location.origin : undefined);
    url.searchParams.set('patchnotes', '1');
    url.searchParams.set('updated', '1');

    try {
      var current = new URL(global.location.href);
      if (current.searchParams.get('pwa-sw') === '1') {
        url.searchParams.set('pwa-sw', '1');
      }
    } catch (_) {}

    return url.toString();
  }

  function redirectToMenuPatchNotesAfterUpdate() {
    var target = buildPostUpdateMenuUrl();
    clearPostUpdateMenuRedirectPending();
    try {
      if (String(global.location && global.location.href || '') === target) return false;
      global.location.href = target;
      return true;
    } catch (_) {
      return false;
    }
  }

  function maybeConsumePendingPostUpdateRedirect() {
    if (!isPostUpdateMenuRedirectPending()) return false;
    return redirectToMenuPatchNotesAfterUpdate();
  }

  function isLocalHost(hostname) {
    var host = String(hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.slice(-6) === '.local';
  }

  function isSecureContextPwa() {
    if (!global.location) return false;
    if (global.isSecureContext) return true;
    return isLocalHost(global.location.hostname);
  }

  function canRunOnLocalhost() {
    try {
      var params = new URLSearchParams(global.location && global.location.search ? global.location.search : '');
      if (params.get('pwa-sw') === '1') return true;
      return String(global.localStorage && global.localStorage.getItem(LOCALHOST_ENABLE_KEY) || '') === '1';
    } catch (_) {
      return false;
    }
  }

  function cleanupLocalhostRegistrations() {
    if (!global.navigator || !global.navigator.serviceWorker || !global.navigator.serviceWorker.getRegistrations) return;

    global.navigator.serviceWorker.getRegistrations()
      .then(function (regs) {
        return Promise.all((regs || []).map(function (reg) {
          return reg.unregister().catch(function () { return false; });
        }));
      })
      .then(function (results) {
        var removed = (results || []).filter(Boolean).length;
        if (removed > 0) {
          console.info('[PWA] ' + t('pwa.logs.localhostSwRemoved', 'Service Workers removidos em localhost para evitar cache durante desenvolvimento.'));
        }
      })
      .catch(function () {});
  }

  function shouldRegister() {
    if (!global.navigator || !global.navigator.serviceWorker) {
      console.info('[PWA] ' + t('pwa.logs.notSupported', 'Service Worker não suportado neste navegador.'));
      return false;
    }

    if (!isSecureContextPwa()) {
      console.info('[PWA] ' + t('pwa.logs.insecureContext', 'Contexto inseguro; SW não registrado.'));
      return false;
    }

    if (isLocalHost(global.location && global.location.hostname) && !canRunOnLocalhost()) {
      console.info('[PWA] ' + t('pwa.logs.localhostDisabled', 'SW desativado em localhost. Use ?pwa-sw=1 ou localStorage["{key}"]="1" para testar.', { key: LOCALHOST_ENABLE_KEY }));
      cleanupLocalhostRegistrations();
      return false;
    }

    return true;
  }

  function isStandaloneMode() {
    try {
      if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (_) {}
    return Boolean(global.navigator && global.navigator.standalone);
  }

  function isLikelyMobileDevice() {
    try {
      if (global.navigator && Number(global.navigator.maxTouchPoints) > 0) return true;
    } catch (_) {}
    try {
      if (global.matchMedia && global.matchMedia('(max-width: 900px)').matches) return true;
    } catch (_) {}
    return false;
  }

  function canTryLandscapeLock() {
    if (!isLikelyMobileDevice()) return false;
    var orientationApi = global.screen && global.screen.orientation;
    if (!orientationApi || typeof orientationApi.lock !== 'function') return false;
    return true;
  }

  function tryLockLandscapeOrientation(reason) {
    if (!canTryLandscapeLock()) return Promise.resolve(false);

    var now = Date.now();
    if ((now - lastOrientationLockAttemptTs) < 1200) return Promise.resolve(false);
    lastOrientationLockAttemptTs = now;

    try {
      return Promise.resolve(global.screen.orientation.lock('landscape'))
        .then(function () {
          console.info('[PWA] Orientacao travada em paisagem' + (reason ? ' (' + reason + ')' : '') + '.');
          return true;
        })
        .catch(function (error) {
          var nome = String(error && error.name || '');
          if (isStandaloneMode()) {
            console.info('[PWA] Nao foi possivel travar orientacao em paisagem' + (reason ? ' (' + reason + ')' : '') + ':', nome || error);
          }
          return false;
        });
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  function wireOrientationPreference() {
    if (!global || global.__finPwaOrientationWired) return;
    global.__finPwaOrientationWired = true;

    function attempt(reason) {
      tryLockLandscapeOrientation(reason);
    }

    if (global.document && global.document.readyState === 'complete') {
      global.setTimeout(function () { attempt('load'); }, 80);
    } else {
      global.addEventListener('load', function () {
        global.setTimeout(function () { attempt('load'); }, 80);
      }, { once: true });
    }

    global.addEventListener('visibilitychange', function () {
      if (!global.document || global.document.visibilityState !== 'visible') return;
      attempt('visible');
    });

    global.addEventListener('orientationchange', function () {
      global.setTimeout(function () { attempt('orientationchange'); }, 120);
    });
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensurePwaUi() {
    if (!global.document || !global.document.body) return null;
    if (pwaUiRoot) return pwaUiRoot;

    pwaUiRoot = global.document.createElement('div');
    pwaUiRoot.id = 'fin-pwa-ui';
    pwaUiRoot.className = 'pwa-ui-root';
    pwaUiRoot.innerHTML = [
      '<button type="button" id="fin-pwa-install-btn" class="pwa-install-btn" hidden aria-label="', escapeHtml(t('pwa.ui.installAria', 'Instalar aplicativo')), '">',
      '  <i class="fa-solid fa-download" aria-hidden="true"></i>',
      '  <span>', escapeHtml(t('pwa.ui.installButton', 'Instalar app')), '</span>',
      '</button>',
      '<div id="fin-pwa-toast-stack" class="pwa-toast-stack" aria-live="polite" aria-atomic="false"></div>',
      '<div id="fin-pwa-confirm-modal" class="pwa-modal-backdrop" hidden>',
      '  <div class="pwa-modal-card" role="dialog" aria-modal="true" aria-labelledby="fin-pwa-confirm-title" aria-describedby="fin-pwa-confirm-msg">',
      '    <button type="button" class="pwa-modal-close" id="fin-pwa-confirm-close" aria-label="', escapeHtml(t('pwa.ui.closeModalAria', 'Fechar aviso')), '"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
      '    <div class="pwa-modal-title" id="fin-pwa-confirm-title"></div>',
      '    <div class="pwa-modal-msg" id="fin-pwa-confirm-msg"></div>',
      '    <div class="pwa-modal-actions">',
      '      <button type="button" class="pwa-modal-btn pwa-modal-btn-primary" id="fin-pwa-confirm-primary">', escapeHtml(t('pwa.update.confirm', 'Atualizar')), '</button>',
      '      <button type="button" class="pwa-modal-btn pwa-modal-btn-ghost" id="fin-pwa-confirm-secondary">', escapeHtml(t('pwa.update.later', 'Depois')), '</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    global.document.body.appendChild(pwaUiRoot);

    pwaInstallButton = pwaUiRoot.querySelector('#fin-pwa-install-btn');
    pwaToastStack = pwaUiRoot.querySelector('#fin-pwa-toast-stack');
    pwaConfirmModal = pwaUiRoot.querySelector('#fin-pwa-confirm-modal');
    pwaConfirmTitle = pwaUiRoot.querySelector('#fin-pwa-confirm-title');
    pwaConfirmMessage = pwaUiRoot.querySelector('#fin-pwa-confirm-msg');
    pwaConfirmPrimaryBtn = pwaUiRoot.querySelector('#fin-pwa-confirm-primary');
    pwaConfirmSecondaryBtn = pwaUiRoot.querySelector('#fin-pwa-confirm-secondary');
    pwaConfirmCloseBtn = pwaUiRoot.querySelector('#fin-pwa-confirm-close');

    if (pwaInstallButton) {
      pwaInstallButton.addEventListener('click', requestPwaInstall);
    }

    if (pwaConfirmModal) {
      pwaConfirmModal.addEventListener('click', function (event) {
        if (event.target === pwaConfirmModal) resolvePwaConfirm(false);
      });
    }

    if (pwaConfirmCloseBtn) {
      pwaConfirmCloseBtn.addEventListener('click', function () {
        resolvePwaConfirm(false);
      });
    }

    if (pwaConfirmPrimaryBtn) {
      pwaConfirmPrimaryBtn.addEventListener('click', function () {
        resolvePwaConfirm(true);
      });
    }

    if (pwaConfirmSecondaryBtn) {
      pwaConfirmSecondaryBtn.addEventListener('click', function () {
        resolvePwaConfirm(false);
      });
    }

    updateInstallButtonVisibility();
    refreshPwaUiTexts();
    return pwaUiRoot;
  }

  function refreshPwaUiTexts() {
    if (pwaInstallButton) {
      pwaInstallButton.setAttribute('aria-label', t('pwa.ui.installAria', 'Instalar aplicativo'));
      var span = pwaInstallButton.querySelector('span');
      if (span) span.textContent = t('pwa.ui.installButton', 'Instalar app');
    }
    if (pwaConfirmCloseBtn) {
      pwaConfirmCloseBtn.setAttribute('aria-label', t('pwa.ui.closeModalAria', 'Fechar aviso'));
    }
    if (pwaConfirmPrimaryBtn && !updatePromptOpen) {
      pwaConfirmPrimaryBtn.textContent = t('pwa.update.confirm', 'Atualizar');
    }
    if (pwaConfirmSecondaryBtn && !updatePromptOpen) {
      pwaConfirmSecondaryBtn.textContent = t('pwa.update.later', 'Depois');
    }
  }

  function closePwaConfirmModal() {
    if (!pwaConfirmModal) return false;
    pwaConfirmModal.classList.remove('visivel');
    pwaConfirmModal.hidden = true;
    if (global.document && global.document.body) {
      global.document.body.classList.remove('pwa-modal-open');
    }
    return true;
  }

  function resolvePwaConfirm(result) {
    closePwaConfirmModal();
    var resolver = pwaConfirmResolver;
    pwaConfirmResolver = null;
    if (typeof resolver === 'function') resolver(Boolean(result));
    return true;
  }

  function showPwaConfirmModal(options) {
    ensurePwaUi();
    if (!pwaConfirmModal || !pwaConfirmTitle || !pwaConfirmMessage || !pwaConfirmPrimaryBtn || !pwaConfirmSecondaryBtn) {
      return Promise.resolve(false);
    }

    var opts = options || {};
    pwaConfirmTitle.textContent = String(opts.title || 'Confirmar');
    pwaConfirmMessage.textContent = String(opts.message || '');
    pwaConfirmPrimaryBtn.textContent = String(opts.primaryLabel || 'OK');
    pwaConfirmSecondaryBtn.textContent = String(opts.secondaryLabel || 'Cancelar');

    if (typeof pwaConfirmResolver === 'function') {
      pwaConfirmResolver(false);
      pwaConfirmResolver = null;
    }

    pwaConfirmModal.hidden = false;
    if (global.document && global.document.body) {
      global.document.body.classList.add('pwa-modal-open');
    }
    global.requestAnimationFrame(function () {
      if (pwaConfirmModal) pwaConfirmModal.classList.add('visivel');
      if (pwaConfirmPrimaryBtn && typeof pwaConfirmPrimaryBtn.focus === 'function') {
        pwaConfirmPrimaryBtn.focus();
      }
    });

    return new Promise(function (resolve) {
      pwaConfirmResolver = resolve;
    });
  }

  function updateInstallButtonVisibility() {
    if (!pwaInstallButton) return;
    var available = Boolean(deferredInstallPromptEvent && !isStandaloneMode());
    pwaInstallButton.hidden = !available;
    emitInstallAvailabilityChange(available);
  }

  function emitInstallAvailabilityChange(forcedAvailable) {
    try {
      var available = typeof forcedAvailable === 'boolean'
        ? forcedAvailable
        : Boolean(deferredInstallPromptEvent && !isStandaloneMode());
      global.dispatchEvent(new CustomEvent('fin:pwa-install-availability', {
        detail: {
          available: available,
          standalone: Boolean(isStandaloneMode())
        }
      }));
    } catch (_) {}
  }

  function closePwaToast(toastEl) {
    if (!toastEl || !toastEl.parentNode) return false;
    toastEl.classList.add('saindo');
    global.setTimeout(function () {
      if (toastEl && toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 170);
    return true;
  }

  function createToastButton(action, toastEl) {
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'pwa-toast-btn' + (action && action.kind ? ' pwa-toast-btn-' + action.kind : '');
    btn.textContent = String(action && action.label || 'OK');

    btn.addEventListener('click', function () {
      if (action && typeof action.onClick === 'function') {
        action.onClick();
        return;
      }
      closePwaToast(toastEl);
    });

    return btn;
  }

  function showPwaToast(options) {
    ensurePwaUi();
    if (!pwaToastStack || !global.document) return null;

    var opts = options || {};
    var kind = String(opts.kind || 'info');
    var title = String(opts.title || '').trim();
    var message = String(opts.message || '').trim();
    var actions = Array.isArray(opts.actions) ? opts.actions : [];
    var persist = Boolean(opts.persist);
    var autoHideMs = persist ? 0 : Math.max(2200, Number(opts.autoHideMs) || 3800);

    var toastEl = global.document.createElement('section');
    toastEl.className = 'pwa-toast pwa-toast-' + kind;
    toastEl.setAttribute('role', kind === 'danger' ? 'alert' : 'status');

    var html = '';
    if (title) html += '<div class="pwa-toast-title">' + escapeHtml(title) + '</div>';
    if (message) html += '<div class="pwa-toast-msg">' + escapeHtml(message) + '</div>';
    if (actions.length) html += '<div class="pwa-toast-actions"></div>';
    toastEl.innerHTML = html;

    if (actions.length) {
      var actionsWrap = toastEl.querySelector('.pwa-toast-actions');
      actions.forEach(function (action) {
        actionsWrap.appendChild(createToastButton(action, toastEl));
      });
    }

    pwaToastStack.appendChild(toastEl);
    global.requestAnimationFrame(function () {
      toastEl.classList.add('visivel');
    });

    if (autoHideMs > 0) {
      global.setTimeout(function () {
        closePwaToast(toastEl);
      }, autoHideMs);
    }

    return toastEl;
  }

  function requestPwaInstall() {
    if (!deferredInstallPromptEvent) {
      showPwaToast({
        kind: 'info',
        title: t('pwa.install.unavailableTitle', 'Instalação indisponível'),
        message: t('pwa.install.unavailableMessage', 'Abra no Chrome (Android/Desktop) e aguarde o app ficar instalável para usar este botão.'),
        autoHideMs: 3600
      });
      return false;
    }

    var promptEvent = deferredInstallPromptEvent;
    deferredInstallPromptEvent = null;
    updateInstallButtonVisibility();

    try {
      promptEvent.prompt();
    } catch (error) {
      console.error('[PWA] ' + t('pwa.logs.installPromptOpenFail', 'Falha ao abrir prompt de instalação:'), error);
      showPwaToast({
        kind: 'danger',
        title: t('pwa.install.failTitle', 'Falha na instalação'),
        message: t('pwa.install.failMessage', 'Não foi possível abrir o prompt de instalação agora.')
      });
      return;
    }

    if (promptEvent.userChoice && typeof promptEvent.userChoice.then === 'function') {
      promptEvent.userChoice.then(function (choice) {
        var outcome = String(choice && choice.outcome || '');
        console.info('[PWA] ' + t('pwa.logs.installPromptResult', 'Resultado do prompt de instalação:'), outcome || t('pwa.logs.unknown', 'desconhecido'));

        if (outcome === 'accepted') {
          showPwaToast({
            kind: 'success',
            title: t('pwa.install.startedTitle', 'Instalação iniciada'),
            message: t('pwa.install.startedMessage', 'O navegador vai concluir a instalação do app.'),
            autoHideMs: 2600
          });
          return;
        }

        showPwaToast({
          kind: 'info',
          title: t('pwa.install.cancelledTitle', 'Instalação cancelada'),
          message: t('pwa.install.cancelledMessage', 'Você pode tentar novamente quando o navegador liberar um novo prompt.'),
          autoHideMs: 3200
        });
      }).catch(function () {});
    }
    return true;
  }

  function canUseLocalNotifications() {
    return typeof global.Notification !== 'undefined'
      && (global.isSecureContext || isLocalHost(global.location && global.location.hostname));
  }

  function requestLocalNotificationPermission(options) {
    var opts = options || {};
    if (!canUseLocalNotifications()) return Promise.resolve('unsupported');

    var current = String(global.Notification.permission || 'default');
    if (current === 'granted' || current === 'denied') return Promise.resolve(current);
    if (opts.silent === true) return Promise.resolve(current);

    try {
      return Promise.resolve(global.Notification.requestPermission())
        .then(function (result) {
          return String(result || 'default');
        })
        .catch(function () {
          return 'default';
        });
    } catch (_) {
      return Promise.resolve('default');
    }
  }

  function openUrlFromNotification(url) {
    var target = String(url || '').trim();
    if (!target) return false;
    try {
      global.open(target, '_blank');
      return true;
    } catch (_) {
      try {
        global.location.href = target;
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function getNotificationRegistration() {
    if (!global.navigator || !global.navigator.serviceWorker) return Promise.resolve(null);

    var basePromise = registrationPromise || registerServiceWorker();
    return Promise.resolve(basePromise)
      .then(function (registration) {
        if (registration) return registration;
        if (!global.navigator.serviceWorker.ready || typeof global.navigator.serviceWorker.ready.then !== 'function') {
          return null;
        }
        return global.navigator.serviceWorker.ready.catch(function () { return null; });
      })
      .catch(function () {
        return null;
      });
  }

  function showLocalNotification(options) {
    var opts = options || {};
    var title = String(opts.title || '').trim() || t('pwa.notifications.defaultTitle', 'Finances');
    var body = String(opts.body || '').trim();
    var icon = String(opts.icon || '/icons/icon-192.png').trim();
    var badge = String(opts.badge || '/icons/favicon-32.png').trim();
    var tag = String(opts.tag || ('fin-notification-' + Date.now())).trim();
    var url = String(opts.url || '').trim();
    var data = Object.assign({}, (opts.data && typeof opts.data === 'object') ? opts.data : {});
    if (url && !data.url) data.url = url;

    if (!canUseLocalNotifications()) return Promise.resolve(false);
    if (String(global.Notification.permission || 'default') !== 'granted') return Promise.resolve(false);

    var swOptions = {
      body: body,
      icon: icon,
      badge: badge,
      tag: tag,
      renotify: Boolean(opts.renotify),
      requireInteraction: Boolean(opts.requireInteraction),
      data: data
    };

    if (Array.isArray(opts.actions) && opts.actions.length) {
      swOptions.actions = opts.actions
        .map(function (action) {
          if (!action || typeof action !== 'object') return null;
          var a = String(action.action || '').trim();
          var titleAction = String(action.title || '').trim();
          if (!a || !titleAction) return null;
          return { action: a, title: titleAction };
        })
        .filter(Boolean)
        .slice(0, 2);
    }

    if (Array.isArray(opts.vibrate) && opts.vibrate.length) {
      swOptions.vibrate = opts.vibrate.slice(0, 12);
    }

    var fallback = function () {
      try {
        var notif = new global.Notification(title, {
          body: body,
          icon: icon,
          badge: badge,
          tag: tag,
          renotify: Boolean(opts.renotify),
          data: data
        });
        if (url) {
          notif.onclick = function () {
            try { notif.close(); } catch (_) {}
            openUrlFromNotification(url);
          };
        }
        return true;
      } catch (_) {
        return false;
      }
    };

    return getNotificationRegistration()
      .then(function (registration) {
        if (registration && typeof registration.showNotification === 'function') {
          return registration.showNotification(title, swOptions)
            .then(function () { return true; })
            .catch(function () { return fallback(); });
        }
        return fallback();
      })
      .catch(function () {
        return fallback();
      });
  }

  function promptUpdate(registration) {
    if (!registration || !registration.waiting || updatePromptOpen) return false;
    updatePromptOpen = true;
    if (pwaUpdateToast) {
      closePwaToast(pwaUpdateToast);
      pwaUpdateToast = null;
    }

    showPwaConfirmModal({
      title: t('pwa.update.title', 'Nova versão disponível'),
      message: t('pwa.update.message', 'Uma atualização do app foi baixada. Deseja atualizar agora?'),
      primaryLabel: t('pwa.update.confirm', 'Atualizar'),
      secondaryLabel: t('pwa.update.later', 'Depois')
    }).then(function (confirmado) {
      updatePromptOpen = false;
      if (!confirmado) return;

      allowReloadOnControllerChange = true;
      markPostUpdateMenuRedirectPending();
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }).catch(function () {
      updatePromptOpen = false;
    });

    return true;
  }

  function wireInstallUiEvents() {
    if (pwaUiWired) return;
    pwaUiWired = true;

    ensurePwaUi();

    global.addEventListener('beforeinstallprompt', function (event) {
      console.info('[PWA] ' + t('pwa.logs.beforeInstallPrompt', 'beforeinstallprompt recebido.'));
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      deferredInstallPromptEvent = event;
      ensurePwaUi();
      updateInstallButtonVisibility();
      showPwaToast({
        kind: 'success',
        title: t('pwa.install.availableTitle', 'App instalável'),
        message: t('pwa.install.availableMessage', 'Você já pode instalar o Finances neste dispositivo.'),
        autoHideMs: 3000
      });
    });

    global.addEventListener('appinstalled', function () {
      console.info('[PWA] ' + t('pwa.logs.appInstalled', 'App instalado.'));
      deferredInstallPromptEvent = null;
      updateInstallButtonVisibility();
      global.setTimeout(function () { tryLockLandscapeOrientation('appinstalled'); }, 180);
      showPwaToast({
        kind: 'success',
        title: t('pwa.install.doneTitle', 'App instalado'),
        message: t('pwa.install.doneMessage', 'Agora o Finances pode abrir em modo standalone.'),
        autoHideMs: 3500
      });
    });

    global.addEventListener('keydown', function (event) {
      if (!pwaConfirmModal || pwaConfirmModal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        resolvePwaConfirm(false);
      }
    });

    if (global.matchMedia) {
      try {
        var modeQuery = global.matchMedia('(display-mode: standalone)');
        if (modeQuery && typeof modeQuery.addEventListener === 'function') {
          modeQuery.addEventListener('change', updateInstallButtonVisibility);
        } else if (modeQuery && typeof modeQuery.addListener === 'function') {
          modeQuery.addListener(updateInstallButtonVisibility);
        }
      } catch (_) {}
    }

    global.addEventListener('fin:i18n-change', function () {
      refreshPwaUiTexts();
    });
  }

  function wireRegistration(registration) {
    if (!registration || registration.__finPwaHooks === '1') return;
    registration.__finPwaHooks = '1';

    function watchWorker(worker) {
      if (!worker || worker.__finPwaWorkerHook === '1') return;
      worker.__finPwaWorkerHook = '1';

      worker.addEventListener('statechange', function () {
        console.info('[PWA] SW state:', worker.state);
        if (worker.state === 'installed' && global.navigator.serviceWorker.controller) {
          promptUpdate(registration);
        }
      });
    }

    if (registration.installing) watchWorker(registration.installing);
    if (registration.waiting && global.navigator.serviceWorker.controller) {
      global.setTimeout(function () { promptUpdate(registration); }, 120);
    }

    registration.addEventListener('updatefound', function () {
      console.info('[PWA] Nova atualização encontrada.');
      watchWorker(registration.installing);
    });
  }

  function wireGlobalSwEvents() {
    if (!global.navigator || !global.navigator.serviceWorker) return;
    if (global.navigator.serviceWorker.__finPwaGlobalHooks === '1') return;
    global.navigator.serviceWorker.__finPwaGlobalHooks = '1';

    global.navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!allowReloadOnControllerChange) {
        console.info('[PWA] Service Worker assumiu o controle (primeira ativação).');
        return;
      }
      if (reloadAfterUpdate) return;
      reloadAfterUpdate = true;
      console.info('[PWA] Novo Service Worker assumiu o controle. Abrindo menu com Patch Notes...');
      if (!redirectToMenuPatchNotesAfterUpdate()) {
        global.location.reload();
      }
    });

    global.navigator.serviceWorker.addEventListener('message', function (event) {
      var data = event && event.data ? event.data : {};
      if (data.type === 'SW_ACTIVATED') {
        rememberActivatedSwVersion(data.version || '');
        rememberActivatedSwChangeSet(data.changedAssets, data.previousVersion);
        console.info('[PWA] SW ativo:', data.version || '(sem versão)');
      }
    });
  }

  function registerServiceWorker() {
    if (registrationPromise) return registrationPromise;
    if (!shouldRegister()) {
      registrationPromise = Promise.resolve(null);
      return registrationPromise;
    }

    wireGlobalSwEvents();

    registrationPromise = global.navigator.serviceWorker.register(SW_URL, { scope: '/' })
      .then(function (registration) {
        console.info('[PWA] Service Worker registrado com sucesso:', registration.scope);
        wireRegistration(registration);

        global.addEventListener('visibilitychange', function () {
          if (global.document && global.document.visibilityState === 'visible') {
            registration.update().catch(function () {});
            if (registration.waiting) promptUpdate(registration);
          }
        });

        global.addEventListener('online', function () {
          registration.update().catch(function () {});
          if (registration.waiting) promptUpdate(registration);
        });

        return registration;
      })
      .catch(function (error) {
        console.error('[PWA] Falha ao registrar Service Worker:', error);
        return null;
      });

    return registrationPromise;
  }

  function scheduleRegistration() {
    if (!global.navigator || !global.navigator.serviceWorker) return;

    if (global.document && global.document.readyState === 'complete') {
      registerServiceWorker();
      return;
    }

    global.addEventListener('load', function () {
      registerServiceWorker();
    }, { once: true });
  }

  wireInstallUiEvents();
  wireOrientationPreference();
  maybeConsumePendingPostUpdateRedirect();

  global.FinPwa = Object.assign({}, global.FinPwa || {}, {
    requestInstall: function () {
      ensurePwaUi();
      return requestPwaInstall();
    },
    isInstallAvailable: function () {
      return Boolean(deferredInstallPromptEvent && !isStandaloneMode());
    },
    isStandaloneMode: function () {
      return Boolean(isStandaloneMode());
    },
    refreshInstallAvailability: function () {
      ensurePwaUi();
      updateInstallButtonVisibility();
      return Boolean(deferredInstallPromptEvent && !isStandaloneMode());
    },
    requestNotificationPermission: function (options) {
      return requestLocalNotificationPermission(options);
    },
    showLocalNotification: function (options) {
      return showLocalNotification(options);
    },
    canUseLocalNotifications: function () {
      return canUseLocalNotifications();
    }
  });

  scheduleRegistration();
})(window);
