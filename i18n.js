(function attachFinI18n(global) {
  'use strict';

  if (!global || global.FinI18n) return;

  var doc = global.document;
  var STORAGE_KEY = 'idioma_sistema';
  var DEFAULT_LANG = 'pt-BR';
  var SUPPORTED = ['pt-BR', 'en-US'];
  var applyScheduled = false;
  var observer = null;
  var currentLanguage = DEFAULT_LANG;

  var MESSAGES = {
    'pt-BR': {
      i18n: {
        language: 'Idioma',
        languageShort: 'Idioma',
        portuguese: 'Português (Brasil)',
        english: 'English',
        changed: 'Idioma alterado para {lang}.'
      },
      common: {
        openMenu: 'Abrir menu',
        goHome: 'Ir para início',
        home: 'Início',
        economias: 'Economias',
        despesas: 'Despesas',
        summary: 'Resumo',
        commerce: 'Comércio',
        executive: 'Executivo',
        changeTheme: 'Mudar tema',
        settings: 'Configurações',
        exportBackup: 'Exportar backup',
        importBackup: 'Importar backup',
        importByPaste: 'Importar por colagem',
        exportSheet: 'Exportar planilha',
        resetAll: 'Zerar tudo',
        closeSettings: 'Fechar configurações',
        previousMonth: 'Mês anterior',
        nextMonth: 'Próximo mês'
      },
      login: {
        title: 'Entrar no sistema',
        subtitle: 'Use seu usuário e senha para acessar.',
        userLabel: 'Usuário',
        userPlaceholder: 'Seu usuário',
        passwordLabel: 'Senha',
        passwordPlaceholder: 'Sua senha',
        submit: 'Entrar',
        firstAccessTitle: 'Primeiro acesso',
        firstAccessSubtitle: 'Defina seu usuário proprietário para liberar o sistema.',
        firstAccessSubmit: 'Criar proprietário',
        loginError: 'Não foi possível entrar.',
        loginOkRedirecting: 'Acesso liberado. Redirecionando...'
      },
      resumoAno: {
        pageTitle: 'Resumo Anual',
        mainTitle: 'Resumo anual',
        subtitle: 'Visão consolidada por mês de recebimentos, pendências e despesas.',
        cards: {
          recebidoAno: 'Recebido no ano',
          pendenteAno: 'Pendente no ano',
          lucroAno: 'Lucro no ano',
          despesasPagas: 'Despesas pagas'
        },
        graph: {
          toggleShowGraph: 'Ver gráfico',
          toggleShowTable: 'Ver tabela',
          sortAsc: 'Crescente',
          sortDesc: 'Decrescente',
          sortLabel: 'Ordenar planilha por',
          sortByReceived: 'Maior valor recebido',
          sortByPending: 'Maior pendente',
          sortByProfit: 'Maior lucro',
          sortByExpenses: 'Maior despesa',
          sortByMonth: 'Mês',
          tableHeaders: {
            month: 'Mês',
            received: 'Recebido',
            pending: 'Pendente',
            profit: 'Lucro',
            expenses: 'Desp. pagas',
            actions: 'Ações'
          },
          chartModeLabel: 'Modo do gráfico',
          chartModeComparativo: 'Comparativo (3 linhas)',
          chartModeRecebido: 'Apenas recebido',
          chartModeDespesas: 'Apenas despesas pagas',
          chartModeLucro: 'Apenas lucro',
          chartModePendente: 'Apenas pendente',
          noData: 'Sem dados para exibir no ano selecionado.',
          noSeries: 'Nenhuma série disponível para o modo selecionado.',
          chartAria: 'Gráfico de evolução mensal',
          insights: {
            peakOf: 'Pico de {serie}: {mes} ({valor})',
            lowestLine: 'Menor {serie}: {mes} ({valor}) | Recebido: {recebido} | Despesas: {despesas} | Lucro anual: {lucro}'
          },
          actions: {
            index: 'Index',
            despesas: 'Despesas',
            economias: 'Economias'
          }
        },
        chartTitles: {
          comparativo: 'Evolução mensal - recebido, despesas e lucro',
          recebido: 'Evolução mensal - recebido',
          despesas: 'Evolução mensal - despesas pagas',
          lucro: 'Evolução mensal - lucro',
          pendente: 'Evolução mensal - pendente'
        },
        series: {
          recebido: 'Recebido',
          despesas: 'Despesas',
          lucro: 'Lucro',
          pendente: 'Pendente'
        }
      },
      offline: {
        title: 'Offline | Finances',
        heading: 'Você está offline',
        p1: 'Não foi possível carregar esta página agora.',
        p2: 'Se a conexão voltar, tente atualizar. Algumas telas e arquivos já visitados podem continuar funcionando.',
        retry: 'Tentar novamente',
        home: 'Ir para início',
        hint: 'Finances PWA (modo offline)'
      },
      menu: {
        title: 'Painel de Controle | Finances',
        heroHeading: 'Painel de Controle',
        heroSubtitle: 'Comande opera\u00e7\u00f5es, relat\u00f3rios e configura\u00e7\u00f5es em um s\u00f3 lugar, com acesso r\u00e1pido por fun\u00e7\u00e3o.',
        theme: 'Tema',
        logout: 'Sair',
        protectedSession: 'Sessão protegida',
        waitingAuth: 'Aguardando autenticação',
        owner: 'Proprietário',
        authenticatedUser: 'Usuário autenticado'
      },
      pages: {
        indexTitle: 'Painel Financeiro',
        economiasTitle: 'Minhas Economias',
        despesasTitle: 'Controle de Despesas',
        resumoEconomiasTitle: 'Resumo Economias',
        comercioTitle: 'Modo Comércio | Finances'
      },
      resumoEconomias: {
        subtitle: 'Visão anual dos 12 meses: saldo disponível da carteira e evolução da poupança.'
      }
    },
    'en-US': {
      i18n: {
        language: 'Language',
        languageShort: 'Language',
        portuguese: 'Portuguese (Brazil)',
        english: 'English',
        changed: 'Language changed to {lang}.'
      },
      common: {
        openMenu: 'Open menu',
        goHome: 'Go to home',
        home: 'Home',
        economias: 'Savings',
        despesas: 'Expenses',
        summary: 'Summary',
        commerce: 'Commerce',
        executive: 'Executive',
        changeTheme: 'Change theme',
        settings: 'Settings',
        exportBackup: 'Export backup',
        importBackup: 'Import backup',
        importByPaste: 'Import by paste',
        exportSheet: 'Export spreadsheet',
        resetAll: 'Reset all',
        closeSettings: 'Close settings',
        previousMonth: 'Previous month',
        nextMonth: 'Next month'
      },
      login: {
        title: 'Sign in',
        subtitle: 'Use your username and password to access.',
        userLabel: 'Username',
        userPlaceholder: 'Your username',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Your password',
        submit: 'Sign in',
        firstAccessTitle: 'First access',
        firstAccessSubtitle: 'Set your owner user to unlock the system.',
        firstAccessSubmit: 'Create owner',
        loginError: 'Could not sign in.',
        loginOkRedirecting: 'Access granted. Redirecting...'
      },
      resumoAno: {
        pageTitle: 'Annual Summary',
        mainTitle: 'Annual summary',
        subtitle: 'Consolidated monthly view of received amounts, pending amounts and expenses.',
        cards: {
          recebidoAno: 'Received this year',
          pendenteAno: 'Pending this year',
          lucroAno: 'Profit this year',
          despesasPagas: 'Paid expenses'
        },
        graph: {
          toggleShowGraph: 'View chart',
          toggleShowTable: 'View table',
          sortAsc: 'Ascending',
          sortDesc: 'Descending',
          sortLabel: 'Sort table by',
          sortByReceived: 'Highest received amount',
          sortByPending: 'Highest pending amount',
          sortByProfit: 'Highest profit',
          sortByExpenses: 'Highest expense',
          sortByMonth: 'Month',
          tableHeaders: {
            month: 'Month',
            received: 'Received',
            pending: 'Pending',
            profit: 'Profit',
            expenses: 'Paid exp.',
            actions: 'Actions'
          },
          chartModeLabel: 'Chart mode',
          chartModeComparativo: 'Comparison (3 lines)',
          chartModeRecebido: 'Received only',
          chartModeDespesas: 'Paid expenses only',
          chartModeLucro: 'Profit only',
          chartModePendente: 'Pending only',
          noData: 'No data available for the selected year.',
          noSeries: 'No series available for the selected mode.',
          chartAria: 'Monthly trend chart',
          insights: {
            peakOf: 'Peak {serie}: {mes} ({valor})',
            lowestLine: 'Lowest {serie}: {mes} ({valor}) | Received: {recebido} | Expenses: {despesas} | Annual profit: {lucro}'
          },
          actions: {
            index: 'Index',
            despesas: 'Expenses',
            economias: 'Savings'
          }
        },
        chartTitles: {
          comparativo: 'Monthly trend - received, expenses and profit',
          recebido: 'Monthly trend - received',
          despesas: 'Monthly trend - paid expenses',
          lucro: 'Monthly trend - profit',
          pendente: 'Monthly trend - pending'
        },
        series: {
          recebido: 'Received',
          despesas: 'Expenses',
          lucro: 'Profit',
          pendente: 'Pending'
        }
      },
      offline: {
        title: 'Offline | Finances',
        heading: 'You are offline',
        p1: 'This page could not be loaded right now.',
        p2: 'When your connection returns, try refreshing. Some previously visited screens and files may still work.',
        retry: 'Try again',
        home: 'Go to home',
        hint: 'Finances PWA (offline mode)'
      },
      menu: {
        title: 'Control Panel | Finances',
        heroHeading: 'Control Panel',
        heroSubtitle: 'Command operations, reports, and settings in one place with fast access by function.',
        theme: 'Theme',
        logout: 'Sign out',
        protectedSession: 'Protected session',
        waitingAuth: 'Waiting for authentication',
        owner: 'Owner',
        authenticatedUser: 'Authenticated user'
      },
      pages: {
        indexTitle: 'Financial Dashboard',
        economiasTitle: 'My Savings',
        despesasTitle: 'Expense Control',
        resumoEconomiasTitle: 'Savings Summary',
        comercioTitle: 'Commerce Mode | Finances'
      },
      resumoEconomias: {
        subtitle: 'Yearly view of all 12 months: available wallet balance and savings growth.'
      }
    }
  };

  var TITLE_BY_PATH = {
    '/index.html': 'pages.indexTitle',
    '/': 'pages.indexTitle',
    '/economias.html': 'pages.economiasTitle',
    '/despesas.html': 'pages.despesasTitle',
    '/resumo-ano.html': 'resumoAno.pageTitle',
    '/resumo-economias.html': 'pages.resumoEconomiasTitle',
    '/comercio.html': 'pages.comercioTitle',
    '/login.html': 'login.title',
    '/menu.html': 'menu.title',
    '/offline.html': 'offline.title'
  };

  var SELECTOR_MAP = [
    { selector: '#toggle-sidebar', attr: 'aria-label', key: 'common.openMenu' },
    { selector: '.btn-voltar-flutuante', attr: 'aria-label', key: 'common.goHome' },
    { selector: '.btn-voltar-sidebar', attr: 'aria-label', key: 'common.goHome' },
    { selector: '.btn-voltar-sidebar span', key: 'common.home' },
    { selector: '.btn-economias span', key: 'common.economias' },
    { selector: '.btn-despesas span', key: 'common.despesas' },
    { selector: '.btn-backup-executive span', key: 'common.executive' },
    { selector: '.btn-tema-toggle', key: 'common.changeTheme' },
    { selector: '.btn-configuracoes-principal span:last-child', key: 'common.settings' },
    { selector: '.btn-backup-export span', key: 'common.exportBackup' },
    { selector: '.btn-backup-import span', key: 'common.importBackup' },
    { selector: '.btn-reset span', key: 'common.resetAll' },
    { selector: '[data-exportar-planilha=\"1\"] span', key: 'common.exportSheet' },
    { selector: '[data-importacao-colagem=\"1\"] span', key: 'common.importByPaste' },
    { selector: '[data-config-popup-close=\"1\"]', attr: 'aria-label', key: 'common.closeSettings' },
    { selector: '.btn-mes-nav[onclick*=\"navegarMesTitulo(-1)\"]', attr: 'aria-label', key: 'common.previousMonth' },
    { selector: '.btn-mes-nav[onclick*=\"navegarMesTitulo(1)\"]', attr: 'aria-label', key: 'common.nextMonth' },

    { path: '/login.html', selector: '#login-titulo', key: 'login.title' },
    { path: '/login.html', selector: '#login-subtitulo', key: 'login.subtitle' },
    { path: '/login.html', selector: 'label[for=\"login-usuario\"]', key: 'login.userLabel' },
    { path: '/login.html', selector: '#login-usuario', attr: 'placeholder', key: 'login.userPlaceholder' },
    { path: '/login.html', selector: 'label[for=\"login-senha\"]', key: 'login.passwordLabel' },
    { path: '/login.html', selector: '#login-senha', attr: 'placeholder', key: 'login.passwordPlaceholder' },
    { path: '/login.html', selector: '#login-submit', key: 'login.submit' },

    { path: '/menu.html', selector: '.menu-app-hero-main h1', key: 'menu.heroHeading' },
    { path: '/menu.html', selector: '.menu-app-subtitulo', key: 'menu.heroSubtitle' },
    { path: '/menu.html', selector: '#menu-app-btn-tema span', key: 'menu.theme' },
    { path: '/menu.html', selector: '#menu-app-btn-sair span', key: 'menu.logout' },

    { path: '/offline.html', selector: '#offline-title', key: 'offline.heading' },
    { path: '/offline.html', selector: '.card > p:nth-of-type(1)', key: 'offline.p1' },
    { path: '/offline.html', selector: '.card > p:nth-of-type(2)', key: 'offline.p2' },
    { path: '/offline.html', selector: '.acoes .btn.primary', key: 'offline.retry' },
    { path: '/offline.html', selector: '.acoes .btn:not(.primary)', key: 'offline.home' },
    { path: '/offline.html', selector: '.hint', key: 'offline.hint' },

    { path: '/resumo-ano.html', selector: '.subtitulo-resumo-ano', key: 'resumoAno.subtitle' },
    { path: '/resumo-ano.html', selector: '.resumo-ano-cards .card:nth-child(1) h3', key: 'resumoAno.cards.recebidoAno' },
    { path: '/resumo-ano.html', selector: '.resumo-ano-cards .card:nth-child(2) h3', key: 'resumoAno.cards.pendenteAno' },
    { path: '/resumo-ano.html', selector: '.resumo-ano-cards .card:nth-child(3) h3', key: 'resumoAno.cards.lucroAno' },
    { path: '/resumo-ano.html', selector: '.resumo-ano-cards .card:nth-child(4) h3', key: 'resumoAno.cards.despesasPagas' },
    { path: '/resumo-ano.html', selector: '.resumo-ano-tabela-controles label', key: 'resumoAno.graph.sortLabel' },
    { path: '/resumo-ano.html', selector: '#resumo-tabela-metrica option[value=\"recebido\"]', key: 'resumoAno.graph.sortByReceived' },
    { path: '/resumo-ano.html', selector: '#resumo-tabela-metrica option[value=\"pendente\"]', key: 'resumoAno.graph.sortByPending' },
    { path: '/resumo-ano.html', selector: '#resumo-tabela-metrica option[value=\"liquido\"]', key: 'resumoAno.graph.sortByProfit' },
    { path: '/resumo-ano.html', selector: '#resumo-tabela-metrica option[value=\"despesasPagas\"]', key: 'resumoAno.graph.sortByExpenses' },
    { path: '/resumo-ano.html', selector: '#resumo-tabela-metrica option[value=\"mes\"]', key: 'resumoAno.graph.sortByMonth' },
    { path: '/resumo-ano.html', selector: '#tabela-resumo-ano thead th:nth-child(1)', key: 'resumoAno.graph.tableHeaders.month' },
    { path: '/resumo-ano.html', selector: '#tabela-resumo-ano thead th:nth-child(2)', key: 'resumoAno.graph.tableHeaders.received' },
    { path: '/resumo-ano.html', selector: '#tabela-resumo-ano thead th:nth-child(3)', key: 'resumoAno.graph.tableHeaders.pending' },
    { path: '/resumo-ano.html', selector: '#tabela-resumo-ano thead th:nth-child(4)', key: 'resumoAno.graph.tableHeaders.profit' },
    { path: '/resumo-ano.html', selector: '#tabela-resumo-ano thead th:nth-child(5)', key: 'resumoAno.graph.tableHeaders.expenses' },
    { path: '/resumo-ano.html', selector: '#tabela-resumo-ano thead th:nth-child(6)', key: 'resumoAno.graph.tableHeaders.actions' },
    { path: '/resumo-ano.html', selector: '.resumo-ano-grafico-controles label', key: 'resumoAno.graph.chartModeLabel' },
    { path: '/resumo-ano.html', selector: '#resumo-grafico-modo option[value=\"comparativo\"]', key: 'resumoAno.graph.chartModeComparativo' },
    { path: '/resumo-ano.html', selector: '#resumo-grafico-modo option[value=\"recebido\"]', key: 'resumoAno.graph.chartModeRecebido' },
    { path: '/resumo-ano.html', selector: '#resumo-grafico-modo option[value=\"despesas\"]', key: 'resumoAno.graph.chartModeDespesas' },
    { path: '/resumo-ano.html', selector: '#resumo-grafico-modo option[value=\"lucro\"]', key: 'resumoAno.graph.chartModeLucro' },
    { path: '/resumo-ano.html', selector: '#resumo-grafico-modo option[value=\"pendente\"]', key: 'resumoAno.graph.chartModePendente' },

    { path: '/resumo-economias.html', selector: '.subtitulo-resumo-economias', key: 'resumoEconomias.subtitle' },
    { path: '/economias.html', selector: '.btn-resumo-economias-topo span', key: 'common.summary' },
    { path: '/economias.html', selector: '.btn-modo-comercio-topo span', key: 'common.commerce' },

    { path: '/comercio.html', selector: '#btn-comercio-abrir-economias span', key: 'common.economias' }
  ];

  function getPathname() {
    if (!global.location) return '';
    return String(global.location.pathname || '/').replace(/\/+$/, '') || '/';
  }

  function normalizeLang(input) {
    var raw = String(input || '').trim().toLowerCase();
    if (!raw) return DEFAULT_LANG;
    if (raw === 'pt' || raw === 'pt-br' || raw.indexOf('pt-') === 0) return 'pt-BR';
    if (raw === 'en' || raw === 'en-us' || raw.indexOf('en-') === 0) return 'en-US';
    return SUPPORTED.indexOf(input) >= 0 ? input : DEFAULT_LANG;
  }

  function readStoredLanguage() {
    try {
      return normalizeLang(global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : '');
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function persistLanguage(lang) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }

  function getMessagesForLang(lang) {
    return MESSAGES[normalizeLang(lang)] || MESSAGES[DEFAULT_LANG];
  }

  function getExtraMessagesForLang(lang) {
    var extra = global.__FIN_I18N_EXTRA_MESSAGES;
    if (!extra || typeof extra !== 'object') return null;
    return extra[normalizeLang(lang)] || extra[DEFAULT_LANG] || null;
  }

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i += 1) {
      if (!cur || typeof cur !== 'object' || !(parts[i] in cur)) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(template, vars) {
    var text = String(template == null ? '' : template);
    if (!vars || typeof vars !== 'object') return text;
    return text.replace(/\{(\w+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
    });
  }

  function t(key, vars, fallback) {
    var dict = getMessagesForLang(currentLanguage);
    var extraDict = getExtraMessagesForLang(currentLanguage);
    var value = getByPath(dict, key);
    if (value == null) value = getByPath(extraDict, key);
    if (value == null) {
      value = getByPath(getMessagesForLang(DEFAULT_LANG), key);
    }
    if (value == null) value = getByPath(getExtraMessagesForLang(DEFAULT_LANG), key);
    if (value == null) value = fallback != null ? fallback : key;
    return interpolate(value, vars);
  }

  function getLanguage() {
    return currentLanguage;
  }

  function getLanguageLabel(lang) {
    var normalized = normalizeLang(lang);
    if (normalized === 'en-US') return t('i18n.english');
    return t('i18n.portuguese');
  }

  function formatMonthName(index, style) {
    var monthIndex = Number(index);
    if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return '';
    try {
      var dtf = new Intl.DateTimeFormat(currentLanguage, {
        month: style || 'long',
        timeZone: 'UTC'
      });
      return dtf.format(new Date(Date.UTC(2026, monthIndex, 1, 12, 0, 0)));
    } catch (_) {
      var fallback = getMessagesForLang(DEFAULT_LANG);
      var meses = (fallback.months && fallback.months.long) || [];
      return meses[monthIndex] || '';
    }
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setAttr(el, attr, value) {
    if (!el || !attr) return;
    el.setAttribute(attr, value);
  }

  function applyTitle() {
    if (!doc) return;
    var path = getPathname();
    var extraTitles = global.__FIN_I18N_EXTRA_TITLE_BY_PATH;
    var key = (extraTitles && (extraTitles[path] || extraTitles[path + '.html'])) || TITLE_BY_PATH[path] || TITLE_BY_PATH[path + '.html'];
    if (key) {
      doc.title = t(key);
    }
  }

  function shouldApplyEntry(entry, path) {
    if (!entry) return false;
    if (!entry.path) return true;
    if (Array.isArray(entry.path)) return entry.path.indexOf(path) >= 0;
    return String(entry.path) === path;
  }

  function applySelectorTranslations(root) {
    if (!doc) return;
    var path = getPathname();
    var scope = root && root.querySelectorAll ? root : doc;
    var extraSelectorMap = Array.isArray(global.__FIN_I18N_EXTRA_SELECTOR_MAP) ? global.__FIN_I18N_EXTRA_SELECTOR_MAP : [];
    var selectorMap = SELECTOR_MAP.concat(extraSelectorMap);

    for (var i = 0; i < selectorMap.length; i += 1) {
      var entry = selectorMap[i];
      if (!shouldApplyEntry(entry, path)) continue;
      var els;
      try {
        els = scope.querySelectorAll(entry.selector);
      } catch (_) {
        continue;
      }
      if (!els || !els.length) continue;

      for (var j = 0; j < els.length; j += 1) {
        var el = els[j];
        if (!el) continue;
        var value = entry.key ? t(entry.key) : String(entry.text || '');
        if (entry.attr) setAttr(el, entry.attr, value);
        else setText(el, value);
      }
    }

    if (path === '/economias.html') {
      var resumoBtn = doc.querySelector('.btn-resumo-economias-topo');
      if (resumoBtn) setAttr(resumoBtn, 'aria-label', currentLanguage === 'en-US' ? 'Open savings summary' : 'Abrir resumo de economias');
      var comercioBtn = doc.querySelector('.btn-modo-comercio-topo');
      if (comercioBtn) setAttr(comercioBtn, 'aria-label', currentLanguage === 'en-US' ? 'Open commerce mode' : 'Abrir modo comércio');
    }
  }

  function applyDataAttributeTranslations(root) {
    if (!doc) return;
    var scope = root && root.querySelectorAll ? root : doc;
    var textNodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textNodes.length; i += 1) {
      var el = textNodes[i];
      setText(el, t(el.getAttribute('data-i18n')));
    }

    var attrs = [
      ['data-i18n-placeholder', 'placeholder'],
      ['data-i18n-title', 'title'],
      ['data-i18n-aria-label', 'aria-label']
    ];

    for (var a = 0; a < attrs.length; a += 1) {
      var attrKey = attrs[a][0];
      var attrTarget = attrs[a][1];
      var list = scope.querySelectorAll('[' + attrKey + ']');
      for (var k = 0; k < list.length; k += 1) {
        var node = list[k];
        setAttr(node, attrTarget, t(node.getAttribute(attrKey)));
      }
    }
  }

  function updateDocumentLang() {
    if (!doc || !doc.documentElement) return;
    doc.documentElement.lang = currentLanguage;
  }

  function buildLanguageControlMarkup() {
    return [
      '<label class="i18n-locale-control" data-i18n-locale-control="1">',
      '  <span class="i18n-locale-label">', t('i18n.languageShort'), '</span>',
      '  <select class="i18n-locale-select" data-i18n-lang-select="1" aria-label="', t('i18n.language'), '">',
      '    <option value="pt-BR">', t('i18n.portuguese'), '</option>',
      '    <option value="en-US">', t('i18n.english'), '</option>',
      '  </select>',
      '</label>'
    ].join('');
  }

  function createLanguageControl(containerClass) {
    if (!doc) return null;
    var wrap = doc.createElement('div');
    wrap.className = 'i18n-locale-slot' + (containerClass ? (' ' + containerClass) : '');
    wrap.dataset.i18nLocaleSlot = '1';
    wrap.innerHTML = buildLanguageControlMarkup();
    return wrap;
  }

  function ensureLanguageControls() {
    if (!doc || !doc.body) return;

    var configMenus = doc.querySelectorAll('.configuracoes-menu-conteudo');
    for (var i = 0; i < configMenus.length; i += 1) {
      var menu = configMenus[i];
      if (!menu || menu.querySelector('[data-i18n-locale-slot=\"1\"]')) continue;
      var ctrl = createLanguageControl('i18n-locale-slot-menu');
      if (ctrl) menu.prepend(ctrl);
    }

    var loginCard = doc.querySelector('.login-card');
    if (loginCard && !loginCard.querySelector('[data-i18n-locale-slot=\"1\"]')) {
      var loginSlot = createLanguageControl('i18n-locale-slot-login');
      var loginForm = loginCard.querySelector('.login-form');
      if (loginSlot) {
        if (loginForm && loginForm.parentNode === loginCard) loginCard.insertBefore(loginSlot, loginForm);
        else loginCard.appendChild(loginSlot);
      }
    }

    var menuActions = doc.querySelector('.menu-app-hero-actions');
    if (menuActions && !menuActions.querySelector('[data-i18n-locale-slot=\"1\"]')) {
      var menuSlot = createLanguageControl('i18n-locale-slot-inline');
      if (menuSlot) menuActions.prepend(menuSlot);
    }

    var comercioActions = doc.querySelector('.comercio-header-acoes');
    if (comercioActions && !comercioActions.querySelector('[data-i18n-locale-slot=\"1\"]')) {
      var comercioSlot = createLanguageControl('i18n-locale-slot-inline');
      if (comercioSlot) comercioActions.prepend(comercioSlot);
    }

    var offlineCard = doc.querySelector('.card[role=\"main\"]');
    if (offlineCard && !offlineCard.querySelector('[data-i18n-locale-slot=\"1\"]')) {
      var offlineSlot = createLanguageControl('i18n-locale-slot-offline');
      var acoes = offlineCard.querySelector('.acoes');
      if (offlineSlot) {
        if (acoes && acoes.parentNode === offlineCard) offlineCard.insertBefore(offlineSlot, acoes);
        else offlineCard.appendChild(offlineSlot);
      }
    }
  }

  function syncLanguageSelects() {
    if (!doc) return;
    var selects = doc.querySelectorAll('[data-i18n-lang-select=\"1\"]');
    for (var i = 0; i < selects.length; i += 1) {
      var select = selects[i];
      if (select.value !== currentLanguage) select.value = currentLanguage;
      select.setAttribute('aria-label', t('i18n.language'));
    }
    var labels = doc.querySelectorAll('.i18n-locale-label');
    for (var j = 0; j < labels.length; j += 1) {
      setText(labels[j], t('i18n.languageShort'));
    }
  }

  function applyTranslations(root) {
    if (!doc) return;
    updateDocumentLang();
    ensureLanguageControls();
    applyTitle();
    applyDataAttributeTranslations(root);
    applySelectorTranslations(root);
    syncLanguageSelects();
  }

  function scheduleApply(root) {
    if (applyScheduled) return;
    applyScheduled = true;
    global.requestAnimationFrame(function () {
      applyScheduled = false;
      applyTranslations(root);
    });
  }

  function setLanguage(lang, opts) {
    var next = normalizeLang(lang);
    var options = opts || {};
    var changed = next !== currentLanguage;
    currentLanguage = next;
    if (options.persist !== false) persistLanguage(next);
    applyTranslations();

    if (changed && !options.silent) {
      global.dispatchEvent(new CustomEvent('fin:i18n-change', {
        detail: { language: next }
      }));
    }
    return next;
  }

  function detectInitialLanguage() {
    var stored = readStoredLanguage();
    if (stored && stored !== DEFAULT_LANG) return stored;
    var browser = normalizeLang(global.navigator && (global.navigator.language || (global.navigator.languages && global.navigator.languages[0])));
    if (browser) return browser;
    return DEFAULT_LANG;
  }

  function onDocumentChange(event) {
    var target = event && event.target;
    if (!target || target.getAttribute('data-i18n-lang-select') !== '1') return;
    setLanguage(target.value);
  }

  function startObserver() {
    if (!doc || !doc.body || typeof MutationObserver === 'undefined' || observer) return;
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
          scheduleApply(doc);
          return;
        }
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  function init() {
    if (!doc) return;
    setLanguage(detectInitialLanguage(), { persist: false, silent: true });
    doc.addEventListener('change', onDocumentChange);
    startObserver();
    global.setTimeout(function () { applyTranslations(); }, 240);
    global.setTimeout(function () { applyTranslations(); }, 800);
  }

  global.FinI18n = Object.freeze({
    getLanguage: getLanguage,
    setLanguage: setLanguage,
    t: t,
    getLanguageLabel: getLanguageLabel,
    formatMonthName: formatMonthName,
    applyTranslations: applyTranslations
  });

  if (doc && doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
