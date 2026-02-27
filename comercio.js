(function (w) {
  'use strict';

  const C = w.FinCommon;
  if (!C) throw new Error('common.js nÃ£o foi carregado antes de comercio.js');

  const {
    STORAGE, getEl, escapeHtml, formatarMoeda, parseValorInput,
    safeGetItem, safeSetItem, safeGetJSON, safeSetJSON, safeGetNumber,
    limitarHistorico, carregarTema
  } = C;
  const I18n = w.FinI18n;
  const t = (key, fallback, vars) => (I18n && typeof I18n.t === 'function'
    ? I18n.t(key, vars, fallback)
    : (fallback ?? key));
  const localeAtual = () => (I18n && typeof I18n.getLanguage === 'function' ? I18n.getLanguage() : 'pt-BR');

  const KS = {
    saldo: STORAGE.SALDO_CARTEIRA,
    hist: STORAGE.HISTORICO_CARTEIRA,
    cat: STORAGE.COMERCIO_CATALOGO || 'comercio_catalogo',
    vendas: STORAGE.COMERCIO_VENDAS || 'comercio_vendas_dias',
    extratoCom: STORAGE.COMERCIO_EXTRATO || 'comercio_extrato_historico',
    forma: STORAGE.COMERCIO_FORMA_PADRAO || 'comercio_forma_padrao',
    comanda: STORAGE.COMERCIO_COMANDA_ATUAL || 'comercio_comanda_atual'
  };

  const FORMAS = Object.freeze({
    '': { rotulo: 'Nao informar', icone: 'fa-circle-question', i18n: 'comercioPage.paymentMethods.notInformed' },
    pix: { rotulo: 'PIX', icone: 'fa-qrcode', i18n: 'comercioPage.paymentMethods.pix' },
    dinheiro: { rotulo: 'Dinheiro', icone: 'fa-money-bill-wave', i18n: 'comercioPage.paymentMethods.cash' },
    debito: { rotulo: 'Debito', icone: 'fa-credit-card', i18n: 'comercioPage.paymentMethods.debit' },
    credito: { rotulo: 'Credito', icone: 'fa-credit-card', i18n: 'comercioPage.paymentMethods.credit' },
    transferencia: { rotulo: 'Transferencia', icone: 'fa-building-columns', i18n: 'comercioPage.paymentMethods.transfer' },
    boleto: { rotulo: 'Boleto', icone: 'fa-barcode', i18n: 'comercioPage.paymentMethods.boleto' }
  });
  const FORMAS_KEYS = Object.freeze(['pix', 'dinheiro', 'debito', 'credito', 'transferencia', 'boleto']);
  const FILTRO_TODOS = 'todos';
  const FILTRO_SEM_FORMA = 'sem_forma';

  const CATALOGO_PADRAO = Object.freeze([
    { id: 'agua-500', nome: 'Ãgua 500ml', preco: 4 },
    { id: 'refri-lata', nome: 'Refrigerante lata', preco: 7 },
    { id: 'cafe', nome: 'CafÃ©', preco: 5 },
    { id: 'salgado', nome: 'Salgado', preco: 9 },
    { id: 'suco', nome: 'Suco', preco: 8 },
    { id: 'bolo-fatia', nome: 'Bolo (fatia)', preco: 10 },
    { id: 'combo-lanche', nome: 'Combo lanche', preco: 24.9 },
    { id: 'almoco', nome: 'AlmoÃ§o', preco: 28 }
  ]);

  let catalogo = [];
  let vendasState = { dias: {} };
  let extratoComercioState = [];
  let formaPadrao = '';
  let filtroForma = FILTRO_TODOS;
  let buscaCatalogo = '';
  let periodoRelatorio = '7dias';
  let periodoRelatorioItens = '7dias';
  let comanda = { titulo: '', formaPagamento: '', desconto: 0, acrescimo: 0, itens: [] };
  let dialogState = null;
  let secaoAbaAtiva = 'vendas';

  const id = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const n2 = v => Number((Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(2));
  const parseMoney = v => n2(parseValorInput(v));
  const hojeKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const inicioHojeTs = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const keyTs = k => {
    const m = String(k).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN;
  };
  const hora = ts => new Date(Number(ts) || Date.now()).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' });
  const dataHoje = () => new Date().toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  const normForma = v => {
    const raw = String(v ?? '').trim().toLowerCase();
    if (!raw) return '';
    const k = (raw.normalize ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : raw).replace(/\s+/g, '_').replace(/-/g, '_');
    return Object.prototype.hasOwnProperty.call(FORMAS, k) ? k : '';
  };
  const metaForma = k => {
    const base = FORMAS[normForma(k)] || FORMAS[''];
    return { ...base, rotulo: base?.i18n ? t(base.i18n, base.rotulo) : String(base?.rotulo || '') };
  };
  const badgeForma = k => {
    const f = normForma(k);
    if (!f) return '';
    const m = metaForma(f);
    return `<span class="comercio-badge-forma"><i class="fa-solid ${m.icone}" aria-hidden="true"></i><span>${escapeHtml(m.rotulo)}</span></span>`;
  };
  const normBuscaTexto = (v) => String(v ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const txt = (key, fallback, vars) => t(`comercioPage.${key}`, fallback, vars);
  const txtSales = q => txt('units.sales', '{q} sale(s)', { q });
  const txtItems = q => txt('units.items', '{q} item(s)', { q });
  const txtUnitsShort = q => txt('units.unitsShort', '{q} u.', { q });
  const txtDays = q => txt('units.days', '{q} day(s)', { q });
  const txtTicket = valor => txt('common.ticketAverage', 'Average ticket: {valor}', { valor });
  const dataHoraLocal = (ts) => new Date(Number(ts) || Date.now()).toLocaleString(localeAtual(), {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const dataRefFormatada = (dataRef) => {
    const m = String(dataRef || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '--/--/----';
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(localeAtual(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  function setText(selector, key, fallback, vars) {
    const el = w.document.querySelector(selector);
    if (!el) return;
    el.textContent = txt(key, fallback, vars);
  }

  function setAttr(selector, attr, key, fallback, vars) {
    const el = w.document.querySelector(selector);
    if (!el) return;
    el.setAttribute(attr, txt(key, fallback, vars));
  }

  function setInlineLabel(selector, key, fallback) {
    const el = w.document.querySelector(selector);
    if (!el) return;
    const target = el.querySelector('select, .comercio-catalogo-busca-wrap');
    if (!target) return;
    let span = el.querySelector('[data-fin-inline-label="1"]');
    if (!span) {
      span = w.document.createElement('span');
      span.setAttribute('data-fin-inline-label', '1');
      el.insertBefore(span, target);
    }
    span.textContent = txt(key, fallback);
    for (const node of [...el.childNodes]) {
      if (node === span || node === target) continue;
      if (node.nodeType === 3) node.textContent = '';
    }
  }

  function applyStaticI18nComercio() {
    if (w.document?.title != null) w.document.title = txt('meta.title', 'Commerce Mode | Finances');

    setText('.comercio-kicker', 'header.kicker', 'Modo comercio');
    setText('.comercio-header-textos h1', 'header.title', 'Central de vendas');
    setText('.comercio-subtitulo', 'header.subtitle', 'Monte uma comanda com varios itens, aplique desconto/acrescimo e exporte manualmente para o extrato da carteira.');
    setText('#btn-comercio-abrir-economias span', 'header.buttons.economias', 'Economias');

    setAttr('.comercio-resumo', 'aria-label', 'summary.aria', 'Resumo de vendas do dia');
    setText('.comercio-resumo-card:nth-child(1) > span', 'summary.cards.totalDay', 'Total do dia');
    setText('.comercio-resumo-card:nth-child(2) > span', 'summary.cards.pendingExport', 'Pendentes para exportar');
    setText('.comercio-resumo-card:nth-child(3) > span', 'summary.cards.itemsSoldToday', 'Itens vendidos hoje');
    setText('.comercio-resumo-card:nth-child(4) > span', 'summary.cards.date', 'Data');

    setAttr('.comercio-relatorios-wrap', 'aria-label', 'reports.aria', 'Relatorios diario e semanal');
    setText('.comercio-relatorios-wrap .comercio-section-header h2', 'reports.title', 'Relatorios');
    setText('.comercio-relatorios-wrap .comercio-section-header p', 'reports.subtitle', 'Resumo diario e semanal com totais, pendencias e formas de pagamento.');
    setInlineLabel('.comercio-relatorios-wrap label[for="comercio-relatorio-periodo"]', 'reports.detailPeriod', 'Detalhar periodo');
    setText('.comercio-relatorio-card:nth-child(1) > span', 'reports.cards.todayTotal', 'Hoje • Total');
    setText('.comercio-relatorio-card:nth-child(2) > span', 'reports.cards.todayPending', 'Hoje • Pendente');
    setText('.comercio-relatorio-card:nth-child(3) > span', 'reports.cards.weekTotal', '7 dias • Total');
    setText('.comercio-relatorio-card:nth-child(4) > span', 'reports.cards.weekPending', '7 dias • Pendente');

    setAttr('.comercio-painel', 'aria-label', 'panel.aria', 'Configuracoes rapidas');
    setText('#btn-comercio-toggle-form-item span', 'catalog.addButton', 'Adicionar ao catalogo');
    setText('#comercio-form-item .comercio-form-item-popover-header strong', 'catalog.newItemTitle', 'Novo item');
    setText('#comercio-form-item .comercio-form-item-popover-header p', 'catalog.newItemSubtitle', 'Cadastre nome, preco e custo opcional.');
    setAttr('#btn-comercio-fechar-form-item', 'aria-label', 'catalog.closeItemFormAria', 'Fechar cadastro de item');
    setAttr('#comercio-item-nome', 'placeholder', 'catalog.placeholders.name', 'Ex.: Agua 500ml');
    setAttr('#comercio-item-preco', 'placeholder', 'catalog.placeholders.price', 'Preco (ex.: 5,00)');
    setAttr('#comercio-item-custo', 'placeholder', 'catalog.placeholders.cost', 'Custo (opcional)');
    setText('#btn-comercio-cancelar-form-item span', 'dialogs.cancel', 'Cancelar');
    setText('#comercio-form-item .comercio-btn-add span', 'common.saveItem', 'Salvar item');

    setText('.comercio-grid-wrap .comercio-section-header h2', 'catalog.sectionTitle', 'Itens (placas)');
    setText('.comercio-grid-wrap .comercio-section-header p', 'catalog.sectionSubtitle', 'Toque nos blocos para adicionar a comanda atual.');
    setInlineLabel('.comercio-grid-wrap label[for="comercio-catalogo-busca"]', 'catalog.searchLabel', 'Buscar produto');
    setAttr('#comercio-catalogo-busca', 'placeholder', 'catalog.searchPlaceholder', 'Digite o nome do item');
    setAttr('#btn-comercio-limpar-busca', 'aria-label', 'catalog.clearSearch', 'Limpar busca');
    setAttr('#btn-comercio-limpar-busca', 'title', 'catalog.clearSearch', 'Limpar busca');

    setAttr('.comercio-comanda-wrap', 'aria-label', 'order.aria', 'Comanda atual');
    setText('.comercio-comanda-wrap .comercio-section-header h2', 'order.title', 'Comanda atual');
    setText('#btn-comercio-limpar-comanda span', 'order.clear', 'Limpar comanda');
    setText('#btn-comercio-finalizar-comanda span', 'order.finishSale', 'Fechar venda');
    setText('label[for="comercio-comanda-titulo"]', 'order.identificationOptional', 'Identificacao (opcional)');
    setAttr('#comercio-comanda-titulo', 'placeholder', 'order.identificationPlaceholder', 'Ex.: Mesa 3 / Cliente Joao');
    setText('label[for="comercio-comanda-forma"]', 'order.paymentMethod', 'Forma de pagamento');
    setText('label[for="comercio-comanda-desconto"]', 'order.discount', 'Desconto (R$)');
    setText('label[for="comercio-comanda-acrescimo"]', 'order.increase', 'Acrescimo (R$)');
    setText('.comercio-comanda-totais > div:nth-child(1) > span', 'order.totals.subtotal', 'Subtotal');
    setText('.comercio-comanda-totais > div:nth-child(2) > span', 'order.totals.discount', 'Desconto');
    setText('.comercio-comanda-totais > div:nth-child(3) > span', 'order.totals.increase', 'Acrescimo');
    setText('.comercio-comanda-total-final > span', 'order.totals.finalTotal', 'Total final');

    setAttr('.comercio-secoes-tabs-wrap', 'aria-label', 'tabs.aria', 'Abas de vendas e extrato');
    setAttr('.comercio-secoes-tabs', 'aria-label', 'tabs.switchAria', 'Alternar entre vendas, extrato e relatorio de itens');
    setText('#btn-comercio-tab-vendas span', 'tabs.salesDay', 'Lista de vendas do dia');
    setText('#btn-comercio-tab-extrato span', 'tabs.statement', 'Extrato do comercio');
    setText('#btn-comercio-tab-itens span', 'tabs.itemsReport', 'Relatorio de itens');

    setText('#comercio-panel-vendas .comercio-section-header h2', 'sales.listTitle', 'Lista de vendas do dia');
    setText('#btn-comercio-limpar-exportadas span', 'sales.clearExported', 'Limpar exportadas');

    setAttr('#comercio-panel-extrato', 'aria-label', 'statement.aria', 'Extrato do comercio');
    setText('#comercio-panel-extrato .comercio-section-header h2', 'statement.title', 'Extrato do comercio');
    setText('#comercio-panel-extrato .comercio-section-header p', 'statement.subtitle', 'Historico consolidado das vendas do modo comercio, com custo e lucro estimado.');
    setText('#btn-comercio-exportar span', 'statement.exportButton', 'Exportar para extrato');
    setText('.comercio-extrato-resumo-card:nth-child(1) > span', 'statement.cards.revenue', 'Receita');
    setText('.comercio-extrato-resumo-card:nth-child(2) > span', 'statement.cards.cost', 'Custo');
    setText('.comercio-extrato-resumo-card:nth-child(3) > span', 'statement.cards.profit', 'Lucro estimado');
    setText('.comercio-extrato-resumo-card:nth-child(4) > span', 'statement.cards.exportedPending', 'Exportadas / Pendentes');

    setAttr('#comercio-panel-itens', 'aria-label', 'itemsReport.aria', 'Relatorio de itens');
    setText('#comercio-panel-itens .comercio-section-header h2', 'itemsReport.title', 'Relatorio de itens');
    setText('#comercio-panel-itens .comercio-section-header p', 'itemsReport.subtitle', 'Desempenho por item com base nas vendas do modo comercio.');
    setInlineLabel('#comercio-panel-itens label[for="comercio-itens-periodo"]', 'itemsReport.periodLabel', 'Periodo');
    setText('.comercio-itens-insights-card:nth-child(1) > span', 'itemsReport.cards.topSold', 'Item mais vendido');
    setText('.comercio-itens-insights-card:nth-child(2) > span', 'itemsReport.cards.topProfit', 'Item mais lucrativo');
    setText('.comercio-itens-insights-card:nth-child(3) > span', 'itemsReport.cards.topRevenue', 'Maior faturamento');
    setText('.comercio-itens-insights-card:nth-child(4) > span', 'itemsReport.cards.itemsWithSales', 'Itens com vendas');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(1) h3', 'itemsReport.blocks.rankQty', 'Ranking por quantidade');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(1) .comercio-itens-insights-bloco-header span', 'itemsReport.blocks.top5', 'Top 5');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(2) h3', 'itemsReport.blocks.rankProfit', 'Ranking por lucro');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(2) .comercio-itens-insights-bloco-header span', 'itemsReport.blocks.top5', 'Top 5');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(3) h3', 'itemsReport.blocks.lowTurnover', 'Itens com baixo giro');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(3) .comercio-itens-insights-bloco-header span', 'itemsReport.blocks.lowestOutput', 'Menor saida');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(4) h3', 'itemsReport.blocks.periodSummary', 'Resumo do periodo');
    setText('#comercio-panel-itens .comercio-itens-insights-bloco:nth-child(4) .comercio-itens-insights-bloco-header span', 'itemsReport.blocks.revenueVsCost', 'Receita x custo');
  }

  function syncBuscaCatalogoUi() {
    const input = getEl('comercio-catalogo-busca');
    const btnLimpar = getEl('btn-comercio-limpar-busca');
    const valor = String(buscaCatalogo || '');
    if (input && input.value !== valor) input.value = valor;
    if (btnLimpar) btnLimpar.hidden = !valor;
  }

  function normCatalogoItem(it) {
    const nome = String(it?.nome ?? '').trim();
    const preco = n2(it?.preco);
    const custo = Math.max(0, n2(it?.custo));
    if (!nome || preco <= 0) return null;
    return { id: String(it?.id ?? id('item')), nome, preco, custo };
  }

  function normItem(it) {
    const nome = String(it?.nome ?? '').trim();
    const precoUnitario = n2(it?.precoUnitario);
    const custoUnitario = Math.max(0, n2(it?.custoUnitario));
    const quantidade = Math.max(1, Math.floor(Number(it?.quantidade) || 1));
    if (!nome || precoUnitario <= 0) return null;
    return { id: String(it?.id ?? id('ci')), itemId: String(it?.itemId ?? ''), nome, precoUnitario, custoUnitario, quantidade };
  }

  const custoVenda = v => n2((Array.isArray(v?.itens) ? v.itens : []).reduce((a, it) => a + (Math.max(0, n2(it?.custoUnitario)) * Math.max(1, Number(it?.quantidade) || 1)), 0));
  const lucroVenda = v => n2(n2(v?.total) - custoVenda(v));
  const todasVendas = () => Object.values(vendasState?.dias || {}).flatMap(lista => Array.isArray(lista) ? lista.map(normVenda).filter(Boolean) : []);

  function sumComanda(c) {
    let subtotal = 0, custo = 0, itens = 0;
    for (const it of (Array.isArray(c?.itens) ? c.itens : [])) {
      subtotal += n2(it.precoUnitario) * Math.max(1, Number(it.quantidade) || 1);
      custo += Math.max(0, n2(it.custoUnitario)) * Math.max(1, Number(it.quantidade) || 1);
      itens += Math.max(1, Number(it.quantidade) || 1);
    }
    subtotal = n2(subtotal);
    custo = n2(custo);
    const desconto = Math.max(0, n2(c?.desconto));
    const acrescimo = Math.max(0, n2(c?.acrescimo));
    const total = n2(Math.max(0, subtotal - desconto + acrescimo));
    const lucro = n2(total - custo);
    return { subtotal, custo, lucro, desconto, acrescimo, total, itens };
  }

  function normComanda(raw) {
    const r = (raw && typeof raw === 'object') ? raw : {};
    return {
      titulo: String(r.titulo ?? '').trim(),
      formaPagamento: normForma(r.formaPagamento) || normForma(formaPadrao),
      desconto: Math.max(0, n2(r.desconto)),
      acrescimo: Math.max(0, n2(r.acrescimo)),
      itens: (Array.isArray(r.itens) ? r.itens.map(normItem).filter(Boolean) : [])
    };
  }

  function normVenda(raw) {
    const r = (raw && typeof raw === 'object') ? raw : {};
    let itens = Array.isArray(r.itens) ? r.itens.map(normItem).filter(Boolean) : [];
    if (!itens.length) {
      const nome = String(r.nome ?? '').trim();
      const precoUnitario = n2(r.precoUnitario);
      const custoUnitario = Math.max(0, n2(r.custoUnitario));
      const quantidade = Math.max(1, Math.floor(Number(r.quantidade) || 1));
      if (nome && precoUnitario > 0) itens = [{ id: id('ci'), itemId: String(r.itemId ?? ''), nome, precoUnitario, custoUnitario, quantidade }];
    }
    if (!itens.length) return null;
    const subtotalCalc = n2(itens.reduce((a, it) => a + it.precoUnitario * it.quantidade, 0));
    const custoCalc = custoVenda({ itens });
    let subtotal = n2(r.subtotal);
    let desconto = Math.max(0, n2(r.desconto));
    let acrescimo = Math.max(0, n2(r.acrescimo));
    let total = n2(r.total);
    let custoTotal = Math.max(0, n2(r.custoTotal));
    let lucroEstimado = n2(r.lucroEstimado);
    if (subtotal <= 0) subtotal = subtotalCalc;
    if (total <= 0) total = n2(Math.max(0, subtotal - desconto + acrescimo));
    if (total <= 0) { subtotal = subtotalCalc; desconto = 0; acrescimo = 0; total = subtotalCalc; }
    if (custoTotal <= 0) custoTotal = custoCalc;
    lucroEstimado = n2(total - custoTotal);
    return {
      id: String(r.id ?? id('venda')),
      criadoEm: Number(r.criadoEm) || Date.now(),
      exportado: Boolean(r.exportado),
      exportadoEm: r.exportado ? (Number(r.exportadoEm) || Date.now()) : null,
      formaPagamento: normForma(r.formaPagamento),
      titulo: String(r.titulo ?? '').trim(),
      itens, subtotal, custoTotal, lucroEstimado, desconto, acrescimo, total
    };
  }

  function normState(raw) {
    const s = (raw && typeof raw === 'object') ? raw : {};
    const dias = {};
    for (const [k, v] of Object.entries(s.dias || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(v)) continue;
      const n = v.map(normVenda).filter(Boolean);
      if (n.length) dias[k] = n;
    }
    return { dias };
  }

  function normExtratoComercioRegistro(raw) {
    const r = (raw && typeof raw === 'object') ? raw : {};
    const total = n2(r.total);
    const custoTotal = Math.max(0, n2(r.custoTotal));
    const lucroEstimado = n2(r.lucroEstimado ?? (total - custoTotal));
    if (total <= 0) return null;
    const formas = {};
    for (const [k, v] of Object.entries(r.formas || {})) {
      const key = normForma(k) || FILTRO_SEM_FORMA;
      const val = n2(v);
      if (val > 0) formas[key] = n2((formas[key] || 0) + val);
    }
    const vendasResumo = Array.isArray(r.vendasResumo)
      ? r.vendasResumo.map(v => ({
          titulo: String(v?.titulo ?? '').trim() || txt('sales.fallbackSale', 'Venda'),
          total: n2(v?.total),
          formaPagamento: normForma(v?.formaPagamento),
          itens: Math.max(0, Math.floor(Number(v?.itens) || 0))
        })).filter(v => v.total > 0)
      : [];
    return {
      id: String(r.id ?? id('expcom')),
      timestamp: Number(r.timestamp) || Date.now(),
      dataRef: /^\d{4}-\d{2}-\d{2}$/.test(String(r.dataRef || '')) ? String(r.dataRef) : hojeKey(),
      total,
      custoTotal,
      lucroEstimado,
      quantidadeVendas: Math.max(1, Math.floor(Number(r.quantidadeVendas) || vendasResumo.length || 1)),
      quantidadeItens: Math.max(0, Math.floor(Number(r.quantidadeItens) || 0)),
      formas,
      vendasResumo
    };
  }

  function vendasDia(key = hojeKey()) { return Array.isArray(vendasState.dias[key]) ? vendasState.dias[key] : []; }
  function setVendasDia(lista, key = hojeKey()) {
    const n = (Array.isArray(lista) ? lista : []).map(normVenda).filter(Boolean);
    if (n.length) vendasState.dias[key] = n; else delete vendasState.dias[key];
    safeSetJSON(KS.vendas, vendasState);
  }
  function saveCatalogo() { safeSetJSON(KS.cat, catalogo); }
  function saveExtratoComercio() { safeSetJSON(KS.extratoCom, extratoComercioState); }
  function saveComanda() { safeSetJSON(KS.comanda, comanda); }

  function feedback(msg, tipo = 'info') {
    const el = getEl('comercio-feedback');
    if (!el) return;
    el.textContent = msg || '';
    el.dataset.tipo = tipo;
    el.classList.toggle('visivel', Boolean(msg));
    if (!msg) return;
    clearTimeout(feedback.t);
    feedback.t = setTimeout(() => { if (el.textContent === msg) el.classList.remove('visivel'); }, 3600);
  }

  function ensureComercioDialogUi() {
    if (dialogState?.root?.isConnected) return dialogState;

    const root = w.document.createElement('div');
    root.className = 'comercio-ui-modal-backdrop';
    root.hidden = true;
    root.innerHTML = `
      <div class="comercio-ui-modal-card" role="dialog" aria-modal="true" aria-labelledby="comercio-ui-modal-titulo">
        <button type="button" class="comercio-ui-modal-fechar" aria-label="${escapeHtml(txt('dialogs.close', 'Fechar'))}">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <h3 id="comercio-ui-modal-titulo" class="comercio-ui-modal-titulo"></h3>
        <p class="comercio-ui-modal-texto"></p>
        <form class="comercio-ui-modal-form" novalidate>
          <div class="comercio-ui-modal-campos"></div>
          <div class="comercio-ui-modal-acoes">
            <button type="button" class="comercio-ui-modal-btn comercio-ui-modal-btn-sec" data-acao="cancelar">${escapeHtml(txt('dialogs.cancel', 'Cancelar'))}</button>
            <button type="submit" class="comercio-ui-modal-btn comercio-ui-modal-btn-pri" data-acao="confirmar">OK</button>
          </div>
        </form>
      </div>`;
    w.document.body.appendChild(root);

    const refs = {
      root,
      card: root.querySelector('.comercio-ui-modal-card'),
      titulo: root.querySelector('.comercio-ui-modal-titulo'),
      texto: root.querySelector('.comercio-ui-modal-texto'),
      form: root.querySelector('.comercio-ui-modal-form'),
      campos: root.querySelector('.comercio-ui-modal-campos'),
      btnCancelar: root.querySelector('[data-acao="cancelar"]'),
      btnConfirmar: root.querySelector('[data-acao="confirmar"]'),
      btnFechar: root.querySelector('.comercio-ui-modal-fechar')
    };

    const resolveDialog = (payload) => {
      if (!dialogState?.pending) return;
      const pending = dialogState.pending;
      dialogState.pending = null;
      root.hidden = true;
      root.classList.remove('is-open');
      refs.campos.innerHTML = '';
      refs.form.dataset.type = '';
      pending.resolve(payload);
    };

    root.addEventListener('click', (ev) => {
      if (ev.target === root) resolveDialog({ confirmed: false, reason: 'backdrop' });
    });
    refs.btnFechar?.addEventListener('click', () => resolveDialog({ confirmed: false, reason: 'close' }));
    refs.btnCancelar?.addEventListener('click', () => resolveDialog({ confirmed: false, reason: 'cancel' }));
    root.addEventListener('keydown', (ev) => {
      if (!dialogState?.pending) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        resolveDialog({ confirmed: false, reason: 'escape' });
      }
    });
    refs.form?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!dialogState?.pending) return;
      const fields = Array.isArray(dialogState.pending.fields) ? dialogState.pending.fields : [];
      const values = {};
      for (const f of fields) {
        const input = refs.form.querySelector(`[name="${f.name}"]`);
        if (!input) continue;
        const val = String(input.value ?? '');
        if (f.required && !val.trim()) {
          input.focus();
          input.select?.();
          return;
        }
        values[f.name] = val;
      }
      if (!fields.length) {
        resolveDialog({ confirmed: true });
        return;
      }
      resolveDialog({ confirmed: true, values });
    });

    dialogState = { ...refs, pending: null };
    return dialogState;
  }

  function openComercioDialog(cfg) {
    const ui = ensureComercioDialogUi();
    if (ui.pending) {
      ui.pending.resolve({ confirmed: false, reason: 'replaced' });
      ui.pending = null;
    }

    const title = String(cfg?.title || txt('dialogs.confirmTitle', 'Confirmar'));
    const message = String(cfg?.message || '');
    const confirmText = String(cfg?.confirmText || 'OK');
    const cancelText = String(cfg?.cancelText || txt('dialogs.cancel', 'Cancelar'));
    const fields = Array.isArray(cfg?.fields) ? cfg.fields : [];
    const danger = Boolean(cfg?.danger);

    ui.titulo.textContent = title;
    ui.texto.textContent = message;
    ui.texto.hidden = !message;
    ui.campos.innerHTML = '';
    ui.form.dataset.type = fields.length ? 'form' : 'confirm';
    ui.btnConfirmar.textContent = confirmText;
    ui.btnCancelar.textContent = cancelText;
    ui.btnConfirmar.classList.toggle('is-danger', danger);
    ui.btnCancelar.hidden = cfg?.showCancel === false;

    for (const field of fields) {
      const wrap = w.document.createElement('label');
      wrap.className = 'comercio-ui-modal-campo';
      if (field.label) {
        const sp = w.document.createElement('span');
        sp.className = 'comercio-ui-modal-campo-label';
        sp.textContent = String(field.label);
        wrap.appendChild(sp);
      }
      const input = w.document.createElement(field.multiline ? 'textarea' : 'input');
      input.className = 'comercio-ui-modal-input';
      input.name = String(field.name || '');
      if (!field.multiline) input.type = String(field.type || 'text');
      if (field.placeholder != null) input.placeholder = String(field.placeholder);
      if (field.inputmode != null) input.setAttribute('inputmode', String(field.inputmode));
      if (field.maxlength != null) input.maxLength = Number(field.maxlength) || -1;
      if (field.required) input.required = true;
      input.value = field.value == null ? '' : String(field.value);
      wrap.appendChild(input);
      ui.campos.appendChild(wrap);
    }

    ui.root.hidden = false;
    ui.root.classList.add('is-open');

    const firstInput = ui.campos.querySelector('.comercio-ui-modal-input');
    w.setTimeout(() => {
      if (firstInput) {
        firstInput.focus();
        if (typeof firstInput.select === 'function') firstInput.select();
      } else {
        ui.btnConfirmar.focus();
      }
    }, 0);

    return new Promise((resolve) => {
      ui.pending = { resolve, fields };
    });
  }

  async function comercioConfirm(message, opts = {}) {
    const res = await openComercioDialog({
      title: opts.title || txt('dialogs.confirmationTitle', 'Confirmacao'),
      message: String(message || ''),
      confirmText: opts.confirmText || txt('dialogs.confirm', 'Confirmar'),
      cancelText: opts.cancelText || txt('dialogs.cancel', 'Cancelar'),
      danger: Boolean(opts.danger),
      showCancel: opts.showCancel !== false
    });
    return Boolean(res?.confirmed);
  }

  async function comercioPromptTriploItem(item) {
    const res = await openComercioDialog({
      title: txt('catalog.editItemTitle', 'Editar item'),
      message: txt('catalog.editItemMessage', 'Atualize nome, preco e custo do item.'),
      confirmText: txt('common.save', 'Salvar'),
      cancelText: txt('dialogs.cancel', 'Cancelar'),
      fields: [
        { name: 'nome', label: txt('catalog.itemNameLabel', 'Nome do item'), value: item?.nome || '', required: true, maxlength: 48 },
        { name: 'preco', label: txt('catalog.priceLabel', 'Preco (R$)'), value: String(item?.preco ?? '').replace('.', ','), inputmode: 'decimal', required: true, maxlength: 16 },
        { name: 'custo', label: txt('catalog.costOptionalLabel', 'Custo (R$) - opcional'), value: (item?.custo > 0 ? String(item.custo).replace('.', ',') : ''), inputmode: 'decimal', maxlength: 16 }
      ]
    });
    return res;
  }

  function bindCadastroItemPopover() {
    const wrap = getEl('btn-comercio-toggle-form-item')?.closest('.comercio-form-item-wrap');
    const trigger = getEl('btn-comercio-toggle-form-item');
    const pop = getEl('comercio-form-item');
    const btnFechar = getEl('btn-comercio-fechar-form-item');
    const btnCancelar = getEl('btn-comercio-cancelar-form-item');
    const nomeEl = getEl('comercio-item-nome');
    if (!wrap || !trigger || !pop) return;

    const setOpen = (open) => {
      pop.hidden = !open;
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        w.setTimeout(() => { nomeEl?.focus(); nomeEl?.select?.(); }, 0);
      }
    };

    trigger.addEventListener('click', () => setOpen(pop.hidden));
    btnFechar?.addEventListener('click', () => setOpen(false));
    btnCancelar?.addEventListener('click', () => setOpen(false));

    w.document.addEventListener('click', (ev) => {
      if (pop.hidden) return;
      if (wrap.contains(ev.target)) return;
      setOpen(false);
    });

    w.document.addEventListener('keydown', (ev) => {
      if (!pop.hidden && ev.key === 'Escape') setOpen(false);
    });

    pop.__finClosePopover = () => setOpen(false);
    pop.__finOpenPopover = () => setOpen(true);
  }

  function setAbaSecaoComercio(aba) {
    const alvo = (aba === 'extrato' || aba === 'itens') ? aba : 'vendas';
    secaoAbaAtiva = alvo;
    const tabs = w.document.querySelectorAll('[data-comercio-sec-tab]');
    const paineis = w.document.querySelectorAll('[data-comercio-sec-panel]');

    tabs.forEach((btn) => {
      const ativa = btn.getAttribute('data-comercio-sec-tab') === alvo;
      btn.classList.toggle('is-active', ativa);
      btn.setAttribute('aria-selected', ativa ? 'true' : 'false');
      btn.tabIndex = ativa ? 0 : -1;
    });

    paineis.forEach((panel) => {
      panel.hidden = panel.getAttribute('data-comercio-sec-panel') !== alvo;
    });
  }

  function bindAbasSecoesComercio() {
    const tabs = w.document.querySelectorAll('[data-comercio-sec-tab]');
    if (!tabs.length) return;
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => setAbaSecaoComercio(btn.getAttribute('data-comercio-sec-tab')));
      btn.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        ev.preventDefault();
        const lista = [...tabs];
        const idx = lista.indexOf(btn);
        if (idx < 0) return;
        const prox = ev.key === 'ArrowRight'
          ? lista[(idx + 1) % lista.length]
          : lista[(idx - 1 + lista.length) % lista.length];
        prox?.focus();
        if (prox) setAbaSecaoComercio(prox.getAttribute('data-comercio-sec-tab'));
      });
    });
    setAbaSecaoComercio(secaoAbaAtiva);
  }

  function fillSelect(idEl, opts, selected) {
    const el = getEl(idEl);
    if (!el) return;
    el.innerHTML = opts.map(op => `<option value="${escapeHtml(op.value)}"${op.value === selected ? ' selected' : ''}>${escapeHtml(op.label)}</option>`).join('');
  }

  function renderFiltrosEFormas() {
    fillSelect('comercio-forma-padrao',
      [{ value: '', label: metaForma('').rotulo }, ...FORMAS_KEYS.map(k => ({ value: k, label: metaForma(k).rotulo }))],
      formaPadrao);
    fillSelect('comercio-comanda-forma',
      [{ value: '', label: metaForma('').rotulo }, ...FORMAS_KEYS.map(k => ({ value: k, label: metaForma(k).rotulo }))],
      normForma(comanda.formaPagamento));
    fillSelect('comercio-filtro-forma-vendas', [
      { value: FILTRO_TODOS, label: txt('filters.allMethods', 'Todos os metodos') },
      { value: FILTRO_SEM_FORMA, label: txt('filters.noMethod', 'Sem metodo informado') },
      ...FORMAS_KEYS.map(k => ({ value: k, label: metaForma(k).rotulo }))
    ], filtroForma);
    fillSelect('comercio-relatorio-periodo', [
      { value: 'hoje', label: txt('periods.today', 'Hoje') },
      { value: '7dias', label: txt('periods.last7Days', 'Ultimos 7 dias') }
    ], periodoRelatorio);
    fillSelect('comercio-itens-periodo', [
      { value: '7dias', label: txt('periods.last7Days', 'Ultimos 7 dias') },
      { value: '15dias', label: txt('periods.last15Days', 'Ultimos 15 dias') },
      { value: '30dias', label: txt('periods.last30Days', 'Ultimos 30 dias') }
    ], periodoRelatorioItens);
  }

  function renderCatalogo() {
    const grid = getEl('comercio-catalogo-grid');
    if (!grid) return;

    syncBuscaCatalogoUi();

    if (!catalogo.length) {
      grid.innerHTML = `<p class="comercio-vazio">${escapeHtml(txt('catalog.empty', 'Nenhum item no catalogo.'))}</p>`;
      return;
    }

    const termo = normBuscaTexto(buscaCatalogo);
    const itensFiltrados = termo
      ? catalogo.filter(item => normBuscaTexto(item?.nome).includes(termo))
      : catalogo;

    if (!itensFiltrados.length) {
      grid.innerHTML = `<p class="comercio-vazio">${escapeHtml(txt('catalog.notFound', 'Nenhum produto encontrado para "{termo}".', { termo: String(buscaCatalogo || '') }))}</p>`;
      return;
    }

    grid.innerHTML = itensFiltrados.map(item => `
      <article class="comercio-item-card">
        <button type="button" class="comercio-item-adicionar" data-acao="adicionar-item" data-item-id="${escapeHtml(item.id)}">
          <span class="comercio-item-nome">${escapeHtml(item.nome)}</span>
          <span class="comercio-item-preco">${escapeHtml(formatarMoeda(item.preco))}</span>
          <span class="comercio-item-custo">${escapeHtml(txt('catalog.costLabel', 'Custo: {valor}', { valor: formatarMoeda(Math.max(0, n2(item.custo))) }))}</span>
          <span class="comercio-item-hint"><i class="fa-solid fa-plus"></i> ${escapeHtml(txt('catalog.addToOrder', 'Adicionar a comanda'))}</span>
        </button>
        <div class="comercio-item-card-acoes">
          <button type="button" class="comercio-mini-btn" data-acao="editar-item" data-item-id="${escapeHtml(item.id)}"><i class="fa-solid fa-pen"></i><span>${escapeHtml(txt('common.edit', 'Editar'))}</span></button>
          <button type="button" class="comercio-mini-btn comercio-mini-btn-danger" data-acao="remover-item" data-item-id="${escapeHtml(item.id)}"><i class="fa-solid fa-trash"></i><span>${escapeHtml(txt('common.remove', 'Remover'))}</span></button>
        </div>
      </article>`).join('');
  }

  function syncVisibilidadeComanda() {
    const layoutEl = w.document?.querySelector('.comercio-operacao-layout');
    const comandaEl = w.document?.querySelector('.comercio-comanda-wrap');
    if (!layoutEl || !comandaEl) return;
    const visivel = Array.isArray(comanda?.itens) && comanda.itens.length > 0;
    comandaEl.hidden = !visivel;
    comandaEl.setAttribute('aria-hidden', visivel ? 'false' : 'true');
    layoutEl.classList.toggle('sem-comanda', !visivel);
  }

  function renderComanda() {
    syncVisibilidadeComanda();
    const t = sumComanda(comanda);
    const tituloEl = getEl('comercio-comanda-titulo');
    const formaEl = getEl('comercio-comanda-forma');
    const descontoEl = getEl('comercio-comanda-desconto');
    const acrescimoEl = getEl('comercio-comanda-acrescimo');
    if (tituloEl) tituloEl.value = comanda.titulo || '';
    if (formaEl) formaEl.value = normForma(comanda.formaPagamento);
    if (descontoEl) descontoEl.value = t.desconto > 0 ? t.desconto.toFixed(2).replace('.', ',') : '';
    if (acrescimoEl) acrescimoEl.value = t.acrescimo > 0 ? t.acrescimo.toFixed(2).replace('.', ',') : '';

    const binds = [
      ['comercio-comanda-subtotal', formatarMoeda(t.subtotal)],
      ['comercio-comanda-desconto-total', formatarMoeda(t.desconto)],
      ['comercio-comanda-acrescimo-total', formatarMoeda(t.acrescimo)],
      ['comercio-comanda-total-final', formatarMoeda(t.total)]
    ];
    for (const [idEl, text] of binds) { const el = getEl(idEl); if (el) el.textContent = text; }
    const resumo = getEl('comercio-comanda-resumo-texto');
    if (resumo) resumo.textContent = comanda.itens.length
      ? txt('order.summaryShort', '{itens} • {total} • {forma}', {
          itens: txtItems(t.itens),
          total: formatarMoeda(t.total),
          forma: metaForma(comanda.formaPagamento).rotulo
        })
      : txt('order.emptyHint', 'Monte a comanda tocando nos itens acima.');

    const ul = getEl('comercio-comanda-itens');
    if (resumo && comanda.itens.length) {
      resumo.textContent = txt('order.summaryFull', '{itens} | {total} | custo {custo} | lucro {lucro} | {forma}', {
        itens: txtItems(t.itens),
        total: formatarMoeda(t.total),
        custo: formatarMoeda(t.custo),
        lucro: formatarMoeda(t.lucro),
        forma: metaForma(comanda.formaPagamento).rotulo
      });
    }
    if (!ul) return;
    if (!comanda.itens.length) { ul.innerHTML = `<li class="comercio-vazio">${escapeHtml(txt('order.empty', 'A comanda esta vazia.'))}</li>`; return; }
    ul.innerHTML = comanda.itens.map(it => `
      <li class="comercio-comanda-item">
        <div class="comercio-comanda-item-main">
          <strong>${escapeHtml(it.nome)}</strong>
          <small>${escapeHtml(txt('order.eachPrice', '{valor} cada', { valor: formatarMoeda(it.precoUnitario) }))}${Math.max(0, n2(it.custoUnitario)) > 0 ? ` | ${escapeHtml(txt('order.costInline', 'custo {valor}', { valor: formatarMoeda(Math.max(0, n2(it.custoUnitario))) }))}` : ''}</small>
        </div>
        <div class="comercio-comanda-item-lado">
          <span class="comercio-comanda-item-total">${escapeHtml(formatarMoeda(n2(it.precoUnitario * it.quantidade)))}</span>
          <div class="comercio-comanda-item-acoes">
            <button type="button" class="comercio-mini-btn" data-acao="diminuir-comanda-item" data-comanda-item-id="${escapeHtml(it.id)}">-</button>
            <span class="comercio-comanda-item-qtd">${escapeHtml(String(it.quantidade))}</span>
            <button type="button" class="comercio-mini-btn" data-acao="aumentar-comanda-item" data-comanda-item-id="${escapeHtml(it.id)}">+</button>
            <button type="button" class="comercio-mini-btn comercio-mini-btn-danger" data-acao="remover-comanda-item" data-comanda-item-id="${escapeHtml(it.id)}">${escapeHtml(txt('common.exclude', 'Excluir'))}</button>
          </div>
        </div>
      </li>`).join('');
  }

  const vendaItensQtd = v => (Array.isArray(v.itens) ? v.itens : []).reduce((a, it) => a + Math.max(1, Number(it.quantidade) || 1), 0);
  const vendaRotulo = v => {
    if (String(v.titulo || '').trim()) return v.titulo.trim();
    const itens = Array.isArray(v.itens) ? v.itens : [];
    if (!itens.length) return txt('sales.fallbackSale', 'Venda');
    if (itens.length === 1) return itens[0].quantidade > 1 ? `${itens[0].nome} x${itens[0].quantidade}` : itens[0].nome;
    return `${itens[0].nome} + ${txtItems(Math.max(0, vendaItensQtd(v) - itens[0].quantidade))}`;
  };
  const vendaAjustes = v => {
    const p = [];
    if (n2(v.desconto) > 0) p.push(txt('sales.discountShort', 'Desc. {valor}', { valor: formatarMoeda(v.desconto) }));
    if (n2(v.acrescimo) > 0) p.push(txt('sales.increaseShort', 'Acresc. {valor}', { valor: formatarMoeda(v.acrescimo) }));
    return p.join(' • ');
  };
  const matchFiltro = v => {
    if (filtroForma === FILTRO_TODOS) return true;
    const f = normForma(v.formaPagamento);
    if (filtroForma === FILTRO_SEM_FORMA) return !f;
    return f === filtroForma;
  };

  function renderResumoTopo() {
    const dia = vendasDia();
    let total = 0, pend = 0, itens = 0;
    for (const v of dia) {
      total += n2(v.total);
      itens += vendaItensQtd(v);
      if (!v.exportado) pend += n2(v.total);
    }
    const binds = [
      ['comercio-total-dia', formatarMoeda(n2(total))],
      ['comercio-total-pendente', formatarMoeda(n2(pend))],
      ['comercio-total-itens', String(itens)],
      ['comercio-data-hoje', dataHoje()]
    ];
    for (const [k, v] of binds) { const el = getEl(k); if (el) el.textContent = v; }
    const p = getEl('comercio-resumo-vendas-texto');
    if (p) p.textContent = dia.length
      ? txt('sales.daySummary', '{vendas} no dia • {pendente} pendente(s) de exportacao.', {
          vendas: txtSales(dia.length),
          pendente: formatarMoeda(n2(pend))
        })
      : txt('sales.noneLaunchedYet', 'Nenhuma venda lancada ainda.');
  }

  function renderVendas() {
    const ul = getEl('comercio-vendas-lista');
    if (!ul) return;
    const dia = vendasDia().slice().sort((a, b) => b.criadoEm - a.criadoEm);
    const list = dia.filter(matchFiltro);
    if (!list.length) {
      ul.innerHTML = `<li class="comercio-vazio">${escapeHtml(dia.length
        ? txt('sales.noneMatchFilter', 'Nenhuma venda corresponde ao filtro selecionado.')
        : txt('sales.noneToday', 'Nenhuma venda registrada hoje.'))}</li>`;
      renderResumoTopo();
      renderExtratoComercio();
      renderRelatorioItens();
      return;
    }
    ul.innerHTML = list.map(v => {
      const itensHtml = (v.itens || []).map(it => `<li><span>${escapeHtml(it.nome)}${it.quantidade > 1 ? ` x${it.quantidade}` : ''}</span><strong>${escapeHtml(formatarMoeda(n2(it.precoUnitario * it.quantidade)))}</strong></li>`).join('');
      const ajustes = vendaAjustes(v);
      return `<li class="comercio-venda-item ${v.exportado ? 'is-exportado' : 'is-pendente'}">
        <div class="comercio-venda-main">
          <div class="comercio-venda-topo">
            <strong class="comercio-venda-nome">${escapeHtml(vendaRotulo(v))}</strong>
            ${badgeForma(v.formaPagamento)}
            <span class="comercio-venda-status">${escapeHtml(v.exportado ? txt('statuses.exported', 'Exportado') : txt('statuses.pending', 'Pendente'))}</span>
          </div>
          <div class="comercio-venda-meta">
            <span>${escapeHtml(hora(v.criadoEm))}</span><span>•</span><span>${escapeHtml(txtItems(vendaItensQtd(v)))}</span><span>•</span><span>${escapeHtml(txt('sales.subtotalLabel', 'Subtotal: {valor}', { valor: formatarMoeda(v.subtotal) }))}</span>${ajustes ? `<span>•</span><span>${escapeHtml(ajustes)}</span>` : ''}
          </div>
          <ul class="comercio-venda-itens-detalhe">${itensHtml}</ul>
        </div>
        <div class="comercio-venda-lado">
          <div class="comercio-venda-valor">${escapeHtml(formatarMoeda(v.total))}</div>
          <div class="comercio-venda-acoes">
            <button type="button" class="comercio-mini-btn" data-acao="usar-modelo-venda" data-venda-id="${escapeHtml(v.id)}">${escapeHtml(txt('sales.useTemplate', 'Usar modelo'))}</button>
            <button type="button" class="comercio-mini-btn comercio-mini-btn-danger" data-acao="remover-venda" data-venda-id="${escapeHtml(v.id)}">${escapeHtml(txt('common.exclude', 'Excluir'))}</button>
          </div>
        </div>
      </li>`;
    }).join('');
    renderResumoTopo();
    renderExtratoComercio();
    renderRelatorioItens();
  }

  function renderExtratoComercio() {
    const listaEl = getEl('comercio-extrato-lista');
    if (!listaEl) return;

    const lista = (Array.isArray(extratoComercioState) ? extratoComercioState : [])
      .slice()
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
      .slice(0, 120);

    const resumo = lista.reduce((acc, r) => {
      acc.total += n2(r.total);
      acc.custo += Math.max(0, n2(r.custoTotal));
      acc.lucro += n2(r.lucroEstimado);
      return acc;
    }, { total: 0, custo: 0, lucro: 0 });
    resumo.total = n2(resumo.total);
    resumo.custo = n2(resumo.custo);
    resumo.lucro = n2(resumo.lucro);

    const exportadas = lista.length;
    const pendentes = vendasDia().filter(v => !v.exportado).length;

    const binds = [
      ['comercio-extrato-total', formatarMoeda(resumo.total)],
      ['comercio-extrato-custo', formatarMoeda(resumo.custo)],
      ['comercio-extrato-lucro', formatarMoeda(resumo.lucro)],
      ['comercio-extrato-status', `${exportadas} / ${pendentes}`],
      ['comercio-extrato-meta-texto', txt('statement.recordsCount', '{q} registro(s){sufixo}', {
        q: lista.length,
        sufixo: (lista.length >= 120 ? txt('statement.last120Suffix', ' (ultimos 120)') : '')
      })]
    ];
    for (const [idEl, text] of binds) { const el = getEl(idEl); if (el) el.textContent = text; }

    if (!lista.length) {
      listaEl.innerHTML = `<li class="comercio-vazio">${escapeHtml(txt('statement.empty', 'Nenhuma exportacao consolidada registrada no extrato do comercio ainda.'))}</li>`;
      return;
    }

    listaEl.innerHTML = lista.map(r => {
      const custo = Math.max(0, n2(r.custoTotal));
      const lucro = n2(r.lucroEstimado);
      const dataHora = dataHoraLocal(r.timestamp);
      const formasLista = Object.entries(r.formas || {})
        .map(([k, v]) => ({ k, v: n2(v), meta: k === FILTRO_SEM_FORMA ? metaForma('') : metaForma(k) }))
        .filter(x => x.v > 0)
        .sort((a, b) => b.v - a.v);
      const formasChips = formasLista.map(f => `<span class="comercio-badge-forma"><i class="fa-solid ${f.meta.icone}" aria-hidden="true"></i><span>${escapeHtml(f.meta.rotulo)}</span></span>`).join('');
      const vendasResumo = (Array.isArray(r.vendasResumo) ? r.vendasResumo : []).map(vs => `
        <li>
          <span>${escapeHtml(vs.titulo)}${vs.itens > 0 ? ` (${escapeHtml(txtItems(vs.itens))})` : ``}${vs.formaPagamento ? ` | ${escapeHtml(metaForma(vs.formaPagamento).rotulo)}` : ``}</span>
          <strong>${escapeHtml(formatarMoeda(vs.total))}</strong>
        </li>`).join('');
      const dataRefBr = dataRefFormatada(r.dataRef);
      return `<li class="comercio-extrato-item is-exportado">
        <details>
          <summary class="comercio-extrato-summary">
            <div class="comercio-extrato-summary-main">
              <strong class="comercio-extrato-titulo">${escapeHtml(txt('statement.batchExportTitle', 'Exportacao consolidada - {data}', { data: dataRefBr }))}</strong>
              <div class="comercio-extrato-meta-linha">
                <span>${escapeHtml(dataHora)}</span>
                <span>|</span>
                <span>${escapeHtml(txtSales(r.quantidadeVendas))}</span>
                <span>|</span>
                <span>${escapeHtml(txtItems(r.quantidadeItens))}</span>
                ${formasChips}
                <span class="comercio-extrato-status-badge">${escapeHtml(txt('statuses.exported', 'Exportado'))}</span>
              </div>
            </div>
            <div class="comercio-extrato-summary-valores">
              <strong>${escapeHtml(formatarMoeda(r.total))}</strong>
              <small>${escapeHtml(txt('statement.profitLabel', 'Lucro: {valor}', { valor: formatarMoeda(lucro) }))}</small>
            </div>
          </summary>
          <div class="comercio-extrato-body">
            <div class="comercio-extrato-totais-linha">
              <span>${escapeHtml(txt('statement.totals.sales', 'Vendas'))}: <strong>${r.quantidadeVendas}</strong></span>
              <span>${escapeHtml(txt('statement.totals.items', 'Itens'))}: <strong>${r.quantidadeItens}</strong></span>
              <span>${escapeHtml(txt('statement.totals.revenue', 'Receita'))}: <strong>${escapeHtml(formatarMoeda(r.total))}</strong></span>
              <span>${escapeHtml(txt('statement.totals.cost', 'Custo'))}: <strong>${escapeHtml(formatarMoeda(custo))}</strong></span>
              <span>${escapeHtml(txt('statement.totals.profit', 'Lucro'))}: <strong class="${lucro >= 0 ? 'ok' : 'neg'}">${escapeHtml(formatarMoeda(lucro))}</strong></span>
            </div>
            <ul class="comercio-venda-itens-detalhe">${vendasResumo || `<li><span>${escapeHtml(txt('statement.noBatchSummary', 'Sem resumo das vendas desse lote'))}</span><strong>-</strong></li>`}</ul>
          </div>
        </details>
      </li>`;
    }).join('');
  }

  function periodoDiasFromKey(periodo) {
    const raw = String(periodo || '').toLowerCase();
    if (raw === 'hoje') return 1;
    const m = raw.match(/^(\d+)\s*dias?$/);
    const n = m ? Number(m[1]) : 7;
    return Math.max(1, Math.min(365, Number.isFinite(n) ? n : 7));
  }

  function nomeItemKey(it) {
    const nome = String(it?.nome || '').trim().toLowerCase();
    return (it?.itemId ? `id:${String(it.itemId)}` : `nome:${nome}`) || `tmp:${Math.random()}`;
  }

  function analisarItensPorPeriodo(periodoKey) {
    const vendas = vendasPeriodo(periodoKey);
    const agg = new Map();

    for (const venda of vendas) {
      for (const it of (Array.isArray(venda?.itens) ? venda.itens : [])) {
        const qtd = Math.max(1, Number(it.quantidade) || 1);
        const receita = n2(n2(it.precoUnitario) * qtd);
        const custo = n2(Math.max(0, n2(it.custoUnitario)) * qtd);
        const lucro = n2(receita - custo);
        const key = nomeItemKey(it);
        const atual = agg.get(key) || {
          key,
          itemId: String(it.itemId || ''),
          nome: String(it.nome || txt('itemsReport.genericItem', 'Item')),
          quantidade: 0,
          vendas: 0,
          receita: 0,
          custo: 0,
          lucro: 0
        };
        atual.quantidade += qtd;
        atual.vendas += 1;
        atual.receita = n2(atual.receita + receita);
        atual.custo = n2(atual.custo + custo);
        atual.lucro = n2(atual.lucro + lucro);
        if (!atual.itemId && it.itemId) atual.itemId = String(it.itemId);
        if ((!atual.nome || atual.nome === txt('itemsReport.genericItem', 'Item')) && it.nome) atual.nome = String(it.nome);
        agg.set(key, atual);
      }
    }

    const vendidos = [...agg.values()].sort((a, b) =>
      b.quantidade - a.quantidade ||
      b.receita - a.receita ||
      a.nome.localeCompare(b.nome, localeAtual())
    );

    const porLucro = [...agg.values()].sort((a, b) =>
      b.lucro - a.lucro ||
      b.quantidade - a.quantidade ||
      a.nome.localeCompare(b.nome, localeAtual())
    );

    const porReceita = [...agg.values()].sort((a, b) =>
      b.receita - a.receita ||
      b.quantidade - a.quantidade ||
      a.nome.localeCompare(b.nome, localeAtual())
    );

    const catalogoMerge = new Map();
    for (const c of catalogo) {
      const key = c.id ? `id:${String(c.id)}` : `nome:${String(c.nome || '').trim().toLowerCase()}`;
      catalogoMerge.set(key, {
        key,
        itemId: String(c.id || ''),
        nome: String(c.nome || txt('itemsReport.genericItem', 'Item')),
        quantidade: 0,
        vendas: 0,
        receita: 0,
        custo: 0,
        lucro: 0
      });
    }
    for (const r of agg.values()) {
      const k = r.itemId ? `id:${r.itemId}` : `nome:${String(r.nome || '').trim().toLowerCase()}`;
      catalogoMerge.set(k, { ...(catalogoMerge.get(k) || {}), ...r });
    }
    const catalogoComStats = [...catalogoMerge.values()];
    const itensSemVendaCatalogo = catalogoComStats.filter(i => i.quantidade === 0).length;
    const itensBaixaSaidaCatalogo = catalogoComStats.filter(i => i.quantidade > 0 && i.quantidade <= 2).length;
    const baixoGiro = [...catalogoComStats].sort((a, b) =>
      a.quantidade - b.quantidade ||
      a.receita - b.receita ||
      a.nome.localeCompare(b.nome, localeAtual())
    );

    const resumo = vendidos.reduce((acc, r) => {
      acc.itensVendidos += 1;
      acc.unidades += r.quantidade;
      acc.receita = n2(acc.receita + r.receita);
      acc.custo = n2(acc.custo + r.custo);
      acc.lucro = n2(acc.lucro + r.lucro);
      return acc;
    }, { vendas: vendas.length, itensVendidos: 0, unidades: 0, receita: 0, custo: 0, lucro: 0 });

    return {
      vendas,
      resumo,
      itensSemVendaCatalogo,
      itensBaixaSaidaCatalogo,
      topQtd: vendidos[0] || null,
      topLucro: porLucro[0] || null,
      topReceita: porReceita[0] || null,
      rankingQtd: vendidos.slice(0, 5),
      rankingLucro: porLucro.slice(0, 5),
      baixoGiro: baixoGiro.slice(0, 5)
    };
  }

  function renderListaInsightItens(idEl, lista, tipo) {
    const el = getEl(idEl);
    if (!el) return;
    if (!Array.isArray(lista) || !lista.length) {
      el.innerHTML = `<li class="comercio-vazio">${escapeHtml(txt('itemsReport.noData', 'Sem dados suficientes no periodo.'))}</li>`;
      return;
    }
    el.innerHTML = lista.map((r, idx) => {
      let meta = '';
      if (tipo === 'qtd') meta = `${txtUnitsShort(r.quantidade)} • ${formatarMoeda(r.receita)}`;
      if (tipo === 'lucro') meta = `${formatarMoeda(r.lucro)} • ${txtUnitsShort(r.quantidade)}`;
      if (tipo === 'baixo') meta = `${txtUnitsShort(r.quantidade)} • ${txtSales(r.vendas)}`;
      if (tipo === 'resumo') meta = '';
      return `<li class="comercio-itens-insights-item">
        <div class="comercio-itens-insights-item-main">
          <span class="comercio-itens-insights-rank">${tipo === 'resumo' ? '•' : String(idx + 1)}</span>
          <div class="comercio-itens-insights-item-textos">
            <strong>${escapeHtml(r.nome || '-')}</strong>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
          </div>
        </div>
        <div class="comercio-itens-insights-item-lado">
          ${tipo === 'qtd' ? `<strong>${escapeHtml(txtUnitsShort(r.quantidade))}</strong>` : ''}
          ${tipo === 'lucro' ? `<strong>${escapeHtml(formatarMoeda(r.lucro))}</strong>` : ''}
          ${tipo === 'baixo' ? `<strong>${escapeHtml(txtUnitsShort(r.quantidade))}</strong>` : ''}
        </div>
      </li>`;
    }).join('');
  }

  function renderRelatorioItens() {
    const periodo = String(periodoRelatorioItens || '7dias');
    const analise = analisarItensPorPeriodo(periodo);
    const dias = periodoDiasFromKey(periodo);

    const topQtd = analise.topQtd;
    const topLucro = analise.topLucro;
    const topReceita = analise.topReceita;

    const binds = [
      ['comercio-itens-top-qtd-nome', topQtd ? topQtd.nome : '-'],
      ['comercio-itens-top-qtd-meta', topQtd ? `${txtUnitsShort(topQtd.quantidade)} • ${txtSales(topQtd.vendas)}` : txtUnitsShort(0)],
      ['comercio-itens-top-lucro-nome', topLucro ? topLucro.nome : '-'],
      ['comercio-itens-top-lucro-meta', topLucro ? formatarMoeda(topLucro.lucro) : 'R$ 0,00'],
      ['comercio-itens-top-receita-nome', topReceita ? topReceita.nome : '-'],
      ['comercio-itens-top-receita-meta', topReceita ? formatarMoeda(topReceita.receita) : 'R$ 0,00'],
      ['comercio-itens-total-vendidos', String(analise.resumo.itensVendidos)],
      ['comercio-itens-total-unidades', txt('itemsReport.unitsInPeriod', '{q} un. no periodo', { q: analise.resumo.unidades })],
      ['comercio-itens-periodo-resumo', `${txtSales(analise.resumo.vendas)} • ${txtDays(dias)}`]
    ];
    for (const [idEl, txt] of binds) { const el = getEl(idEl); if (el) el.textContent = txt; }

    renderListaInsightItens('comercio-itens-ranking-qtd', analise.rankingQtd, 'qtd');
    renderListaInsightItens('comercio-itens-ranking-lucro', analise.rankingLucro, 'lucro');
    renderListaInsightItens('comercio-itens-baixo-giro', analise.baixoGiro, 'baixo');

    const resumoEl = getEl('comercio-itens-resumo-periodo');
    if (resumoEl) {
      const rows = [
        { nome: txt('itemsReport.summary.totalRevenue', 'Receita total'), valor: formatarMoeda(analise.resumo.receita) },
        { nome: txt('itemsReport.summary.totalCost', 'Custo total'), valor: formatarMoeda(analise.resumo.custo) },
        { nome: txt('itemsReport.summary.estimatedProfit', 'Lucro estimado'), valor: formatarMoeda(analise.resumo.lucro) },
        { nome: txt('itemsReport.summary.ticketPerSale', 'Ticket medio por venda'), valor: analise.resumo.vendas ? formatarMoeda(n2(analise.resumo.receita / analise.resumo.vendas)) : 'R$ 0,00' },
        { nome: txt('itemsReport.summary.lowTurnoverItems', 'Itens com baixa saida (<= 2 un.)'), valor: String(analise.itensBaixaSaidaCatalogo || 0) },
        { nome: txt('itemsReport.summary.itemsWithoutSales', 'Itens sem venda no catalogo'), valor: String(analise.itensSemVendaCatalogo || 0) }
      ];
      resumoEl.innerHTML = rows.map(r => `<li class="comercio-itens-insights-item is-resumo"><div class="comercio-itens-insights-item-textos"><strong>${escapeHtml(r.nome)}</strong></div><div class="comercio-itens-insights-item-lado"><strong>${escapeHtml(r.valor)}</strong></div></li>`).join('');
    }
  }

  function vendasPeriodo(periodo) {
    const fim = inicioHojeTs();
    const dias = periodoDiasFromKey(periodo);
    const ini = fim - ((dias - 1) * 86400000);
    const out = [];
    for (const [k, lista] of Object.entries(vendasState.dias || {})) {
      const ts = keyTs(k);
      if (!Number.isFinite(ts) || ts < ini || ts > fim || !Array.isArray(lista)) continue;
      for (const v of lista) { const n = normVenda(v); if (n) out.push(n); }
    }
    return out;
  }

  function resumir(lista) {
    const r = { total: 0, custo: 0, lucro: 0, pendente: 0, exportado: 0, vendas: 0, itens: 0, ticket: 0, porForma: {} };
    for (const v of (lista || [])) {
      const t = n2(v.total);
      const c = Math.max(0, n2(v.custoTotal || custoVenda(v)));
      const f = normForma(v.formaPagamento) || FILTRO_SEM_FORMA;
      r.total += t; r.custo += c; r.lucro += (t - c); r.vendas += 1; r.itens += vendaItensQtd(v);
      if (v.exportado) r.exportado += t; else r.pendente += t;
      r.porForma[f] = n2((r.porForma[f] || 0) + t);
    }
    r.total = n2(r.total); r.custo = n2(r.custo); r.lucro = n2(r.lucro); r.pendente = n2(r.pendente); r.exportado = n2(r.exportado); r.ticket = r.vendas ? n2(r.total / r.vendas) : 0;
    return r;
  }

  function renderRelatorios() {
    const h = resumir(vendasPeriodo('hoje'));
    const s = resumir(vendasPeriodo('7dias'));
    const p = resumir(vendasPeriodo(periodoRelatorio));
    const binds = [
      ['comercio-rel-hoje-total', formatarMoeda(h.total)],
      ['comercio-rel-hoje-pendente', formatarMoeda(h.pendente)],
      ['comercio-rel-hoje-meta', `${txtSales(h.vendas)} • ${txtItems(h.itens)}`],
      ['comercio-rel-hoje-ticket', txtTicket(formatarMoeda(h.ticket))],
      ['comercio-rel-semana-total', formatarMoeda(s.total)],
      ['comercio-rel-semana-pendente', formatarMoeda(s.pendente)],
      ['comercio-rel-semana-meta', `${txtSales(s.vendas)} • ${txtItems(s.itens)}`],
      ['comercio-rel-semana-ticket', txtTicket(formatarMoeda(s.ticket))]
    ];
    for (const [k, v] of binds) { const el = getEl(k); if (el) el.textContent = v; }
    const tit = getEl('comercio-relatorio-formas-titulo');
    const rs = getEl('comercio-relatorio-formas-resumo');
    if (tit) tit.textContent = txt('reports.paymentMethodsTitle', 'Formas de pagamento • {periodo}', {
      periodo: periodoRelatorio === 'hoje' ? txt('periods.today', 'Hoje') : txt('periods.last7Days', 'Ultimos 7 dias')
    });
    if (rs) rs.textContent = `${txtSales(p.vendas)} • ${formatarMoeda(p.total)}`;
    const ul = getEl('comercio-relatorio-formas-lista');
    if (!ul) return;
    const linhas = Object.entries(p.porForma).map(([k, v]) => ({ k, v: n2(v), meta: k === FILTRO_SEM_FORMA ? metaForma('') : metaForma(k) }))
      .sort((a, b) => b.v - a.v || a.meta.rotulo.localeCompare(b.meta.rotulo, localeAtual()));
    if (!linhas.length) { ul.innerHTML = `<li class="comercio-vazio">${escapeHtml(txt('reports.noSalesSelectedPeriod', 'Sem vendas no periodo selecionado.'))}</li>`; return; }
    ul.innerHTML = linhas.map(l => `<li class="comercio-relatorio-forma-item"><span class="comercio-relatorio-forma-label"><i class="fa-solid ${l.meta.icone}" aria-hidden="true"></i><span>${escapeHtml(l.meta.rotulo)}</span></span><strong>${escapeHtml(formatarMoeda(l.v))}</strong></li>`).join('');
  }

  function salvarCamposComandaDaUI() {
    comanda.titulo = String(getEl('comercio-comanda-titulo')?.value || '').trim();
    comanda.formaPagamento = normForma(getEl('comercio-comanda-forma')?.value);
    comanda.desconto = Math.max(0, parseMoney(getEl('comercio-comanda-desconto')?.value || ''));
    comanda.acrescimo = Math.max(0, parseMoney(getEl('comercio-comanda-acrescimo')?.value || ''));
    saveComanda();
  }

  function addItemComanda(item) {
    if (!item) return;
    const ex = comanda.itens.find(i => i.itemId === item.id && n2(i.precoUnitario) === n2(item.preco));
    if (ex) ex.quantidade = Math.max(1, Number(ex.quantidade || 1) + 1);
    else comanda.itens.push({ id: id('ci'), itemId: item.id, nome: item.nome, precoUnitario: n2(item.preco), custoUnitario: Math.max(0, n2(item.custo)), quantidade: 1 });
    if (!comanda.formaPagamento && formaPadrao) comanda.formaPagamento = formaPadrao;
    saveComanda(); renderComanda(); feedback(txt('feedback.itemAddedToOrder', 'Item adicionado a comanda: {nome}.', { nome: item.nome }), 'success');
  }

  function finalizaComanda() {
    salvarCamposComandaDaUI();
    if (!comanda.itens.length) return feedback(txt('order.empty', 'A comanda esta vazia.'), 'danger');
    const t = sumComanda(comanda);
    if (t.total <= 0) return feedback(txt('order.totalMustBePositive', 'O total final precisa ser maior que zero.'), 'danger');
    const venda = normVenda({
      id: id('venda'),
      criadoEm: Date.now(),
      exportado: false,
      formaPagamento: comanda.formaPagamento || formaPadrao || '',
      titulo: comanda.titulo,
      itens: comanda.itens.map(i => ({ ...i, id: id('ci') })),
      subtotal: t.subtotal, custoTotal: t.custo, lucroEstimado: t.lucro, desconto: t.desconto, acrescimo: t.acrescimo, total: t.total
    });
    const dia = vendasDia(); dia.unshift(venda); setVendasDia(dia);
    comanda = { titulo: '', formaPagamento: comanda.formaPagamento || formaPadrao || '', desconto: 0, acrescimo: 0, itens: [] };
    saveComanda();
    renderComanda(); renderVendas(); renderRelatorios();
    feedback(txt('feedback.saleRecorded', 'Venda registrada ({valor}).', { valor: formatarMoeda(venda.total) }), 'success');
  }

  function descExtrato(v) {
    const titulo = String(v.titulo || '').trim();
    if (titulo) return `${txt('statement.modePrefix', 'Modo Comercio')}: ${titulo}${vendaAjustes(v) ? ` (${vendaAjustes(v)})` : ''}`;
    const itens = Array.isArray(v.itens) ? v.itens : [];
    if (!itens.length) return txt('statement.modePrefix', 'Modo Comercio');
    if (itens.length === 1) return `${txt('statement.modePrefix', 'Modo Comercio')}: ${itens[0].nome}${itens[0].quantidade > 1 ? ` x${itens[0].quantidade}` : ''}${vendaAjustes(v) ? ` (${vendaAjustes(v)})` : ''}`;
    const prev = itens.slice(0, 2).map(i => `${i.nome}${i.quantidade > 1 ? ` x${i.quantidade}` : ''}`).join(', ');
    const rest = Math.max(0, itens.length - 2);
    return `${txt('statement.modePrefix', 'Modo Comercio')}: ${prev}${rest ? ` +${txtItems(rest)}` : ''}${vendaAjustes(v) ? ` (${vendaAjustes(v)})` : ''}`;
  }

  function histExtrato(v) {
    const ts = Number(v.criadoEm) || Date.now();
    const d = new Date(ts);
    const h = {
      tipo: 'depositar',
      valor: n2(v.total),
      descricao: descExtrato(v),
      categoria: 'modo_comercio',
      timestamp: ts,
      data: d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    };
    const f = normForma(v.formaPagamento); if (f) h.formaPagamento = f;
    return h;
  }

  function histExtratoConsolidado(vendas) {
    const lista = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
    const ts = Date.now();
    const d = new Date(ts);
    const total = n2(lista.reduce((a, v) => a + n2(v.total), 0));
    const itens = lista.reduce((a, v) => a + vendaItensQtd(v), 0);
    const formas = [...new Set(lista.map(v => normForma(v.formaPagamento)).filter(Boolean))];
    const h = {
      tipo: 'depositar',
      valor: total,
      descricao: txt('statement.exportToWalletDescription', 'Modo Comercio: Exportacao consolidada ({vendas}, {itens})', {
        vendas: txtSales(lista.length),
        itens: txtItems(itens)
      }),
      categoria: 'modo_comercio',
      timestamp: ts,
      data: d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    };
    if (formas.length === 1) h.formaPagamento = formas[0];
    return h;
  }

  function registroExtratoComercioConsolidado(vendas) {
    const lista = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
    const total = n2(lista.reduce((a, v) => a + n2(v.total), 0));
    const custoTotal = n2(lista.reduce((a, v) => a + Math.max(0, n2(v.custoTotal || custoVenda(v))), 0));
    const lucroEstimado = n2(total - custoTotal);
    const quantidadeItens = lista.reduce((a, v) => a + vendaItensQtd(v), 0);
    const formas = {};
    for (const v of lista) {
      const key = normForma(v.formaPagamento) || FILTRO_SEM_FORMA;
      formas[key] = n2((formas[key] || 0) + n2(v.total));
    }
    return normExtratoComercioRegistro({
      id: id('expcom'),
      timestamp: Date.now(),
      dataRef: hojeKey(),
      total,
      custoTotal,
      lucroEstimado,
      quantidadeVendas: lista.length,
      quantidadeItens,
      formas,
      vendasResumo: lista.slice(0, 20).map(v => ({
        titulo: vendaRotulo(v),
        total: n2(v.total),
        formaPagamento: normForma(v.formaPagamento),
        itens: vendaItensQtd(v)
      }))
    });
  }

  async function exportaPendentes() {
    const dia = vendasDia();
    const pend = dia.filter(v => !v.exportado);
    if (!pend.length) return feedback(txt('feedback.noPendingSalesToExport', 'Nao ha vendas pendentes para exportar.'), 'info');
    const total = n2(pend.reduce((a, v) => a + n2(v.total), 0));
    if (!await comercioConfirm(
      txt('dialogs.exportToStatementMessage', 'Exportar {vendas} para o extrato?\nTotal: {total}', { vendas: txtSales(pend.length), total: formatarMoeda(total) }),
      { title: txt('dialogs.exportToStatementTitle', 'Exportar para extrato'), confirmText: txt('common.export', 'Exportar') }
    )) return;
    let saldo = safeGetNumber(KS.saldo, 0);
    let hist = safeGetJSON(KS.hist, []);
    if (!Array.isArray(hist)) hist = [];
    const novo = histExtratoConsolidado(pend);
    const novoExtratoCom = registroExtratoComercioConsolidado(pend);
    saldo = n2(saldo + total);
    hist = [novo, ...hist];
    limitarHistorico(hist);
    safeSetItem(KS.saldo, String(saldo));
    safeSetJSON(KS.hist, hist);
    if (novoExtratoCom) {
      extratoComercioState = [novoExtratoCom, ...extratoComercioState];
      limitarHistorico(extratoComercioState);
      saveExtratoComercio();
    }
    const agora = Date.now();
    for (const v of dia) if (!v.exportado) { v.exportado = true; v.exportadoEm = agora; }
    setVendasDia(dia);
    try { if (w.opener && !w.opener.closed && typeof w.opener.__finSyncCarteiraFromStorage === 'function') w.opener.__finSyncCarteiraFromStorage(); } catch (_) {}
    renderVendas(); renderRelatorios();
    feedback(txt('feedback.exportDoneSingleEntry', 'Exportacao concluida: {vendas} consolidadas em 1 lancamento no extrato.', {
      vendas: txtSales(pend.length)
    }), 'success');
  }

  async function removeVenda(vId) {
    const dia = vendasDia();
    const v = dia.find(x => x.id === vId);
    if (!v) return;
    if (!await comercioConfirm(
      v.exportado
        ? txt('dialogs.removeExportedSaleMessage', 'Este registro ja foi exportado. Remover somente da lista do dia?')
        : txt('dialogs.removeSaleMessage', 'Remover esta venda da lista do dia?'),
      { title: txt('dialogs.removeSaleTitle', 'Remover venda'), confirmText: txt('common.remove', 'Remover'), danger: true }
    )) return;
    setVendasDia(dia.filter(x => x.id !== vId));
    renderVendas(); renderRelatorios();
    feedback(txt('feedback.saleRemovedFromDayList', 'Registro removido da lista do dia.'), 'info');
  }

  function usaModelo(vId) {
    const v = vendasDia().find(x => x.id === vId);
    if (!v) return;
    comanda = normComanda({
      titulo: v.titulo, formaPagamento: v.formaPagamento || formaPadrao || '',
      desconto: v.desconto, acrescimo: v.acrescimo,
      itens: (v.itens || []).map(i => ({ ...i, id: id('ci') }))
    });
    saveComanda(); renderComanda();
    feedback(txt('feedback.saleLoadedAsTemplate', 'Venda carregada como modelo na comanda.'), 'success');
    const alvo = getEl('comercio-comanda-titulo') || getEl('comercio-comanda-itens');
    if (alvo?.scrollIntoView) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function limpaExportadas() {
    const dia = vendasDia();
    const keep = dia.filter(v => !v.exportado);
    if (keep.length === dia.length) return feedback(txt('feedback.noExportedRecordsToClear', 'Nao ha registros exportados para limpar.'), 'info');
    if (!await comercioConfirm(
      txt('dialogs.clearExportedMessage', 'Remover da lista do dia todos os registros ja exportados?'),
      { title: txt('dialogs.clearExportedTitle', 'Limpar exportadas'), confirmText: txt('common.clear', 'Limpar'), danger: true }
    )) return;
    setVendasDia(keep);
    renderVendas(); renderRelatorios();
    feedback(txt('feedback.exportedRecordsCleared', 'Registros exportados removidos da lista.'), 'success');
  }

  async function onCatalogoClick(ev) {
    const b = ev.target.closest('[data-acao]'); if (!b) return;
    const ac = String(b.dataset.acao || ''), itemId = String(b.dataset.itemId || '');
    const item = catalogo.find(x => x.id === itemId);
    if (ac === 'adicionar-item') return addItemComanda(item);
    if (ac === 'editar-item' && item) {
      const edit = await comercioPromptTriploItem(item);
      if (!edit?.confirmed) return;
      const nn = String(edit.values?.nome || '').trim();
      if (!nn) return feedback(txt('feedback.itemNameRequired', 'Nome do item nao pode ficar vazio.'), 'danger');
      const pp = parseMoney(edit.values?.preco || '');
      if (pp <= 0) return feedback(txt('feedback.invalidPrice', 'Preco invalido.'), 'danger');
      const cc = Math.max(0, parseMoney(edit.values?.custo || ''));
      item.nome = nn; item.preco = pp; item.custo = cc; saveCatalogo(); renderCatalogo(); feedback(txt('feedback.itemUpdated', 'Item atualizado: {nome}.', { nome: nn }), 'success'); return;
    }
    if (ac === 'remover-item' && item) {
      if (!await comercioConfirm(
        txt('dialogs.removeCatalogItemMessage', 'Remover o item "{nome}" do catalogo?', { nome: item.nome }),
        { title: txt('dialogs.removeCatalogItemTitle', 'Remover item'), confirmText: txt('common.remove', 'Remover'), danger: true }
      )) return;
      catalogo = catalogo.filter(x => x.id !== itemId); saveCatalogo(); renderCatalogo(); feedback(txt('feedback.itemRemovedFromCatalog', 'Item removido do catalogo: {nome}.', { nome: item.nome }), 'info');
    }
  }

  function onComandaClick(ev) {
    const b = ev.target.closest('[data-acao]'); if (!b) return;
    const ac = String(b.dataset.acao || ''), cid = String(b.dataset.comandaItemId || '');
    const it = comanda.itens.find(x => x.id === cid); if (!it) return;
    if (ac === 'aumentar-comanda-item') it.quantidade = Math.max(1, Number(it.quantidade || 1) + 1);
    if (ac === 'diminuir-comanda-item') it.quantidade = Math.max(1, Number(it.quantidade || 1) - 1);
    if (ac === 'remover-comanda-item') comanda.itens = comanda.itens.filter(x => x.id !== cid);
    saveComanda(); renderComanda();
  }

  async function onVendasClick(ev) {
    const b = ev.target.closest('[data-acao]'); if (!b) return;
    const ac = String(b.dataset.acao || ''), vId = String(b.dataset.vendaId || '');
    if (ac === 'usar-modelo-venda') usaModelo(vId);
    if (ac === 'remover-venda') await removeVenda(vId);
  }

  function bind() {
    getEl('btn-comercio-abrir-economias')?.addEventListener('click', () => {
      if (w.opener && !w.opener.closed) { try { w.opener.focus(); return; } catch (_) {} }
      w.location.href = 'economias.html';
    });
    getEl('btn-comercio-exportar')?.addEventListener('click', exportaPendentes);
    getEl('btn-comercio-limpar-exportadas')?.addEventListener('click', limpaExportadas);
    getEl('btn-comercio-finalizar-comanda')?.addEventListener('click', finalizaComanda);
    getEl('btn-comercio-limpar-comanda')?.addEventListener('click', async () => {
      if (!comanda.itens.length && !comanda.titulo && !comanda.desconto && !comanda.acrescimo) return feedback(txt('feedback.orderAlreadyEmpty', 'A comanda ja esta vazia.'), 'info');
      if (!await comercioConfirm(
        txt('dialogs.clearOrderMessage', 'Limpar a comanda atual?'),
        { title: txt('dialogs.clearOrderTitle', 'Limpar comanda'), confirmText: txt('common.clear', 'Limpar'), danger: true }
      )) return;
      comanda = { titulo: '', formaPagamento: comanda.formaPagamento || formaPadrao || '', desconto: 0, acrescimo: 0, itens: [] };
      saveComanda(); renderComanda(); feedback(txt('feedback.orderCleared', 'Comanda limpa.'), 'info');
    });
    getEl('comercio-form-item')?.addEventListener('submit', ev => {
      ev.preventDefault();
      const nomeEl = getEl('comercio-item-nome'), precoEl = getEl('comercio-item-preco'), custoEl = getEl('comercio-item-custo');
      const nome = String(nomeEl?.value || '').trim(), preco = parseMoney(precoEl?.value || ''), custo = Math.max(0, parseMoney(custoEl?.value || ''));
      if (!nome) return feedback(txt('feedback.enterItemName', 'Informe o nome do item.'), 'danger');
      if (preco <= 0) return feedback(txt('feedback.enterValidItemPrice', 'Informe um preco valido para o item.'), 'danger');
      catalogo.unshift({ id: id('item'), nome, preco, custo }); saveCatalogo(); renderCatalogo();
      if (nomeEl) nomeEl.value = ''; if (precoEl) precoEl.value = ''; if (custoEl) custoEl.value = ''; nomeEl?.focus();
      getEl('comercio-form-item')?.__finClosePopover?.();
      feedback(txt('feedback.itemAddedToCatalog', 'Item adicionado ao catalogo: {nome}.', { nome }), 'success');
    });
    getEl('comercio-catalogo-grid')?.addEventListener('click', onCatalogoClick);
    getEl('comercio-catalogo-busca')?.addEventListener('input', e => {
      buscaCatalogo = String(e.target?.value || '').trimStart();
      renderCatalogo();
    });
    getEl('btn-comercio-limpar-busca')?.addEventListener('click', () => {
      buscaCatalogo = '';
      syncBuscaCatalogoUi();
      renderCatalogo();
      getEl('comercio-catalogo-busca')?.focus();
    });
    getEl('comercio-comanda-itens')?.addEventListener('click', onComandaClick);
    getEl('comercio-vendas-lista')?.addEventListener('click', onVendasClick);

    getEl('comercio-forma-padrao')?.addEventListener('change', e => {
      formaPadrao = normForma(e.target.value); safeSetItem(KS.forma, formaPadrao);
      if (!comanda.formaPagamento) { comanda.formaPagamento = formaPadrao; saveComanda(); renderComanda(); }
      feedback(txt('feedback.defaultMethodUpdated', 'Forma padrao atualizada para {forma}.', { forma: metaForma(formaPadrao).rotulo }), 'info');
    });
    getEl('comercio-comanda-forma')?.addEventListener('change', e => { comanda.formaPagamento = normForma(e.target.value); saveComanda(); renderComanda(); });

    const syncComanda = () => { salvarCamposComandaDaUI(); renderComanda(); };
    getEl('comercio-comanda-titulo')?.addEventListener('input', e => { comanda.titulo = String(e.target.value || '').trimStart(); saveComanda(); });
    getEl('comercio-comanda-titulo')?.addEventListener('blur', syncComanda);
    getEl('comercio-comanda-desconto')?.addEventListener('change', syncComanda);
    getEl('comercio-comanda-desconto')?.addEventListener('blur', syncComanda);
    getEl('comercio-comanda-acrescimo')?.addEventListener('change', syncComanda);
    getEl('comercio-comanda-acrescimo')?.addEventListener('blur', syncComanda);

    getEl('comercio-filtro-forma-vendas')?.addEventListener('change', e => { filtroForma = String(e.target.value || FILTRO_TODOS); renderVendas(); });
    getEl('comercio-relatorio-periodo')?.addEventListener('change', e => { periodoRelatorio = String(e.target.value) === 'hoje' ? 'hoje' : '7dias'; renderRelatorios(); });
    getEl('comercio-itens-periodo')?.addEventListener('change', e => {
      const v = String(e.target.value || '7dias');
      periodoRelatorioItens = (v === '15dias' || v === '30dias') ? v : '7dias';
      renderRelatorioItens();
    });

    w.document.addEventListener('fin:i18n-change', () => {
      renderAll();
    });
  }

  function load() {
    catalogo = (Array.isArray(safeGetJSON(KS.cat, [])) ? safeGetJSON(KS.cat, []) : []).map(normCatalogoItem).filter(Boolean);
    if (!catalogo.length) catalogo = CATALOGO_PADRAO.map(x => normCatalogoItem(x)).filter(Boolean);
    vendasState = normState(safeGetJSON(KS.vendas, { dias: {} }));
    extratoComercioState = (Array.isArray(safeGetJSON(KS.extratoCom, [])) ? safeGetJSON(KS.extratoCom, []) : []).map(normExtratoComercioRegistro).filter(Boolean);
    formaPadrao = normForma(safeGetItem(KS.forma, ''));
    comanda = normComanda(safeGetJSON(KS.comanda, { formaPagamento: formaPadrao, itens: [] }));
    if (!comanda.formaPagamento && formaPadrao) comanda.formaPagamento = formaPadrao;
    saveCatalogo(); safeSetJSON(KS.vendas, vendasState); saveExtratoComercio(); saveComanda();
  }

  function renderAll() { applyStaticI18nComercio(); renderFiltrosEFormas(); renderCatalogo(); renderComanda(); renderVendas(); renderRelatorios(); }

  function start() {
    if (typeof carregarTema === 'function') carregarTema();
    load();
    bindCadastroItemPopover();
    bindAbasSecoesComercio();
    bind();
    renderAll();
  }

  if (w.document?.readyState === 'loading') w.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);



