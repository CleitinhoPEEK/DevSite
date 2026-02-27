(function (global) {
  'use strict';

  if (!global || global.__finMenuPageLoaded) return;
  global.__finMenuPageLoaded = true;

  var doc = global.document;
  if (!doc) return;
  var PATCH_MODAL_ID = 'menu-app-patchnotes-modal';
  var PATCH_NOTES_STORAGE_KEY = 'menu_patch_notes_v1';
  var PATCH_NOTES_LAST_SEEN_VERSION_KEY = 'menu_patch_notes_last_seen_version';
  var PATCH_NOTES_LAST_SEEN_BACKEND_VERSION_KEY = 'menu_patch_notes_last_seen_backend_version';
  var PATCH_NOTES_LAST_SEEN_FRONTEND_PWA_VERSION_KEY = 'menu_patch_notes_last_seen_frontend_pwa_version';
  var PWA_LAST_ACTIVATED_SW_VERSION_KEY = 'fin_pwa_last_activated_sw_version';
  var PWA_LAST_ACTIVATED_SW_AT_KEY = 'fin_pwa_last_activated_sw_at';
  var PWA_PREV_ACTIVATED_SW_VERSION_KEY = 'fin_pwa_prev_activated_sw_version';
  var PWA_LAST_UPDATE_CHANGED_ASSETS_KEY = 'fin_pwa_last_update_changed_assets';
  var FRONTEND_PWA_VERSION_CACHE_KEY = 'menu_frontend_pwa_version_info_v1';
  var FRONTEND_SW_VERSION_ENDPOINT = '/service-worker.js';
  var BACKEND_APP_VERSION_ENDPOINT = '/api/app-version';
  var BACKEND_APP_VERSION_CACHE_KEY = 'menu_backend_app_version_info_v1';
  var patchNotesState = null;
  var backendVersionInfoState = null;
  var frontendPwaVersionInfoState = null;
  var PATCH_NOTES = [
    {
      version: '2026.02.25-01',
      releasedAt: '2026-02-25T18:10:00-03:00',
      title: {
        'pt-BR': 'Patch notes no menu inicial',
        'en-US': 'Patch notes in the main menu'
      },
      changes: {
        'pt-BR': [
          'Nova opcao no Painel de Controle para abrir o historico de atualizacoes.',
          'Modal de Patch notes com data e hora de lancamento de cada versao.',
          'Lista de mudancas organizada por versao em formato de timeline.'
        ],
        'en-US': [
          'New option in the Control Panel to open the update history.',
          'Patch notes modal with release date and time for each version.',
          'Change list organized by version in a timeline layout.'
        ]
      }
    },
    {
      version: '2026.02.24-13',
      releasedAt: '2026-02-24T17:20:00-03:00',
      title: {
        'pt-BR': 'Traducao de pop-ups e ajustes de i18n',
        'en-US': 'Popup translation and i18n improvements'
      },
      changes: {
        'pt-BR': [
          'Traducao dos modais da tela principal (cadastro, edicao e WhatsApp).',
          'Traducao de notificacoes e descricoes do extrato na pagina Economias.',
          'Correcoes de labels e textos ainda fixos na interface.'
        ],
        'en-US': [
          'Translated the main screen modals (create, edit and WhatsApp).',
          'Translated notifications and statement descriptions on the Savings page.',
          'Fixed labels and remaining hardcoded interface texts.'
        ]
      }
    },
    {
      version: '2026.02.24-10',
      releasedAt: '2026-02-24T14:45:00-03:00',
      title: {
        'pt-BR': 'Modo Comercio expandido',
        'en-US': 'Expanded Commerce Mode'
      },
      changes: {
        'pt-BR': [
          'Comanda com varios itens, desconto/acrescimo e fechamento de venda.',
          'Extrato proprio do comercio, abas e relatorios por itens (7/15/30 dias).',
          'Exportacao consolidada para o extrato da carteira e pop-ups customizados.'
        ],
        'en-US': [
          'Order workflow with multiple items, discount/surcharge and sale closing.',
          'Dedicated commerce statement, tabs and item reports (7/15/30 days).',
          'Consolidated export to wallet statement and custom popups.'
        ]
      }
    },
    {
      version: '2026.02.24-07',
      releasedAt: '2026-02-24T11:30:00-03:00',
      title: {
        'pt-BR': 'PWA instalavel e fluxo de atualizacao',
        'en-US': 'Installable PWA and update flow'
      },
      changes: {
        'pt-BR': [
          'Manifest, Service Worker e cache por estrategia (HTML/arquivos/CDN).',
          'Botao de instalar app e aviso de nova versao com update controlado.',
          'Fallback offline e limpeza de caches antigos por versao.'
        ],
        'en-US': [
          'Manifest, Service Worker and cache strategy for HTML/assets/CDN.',
          'Install app button and new version prompt with controlled update flow.',
          'Offline fallback and old cache cleanup by version.'
        ]
      }
    }
  ];

  function getI18n() {
    return global.FinI18n || null;
  }

  function getCommon() {
    return global.FinCommon || null;
  }

  function getLanguage() {
    var api = getI18n();
    if (api && typeof api.getLanguage === 'function') {
      return api.getLanguage();
    }
    return 'pt-BR';
  }

  function t(key, fallback, vars) {
    var api = getI18n();
    if (api && typeof api.t === 'function') {
      return api.t(key, vars, fallback);
    }
    return fallback || key;
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  function safeGetJsonLocal(key, fallback) {
    var common = getCommon();
    if (common && typeof common.safeGetJSON === 'function') {
      return common.safeGetJSON(key, fallback);
    }
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function safeSetJsonLocal(key, value) {
    var common = getCommon();
    if (common && typeof common.safeSetJSON === 'function') {
      return common.safeSetJSON(key, value);
    }
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeGetItemLocal(key, fallback) {
    var common = getCommon();
    if (common && typeof common.safeGetItem === 'function') {
      return common.safeGetItem(key, fallback);
    }
    try {
      if (!global.localStorage) return fallback;
      var raw = global.localStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  }

  function safeSetItemLocal(key, value) {
    var common = getCommon();
    if (common && typeof common.safeSetItem === 'function') {
      return common.safeSetItem(key, value);
    }
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, String(value ?? ''));
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizarListaStrings(lista) {
    var src = Array.isArray(lista) ? lista : [];
    return src.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  }

  function normalizarBackendVersionInfo(raw) {
    var backend = raw && typeof raw === 'object'
      ? (raw.backend && typeof raw.backend === 'object' ? raw.backend : raw)
      : null;
    if (!backend) return null;

    var version = String(backend.version || '').trim();
    if (!version) return null;

    var releasedAtRaw = String(backend.releasedAt || '').trim();
    var releasedAtDate = new Date(releasedAtRaw || Date.now());
    var releasedAt = Number.isNaN(releasedAtDate.getTime())
      ? new Date().toISOString()
      : releasedAtDate.toISOString();

    var title = backend.title && typeof backend.title === 'object' ? backend.title : {};
    var changes = backend.changes && typeof backend.changes === 'object' ? backend.changes : {};

    return {
      version: version,
      releasedAt: releasedAt,
      fingerprint: String(backend.fingerprint || '').trim(),
      source: String(backend.source || 'server.js').trim() || 'server.js',
      title: {
        'pt-BR': String(title['pt-BR'] || title.pt || title['pt_BR'] || '').trim(),
        'en-US': String(title['en-US'] || title.en || title['en_US'] || '').trim()
      },
      changes: {
        'pt-BR': normalizarListaStrings(changes['pt-BR'] || changes.pt),
        'en-US': normalizarListaStrings(changes['en-US'] || changes.en)
      },
      affectedAreas: normalizarListaStrings(backend.affectedAreas),
      changedFiles: normalizarListaStrings(backend.changedFiles)
    };
  }

  function carregarBackendVersionInfoCache() {
    if (backendVersionInfoState && typeof backendVersionInfoState === 'object') return backendVersionInfoState;
    backendVersionInfoState = normalizarBackendVersionInfo(safeGetJsonLocal(BACKEND_APP_VERSION_CACHE_KEY, null));
    return backendVersionInfoState;
  }

  function salvarBackendVersionInfoCache(info) {
    backendVersionInfoState = normalizarBackendVersionInfo(info);
    if (backendVersionInfoState) safeSetJsonLocal(BACKEND_APP_VERSION_CACHE_KEY, backendVersionInfoState);
    return backendVersionInfoState;
  }

  function obterBackendVersionInfoAtual() {
    return carregarBackendVersionInfoCache();
  }

  function obterVersaoBackendAtual() {
    var info = obterBackendVersionInfoAtual();
    return info ? String(info.version || '').trim() : '';
  }

  function normalizarFrontendPwaVersionInfo(raw) {
    var info = raw && typeof raw === 'object' ? raw : null;
    if (!info) return null;

    var swVersion = String(info.swVersion || info.version || '').trim();
    if (!swVersion) return null;

    var releasedAtRaw = String(info.releasedAt || info.detectedAt || '').trim();
    var releasedAtDate = new Date(releasedAtRaw || Date.now());
    var releasedAt = Number.isNaN(releasedAtDate.getTime())
      ? new Date().toISOString()
      : releasedAtDate.toISOString();

    var previousSwVersion = String(info.previousSwVersion || '').trim();
    var changedAssets = normalizarListaStrings(info.changedAssets || info.changedFiles)
      .map(normalizarAssetPathPatchNote)
      .filter(Boolean);

    return {
      swVersion: swVersion,
      previousSwVersion: previousSwVersion,
      releasedAt: releasedAt,
      changedAssets: changedAssets
    };
  }

  function carregarFrontendPwaVersionInfoCache() {
    if (frontendPwaVersionInfoState && typeof frontendPwaVersionInfoState === 'object') {
      return frontendPwaVersionInfoState;
    }
    frontendPwaVersionInfoState = normalizarFrontendPwaVersionInfo(
      safeGetJsonLocal(FRONTEND_PWA_VERSION_CACHE_KEY, null)
    );
    return frontendPwaVersionInfoState;
  }

  function salvarFrontendPwaVersionInfoCache(info) {
    frontendPwaVersionInfoState = normalizarFrontendPwaVersionInfo(info);
    if (frontendPwaVersionInfoState) {
      safeSetJsonLocal(FRONTEND_PWA_VERSION_CACHE_KEY, frontendPwaVersionInfoState);
    }
    return frontendPwaVersionInfoState;
  }

  function obterFrontendPwaVersionInfoAtual() {
    return carregarFrontendPwaVersionInfoCache();
  }

  function obterVersaoFrontendPwaAtual() {
    var info = obterFrontendPwaVersionInfoAtual();
    if (!info) return '';
    return normalizarVersaoPatchPorSw(info.swVersion || '');
  }

  function getPatchEntryText(bundle, lang, fallback) {
    if (!bundle || typeof bundle !== 'object') return fallback || '';
    return bundle[lang] || bundle['pt-BR'] || bundle['en-US'] || fallback || '';
  }

  function getPatchEntryList(bundle, lang) {
    var lista = bundle && typeof bundle === 'object'
      ? (bundle[lang] || bundle['pt-BR'] || bundle['en-US'])
      : null;
    return Array.isArray(lista) ? lista : [];
  }

  function dividirPatchNoteEmPartes(entry, limiteMudancas) {
    var src = entry && typeof entry === 'object' ? entry : null;
    var limite = Math.max(1, Number(limiteMudancas) || 4);
    if (!src) return [];

    var pt = getPatchEntryList(src.changes, 'pt-BR');
    var en = getPatchEntryList(src.changes, 'en-US');
    var totalMudancas = Math.max(pt.length, en.length);
    if (!totalMudancas || totalMudancas <= limite) return [src];

    var totalPartes = Math.ceil(totalMudancas / limite);
    var partes = [];
    for (var i = 0; i < totalPartes; i += 1) {
      var parteIndex = i + 1;
      var partePt = pt.slice(i * limite, (i + 1) * limite);
      var parteEn = en.slice(i * limite, (i + 1) * limite);
      var titlePtBase = getPatchEntryText(src.title, 'pt-BR', 'Atualizacao');
      var titleEnBase = getPatchEntryText(src.title, 'en-US', 'Update');

      partes.push({
        id: String(src.id || ('pn_auto_split_' + Date.now())) + '_part_' + parteIndex,
        version: String(src.version || 'v') + ' [' + parteIndex + '/' + totalPartes + ']',
        releasedAt: String(src.releasedAt || new Date().toISOString()),
        title: {
          'pt-BR': titlePtBase + ' (parte ' + parteIndex + '/' + totalPartes + ')',
          'en-US': titleEnBase + ' (part ' + parteIndex + '/' + totalPartes + ')'
        },
        changes: {
          'pt-BR': partePt.length ? partePt : (parteEn.length ? parteEn.slice() : pt.slice()),
          'en-US': parteEn.length ? parteEn : (partePt.length ? partePt.slice() : en.slice())
        }
      });
    }

    return partes;
  }

  function formatPatchDateTime(input) {
    var date = new Date(input);
    if (Number.isNaN(date.getTime())) return String(input || '-');
    try {
      return date.toLocaleString(getLanguage(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  function gerarPatchNoteId() {
    return 'pn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizarPatchNoteEntry(entry, index) {
    if (!entry || typeof entry !== 'object') return null;

    var version = String(entry.version || '').trim();
    var releasedAtRaw = String(entry.releasedAt || '').trim();
    var releasedAtDate = new Date(releasedAtRaw || Date.now());
    var releasedAt = Number.isNaN(releasedAtDate.getTime())
      ? new Date().toISOString()
      : releasedAtDate.toISOString();

    var titleObj = entry.title && typeof entry.title === 'object' ? entry.title : {};
    var changesObj = entry.changes && typeof entry.changes === 'object' ? entry.changes : {};

    var titlePt = String(titleObj['pt-BR'] || titleObj['pt_BR'] || titleObj.pt || '').trim();
    var titleEn = String(titleObj['en-US'] || titleObj['en_US'] || titleObj.en || '').trim();

    var changesPtRaw = Array.isArray(changesObj['pt-BR']) ? changesObj['pt-BR']
      : (Array.isArray(changesObj.pt) ? changesObj.pt : []);
    var changesEnRaw = Array.isArray(changesObj['en-US']) ? changesObj['en-US']
      : (Array.isArray(changesObj.en) ? changesObj.en : []);

    var changesPt = changesPtRaw.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    var changesEn = changesEnRaw.map(function (x) { return String(x || '').trim(); }).filter(Boolean);

    if (!version) version = 'v' + (index + 1);
    if (!titlePt && !titleEn) return null;

    return {
      id: String(entry.id || gerarPatchNoteId()),
      version: version,
      releasedAt: releasedAt,
      title: {
        'pt-BR': titlePt || titleEn || t('menu.patchNotes.entryTitleFallback', 'Atualizacao'),
        'en-US': titleEn || titlePt || t('menu.patchNotes.entryTitleFallback', 'Update')
      },
      changes: {
        'pt-BR': changesPt,
        'en-US': changesEn.length ? changesEn : changesPt
      }
    };
  }

  function normalizarPatchNotesLista(lista, fallback) {
    var origem = Array.isArray(lista) ? lista : (Array.isArray(fallback) ? fallback : []);
    var normalizada = [];
    for (var i = 0; i < origem.length; i += 1) {
      var item = normalizarPatchNoteEntry(origem[i], i);
      if (item) normalizada.push(item);
    }
    return normalizada;
  }

  function normalizarVersaoPatchPorSw(swVersion) {
    var raw = String(swVersion || '').trim();
    if (!raw) return '';
    var match = raw.match(/finances-pwa-v(\d{4})-(\d{2})-(\d{2})-(\d+)/i);
    if (match) {
      return match[1] + '.' + match[2] + '.' + match[3] + '-' + match[4];
    }
    return raw;
  }

  function normalizarAssetPathPatchNote(pathValue) {
    var raw = String(pathValue || '').trim();
    if (!raw) return '';
    var semHash = raw.split('#')[0];
    var semQuery = semHash.split('?')[0];
    return semQuery.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '/');
  }

  function obterChangedAssetsUltimaAtualizacaoPwa() {
    var parsed = safeGetJsonLocal(PWA_LAST_UPDATE_CHANGED_ASSETS_KEY, []);
    if (!Array.isArray(parsed)) return [];
    var vistos = new Set();
    var list = [];
    for (var i = 0; i < parsed.length; i += 1) {
      var p = normalizarAssetPathPatchNote(parsed[i]);
      if (!p || vistos.has(p)) continue;
      vistos.add(p);
      list.push(p);
    }
    return list;
  }

  function listarAreasAfetadasPorAssets(changedAssets) {
    var assets = Array.isArray(changedAssets) ? changedAssets : [];
    var areas = new Set();

    for (var i = 0; i < assets.length; i += 1) {
      var p = String(assets[i] || '');
      if (!p) continue;
      if (p === '/' || p === '/index.html' || p === '/script.js') areas.add('Painel financeiro (index)');
      if (p === '/economias.html' || p === '/script.js') areas.add('Economias / Extrato');
      if (p === '/despesas.html' || p === '/despesas.js') areas.add('Despesas');
      if (p === '/comercio.html' || p === '/comercio.js') areas.add('Modo Comercio');
      if (p === '/menu.html' || p === '/menu.js') areas.add('Painel de Controle / Patch notes');
      if (p === '/dev-tools.html' || p === '/dev-tools.js') areas.add('Dev Tools');
      if (p === '/resumo-ano.html' || p === '/resumo-ano.js') areas.add('Resumo anual');
      if (p === '/resumo-economias.html' || p === '/resumo-economias.js') areas.add('Resumo economias');
      if (p === '/login.html' || p === '/login.js' || p === '/auth.js') areas.add('Login / Usuarios');
      if (p === '/common.js') areas.add('Funcoes compartilhadas');
      if (p === '/style.css') areas.add('Estilo global');
      if (p === '/i18n.js' || p === '/i18n-extra.js') areas.add('Idiomas (i18n)');
      if (p === '/service-worker.js' || p === '/manifest.webmanifest' || p === '/pwa-register.js') areas.add('PWA / Instalacao / Atualizacao');
    }

    return Array.from(areas);
  }

  function formatarListaArquivosMudadosPt(changedAssets) {
    var assets = Array.isArray(changedAssets) ? changedAssets : [];
    if (!assets.length) return '';
    var nomes = assets.map(function (p) { return String(p || '').replace(/^\//, ''); });
    var limite = 8;
    var visiveis = nomes.slice(0, limite);
    var restante = Math.max(0, nomes.length - visiveis.length);
    return visiveis.join(', ') + (restante > 0 ? (' +' + restante + ' arquivo(s)') : '');
  }

  function formatarListaArquivosMudadosEn(changedAssets) {
    var assets = Array.isArray(changedAssets) ? changedAssets : [];
    if (!assets.length) return '';
    var nomes = assets.map(function (p) { return String(p || '').replace(/^\//, ''); });
    var limite = 8;
    var visiveis = nomes.slice(0, limite);
    var restante = Math.max(0, nomes.length - visiveis.length);
    return visiveis.join(', ') + (restante > 0 ? (' +' + restante + ' file(s)') : '');
  }

  function montarPatchNoteAutomaticoPwa() {
    var swVersion = String(safeGetItemLocal(PWA_LAST_ACTIVATED_SW_VERSION_KEY, '') || '').trim();
    var frontendInfo = obterFrontendPwaVersionInfoAtual();
    var swVersionFallback = frontendInfo ? String(frontendInfo.swVersion || '').trim() : '';
    if (!swVersion && swVersionFallback) swVersion = swVersionFallback;
    if (!swVersion) return null;

    var version = normalizarVersaoPatchPorSw(swVersion);
    if (!version) return null;

    var releasedAt = String(safeGetItemLocal(PWA_LAST_ACTIVATED_SW_AT_KEY, '') || '').trim();
    if (!releasedAt && frontendInfo) releasedAt = String(frontendInfo.releasedAt || '').trim();
    if (!releasedAt) releasedAt = new Date().toISOString();

    var swVersionAnterior = String(safeGetItemLocal(PWA_PREV_ACTIVATED_SW_VERSION_KEY, '') || '').trim();
    if (!swVersionAnterior && frontendInfo) swVersionAnterior = String(frontendInfo.previousSwVersion || '').trim();
    var versaoAnterior = normalizarVersaoPatchPorSw(swVersionAnterior);
    var houveTrocaVersao = versaoAnterior && versaoAnterior !== version;
    var changedAssets = obterChangedAssetsUltimaAtualizacaoPwa();
    if (!changedAssets.length && frontendInfo && Array.isArray(frontendInfo.changedAssets)) {
      changedAssets = frontendInfo.changedAssets.slice();
    }
    var areasAfetadas = listarAreasAfetadasPorAssets(changedAssets);
    var arquivosResumoPt = formatarListaArquivosMudadosPt(changedAssets);
    var arquivosResumoEn = formatarListaArquivosMudadosEn(changedAssets);
    var temAtivacaoRegistrada = Boolean(String(safeGetItemLocal(PWA_LAST_ACTIVATED_SW_VERSION_KEY, '') || '').trim());

    var mudancasPt = [
      (temAtivacaoRegistrada
        ? 'Atualizacao automatica detectada pelo PWA para a versao ' + version + '.'
        : 'Versao atual do frontend/PWA detectada automaticamente pelo menu (' + version + ').'),
      houveTrocaVersao
        ? ('Service Worker e cache local foram renovados de ' + versaoAnterior + ' para ' + version + '.')
        : (temAtivacaoRegistrada
          ? 'Service Worker e cache local foram renovados para carregar os arquivos mais recentes.'
          : 'Service Worker ativo identificado por leitura de versao do arquivo service-worker.js.'),
      (arquivosResumoPt
        ? ('Arquivos atualizados: ' + arquivosResumoPt + '.')
        : 'Arquivos atualizados detectados automaticamente pelo PWA.'),
      (areasAfetadas.length
        ? ('Areas afetadas: ' + areasAfetadas.join(', ') + '.')
        : 'Areas afetadas: interface geral / PWA.')
    ];

    var mudancasEn = [
      (temAtivacaoRegistrada
        ? 'Automatic PWA update detected for version ' + version + '.'
        : 'Current frontend/PWA version automatically detected by the menu (' + version + ').'),
      houveTrocaVersao
        ? ('Service Worker and local cache were refreshed from ' + versaoAnterior + ' to ' + version + '.')
        : (temAtivacaoRegistrada
          ? 'Service Worker and local cache were refreshed to load the latest files.'
          : 'Active Service Worker version detected by reading service-worker.js.'),
      (arquivosResumoEn
        ? ('Updated files: ' + arquivosResumoEn + '.')
        : 'Updated files were automatically detected by the PWA.'),
      (areasAfetadas.length
        ? ('Affected areas: ' + areasAfetadas.join(', ') + '.')
        : 'Affected areas: general UI / PWA.')
    ];

    return {
      id: 'pn_auto_sw_' + version.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase(),
      version: version,
      releasedAt: releasedAt,
      title: {
        'pt-BR': 'Atualizacao automatica do aplicativo',
        'en-US': 'Automatic app update'
      },
      changes: {
        'pt-BR': mudancasPt,
        'en-US': mudancasEn
      }
    };
  }

  function montarPatchNoteAutomaticoBackend() {
    var info = obterBackendVersionInfoAtual();
    if (!info) return null;

    var versionRaw = String(info.version || '').trim();
    if (!versionRaw) return null;

    var versionLabel = 'backend ' + versionRaw;
    var releasedAt = String(info.releasedAt || '').trim() || new Date().toISOString();
    var files = Array.isArray(info.changedFiles) ? info.changedFiles : [];
    var areas = Array.isArray(info.affectedAreas) ? info.affectedAreas : [];
    var changesPtBase = Array.isArray(info.changes && info.changes['pt-BR']) ? info.changes['pt-BR'] : [];
    var changesEnBase = Array.isArray(info.changes && info.changes['en-US']) ? info.changes['en-US'] : [];
    var filesPt = files.length ? ('Arquivos backend atualizados: ' + files.join(', ') + '.') : '';
    var filesEn = files.length ? ('Updated backend files: ' + files.join(', ') + '.') : '';
    var areasPt = areas.length ? ('Areas afetadas no servidor: ' + areas.join(', ') + '.') : '';
    var areasEn = areas.length ? ('Affected server areas: ' + areas.join(', ') + '.') : '';
    var fingerprintPt = info.fingerprint ? ('Fingerprint do backend: ' + info.fingerprint + '.') : '';
    var fingerprintEn = info.fingerprint ? ('Backend fingerprint: ' + info.fingerprint + '.') : '';

    var mudancasPt = []
      .concat(changesPtBase.length ? changesPtBase : [
        'Atualizacao automatica do backend detectada pelo menu do aplicativo.',
        'Versao do servidor atualizada para ' + versionRaw + '.'
      ])
      .concat(filesPt ? [filesPt] : [])
      .concat(areasPt ? [areasPt] : [])
      .concat(fingerprintPt ? [fingerprintPt] : []);

    var mudancasEn = []
      .concat(changesEnBase.length ? changesEnBase : [
        'Automatic backend update detected by the app menu.',
        'Server version updated to ' + versionRaw + '.'
      ])
      .concat(filesEn ? [filesEn] : [])
      .concat(areasEn ? [areasEn] : [])
      .concat(fingerprintEn ? [fingerprintEn] : []);

    return {
      id: 'pn_auto_backend_' + versionRaw.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase(),
      version: versionLabel,
      releasedAt: releasedAt,
      title: {
        'pt-BR': String(info.title && info.title['pt-BR'] || '').trim() || 'Atualizacao automatica do servidor',
        'en-US': String(info.title && info.title['en-US'] || '').trim() || 'Automatic server update'
      },
      changes: {
        'pt-BR': mudancasPt,
        'en-US': mudancasEn.length ? mudancasEn : mudancasPt
      }
    };
  }

  function obterPatchNotesDefaultsComAutoSources() {
    var base = Array.isArray(PATCH_NOTES) ? cloneJson(PATCH_NOTES) || PATCH_NOTES.slice() : [];
    var autoPwaEntry = montarPatchNoteAutomaticoPwa();
    var autoBackendEntry = montarPatchNoteAutomaticoBackend();
    var autos = [];
    if (autoBackendEntry) autos = autos.concat(dividirPatchNoteEmPartes(autoBackendEntry, 4));
    if (autoPwaEntry) autos = autos.concat(dividirPatchNoteEmPartes(autoPwaEntry, 4));
    if (autos.length) base = autos.concat(base);
    return normalizarPatchNotesLista(base, PATCH_NOTES);
  }

  function getPatchNoteMergeKey(entry) {
    if (!entry || typeof entry !== 'object') return '';
    var version = String(entry.version || '').trim().toLowerCase();
    if (version) return 'v:' + version;

    var releasedAt = String(entry.releasedAt || '').trim();
    var titlePt = String(entry.title && entry.title['pt-BR'] || '').trim().toLowerCase();
    if (releasedAt || titlePt) return 'rt:' + releasedAt + '::' + titlePt;
    return '';
  }

  function mesclarPatchNotesComDefaults(salvos, defaults) {
    var listaSalva = Array.isArray(salvos) ? salvos.slice() : [];
    var listaDefault = Array.isArray(defaults) ? defaults : [];
    if (!listaDefault.length) return listaSalva;

    var porChave = new Map();
    for (var i = 0; i < listaSalva.length; i += 1) {
      var itemSalvo = listaSalva[i];
      var chaveSalva = getPatchNoteMergeKey(itemSalvo);
      if (chaveSalva && !porChave.has(chaveSalva)) {
        porChave.set(chaveSalva, i);
      }
    }

    for (var j = 0; j < listaDefault.length; j += 1) {
      var itemDefault = listaDefault[j];
      var chaveDefault = getPatchNoteMergeKey(itemDefault);
      if (!chaveDefault) {
        listaSalva.push(itemDefault);
        continue;
      }

      if (!porChave.has(chaveDefault)) {
        porChave.set(chaveDefault, listaSalva.length);
        listaSalva.push(itemDefault);
        continue;
      }

      // Enriquecer entrada existente com campos ausentes sem sobrescrever customizacao manual.
      var idxExistente = porChave.get(chaveDefault);
      var existente = listaSalva[idxExistente];
      if (!existente || typeof existente !== 'object') continue;

      if (!existente.title || typeof existente.title !== 'object') existente.title = {};
      if (!existente.changes || typeof existente.changes !== 'object') existente.changes = {};

      if (!String(existente.title['pt-BR'] || '').trim() && String(itemDefault.title && itemDefault.title['pt-BR'] || '').trim()) {
        existente.title['pt-BR'] = itemDefault.title['pt-BR'];
      }
      if (!String(existente.title['en-US'] || '').trim() && String(itemDefault.title && itemDefault.title['en-US'] || '').trim()) {
        existente.title['en-US'] = itemDefault.title['en-US'];
      }

      var changesPtExist = Array.isArray(existente.changes['pt-BR']) ? existente.changes['pt-BR'] : [];
      var changesEnExist = Array.isArray(existente.changes['en-US']) ? existente.changes['en-US'] : [];
      var changesPtDef = Array.isArray(itemDefault.changes && itemDefault.changes['pt-BR']) ? itemDefault.changes['pt-BR'] : [];
      var changesEnDef = Array.isArray(itemDefault.changes && itemDefault.changes['en-US']) ? itemDefault.changes['en-US'] : [];

      if (!changesPtExist.length && changesPtDef.length) existente.changes['pt-BR'] = changesPtDef.slice();
      if (!changesEnExist.length && changesEnDef.length) existente.changes['en-US'] = changesEnDef.slice();

      if (!String(existente.releasedAt || '').trim() && String(itemDefault.releasedAt || '').trim()) {
        existente.releasedAt = itemDefault.releasedAt;
      }
    }

    return listaSalva;
  }

  function carregarPatchNotesPersistidos() {
    var defaults = obterPatchNotesDefaultsComAutoSources();
    var salvos = safeGetJsonLocal(PATCH_NOTES_STORAGE_KEY, null);
    if (!Array.isArray(salvos)) {
      patchNotesState = defaults;
      safeSetJsonLocal(PATCH_NOTES_STORAGE_KEY, patchNotesState);
      return patchNotesState;
    }

    patchNotesState = mesclarPatchNotesComDefaults(
      normalizarPatchNotesLista(salvos, defaults),
      defaults
    );
    safeSetJsonLocal(PATCH_NOTES_STORAGE_KEY, patchNotesState);
    return patchNotesState;
  }

  function obterPatchNotesState() {
    if (!Array.isArray(patchNotesState)) {
      return carregarPatchNotesPersistidos();
    }
    var defaults = obterPatchNotesDefaultsComAutoSources();
    patchNotesState = mesclarPatchNotesComDefaults(
      normalizarPatchNotesLista(patchNotesState, defaults),
      defaults
    );
    return patchNotesState;
  }

  function salvarPatchNotesPersistidos() {
    if (!Array.isArray(patchNotesState)) patchNotesState = [];
    var defaults = obterPatchNotesDefaultsComAutoSources();
    patchNotesState = mesclarPatchNotesComDefaults(
      normalizarPatchNotesLista(patchNotesState, defaults),
      defaults
    );
    safeSetJsonLocal(PATCH_NOTES_STORAGE_KEY, patchNotesState);
    return patchNotesState;
  }

  function obterUsuarioAtual() {
    try {
      return global.FinAuth && typeof global.FinAuth.obterUsuarioAtualAutenticacao === 'function'
        ? global.FinAuth.obterUsuarioAtualAutenticacao()
        : null;
    } catch (_) {
      return null;
    }
  }

  function usuarioPodeGerenciarPatchNotes(usuario) {
    return Boolean(usuario && usuario.developer);
  }

  function buildGroups() {
    var currentUser = obterUsuarioAtual();
    var canSeeDevTools = usuarioPodeGerenciarPatchNotes(currentUser);
    return [
      {
        key: 'operacao',
        tone: 'operacao',
        icon: 'fa-coins',
        titulo: t('menu.groups.operacao.title', 'Operacao financeira'),
        descricao: t('menu.groups.operacao.description', 'Fluxo diario de clientes, entradas, saidas e caixa.'),
        paginas: [
          {
            titulo: t('menu.pages.dashboard.title', 'Painel financeiro'),
            descricao: t('menu.pages.dashboard.description', 'Tela principal com clientes, pagamentos e acoes rapidas.'),
            icon: 'fa-chart-line',
            href: 'index.html',
            tags: [t('menu.tags.principal', 'Principal'), t('menu.tags.protegida', 'Protegida')]
          },
          {
            titulo: t('menu.pages.economias.title', 'Economias'),
            descricao: t('menu.pages.economias.description', 'Carteira, extrato, poupanca e controle de saldo.'),
            icon: 'fa-piggy-bank',
            href: 'economias.html',
            tags: [t('menu.tags.carteira', 'Carteira'), t('menu.tags.protegida', 'Protegida')]
          },
          {
            titulo: t('menu.pages.despesas.title', 'Despesas'),
            descricao: t('menu.pages.despesas.description', 'Lancamentos de gastos e controle mensal de despesas.'),
            icon: 'fa-file-invoice-dollar',
            href: 'despesas.html',
            tags: [t('menu.tags.mensal', 'Mensal'), t('menu.tags.protegida', 'Protegida')]
          },
          {
            titulo: t('menu.pages.comercio.title', 'Modo comercio'),
            descricao: t('menu.pages.comercio.description', 'Comanda, vendas do dia, catalogo e extrato consolidado.'),
            icon: 'fa-cash-register',
            href: 'comercio.html',
            tags: [t('menu.tags.vendas', 'Vendas'), t('menu.tags.protegida', 'Protegida')]
          }
        ]
      },
      {
        key: 'relatorios',
        tone: 'relatorios',
        icon: 'fa-chart-column',
        titulo: t('menu.groups.relatorios.title', 'Relatorios e analises'),
        descricao: t('menu.groups.relatorios.description', 'Visoes consolidadas anuais e comparativos por periodo.'),
        paginas: [
          {
            titulo: t('menu.pages.resumoAno.title', 'Resumo anual'),
            descricao: t('menu.pages.resumoAno.description', 'Resumo executivo anual com graficos e totais consolidados.'),
            icon: 'fa-chart-pie',
            href: 'resumo-ano.html',
            tags: [t('menu.tags.executivo', 'Executivo'), t('menu.tags.protegida', 'Protegida')]
          },
          {
            titulo: t('menu.pages.resumoEconomias.title', 'Resumo economias'),
            descricao: t('menu.pages.resumoEconomias.description', 'Evolucao de carteira e poupanca com analise por meses.'),
            icon: 'fa-chart-area',
            href: 'resumo-economias.html',
            tags: [t('menu.tags.evolucao', 'Evolucao'), t('menu.tags.protegida', 'Protegida')]
          }
        ]
      },
      {
        key: 'acesso',
        tone: 'acesso',
        icon: 'fa-user-lock',
        titulo: t('menu.groups.acesso.title', 'Acesso e conta'),
        descricao: t('menu.groups.acesso.description', 'Paginas de autenticacao e entrada no sistema.'),
        paginas: [
          {
            titulo: t('menu.pages.login.title', 'Login'),
            descricao: t('menu.pages.login.description', 'Tela de acesso ao sistema com usuario e senha.'),
            icon: 'fa-right-to-bracket',
            href: 'login.html',
            tags: [t('menu.tags.publica', 'Publica'), t('menu.tags.autenticacao', 'Autenticacao')]
          }
        ]
      },
      {
        key: 'sistema',
        tone: 'sistema',
        icon: 'fa-screwdriver-wrench',
        titulo: t('menu.groups.sistema.title', 'Sistema e suporte'),
        descricao: t('menu.groups.sistema.description', 'Paginas auxiliares do PWA e fallback do aplicativo.'),
        paginas: [
          {
            titulo: t('menu.patchNotes.button', 'Patch notes'),
            descricao: t('menu.patchNotes.subtitle', 'Confira data e hora de lancamento de cada versao e o que foi alterado.'),
            icon: 'fa-clipboard-list',
            href: 'menu.html?patchnotes=1',
            tags: [t('menu.tags.interna', 'Interna'), t('menu.tags.pwa', 'PWA')]
          },
          {
            titulo: t('menu.pages.offline.title', 'Offline (fallback PWA)'),
            descricao: t('menu.pages.offline.description', 'Pagina exibida quando o app esta sem internet.'),
            icon: 'fa-wifi-slash',
            href: 'offline.html',
            tags: [t('menu.tags.interna', 'Interna'), t('menu.tags.pwa', 'PWA')]
          }
        ].concat(canSeeDevTools ? [{
          titulo: t('menu.pages.devTools.title', 'Dev Tools'),
          descricao: t('menu.pages.devTools.description', 'Ferramentas internas para diagnostico, simulacao e manutencao do app.'),
          icon: 'fa-user-gear',
          href: 'dev-tools.html',
          tags: [t('menu.tags.interna', 'Interna'), t('menu.tags.dev', 'DEV')]
        }] : [])
      }
    ];
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveHref(pagina) {
    if (!pagina) return '#';
    if (typeof pagina.hrefBuilder === 'function') {
      try { return String(pagina.hrefBuilder() || '#'); } catch (_) { return '#'; }
    }
    return String(pagina.href || '#');
  }

  function normalizeHrefKey(href) {
    var raw = String(href || '').trim();
    if (!raw || raw === '#') return '';
    var semHash = raw.split('#')[0];
    var semQuery = semHash.split('?')[0];
    return semQuery.replace(/^\.?\//, '').toLowerCase();
  }

  function collectPinnedHrefKeys() {
    var set = new Set();
    var links = doc.querySelectorAll('.menu-app-destaques a[href]');
    for (var i = 0; i < links.length; i += 1) {
      var key = normalizeHrefKey(links[i].getAttribute('href'));
      if (key) set.add(key);
    }
    return set;
  }

  function dedupeGroups(groups) {
    var pinned = collectPinnedHrefKeys();
    var seen = new Set();
    var list = Array.isArray(groups) ? groups : [];

    return list.map(function (grupo) {
      var paginas = Array.isArray(grupo && grupo.paginas) ? grupo.paginas : [];
      var permitirDuplicadoComDestaque = grupo && grupo.key === 'operacao';
      var filtradas = paginas.filter(function (pagina) {
        var href = resolveHref(pagina);
        var key = normalizeHrefKey(href);
        if (!key) return true;
        if (!permitirDuplicadoComDestaque && pinned.has(key)) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return Object.assign({}, grupo, { paginas: filtradas });
    }).filter(function (grupo) {
      return Array.isArray(grupo.paginas) && grupo.paginas.length > 0;
    });
  }

  function renderTags(tags) {
    var lista = Array.isArray(tags) ? tags : [];
    if (!lista.length) return '';
    return '<div class="menu-app-card-tags">' + lista.map(function (tag) {
      return '<span class="menu-app-tag">' + escapeHtml(tag) + '</span>';
    }).join('') + '</div>';
  }

  function renderCard(pagina) {
    var href = resolveHref(pagina);
    return [
      '<a class="menu-app-card" href="', escapeHtml(href), '">',
      '  <span class="menu-app-card-icon" aria-hidden="true"><i class="fa-solid ', escapeHtml(pagina.icon || 'fa-file'), '"></i></span>',
      '  <div class="menu-app-card-body">',
      '    <strong>', escapeHtml(pagina.titulo || t('common.home', 'Pagina')), '</strong>',
      '    <p>', escapeHtml(pagina.descricao || ''), '</p>',
           renderTags(pagina.tags),
      '  </div>',
      '  <span class="menu-app-card-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>',
      '</a>'
    ].join('');
  }

  function renderGroup(grupo) {
    var paginas = Array.isArray(grupo && grupo.paginas) ? grupo.paginas : [];
    return [
      '<article class="menu-app-group menu-app-group--', escapeHtml(grupo.tone || 'padrao'), '">',
      '  <header class="menu-app-group-header">',
      '    <span class="menu-app-group-icon" aria-hidden="true"><i class="fa-solid ', escapeHtml(grupo.icon || 'fa-layer-group'), '"></i></span>',
      '    <div class="menu-app-group-textos">',
      '      <h2>', escapeHtml(grupo.titulo || 'Grupo'), '</h2>',
      '      <p>', escapeHtml(grupo.descricao || ''), '</p>',
      '    </div>',
      '  </header>',
      '  <div class="menu-app-group-links">',
           paginas.map(renderCard).join(''),
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderGroups() {
    var host = doc.getElementById('menu-app-groups');
    if (!host) return;
    host.innerHTML = dedupeGroups(buildGroups()).map(renderGroup).join('');
  }

  function atualizarUsuarioAtual() {
    var nomeEl = doc.getElementById('menu-app-usuario-nome');
    var papelEl = doc.getElementById('menu-app-usuario-papel');
    if (!nomeEl || !papelEl) return;

    var atual = obterUsuarioAtual();

    if (!atual) {
      nomeEl.textContent = t('menu.waitingAuth', 'Aguardando autenticacao');
      papelEl.textContent = t('menu.protectedSession', 'Sessao protegida');
      return;
    }

    nomeEl.textContent = String(atual.nome || atual.username || t('menu.userGeneric', 'Usuario'));
    papelEl.textContent = atual.owner
      ? t('menu.owner', 'Proprietario')
      : (atual.developer
        ? t('menu.developer', 'Desenvolvedor')
        : t('menu.authenticatedUser', 'Usuario autenticado'));

    if (doc.getElementById(PATCH_MODAL_ID)) {
      renderPatchNotesModal();
    }
  }

  function getPatchNotesEntriesSorted() {
    return obterPatchNotesState().slice().sort(function (a, b) {
      var ta = Date.parse(a && a.releasedAt);
      var tb = Date.parse(b && b.releasedAt);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
  }

  function getUltimaVersaoPatchNotes() {
    var entries = getPatchNotesEntriesSorted();
    if (!entries.length) return '';
    return String(entries[0] && entries[0].version || '').trim();
  }

  function marcarUltimaVersaoPatchNotesComoVista() {
    var version = getUltimaVersaoPatchNotes();
    if (!version) return;
    safeSetItemLocal(PATCH_NOTES_LAST_SEEN_VERSION_KEY, version);
    var backendVersion = obterVersaoBackendAtual();
    if (backendVersion) {
      safeSetItemLocal(PATCH_NOTES_LAST_SEEN_BACKEND_VERSION_KEY, backendVersion);
    }
    var frontendPwaVersion = obterVersaoFrontendPwaAtual();
    if (frontendPwaVersion) {
      safeSetItemLocal(PATCH_NOTES_LAST_SEEN_FRONTEND_PWA_VERSION_KEY, frontendPwaVersion);
    }
  }

  function shouldAutoOpenPatchNotesByBackendVersion() {
    var backendVersion = obterVersaoBackendAtual();
    if (!backendVersion) return false;
    var seenBackendVersion = String(safeGetItemLocal(PATCH_NOTES_LAST_SEEN_BACKEND_VERSION_KEY, '') || '').trim();
    return backendVersion !== seenBackendVersion;
  }

  function shouldAutoOpenPatchNotesByFrontendPwaVersion() {
    var frontendPwaVersion = obterVersaoFrontendPwaAtual();
    if (!frontendPwaVersion) return false;
    var seenFrontendVersion = String(safeGetItemLocal(PATCH_NOTES_LAST_SEEN_FRONTEND_PWA_VERSION_KEY, '') || '').trim();
    return frontendPwaVersion !== seenFrontendVersion;
  }

  function shouldAutoOpenPatchNotesByVersion() {
    var latestVersion = getUltimaVersaoPatchNotes();
    if (!latestVersion) {
      return shouldAutoOpenPatchNotesByBackendVersion() || shouldAutoOpenPatchNotesByFrontendPwaVersion();
    }
    var seenVersion = String(safeGetItemLocal(PATCH_NOTES_LAST_SEEN_VERSION_KEY, '') || '').trim();
    return seenVersion !== latestVersion
      || shouldAutoOpenPatchNotesByBackendVersion()
      || shouldAutoOpenPatchNotesByFrontendPwaVersion();
  }

  function removerFerramentasDevPatchNotesDoDom() {
    var adminEl = doc.getElementById('menu-app-patchnotes-admin');
    if (adminEl && adminEl.parentNode) {
      adminEl.parentNode.removeChild(adminEl);
    }
  }

  function renderPatchNotesModal() {
    var listEl = doc.getElementById('menu-app-patchnotes-list');
    var emptyEl = doc.getElementById('menu-app-patchnotes-empty');
    var closeBtn = doc.getElementById('menu-app-patchnotes-close');
    var adminEl = doc.getElementById('menu-app-patchnotes-admin');
    var formEl = doc.getElementById('menu-app-patchnotes-form');
    if (!listEl || !emptyEl) return;

    if (closeBtn) closeBtn.title = t('menu.patchNotes.close', 'Fechar patch notes');
    var atual = obterUsuarioAtual();
    var canManage = usuarioPodeGerenciarPatchNotes(atual);
    if (!canManage) {
      removerFerramentasDevPatchNotesDoDom();
      adminEl = null;
      formEl = null;
    } else {
      if (adminEl) adminEl.hidden = false;
    }

    var lang = getLanguage();
    var entries = getPatchNotesEntriesSorted();
    if (!entries.length) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    listEl.innerHTML = entries.map(function (entry, index) {
      var titulo = getPatchEntryText(entry && entry.title, lang, t('menu.patchNotes.entryTitleFallback', 'Atualizacao'));
      var changes = getPatchEntryList(entry && entry.changes, lang);
      var version = String((entry && entry.version) || '-');
      var releasedAt = formatPatchDateTime(entry && entry.releasedAt);
      var latestBadge = index === 0
        ? '<span class="menu-app-patchnotes-badge is-latest">' + escapeHtml(t('menu.patchNotes.latestBadge', 'Mais recente')) + '</span>'
        : '';
      var changesLabel = escapeHtml(t('menu.patchNotes.changesLabel', 'O que mudou'));
      var releaseLabel = escapeHtml(t('menu.patchNotes.releasedAt', 'Lancado em {data}', { data: releasedAt }));
      var versionLabel = escapeHtml(t('menu.patchNotes.versionLabel', 'Versao {versao}', { versao: version }));
      var actionsHtml = canManage
        ? [
            '<div class="menu-app-patchnotes-item-acoes">',
            '  <button type="button" class="menu-app-patchnotes-item-btn" data-patchnote-action="edit" data-patchnote-id="', escapeHtml(String(entry && entry.id || '')), '">',
            '    <i class="fa-solid fa-pen" aria-hidden="true"></i><span>', escapeHtml(t('menu.patchNotes.edit', 'Editar')), '</span>',
            '  </button>',
            '  <button type="button" class="menu-app-patchnotes-item-btn is-danger" data-patchnote-action="delete" data-patchnote-id="', escapeHtml(String(entry && entry.id || '')), '">',
            '    <i class="fa-solid fa-trash" aria-hidden="true"></i><span>', escapeHtml(t('menu.patchNotes.delete', 'Excluir')), '</span>',
            '  </button>',
            '</div>'
          ].join('')
        : '';

      return [
        '<article class="menu-app-patchnotes-item">',
        '  <div class="menu-app-patchnotes-item-head">',
        '    <div class="menu-app-patchnotes-item-titulos">',
        '      <h3>', escapeHtml(titulo), '</h3>',
        '      <div class="menu-app-patchnotes-meta">',
        '        <span class="menu-app-patchnotes-badge">', versionLabel, '</span>',
                 latestBadge,
        '        <time datetime="', escapeHtml(String(entry && entry.releasedAt || '')), '">', releaseLabel, '</time>',
        '      </div>',
        '    </div>',
             actionsHtml,
        '  </div>',
        '  <div class="menu-app-patchnotes-body">',
        '    <strong class="menu-app-patchnotes-section-title">', changesLabel, '</strong>',
        changes.length
          ? ('<ul class="menu-app-patchnotes-changes">' + changes.map(function (linha) {
              return '<li>' + escapeHtml(String(linha || '')) + '</li>';
            }).join('') + '</ul>')
          : ('<p class="menu-app-patchnotes-empty-inline">' + escapeHtml(t('menu.patchNotes.noDetails', 'Sem detalhes nesta versao.')) + '</p>'),
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function getPatchNotesFormControls() {
    return {
      form: doc.getElementById('menu-app-patchnotes-form'),
      id: doc.getElementById('menu-app-patchnotes-form-id'),
      version: doc.getElementById('menu-app-patchnotes-version'),
      datetime: doc.getElementById('menu-app-patchnotes-datetime'),
      titlePt: doc.getElementById('menu-app-patchnotes-title-pt'),
      titleEn: doc.getElementById('menu-app-patchnotes-title-en'),
      changesPt: doc.getElementById('menu-app-patchnotes-changes-pt'),
      changesEn: doc.getElementById('menu-app-patchnotes-changes-en'),
      feedback: doc.getElementById('menu-app-patchnotes-form-feedback')
    };
  }

  function setPatchNotesFormFeedback(message, isError) {
    var controls = getPatchNotesFormControls();
    if (!controls.feedback) return;
    controls.feedback.hidden = !message;
    controls.feedback.textContent = message || '';
    controls.feedback.classList.toggle('is-error', Boolean(message) && Boolean(isError));
    controls.feedback.classList.toggle('is-ok', Boolean(message) && !isError);
  }

  function toDateTimeLocalValue(isoValue) {
    var d = new Date(String(isoValue || ''));
    if (Number.isNaN(d.getTime())) d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fecharEditorPatchNotes() {
    var controls = getPatchNotesFormControls();
    if (!controls.form) return;
    controls.form.hidden = true;
    if (controls.form.reset) controls.form.reset();
    if (controls.id) controls.id.value = '';
    if (controls.datetime && !controls.datetime.value) {
      controls.datetime.value = toDateTimeLocalValue(new Date().toISOString());
    }
    setPatchNotesFormFeedback('', false);
  }

  function abrirEditorPatchNotes(entryId) {
    if (!usuarioPodeGerenciarPatchNotes(obterUsuarioAtual())) return;

    var controls = getPatchNotesFormControls();
    if (!controls.form) return;

    var entry = null;
    if (entryId) {
      entry = getPatchNotesEntriesSorted().find(function (x) { return String(x.id) === String(entryId); }) || null;
    }

    controls.form.hidden = false;
    if (controls.id) controls.id.value = entry ? String(entry.id || '') : '';
    if (controls.version) controls.version.value = entry ? String(entry.version || '') : '';
    if (controls.datetime) controls.datetime.value = toDateTimeLocalValue(entry ? entry.releasedAt : new Date().toISOString());
    if (controls.titlePt) controls.titlePt.value = entry ? String((entry.title && entry.title['pt-BR']) || '') : '';
    if (controls.titleEn) controls.titleEn.value = entry ? String((entry.title && entry.title['en-US']) || '') : '';
    if (controls.changesPt) controls.changesPt.value = entry ? ((entry.changes && Array.isArray(entry.changes['pt-BR']) ? entry.changes['pt-BR'] : []).join('\n')) : '';
    if (controls.changesEn) controls.changesEn.value = entry ? ((entry.changes && Array.isArray(entry.changes['en-US']) ? entry.changes['en-US'] : []).join('\n')) : '';
    setPatchNotesFormFeedback('', false);
    if (controls.version && typeof controls.version.focus === 'function') controls.version.focus();
  }

  function parseTextareaLines(text) {
    return String(text || '')
      .split(/\r?\n/g)
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function salvarPatchNotesPorFormulario(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (!usuarioPodeGerenciarPatchNotes(obterUsuarioAtual())) return;

    var c = getPatchNotesFormControls();
    if (!c.form || !c.version || !c.datetime || !c.titlePt || !c.titleEn || !c.changesPt || !c.changesEn) return;

    var version = String(c.version.value || '').trim();
    var dtLocal = String(c.datetime.value || '').trim();
    var titlePt = String(c.titlePt.value || '').trim();
    var titleEn = String(c.titleEn.value || '').trim();
    var changesPt = parseTextareaLines(c.changesPt.value);
    var changesEn = parseTextareaLines(c.changesEn.value);

    if (!version) {
      setPatchNotesFormFeedback(t('menu.patchNotes.validation.versionRequired', 'Informe a versao do patch.'), true);
      c.version.focus();
      return;
    }
    if (!dtLocal) {
      setPatchNotesFormFeedback(t('menu.patchNotes.validation.dateRequired', 'Informe a data e hora do lancamento.'), true);
      c.datetime.focus();
      return;
    }
    if (!titlePt && !titleEn) {
      setPatchNotesFormFeedback(t('menu.patchNotes.validation.titleRequired', 'Informe pelo menos um titulo (PT-BR ou EN-US).'), true);
      c.titlePt.focus();
      return;
    }

    var releasedAt = new Date(dtLocal);
    if (Number.isNaN(releasedAt.getTime())) {
      setPatchNotesFormFeedback(t('menu.patchNotes.validation.invalidDate', 'Data/hora invalida.'), true);
      c.datetime.focus();
      return;
    }

    var lista = obterPatchNotesState().slice();
    var id = String((c.id && c.id.value) || '').trim();
    var entry = normalizarPatchNoteEntry({
      id: id || gerarPatchNoteId(),
      version: version,
      releasedAt: releasedAt.toISOString(),
      title: {
        'pt-BR': titlePt,
        'en-US': titleEn
      },
      changes: {
        'pt-BR': changesPt,
        'en-US': changesEn
      }
    }, 0);

    if (!entry) {
      setPatchNotesFormFeedback(t('menu.patchNotes.validation.invalidEntry', 'Nao foi possivel salvar este patch.'), true);
      return;
    }

    var idx = lista.findIndex(function (x) { return String(x.id) === String(entry.id); });
    if (idx >= 0) lista[idx] = entry;
    else lista.unshift(entry);

    patchNotesState = lista;
    salvarPatchNotesPersistidos();
    renderPatchNotesModal();
    setPatchNotesFormFeedback(t('menu.patchNotes.saved', 'Patch note salvo com sucesso.'), false);
    global.setTimeout(function () { fecharEditorPatchNotes(); }, 700);
  }

  function excluirPatchNote(id) {
    if (!usuarioPodeGerenciarPatchNotes(obterUsuarioAtual())) return;
    var ident = String(id || '').trim();
    if (!ident) return;
    if (!global.confirm(t('menu.patchNotes.deleteConfirm', 'Deseja excluir este patch note?'))) return;

    patchNotesState = obterPatchNotesState().filter(function (item) {
      return String(item.id) !== ident;
    });
    salvarPatchNotesPersistidos();
    renderPatchNotesModal();
    setPatchNotesFormFeedback(t('menu.patchNotes.deleted', 'Patch note removido.'), false);
  }

  function exportarPatchNotesJson() {
    if (!usuarioPodeGerenciarPatchNotes(obterUsuarioAtual())) return;
    var payload = obterPatchNotesState();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'patch-notes-finances.json';
    doc.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    setPatchNotesFormFeedback(t('menu.patchNotes.exportDone', 'Patch notes exportados em JSON.'), false);
  }

  function importarPatchNotesJsonArquivo(file) {
    if (!usuarioPodeGerenciarPatchNotes(obterUsuarioAtual()) || !file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(parsed)) {
          setPatchNotesFormFeedback(t('menu.patchNotes.importInvalid', 'JSON invalido para patch notes.'), true);
          return;
        }
        patchNotesState = normalizarPatchNotesLista(parsed, obterPatchNotesState());
        salvarPatchNotesPersistidos();
        renderPatchNotesModal();
        setPatchNotesFormFeedback(t('menu.patchNotes.importDone', 'Patch notes importados com sucesso.'), false);
      } catch (_) {
        setPatchNotesFormFeedback(t('menu.patchNotes.importReadError', 'Nao foi possivel ler o arquivo JSON.'), true);
      }
    };
    reader.onerror = function () {
      setPatchNotesFormFeedback(t('menu.patchNotes.importReadError', 'Nao foi possivel ler o arquivo JSON.'), true);
    };
    reader.readAsText(file);
  }

  function setPatchNotesModalOpen(open) {
    var modal = doc.getElementById(PATCH_MODAL_ID);
    if (!modal) return;
    var shouldOpen = Boolean(open);

    if (shouldOpen) {
      fecharEditorPatchNotes();
      renderPatchNotesModal();
      marcarUltimaVersaoPatchNotesComoVista();
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      doc.body.classList.add('menu-app-modal-open');
      var closeBtn = doc.getElementById('menu-app-patchnotes-close');
      if (closeBtn && typeof closeBtn.focus === 'function') {
        global.setTimeout(function () { closeBtn.focus(); }, 0);
      }
      return;
    }

    fecharEditorPatchNotes();
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    doc.body.classList.remove('menu-app-modal-open');
  }

  function bindPatchNotesModal() {
    var modal = doc.getElementById(PATCH_MODAL_ID);
    var closeBtn = doc.getElementById('menu-app-patchnotes-close');
    var formEl = doc.getElementById('menu-app-patchnotes-form');
    var newBtn = doc.getElementById('menu-app-patchnotes-btn-new');
    var exportBtn = doc.getElementById('menu-app-patchnotes-btn-export');
    var importBtn = doc.getElementById('menu-app-patchnotes-btn-import');
    var importFile = doc.getElementById('menu-app-patchnotes-import-file');
    var cancelEditBtn = doc.getElementById('menu-app-patchnotes-btn-cancel-edit');
    if (!modal) return;

    if (modal.dataset.boundPatchnotes !== '1') {
      modal.addEventListener('click', function (event) {
        var target = event.target;
        if (target === modal) {
          setPatchNotesModalOpen(false);
          return;
        }
        if (!(target instanceof Element)) return;
        var actionBtn = target.closest('[data-patchnote-action]');
        if (!actionBtn) return;
        var action = String(actionBtn.getAttribute('data-patchnote-action') || '');
        var id = String(actionBtn.getAttribute('data-patchnote-id') || '');
        if (action === 'edit') abrirEditorPatchNotes(id);
        if (action === 'delete') excluirPatchNote(id);
      });
      modal.dataset.boundPatchnotes = '1';
    }

    if (closeBtn && closeBtn.dataset.boundPatchnotes !== '1') {
      closeBtn.addEventListener('click', function () {
        fecharEditorPatchNotes();
        setPatchNotesModalOpen(false);
      });
      closeBtn.dataset.boundPatchnotes = '1';
    }

    if (formEl && formEl.dataset.boundPatchnotes !== '1') {
      formEl.addEventListener('submit', salvarPatchNotesPorFormulario);
      formEl.dataset.boundPatchnotes = '1';
    }

    if (newBtn && newBtn.dataset.boundPatchnotes !== '1') {
      newBtn.addEventListener('click', function () { abrirEditorPatchNotes(''); });
      newBtn.dataset.boundPatchnotes = '1';
    }

    if (exportBtn && exportBtn.dataset.boundPatchnotes !== '1') {
      exportBtn.addEventListener('click', exportarPatchNotesJson);
      exportBtn.dataset.boundPatchnotes = '1';
    }

    if (importBtn && importBtn.dataset.boundPatchnotes !== '1') {
      importBtn.addEventListener('click', function () {
        if (importFile) importFile.click();
      });
      importBtn.dataset.boundPatchnotes = '1';
    }

    if (importFile && importFile.dataset.boundPatchnotes !== '1') {
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (file) importarPatchNotesJsonArquivo(file);
        importFile.value = '';
      });
      importFile.dataset.boundPatchnotes = '1';
    }

    if (cancelEditBtn && cancelEditBtn.dataset.boundPatchnotes !== '1') {
      cancelEditBtn.addEventListener('click', fecharEditorPatchNotes);
      cancelEditBtn.dataset.boundPatchnotes = '1';
    }

    if (!global.__finMenuPatchNotesEscBound) {
      global.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        var controls = getPatchNotesFormControls();
        if (controls.form && controls.form.hidden === false) {
          fecharEditorPatchNotes();
          return;
        }
        setPatchNotesModalOpen(false);
      });
      global.__finMenuPatchNotesEscBound = true;
    }
  }

  function aplicarTemaInicial() {
    try {
      if (global.FinCommon && typeof global.FinCommon.carregarTemaExecutivo === 'function') {
        global.FinCommon.carregarTemaExecutivo();
        return;
      }
      if (typeof global.carregarTemaExecutivo === 'function') {
        global.carregarTemaExecutivo();
      }
    } catch (_) {}
  }

  function alternarTemaMenu() {
    try {
      if (global.FinCommon && typeof global.FinCommon.alternarTemaExecutivo === 'function') {
        global.FinCommon.alternarTemaExecutivo();
        return;
      }
      if (typeof global.alternarTemaExecutivo === 'function') {
        global.alternarTemaExecutivo();
        return;
      }
    } catch (_) {}

    doc.body.classList.toggle('light-mode');
  }

  function sairDaConta() {
    if (typeof global.sairContaUsuario === 'function') {
      global.sairContaUsuario();
      return;
    }
    global.location.href = 'login.html';
  }

  function syncMenuInstallButtonState() {
    var installBtn = doc.getElementById('menu-app-btn-instalar');
    if (!installBtn) return;

    var pwa = global.FinPwa || null;
    var standalone = Boolean(pwa && typeof pwa.isStandaloneMode === 'function' && pwa.isStandaloneMode());
    var available = Boolean(pwa && typeof pwa.isInstallAvailable === 'function' && pwa.isInstallAvailable());

    installBtn.hidden = standalone;
    installBtn.classList.toggle('is-disabled', !available);
    installBtn.setAttribute('aria-disabled', available ? 'false' : 'true');

    var title = available
      ? t('pwa.ui.installButton', 'Instalar app')
      : t('pwa.install.unavailableMessage', 'Abra no Chrome (Android/Desktop) e aguarde o app ficar instalavel para usar este botao.');
    installBtn.setAttribute('title', title);
    installBtn.setAttribute('aria-label', title);
  }

  function solicitarInstalacaoPeloMenu() {
    var pwa = global.FinPwa || null;
    if (pwa && typeof pwa.requestInstall === 'function') {
      pwa.requestInstall();
      return;
    }

    var hiddenInstallBtn = doc.getElementById('fin-pwa-install-btn');
    if (hiddenInstallBtn && typeof hiddenInstallBtn.click === 'function') {
      hiddenInstallBtn.click();
      return;
    }

    try {
      global.alert(t('pwa.install.unavailableMessage', 'Abra no Chrome (Android/Desktop) e aguarde o app ficar instalavel para usar este botao.'));
    } catch (_) {}
  }

  function bindActions() {
    var installBtn = doc.getElementById('menu-app-btn-instalar');
    var temaBtn = doc.getElementById('menu-app-btn-tema');
    var sairBtn = doc.getElementById('menu-app-btn-sair');

    if (installBtn) installBtn.addEventListener('click', solicitarInstalacaoPeloMenu);
    if (temaBtn) temaBtn.addEventListener('click', alternarTemaMenu);
    if (sairBtn) sairBtn.addEventListener('click', sairDaConta);
    bindPatchNotesModal();
    syncMenuInstallButtonState();

    global.setTimeout(atualizarUsuarioAtual, 120);
    global.setTimeout(function () {
      if (global.FinPwa && typeof global.FinPwa.refreshInstallAvailability === 'function') {
        global.FinPwa.refreshInstallAvailability();
      }
      syncMenuInstallButtonState();
    }, 180);

    if (!global.__finMenuI18nBound) {
      global.addEventListener('fin:i18n-change', function () {
        renderGroups();
        atualizarUsuarioAtual();
        renderPatchNotesModal();
        syncMenuInstallButtonState();
      });
      global.addEventListener('fin:pwa-install-availability', function () {
        syncMenuInstallButtonState();
      });
      global.addEventListener('appinstalled', function () {
        syncMenuInstallButtonState();
      });
      global.__finMenuI18nBound = true;
    }
  }

  function shouldAutoOpenPatchNotes() {
    try {
      var params = new URLSearchParams(global.location && global.location.search || '');
      var raw = String(params.get('patchnotes') || '').toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'open';
    } catch (_) {
      return false;
    }
  }

  function cleanupPatchNotesQueryFlag() {
    try {
      if (!global.history || typeof global.history.replaceState !== 'function') return;
      var url = new URL(global.location.href);
      if (!url.searchParams.has('patchnotes')) return;
      url.searchParams.delete('patchnotes');
      global.history.replaceState(global.history.state, '', url.toString());
    } catch (_) {}
  }

  async function sincronizarVersaoBackendNoMenu() {
    if (global.location && global.location.protocol === 'file:') return { ok: false, skipped: true, reason: 'file_protocol' };
    if (typeof global.fetch !== 'function') return { ok: false, skipped: true, reason: 'fetch_unavailable' };

    try {
      var resp = await global.fetch(BACKEND_APP_VERSION_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!resp || !resp.ok) {
        return { ok: false, status: resp ? resp.status : 0 };
      }

      var payload = await resp.json();
      var anterior = obterVersaoBackendAtual();
      var info = salvarBackendVersionInfoCache(payload);
      if (!info) return { ok: false, reason: 'invalid_payload' };

      var atual = String(info.version || '').trim();
      var mudouVersao = Boolean(atual && atual !== anterior);

      // Recalcula os patch notes com o novo auto-entry do backend.
      patchNotesState = null;
      renderPatchNotesModal();

      return {
        ok: true,
        changed: mudouVersao,
        version: atual
      };
    } catch (_) {
      return { ok: false, reason: 'network_error' };
    }
  }

  function extrairSwVersionDoTexto(texto) {
    var raw = String(texto || '');
    if (!raw) return '';
    var match = raw.match(/\bSW_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return match ? String(match[1] || '').trim() : '';
  }

  async function sincronizarVersaoFrontendPwaNoMenu() {
    if (global.location && global.location.protocol === 'file:') return { ok: false, skipped: true, reason: 'file_protocol' };
    if (typeof global.fetch !== 'function') return { ok: false, skipped: true, reason: 'fetch_unavailable' };

    try {
      var anteriorInfo = obterFrontendPwaVersionInfoAtual();
      var anteriorSwVersion = String((anteriorInfo && anteriorInfo.swVersion) || '').trim();
      var resp = await global.fetch(FRONTEND_SW_VERSION_ENDPOINT + '?menu_patch_probe=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!resp || !resp.ok) {
        return { ok: false, status: resp ? resp.status : 0 };
      }

      var texto = await resp.text();
      var swVersionAtual = extrairSwVersionDoTexto(texto);
      if (!swVersionAtual) return { ok: false, reason: 'sw_version_not_found' };

      var releasedAt = '';
      try {
        var lastModified = String(resp.headers.get('last-modified') || '').trim();
        if (lastModified) {
          var parsed = new Date(lastModified);
          if (!Number.isNaN(parsed.getTime())) releasedAt = parsed.toISOString();
        }
      } catch (_) {}
      if (!releasedAt) releasedAt = new Date().toISOString();

      var changedAssets = obterChangedAssetsUltimaAtualizacaoPwa();
      var saved = salvarFrontendPwaVersionInfoCache({
        swVersion: swVersionAtual,
        previousSwVersion: (anteriorSwVersion && anteriorSwVersion !== swVersionAtual) ? anteriorSwVersion : '',
        releasedAt: releasedAt,
        changedAssets: changedAssets
      });
      if (!saved) return { ok: false, reason: 'save_failed' };

      // Recalcula patch notes para incluir o auto-entry de frontend/PWA mesmo sem SW_ACTIVATED.
      patchNotesState = null;
      renderPatchNotesModal();

      return {
        ok: true,
        changed: Boolean(swVersionAtual && swVersionAtual !== anteriorSwVersion),
        swVersion: swVersionAtual,
        version: normalizarVersaoPatchPorSw(swVersionAtual)
      };
    } catch (_) {
      return { ok: false, reason: 'network_error' };
    }
  }

  function init() {
    aplicarTemaInicial();
    renderGroups();
    atualizarUsuarioAtual();
    renderPatchNotesModal();
    bindActions();

    var autoOpenByQuery = shouldAutoOpenPatchNotes();
    var autoOpenByVersion = shouldAutoOpenPatchNotesByVersion();
    if (autoOpenByQuery || autoOpenByVersion) {
      global.setTimeout(function () {
        setPatchNotesModalOpen(true);
        if (autoOpenByQuery) cleanupPatchNotesQueryFlag();
      }, 120);
    }

    global.setTimeout(function () {
      sincronizarVersaoBackendNoMenu().then(function (resultado) {
        if (!resultado || !resultado.ok) return;
        if (resultado.changed && shouldAutoOpenPatchNotesByVersion()) {
          setPatchNotesModalOpen(true);
        }
      });
    }, 180);

    global.setTimeout(function () {
      sincronizarVersaoFrontendPwaNoMenu().then(function (resultado) {
        if (!resultado || !resultado.ok) return;
        if (resultado.changed && shouldAutoOpenPatchNotesByVersion()) {
          setPatchNotesModalOpen(true);
        }
      });
    }, 240);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
