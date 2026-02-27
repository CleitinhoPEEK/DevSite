(function (global) {
  'use strict';

  if (!global || global.__finDevToolsLoaded) return;
  global.__finDevToolsLoaded = true;

  var doc = global.document;
  if (!doc) return;

  var K = {
    LOGS: 'fin_dev_tools_logs_v1',
    SIM: 'fin_dev_sim_events_v1',
    LAST: 'fin_dev_last_sim_payload_v1',
    LAST_NOTIFY: 'fin_dev_last_notify_payload_v1'
  };
  var MAX_LOGS = 300;
  var MAX_SIM = 120;
  var state = { logs: [], sim: [], last: null, lastNotify: null, audit: [], user: null };

  function common() { return global.FinCommon || null; }
  function i18n() { return global.FinI18n || null; }
  function t(key, fb, vars) {
    var api = i18n();
    return api && typeof api.t === 'function' ? api.t(key, vars, fb) : (fb || key);
  }
  function esc(v) {
    var c = common();
    if (c && typeof c.escapeHtml === 'function') return c.escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function jget(k, fb) {
    try {
      var c = common();
      if (c && typeof c.safeGetJSON === 'function') return c.safeGetJSON(k, fb);
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fb;
    } catch (_) { return fb; }
  }
  function jset(k, v) {
    try {
      var c = common();
      if (c && typeof c.safeSetJSON === 'function') return c.safeSetJSON(k, v);
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (_) { return false; }
  }
  function money(v) {
    var c = common();
    if (c && typeof c.formatarMoeda === 'function') return c.formatarMoeda(v);
    try { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    catch (_) { return 'R$ ' + Number(v || 0).toFixed(2); }
  }
  function dt(v) {
    var d = new Date(v);
    if (Number.isNaN(d.getTime())) return '-';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(d);
    } catch (_) { return d.toISOString(); }
  }
  function isoNow() { return new Date().toISOString(); }
  function rid(p) { return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

  function getUser() {
    try {
      return global.FinAuth && typeof global.FinAuth.obterUsuarioAtualAutenticacao === 'function'
        ? global.FinAuth.obterUsuarioAtualAutenticacao()
        : null;
    } catch (_) { return null; }
  }
  function isDev(u) { return !!(u && u.developer); }

  function el(id) { return doc.getElementById(id); }
  function setFeedback(msg, tone) {
    var n = el('dev-tools-feedback');
    if (!n) return;
    n.textContent = String(msg || '');
    n.classList.remove('is-ok', 'is-warn', 'is-error', 'is-info');
    if (msg) n.classList.add('is-' + (tone || 'info'));
  }

  var toastTimer = null;
  function toast(msg, tone) {
    var n = el('dev-tools-toast');
    if (!n) return;
    n.hidden = false;
    n.textContent = String(msg || '');
    n.classList.remove('is-ok', 'is-warn', 'is-error', 'is-info');
    n.classList.add('is-' + (tone || 'info'));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.hidden = true; }, 2600);
  }

  function saveLogs() { jset(K.LOGS, state.logs); }
  function loadLogs() {
    var arr = jget(K.LOGS, []);
    state.logs = Array.isArray(arr) ? arr.slice(0, MAX_LOGS) : [];
  }
  function addLog(level, msg, meta) {
    state.logs.unshift({
      id: rid('log'),
      level: String(level || 'info'),
      msg: String(msg || ''),
      meta: meta && typeof meta === 'object' ? meta : null,
      at: isoNow()
    });
    if (state.logs.length > MAX_LOGS) state.logs.length = MAX_LOGS;
    saveLogs();
    renderLogs();
  }
  function shortJson(v) {
    try {
      var s = JSON.stringify(v);
      return s.length > 260 ? (s.slice(0, 257) + '...') : s;
    } catch (_) { return String(v); }
  }
  function renderLogs() {
    var host = el('dev-tools-log-list');
    if (!host) return;
    if (!state.logs.length) {
      host.innerHTML = '<li class="dev-tools-log-item is-empty">Nenhum log registrado ainda.</li>';
      return;
    }
    host.innerHTML = state.logs.map(function (x) {
      var tone = x.level === 'error' ? 'is-error' : (x.level === 'warn' ? 'is-warn' : (x.level === 'ok' || x.level === 'success' ? 'is-ok' : 'is-info'));
      return [
        '<li class="dev-tools-log-item">',
        '<div class="dev-tools-log-item-head"><span class="dev-tools-log-badge ', tone, '">', esc(String(x.level).toUpperCase()), '</span><time datetime="', esc(x.at), '">', esc(dt(x.at)), '</time></div>',
        '<strong class="dev-tools-log-msg">', esc(x.msg), '</strong>',
        x.meta ? ('<pre class="dev-tools-log-meta">' + esc(shortJson(x.meta)) + '</pre>') : '',
        '</li>'
      ].join('');
    }).join('');
  }

  function saveSim() { jset(K.SIM, state.sim); }
  function loadSim() {
    var arr = jget(K.SIM, []);
    state.sim = Array.isArray(arr) ? arr.slice(0, MAX_SIM) : [];
    state.last = jget(K.LAST, null);
    state.lastNotify = jget(K.LAST_NOTIFY, null);
  }
  function setLastSim(payload) { state.last = payload || null; jset(K.LAST, state.last); renderLastSim(); }
  function setLastNotify(payload) { state.lastNotify = payload || null; jset(K.LAST_NOTIFY, state.lastNotify); renderLastNotify(); }

  function renderLastSim() {
    var pre = el('dev-sim-payload');
    if (!pre) return;
    if (!state.last) {
      pre.textContent = '{\n  "status": "aguardando simulacao"\n}';
      return;
    }
    try { pre.textContent = JSON.stringify(state.last, null, 2); }
    catch (_) { pre.textContent = String(state.last); }
  }

  function renderLastNotify() {
    var pre = el('dev-notify-payload');
    if (!pre) return;
    if (!state.lastNotify) {
      pre.textContent = '{\n  "status": "aguardando teste de notificacao"\n}';
      return;
    }
    try { pre.textContent = JSON.stringify(state.lastNotify, null, 2); }
    catch (_) { pre.textContent = String(state.lastNotify); }
  }

  function renderSimHistory() {
    var host = el('dev-sim-history');
    if (!host) return;
    if (!state.sim.length) {
      host.innerHTML = '<li class="dev-tools-list-item is-empty">Nenhum evento simulado ainda.</li>';
      return;
    }
    host.innerHTML = state.sim.map(function (e) {
      var tone = e.kind === 'approved' ? 'is-approved' : (e.kind === 'rejected' ? 'is-rejected' : (e.kind === 'duplicate' ? 'is-duplicate' : 'is-pending'));
      return [
        '<li class="dev-tools-list-item">',
        '<div class="dev-tools-list-item-head"><span class="dev-tools-pill ', tone, '">', esc(String(e.kind || '').toUpperCase()), '</span><time datetime="', esc(e.createdAt || ''), '">', esc(dt(e.createdAt)), '</time></div>',
        '<strong>', esc(e.label || 'Evento'), '</strong>',
        '<div class="dev-tools-list-item-sub"><span>', esc(e.reference || '-'), '</span><span>', esc(money(e.amount || 0)), '</span>', e.duplicateOf ? ('<span>dup: ' + esc(e.duplicateOf) + '</span>') : '', '</div>',
        '</li>'
      ].join('');
    }).join('');
  }

  function simFormValues() {
    var amount = Number((el('dev-sim-amount') && el('dev-sim-amount').value) || 0);
    if (!Number.isFinite(amount) || amount < 0) amount = 0;
    var ref = String((el('dev-sim-reference') && el('dev-sim-reference').value) || '').trim();
    if (!ref) ref = 'pedido-' + String(Date.now()).slice(-6);
    return { amount: amount, reference: ref };
  }

  function notifyFormValues() {
    function read(id, fb) {
      var x = el(id);
      return x ? String(x.value || '').trim() : String(fb || '');
    }
    function readNum(id, fb) {
      var n = Number(read(id, fb));
      return Number.isFinite(n) ? n : Number(fb || 0);
    }
    return {
      name: read('dev-notify-name', 'Joao') || 'Joao',
      phone: read('dev-notify-phone', '11999999999'),
      amount: readNum('dev-notify-amount', 89.9),
      wallet: readNum('dev-notify-wallet', 25),
      goal: readNum('dev-notify-goal', 500),
      savings: readNum('dev-notify-savings', 520),
      reference: simFormValues().reference
    };
  }

  function normalizePhone(telefone) {
    var d = String(telefone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('55') === 0 && d.length > 11) return d.slice(2);
    return d;
  }

  function buildWhatsLink(telefone, texto) {
    var base = normalizePhone(telefone);
    if (!base || base.length < 10) return '';
    var destino = base.indexOf('55') === 0 ? base : ('55' + base);
    return 'https://wa.me/' + destino + '?text=' + encodeURIComponent(String(texto || ''));
  }

  async function requestNotificationPermissionForTests() {
    var finPwa = global.FinPwa || null;
    if (finPwa && typeof finPwa.requestNotificationPermission === 'function') {
      var r = await finPwa.requestNotificationPermission();
      return String(r || 'default');
    }
    if (!('Notification' in global)) return 'unsupported';
    try { return String(await global.Notification.requestPermission()); }
    catch (_) { return 'default'; }
  }

  function canUseNotificationTests() {
    var finPwa = global.FinPwa || null;
    if (finPwa && typeof finPwa.canUseLocalNotifications === 'function') return !!finPwa.canUseLocalNotifications();
    return typeof global.Notification !== 'undefined';
  }

  async function showLocalNotificationForTest(payload) {
    var finPwa = global.FinPwa || null;
    if (finPwa && typeof finPwa.showLocalNotification === 'function') {
      return !!(await finPwa.showLocalNotification(payload));
    }
    if (!('Notification' in global)) return false;
    if (String(global.Notification.permission || 'default') !== 'granted') return false;
    try {
      var n = new Notification(String(payload.title || 'Finances'), {
        body: String(payload.body || ''),
        icon: String(payload.icon || '/icons/icon-192.png'),
        badge: String(payload.badge || '/icons/favicon-32.png'),
        tag: String(payload.tag || ('fin-dev-' + Date.now())),
        data: payload.data || {}
      });
      var target = String((payload.data && (payload.data.url || payload.data.appUrl)) || '');
      if (target) {
        n.onclick = function () {
          try { n.close(); } catch (_) {}
          try { global.open(target, '_blank'); } catch (_) {}
        };
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function buildDevNotification(kind) {
    var v = notifyFormValues();
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var tomorrow = new Date(today.getTime()); tomorrow.setDate(tomorrow.getDate() + 1);
    var dateBr = function (d) { return dt(d).slice(0, 10); };
    var amountText = money(v.amount);
    var appIndex = global.location.origin + '/index.html';
    var appEconomias = global.location.origin + '/economias.html';
    var appDespesas = global.location.origin + '/despesas.html';

    var payload = {
      title: 'Finances',
      body: 'Notificacao de teste',
      tag: 'dev-notify-' + kind + '-' + Date.now(),
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      data: { finType: 'dev_test_notification', kind: kind, appUrl: appIndex },
      actions: []
    };

    if (kind === 'payment-completed-manual') {
      payload.title = 'Pagamento concluido';
      payload.body = v.name + ' recebeu ' + amountText + ' via marcacao manual.';
      payload.data.url = appIndex;
      payload.data.finType = 'payment_completed_manual';
      return payload;
    }
    if (kind === 'payment-completed-mp') {
      payload.title = 'Pagamento concluido';
      payload.body = v.name + ' recebeu ' + amountText + ' via Mercado Pago.';
      payload.data.url = appIndex;
      payload.data.finType = 'payment_completed_mp';
      return payload;
    }
    if (kind === 'mercadopago-failed') {
      payload.title = 'Pagamento Mercado Pago recusado';
      payload.body = 'Falha no pagamento de ' + amountText + ' (' + v.reference + '). Toque para revisar.';
      payload.data.url = appIndex;
      payload.data.finType = 'mercadopago_failed';
      return payload;
    }
    if (kind === 'cobranca-hoje' || kind === 'cobranca-amanha') {
      var isTomorrow = kind === 'cobranca-amanha';
      var dueDate = isTomorrow ? tomorrow : today;
      var msg = isTomorrow
        ? ('Bom dia ' + v.name + '. Passando para lembrar que sua mensalidade no valor de ' + amountText + ' vence amanha (' + dateBr(dueDate) + ').')
        : ('Bom dia ' + v.name + '. Hoje e o dia da mensalidade no valor de ' + amountText + '.');
      var wa = buildWhatsLink(v.phone, msg);
      payload.title = 'Cobranca de ' + v.name + (isTomorrow ? ' vence amanha! Enviar lembrete?' : ' vence hoje! Enviar lembrete?');
      payload.body = 'Valor pendente: ' + amountText + '. Toque para abrir o WhatsApp com mensagem pronta.';
      payload.data.url = wa || appIndex;
      payload.data.appUrl = appIndex;
      payload.data.finType = 'cobranca_whatsapp_reminder';
      payload.data.clienteNome = v.name;
      payload.data.tipoLembrete = isTomorrow ? 'amanha' : 'hoje';
      payload.actions = [{ action: 'send-reminder', title: 'Enviar lembrete' }];
      return payload;
    }
    if (kind === 'despesa-hoje' || kind === 'despesa-amanha') {
      var tomorrowExpense = kind === 'despesa-amanha';
      payload.title = 'Despesa ' + (tomorrowExpense ? 'vence amanha' : 'vence hoje');
      payload.body = 'Internet - ' + amountText + '. Toque para abrir Despesas.';
      payload.data.url = appDespesas;
      payload.data.appUrl = appDespesas;
      payload.data.finType = 'despesa_due_reminder';
      payload.data.tipoLembrete = tomorrowExpense ? 'amanha' : 'hoje';
      return payload;
    }
    if (kind === 'wallet-zero') {
      payload.title = 'Saldo da carteira zerou';
      payload.body = 'Seu saldo da carteira esta em ' + money(0) + '. Toque para abrir Economias.';
      payload.data.url = appEconomias;
      payload.data.appUrl = appEconomias;
      payload.data.finType = 'wallet_zero';
      return payload;
    }
    if (kind === 'wallet-low') {
      payload.title = 'Saldo da carteira perto de zero';
      payload.body = 'Saldo atual: ' + money(v.wallet) + ' (alerta ate ' + money(50) + '). Toque para abrir Economias.';
      payload.data.url = appEconomias;
      payload.data.appUrl = appEconomias;
      payload.data.finType = 'wallet_low';
      return payload;
    }
    if (kind === 'savings-goal') {
      payload.title = 'Meta de economia atingida';
      payload.body = 'Poupanca em ' + money(v.savings) + ' (meta ' + money(v.goal) + '). Toque para abrir Economias.';
      payload.data.url = appEconomias;
      payload.data.appUrl = appEconomias;
      payload.data.finType = 'savings_goal_reached';
      return payload;
    }
    return payload;
  }

  async function testNotification(kind) {
    if (!canUseNotificationTests()) {
      toast('Notificacoes nao suportadas neste navegador/contexto.', 'warn');
      addLog('warn', 'Tentativa de teste de notificacao sem suporte.', { kind: kind });
      return;
    }

    var permission = String((global.Notification && global.Notification.permission) || 'default');
    if (permission !== 'granted') {
      var result = await requestNotificationPermissionForTests();
      if (result !== 'granted') {
        toast('Permissao de notificacao nao concedida.', 'warn');
        addLog('warn', 'Permissao de notificacao nao concedida para teste.', { result: result, kind: kind });
        return;
      }
    }

    var payload = buildDevNotification(kind);
    setLastNotify(payload);

    var ok = await showLocalNotificationForTest(payload);
    if (!ok) {
      toast('Falha ao disparar notificacao de teste.', 'error');
      addLog('error', 'Falha ao disparar notificacao de teste.', { kind: kind, payload: payload });
      return;
    }

    var labels = {
      'payment-completed-manual': 'Pagamento concluido (manual)',
      'payment-completed-mp': 'Pagamento concluido (Mercado Pago)',
      'mercadopago-failed': 'Pagamento Mercado Pago falhou',
      'cobranca-hoje': 'Cobranca vence hoje',
      'cobranca-amanha': 'Cobranca vence amanha',
      'despesa-hoje': 'Despesa vence hoje',
      'despesa-amanha': 'Despesa vence amanha',
      'wallet-zero': 'Carteira zerada',
      'wallet-low': 'Saldo baixo',
      'savings-goal': 'Meta de economia atingida'
    };
    addLog('ok', 'Notificacao de teste enviada: ' + (labels[kind] || kind), { kind: kind, tag: payload.tag, target: payload.data && (payload.data.url || payload.data.appUrl) });
    toast('Notificacao enviada: ' + (labels[kind] || kind), 'ok');
  }

  function simLabel(kind) {
    if (kind === 'approved') return 'Pagamento aprovado';
    if (kind === 'rejected') return 'Pagamento recusado';
    if (kind === 'pending') return 'Pagamento pendente';
    if (kind === 'duplicate') return 'Webhook duplicado';
    return 'Evento de teste';
  }

  function buildSim(kind) {
    var v = simFormValues();
    var prev = state.sim[0] || null;
    var dup = kind === 'duplicate';
    var paymentId = dup && prev && prev.paymentId ? prev.paymentId : ('SIM-' + Date.now());
    var status = dup ? ((prev && prev.status) || 'approved') : kind;
    return {
      id: rid('sim'),
      createdAt: isoNow(),
      kind: kind,
      label: simLabel(kind),
      status: status,
      amount: Number(v.amount || 0),
      reference: v.reference,
      paymentId: paymentId,
      duplicateOf: dup ? ((prev && prev.id) || null) : null,
      payload: {
        source: 'dev-tools',
        event: dup ? 'webhook.duplicate' : 'payment.status',
        status: status,
        payment_id: paymentId,
        transaction_amount: Number(v.amount || 0),
        external_reference: v.reference,
        created_at: isoNow()
      }
    };
  }

  function dispatchDevEvent(item) {
    try { global.dispatchEvent(new CustomEvent('fin:dev-simulated-event', { detail: item })); } catch (_) {}
    try { localStorage.setItem('fin_dev_last_event_v1', JSON.stringify(item)); } catch (_) {}
  }

  function simulate(kind) {
    var item = buildSim(kind);
    state.sim.unshift(item);
    if (state.sim.length > MAX_SIM) state.sim.length = MAX_SIM;
    saveSim();
    setLastSim(item.payload);
    renderSimHistory();
    dispatchDevEvent(item);
    addLog('info', 'Evento simulado: ' + item.label, { status: item.status, reference: item.reference, paymentId: item.paymentId });
    toast(item.label + ' registrado.', 'ok');
  }

  function clearSimHistory() {
    state.sim = [];
    saveSim();
    setLastSim(null);
    renderSimHistory();
    addLog('ok', 'Historico do simulador limpo.');
  }

  function setAuditLoading() {
    state.audit = [{ key: 'run', label: 'Auditoria em execucao', status: 'loading', summary: 'Executando checagens...', details: [] }];
    renderAudit();
  }

  function renderAudit() {
    var host = el('dev-audit-results');
    if (!host) return;
    if (!state.audit.length) {
      host.innerHTML = '<article class="dev-tools-audit-card is-info"><div class="dev-tools-audit-card-head"><span class="dev-tools-pill is-info">PRONTO</span><strong>Auditoria ainda nao executada</strong></div><p>Clique em "Rodar auditoria" para verificar o ambiente.</p></article>';
      return;
    }
    host.innerHTML = state.audit.map(function (r) {
      var tone = /^(ok|warn|fail|info|loading)$/.test(String(r.status || '')) ? r.status : 'info';
      var details = Array.isArray(r.details) ? r.details : [];
      return [
        '<article class="dev-tools-audit-card is-', esc(tone), '">',
        '<div class="dev-tools-audit-card-head"><span class="dev-tools-pill is-', esc(tone), '">', esc(String(tone).toUpperCase()), '</span><strong>', esc(r.label || 'Checagem'), '</strong></div>',
        '<p>', esc(r.summary || '-'), '</p>',
        details.length ? ('<ul class="dev-tools-audit-details">' + details.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>') : '',
        '</article>'
      ].join('');
    }).join('');
  }

  function fetchTimeout(url, opts, ms) {
    var ctrl = ('AbortController' in global) ? new AbortController() : null;
    var tmr = null;
    var o = Object.assign({}, opts || {});
    if (ctrl) o.signal = ctrl.signal;
    if (ctrl && ms) tmr = setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, ms);
    return fetch(url, o).finally(function () { if (tmr) clearTimeout(tmr); });
  }

  async function auditSensitiveFiles() {
    var list = ['/.env', '/.env.local', '/.git/HEAD', '/.git/config', '/server.js', '/package.json'];
    var exposed = [];
    for (var i = 0; i < list.length; i += 1) {
      try {
        var res = await fetchTimeout(list[i], { cache: 'no-store' }, 3200);
        if (res.status === 200) exposed.push(list[i]);
      } catch (_) {}
    }
    return exposed.length
      ? { key: 'sensitive', label: 'Arquivos sensiveis acessiveis?', status: 'fail', summary: 'Arquivos sensiveis responderam 200.', details: exposed.map(function (p) { return 'Exposto: ' + p; }) }
      : { key: 'sensitive', label: 'Arquivos sensiveis acessiveis?', status: 'ok', summary: 'Nenhum arquivo sensivel comum exposto nas rotas testadas.', details: [] };
  }

  function auditTokens() {
    var findings = [];
    function scan(name, store) {
      if (!store) return;
      for (var i = 0; i < store.length; i += 1) {
        var k = store.key(i);
        if (!k) continue;
        var kl = String(k).toLowerCase();
        var v = String(store.getItem(k) || '');
        var internal = kl === 'auth_sessao' || kl === 'auth_usuarios' || kl.indexOf('fin_dev_') === 0 || kl === 'menu_patch_notes_v1';
        var skey = /(token|secret|api[_-]?key|access[_-]?token|bearer)/i.test(kl);
        var sval = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(v) || /sk_(test|live)|pk_(test|live)|access_token|refresh_token/i.test(v);
        if (skey || sval) findings.push((internal ? '[INFO] ' : '[WARN] ') + name + ' -> ' + k + (internal ? ' (token interno/local)' : ' (revisar)'));
      }
    }
    try { scan('localStorage', localStorage); } catch (_) {}
    try { scan('sessionStorage', sessionStorage); } catch (_) {}
    var html = '';
    try { html = String(doc.documentElement && doc.documentElement.innerHTML || ''); } catch (_) {}
    if (/(sk_(test|live)|access_token\s*[:=]|refresh_token\s*[:=])/i.test(html)) findings.unshift('[FAIL] DOM -> padrao de token/segredo encontrado no HTML');
    var fail = findings.some(function (f) { return f.indexOf('[FAIL]') === 0; });
    var warn = findings.some(function (f) { return f.indexOf('[WARN]') === 0; });
    return findings.length
      ? { key: 'tokens', label: 'Tokens expostos?', status: fail ? 'fail' : (warn ? 'warn' : 'info'), summary: 'Itens suspeitos encontrados para revisao.', details: findings.slice(0, 10) }
      : { key: 'tokens', label: 'Tokens expostos?', status: 'ok', summary: 'Nenhum padrao suspeito encontrado no storage/DOM.', details: [] };
  }

  function auditHttps() {
    var proto = String(global.location.protocol || '');
    var host = String(global.location.hostname || '');
    if (proto === 'https:') return { key: 'https', label: 'HTTPS ativo?', status: 'ok', summary: 'Conexao HTTPS ativa.', details: ['Origem: ' + global.location.origin] };
    if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return { key: 'https', label: 'HTTPS ativo?', status: 'info', summary: 'Rodando em localhost (excecao de desenvolvimento).', details: ['Origem: ' + global.location.origin] };
    return { key: 'https', label: 'HTTPS ativo?', status: 'fail', summary: 'Pagina aberta sem HTTPS.', details: ['Origem: ' + global.location.origin] };
  }

  async function auditCors() {
    var endpoint = '/api/mercadopago/status';
    try {
      var res = await fetchTimeout(endpoint, { cache: 'no-store' }, 4000);
      var acao = res.headers.get('access-control-allow-origin');
      if (acao === '*') return { key: 'cors', label: 'CORS configurado corretamente?', status: 'warn', summary: 'Endpoint respondeu com ACAO=* (revisar exposicao).', details: ['Endpoint: ' + endpoint, 'Status: ' + res.status, 'ACAO: *'] };
      if (acao) return { key: 'cors', label: 'CORS configurado corretamente?', status: 'ok', summary: 'Cabecalho CORS encontrado com origem especifica.', details: ['Endpoint: ' + endpoint, 'Status: ' + res.status, 'ACAO: ' + acao] };
      return { key: 'cors', label: 'CORS configurado corretamente?', status: 'info', summary: 'Sem cabecalho CORS explicito (comum em uso same-origin).', details: ['Endpoint: ' + endpoint, 'Status: ' + res.status] };
    } catch (e) {
      return { key: 'cors', label: 'CORS configurado corretamente?', status: 'warn', summary: 'Nao foi possivel validar o endpoint via navegador.', details: [String(e && e.message || e || 'erro desconhecido')] };
    }
  }

  async function swSummary() {
    if (!('serviceWorker' in navigator)) return { supported: false, registrations: [] };
    var regs = await navigator.serviceWorker.getRegistrations();
    return {
      supported: true,
      controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null,
      registrations: regs.map(function (r) {
        return {
          scope: r.scope,
          active: r.active ? r.active.scriptURL : null,
          waiting: r.waiting ? r.waiting.scriptURL : null,
          installing: r.installing ? r.installing.scriptURL : null
        };
      })
    };
  }

  async function auditSw() {
    if (!('serviceWorker' in navigator)) return { key: 'sw', label: 'Service Worker atualizado?', status: 'info', summary: 'Service Worker nao suportado.', details: [] };
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) return { key: 'sw', label: 'Service Worker atualizado?', status: 'warn', summary: 'Nenhum Service Worker registrado nesta origem.', details: [] };
      try { await regs[0].update(); } catch (_) {}
      var w = !!regs[0].waiting;
      var details = ['Registracoes: ' + regs.length, 'Ativo: ' + (regs[0].active && regs[0].active.scriptURL || '(sem ativo)')];
      if (regs[0].waiting) details.push('Waiting: ' + regs[0].waiting.scriptURL);
      return { key: 'sw', label: 'Service Worker atualizado?', status: w ? 'warn' : 'ok', summary: w ? 'Existe update pendente (waiting).' : 'Sem update pendente no momento.', details: details };
    } catch (e) {
      return { key: 'sw', label: 'Service Worker atualizado?', status: 'warn', summary: 'Falha ao consultar Service Worker.', details: [String(e && e.message || e)] };
    }
  }

  async function runAudit() {
    setAuditLoading();
    setFeedback('Rodando auditoria de seguranca...', 'info');
    addLog('info', 'Auditoria de seguranca iniciada.');
    var results = [];
    try { results.push(await auditSensitiveFiles()); } catch (e1) { results.push({ key: 'sensitive', label: 'Arquivos sensiveis acessiveis?', status: 'warn', summary: 'Falha na checagem.', details: [String(e1)] }); }
    try { results.push(auditTokens()); } catch (e2) { results.push({ key: 'tokens', label: 'Tokens expostos?', status: 'warn', summary: 'Falha na checagem.', details: [String(e2)] }); }
    try { results.push(auditHttps()); } catch (e3) { results.push({ key: 'https', label: 'HTTPS ativo?', status: 'warn', summary: 'Falha na checagem.', details: [String(e3)] }); }
    try { results.push(await auditCors()); } catch (e4) { results.push({ key: 'cors', label: 'CORS configurado corretamente?', status: 'warn', summary: 'Falha na checagem.', details: [String(e4)] }); }
    try { results.push(await auditSw()); } catch (e5) { results.push({ key: 'sw', label: 'Service Worker atualizado?', status: 'warn', summary: 'Falha na checagem.', details: [String(e5)] }); }
    state.audit = results;
    renderAudit();
    var fail = results.some(function (r) { return r.status === 'fail'; });
    var warn = results.some(function (r) { return r.status === 'warn'; });
    var tone = fail ? 'error' : (warn ? 'warn' : 'ok');
    var msg = fail ? 'Auditoria concluida com falhas.' : (warn ? 'Auditoria concluida com alertas.' : 'Auditoria concluida sem problemas criticos.');
    setFeedback(msg, tone);
    addLog(fail ? 'error' : (warn ? 'warn' : 'ok'), msg, { resume: results.map(function (r) { return { key: r.key, status: r.status }; }) });
    toast(msg, tone);
  }

  async function copyAudit() {
    var data = {
      generatedAt: isoNow(),
      href: global.location.href,
      user: state.user || getUser(),
      audit: state.audit,
      sw: await swSummary()
    };
    var txt = JSON.stringify(data, null, 2);
    var ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(txt); ok = true; } } catch (_) {}
    if (!ok) {
      try {
        var ta = doc.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        doc.body.appendChild(ta);
        ta.select();
        ok = !!doc.execCommand('copy');
        ta.remove();
      } catch (_) {}
    }
    addLog(ok ? 'ok' : 'warn', ok ? 'Diagnostico copiado.' : 'Falha ao copiar diagnostico.');
    toast(ok ? 'Diagnostico copiado.' : 'Nao foi possivel copiar o diagnostico.', ok ? 'ok' : 'warn');
  }

  function dumpStorage(store) {
    var out = {};
    if (!store) return out;
    try {
      for (var i = 0; i < store.length; i += 1) {
        var k = store.key(i);
        if (k) out[k] = store.getItem(k);
      }
    } catch (_) {}
    return out;
  }

  function dlJson(name, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 900);
  }

  async function quickAction(action) {
    if (action === 'clear-localstorage') {
      if (!global.confirm('Limpar todo o localStorage desta origem? Isso encerra a sessao atual.')) return;
      try { localStorage.clear(); } catch (_) {}
      toast('localStorage limpo. Redirecionando...', 'warn');
      setTimeout(function () { global.location.href = 'login.html'; }, 400);
      return;
    }
    if (action === 'clear-pwa-cache') {
      if (!('caches' in global)) { toast('Cache API nao suportada.', 'warn'); addLog('warn', 'Cache API nao suportada.'); return; }
      var names = await caches.keys();
      var targets = names.filter(function (n) { return String(n).indexOf('finances-pwa-') === 0; });
      await Promise.all(targets.map(function (n) { return caches.delete(n); }));
      addLog('ok', 'Caches do PWA removidos.', { removed: targets });
      toast('Cache PWA limpo (' + targets.length + ').', 'ok');
      return;
    }
    if (action === 'force-sw-update') {
      if (!('serviceWorker' in navigator)) { toast('Service Worker nao suportado.', 'warn'); addLog('warn', 'SW nao suportado.'); return; }
      var regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) { toast('Nenhum Service Worker registrado.', 'warn'); addLog('warn', 'Nenhuma registracao de SW encontrada.'); return; }
      var waiting = false;
      for (var i = 0; i < regs.length; i += 1) {
        try { await regs[i].update(); } catch (_) {}
        if (regs[i].waiting) { waiting = true; try { regs[i].waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {} }
      }
      addLog('info', 'Forcado update do Service Worker.', { registrations: regs.length, waiting: waiting });
      if (waiting) {
        toast('Update do SW solicitado. Recarregando...', 'ok');
        var fired = false;
        var onChange = function () {
          if (fired) return;
          fired = true;
          navigator.serviceWorker.removeEventListener('controllerchange', onChange);
          global.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onChange);
        setTimeout(function () { if (!fired) global.location.reload(); }, 1800);
      } else toast('SW verificado. Sem update pendente.', 'info');
      return;
    }
    if (action === 'export-data') {
      var snap = { exportedAt: isoNow(), href: global.location.href, user: state.user || getUser(), localStorage: dumpStorage(localStorage), sessionStorage: dumpStorage(sessionStorage), sw: await swSummary(), logs: state.logs.length, simEvents: state.sim.length };
      dlJson('finances-dev-export-' + Date.now() + '.json', snap);
      addLog('ok', 'Dados exportados em JSON.');
      toast('Dados exportados em JSON.', 'ok');
      return;
    }
    if (action === 'show-logs') {
      var card = el('dev-tools-logs-card');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.add('dev-tools-highlight');
        setTimeout(function () { card.classList.remove('dev-tools-highlight'); }, 1200);
      }
      addLog('info', 'Painel de logs aberto pelo atalho.');
      return;
    }
    if (action === 'open-patchnotes') {
      addLog('info', 'Abrindo editor de Patch Notes (menu).');
      global.location.href = 'menu.html?patchnotes=1';
    }
  }

  function bindUi() {
    var btns = doc.querySelectorAll('[data-dev-quick-action]');
    for (var i = 0; i < btns.length; i += 1) {
      btns[i].addEventListener('click', function (e) {
        var action = e.currentTarget.getAttribute('data-dev-quick-action');
        Promise.resolve(quickAction(action)).catch(function (err) {
          addLog('error', 'Falha em acao rapida.', { action: action, error: String(err && err.message || err) });
          toast('Falha na acao rapida.', 'error');
        });
      });
    }
    var simBtns = doc.querySelectorAll('[data-dev-sim]');
    for (var j = 0; j < simBtns.length; j += 1) {
      simBtns[j].addEventListener('click', function (e) {
        simulate(e.currentTarget.getAttribute('data-dev-sim'));
      });
    }
    var notifyBtns = doc.querySelectorAll('[data-dev-notify]');
    for (var k = 0; k < notifyBtns.length; k += 1) {
      notifyBtns[k].addEventListener('click', function (e) {
        var kind = e.currentTarget.getAttribute('data-dev-notify');
        Promise.resolve(testNotification(kind)).catch(function (err) {
          addLog('error', 'Falha no teste de notificacao.', { kind: kind, error: String(err && err.message || err) });
          toast('Falha no teste de notificacao.', 'error');
        });
      });
    }
    if (el('dev-notify-permission')) el('dev-notify-permission').addEventListener('click', function () {
      Promise.resolve(requestNotificationPermissionForTests()).then(function (result) {
        var status = String(result || 'default');
        var tone = status === 'granted' ? 'ok' : (status === 'denied' ? 'warn' : 'info');
        addLog(status === 'granted' ? 'ok' : 'info', 'Permissao de notificacao: ' + status + '.', { result: status });
        toast('Permissao de notificacao: ' + status + '.', tone);
      }).catch(function (err) {
        addLog('error', 'Falha ao solicitar permissao de notificacao.', { error: String(err && err.message || err) });
        toast('Falha ao solicitar permissao.', 'error');
      });
    });
    if (el('dev-notify-copy-payload')) el('dev-notify-copy-payload').addEventListener('click', async function () {
      if (!state.lastNotify) { toast('Nenhuma notificacao simulada para copiar.', 'warn'); return; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(JSON.stringify(state.lastNotify, null, 2));
          addLog('ok', 'Payload da notificacao copiado.');
          toast('Payload da notificacao copiado.', 'ok');
          return;
        }
      } catch (_) {}
      toast('Nao foi possivel copiar o payload.', 'warn');
    });
    if (el('dev-sim-clear-history')) el('dev-sim-clear-history').addEventListener('click', function () {
      if (!global.confirm('Limpar historico do simulador?')) return;
      clearSimHistory();
      toast('Historico do simulador limpo.', 'ok');
    });
    if (el('dev-sim-copy-payload')) el('dev-sim-copy-payload').addEventListener('click', async function () {
      if (!state.last) { toast('Nenhum payload para copiar.', 'warn'); return; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(JSON.stringify(state.last, null, 2));
          addLog('ok', 'Payload copiado.');
          toast('Payload copiado.', 'ok');
          return;
        }
      } catch (_) {}
      toast('Nao foi possivel copiar o payload.', 'warn');
    });
    if (el('dev-audit-run')) el('dev-audit-run').addEventListener('click', function () { Promise.resolve(runAudit()).catch(function (e) { addLog('error', 'Falha ao rodar auditoria.', { error: String(e) }); toast('Falha ao rodar auditoria.', 'error'); }); });
    if (el('dev-audit-copy')) el('dev-audit-copy').addEventListener('click', function () { Promise.resolve(copyAudit()); });
    if (el('dev-logs-export')) el('dev-logs-export').addEventListener('click', function () {
      dlJson('finances-dev-logs-' + Date.now() + '.json', { exportedAt: isoNow(), logs: state.logs, sim: state.sim });
      addLog('ok', 'Logs exportados.');
      toast('Logs exportados.', 'ok');
    });
    if (el('dev-logs-clear')) el('dev-logs-clear').addEventListener('click', function () {
      if (!global.confirm('Limpar logs internos da pagina DEV?')) return;
      state.logs = [];
      saveLogs();
      renderLogs();
      addLog('ok', 'Logs internos limpos.');
      toast('Logs limpos.', 'ok');
    });

    if (el('dev-tools-btn-menu')) el('dev-tools-btn-menu').addEventListener('click', function () {
      var destino = (global.FinCommon && typeof global.FinCommon.resolveMenuHrefWithAutoPatchNotes === 'function')
        ? global.FinCommon.resolveMenuHrefWithAutoPatchNotes('menu.html')
        : 'menu.html';
      global.location.href = destino;
    });
    if (el('dev-tools-btn-patchnotes')) el('dev-tools-btn-patchnotes').addEventListener('click', function () { global.location.href = 'menu.html?patchnotes=1'; });
    if (el('dev-tools-btn-tema')) el('dev-tools-btn-tema').addEventListener('click', function () {
      try {
        if (global.FinCommon && typeof global.FinCommon.alternarTemaExecutivo === 'function') { global.FinCommon.alternarTemaExecutivo(); return; }
        if (typeof global.alternarTemaExecutivo === 'function') { global.alternarTemaExecutivo(); return; }
      } catch (_) {}
      doc.body.classList.toggle('light-mode');
    });
    if (el('dev-tools-btn-sair')) el('dev-tools-btn-sair').addEventListener('click', function () {
      if (typeof global.sairContaUsuario === 'function') { global.sairContaUsuario(); return; }
      global.location.href = 'login.html';
    });

    if (!global.__finDevToolsErrBound) {
      global.addEventListener('error', function (ev) {
        addLog('error', 'window.error: ' + String(ev && ev.message || 'erro em runtime'), { file: ev && ev.filename, line: ev && ev.lineno, col: ev && ev.colno });
      });
      global.addEventListener('unhandledrejection', function (ev) {
        addLog('error', 'unhandledrejection detectado.', { reason: shortJson(ev && ev.reason) });
      });
      global.__finDevToolsErrBound = true;
    }
  }

  function renderUser() {
    state.user = getUser();
    if (el('dev-tools-usuario-nome')) el('dev-tools-usuario-nome').textContent = state.user ? String(state.user.username || 'Usuario') : 'Nao autenticado';
    if (el('dev-tools-usuario-papel')) {
      el('dev-tools-usuario-papel').textContent = !state.user ? 'Sessao protegida' : (state.user.owner ? 'Proprietario' : (state.user.developer ? 'Desenvolvedor' : 'Usuario'));
    }
  }

  function ensureAccess() {
    var u = getUser();
    if (!u) {
      setFeedback('Sessao nao encontrada. Redirecionando para login...', 'warn');
      setTimeout(function () { global.location.href = 'login.html'; }, 600);
      return false;
    }
    if (!isDev(u)) {
      setFeedback('Acesso restrito a perfis DEV/owner.', 'error');
      setTimeout(function () {
        var destino = (global.FinCommon && typeof global.FinCommon.resolveMenuHrefWithAutoPatchNotes === 'function')
          ? global.FinCommon.resolveMenuHrefWithAutoPatchNotes('menu.html')
          : 'menu.html';
        global.location.href = destino;
      }, 1000);
      return false;
    }
    return true;
  }

  function applyTheme() {
    try {
      if (global.FinCommon && typeof global.FinCommon.carregarTemaExecutivo === 'function') { global.FinCommon.carregarTemaExecutivo(); return; }
      if (typeof global.carregarTemaExecutivo === 'function') { global.carregarTemaExecutivo(); }
    } catch (_) {}
  }

  function init() {
    applyTheme();
    renderUser();
    if (!ensureAccess()) return;
    loadLogs();
    loadSim();
    renderLogs();
    renderSimHistory();
    renderLastSim();
    renderLastNotify();
    renderAudit();
    bindUi();
    setFeedback('Painel DEV pronto para uso.', 'ok');
    addLog('info', 'Dev Tools carregado.', { user: state.user && state.user.username });
    if (!global.__finDevToolsI18nBound) {
      global.addEventListener('fin:i18n-change', function () {
        renderUser();
        renderLogs();
        renderSimHistory();
        renderLastSim();
        renderLastNotify();
        renderAudit();
      });
      global.__finDevToolsI18nBound = true;
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
