/* =========================================
   Configuracoes e estado
   ========================================= */
const DURACAO_TRANSICAO_TEMA = 420;
const DURACAO_SPLASH_TOTAL = 3000;
const DURACAO_SPLASH_FADE = 1100;
const DURACAO_SPLASH_TELA_WORDMARK = 1450;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js nÃ£o foi carregado antes de script.js');
}

const {
    STORAGE,
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    parseValorInput,
    formatarDataBr,
    getDataLocal: getVencimentoDate,
    escapeHtml,
    limitarHistorico,
    exportarBackupStorage,
    importarBackupStorage,
    safeGetItem,
    safeSetItem,
    safeRemoveItem,
    safeGetJSON,
    safeSetJSON,
    safeGetNumber,
    carregarTema: carregarTemaSalvo,
    carregarTemaExecutivo,
    alternarTemaComAnimacao,
    toggleSidebarPadrao,
    aplicarEstadoInicialSidebarPadrao,
    configurarGestosSidebarMobilePadrao,
    confirmarResetSistema,
    iniciarAnimacaoEntradaPagina
} = Common;
const I18n = window.FinI18n;
const t = (key, fallback, vars) => (I18n && typeof I18n.t === 'function'
    ? I18n.t(key, vars, fallback)
    : (fallback ?? key));
const nomeMesI18n = (indice, estilo = 'long') => {
    if (I18n && typeof I18n.formatMonthName === 'function') {
        const valor = I18n.formatMonthName(indice, estilo);
        if (valor) return estilo === 'short'
            ? valor.slice(0, 3)
            : valor.charAt(0).toUpperCase() + valor.slice(1);
    }
    const fallback = String(nomesMeses[indice] || '');
    return estilo === 'short' ? fallback.slice(0, 3) : fallback;
};
const localeAtualI18n = () => (I18n && typeof I18n.getLanguage === 'function'
    ? I18n.getLanguage()
    : 'pt-BR');

const STORAGE_CLIENTES = STORAGE.CLIENTES;
const STORAGE_SALDO = STORAGE.SALDO_CARTEIRA;
const STORAGE_HISTORICO = STORAGE.HISTORICO_CARTEIRA;
const STORAGE_POUPANCA = STORAGE.SALDO_POUPANCA;
const STORAGE_HIST_POUPANCA = STORAGE.HISTORICO_POUPANCA;
const STORAGE_SIDEBAR_RETORNO_FECHADA = STORAGE.SIDEBAR_RETORNO_FECHADA;
const STORAGE_PULAR_SPLASH_ENTRADA = STORAGE.PULAR_SPLASH_ENTRADA_ONCE;
const STORAGE_TEMA = STORAGE.TEMA_SISTEMA;
const MERCADO_PAGO_ENDPOINT_PADRAO = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:3000/api/mercadopago/preference'
    : '/api/mercadopago/preference';
const MERCADO_PAGO_PAID_REFS_ENDPOINT_PADRAO = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:3000/api/mercadopago/paid-refs'
    : '/api/mercadopago/paid-refs';
const MERCADO_PAGO_ACK_ENDPOINT_PADRAO = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:3000/api/mercadopago/ack'
    : '/api/mercadopago/ack';
const MERCADO_PAGO_CONFIRM_ENDPOINT_PADRAO = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:3000/api/mercadopago/confirm-payment'
    : '/api/mercadopago/confirm-payment';
const MERCADO_PAGO_PIX_ENDPOINT_PADRAO = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:3000/api/mercadopago/pix'
    : '/api/mercadopago/pix';
const MERCADO_PAGO_SYNC_INTERVAL_MS = 25000;
const MERCADO_PAGO_MODAL_STATUS_POLL_INTERVAL_MS = 4000;

const MERCADO_PAGO_ENDPOINT = safeGetItem('mercado_pago_endpoint', MERCADO_PAGO_ENDPOINT_PADRAO);
const MERCADO_PAGO_PAID_REFS_ENDPOINT = safeGetItem('mercado_pago_paid_refs_endpoint', MERCADO_PAGO_PAID_REFS_ENDPOINT_PADRAO);
const MERCADO_PAGO_ACK_ENDPOINT = safeGetItem('mercado_pago_ack_endpoint', MERCADO_PAGO_ACK_ENDPOINT_PADRAO);
const MERCADO_PAGO_CONFIRM_ENDPOINT = safeGetItem('mercado_pago_confirm_endpoint', MERCADO_PAGO_CONFIRM_ENDPOINT_PADRAO);
const MERCADO_PAGO_PIX_ENDPOINT = safeGetItem('mercado_pago_pix_endpoint', MERCADO_PAGO_PIX_ENDPOINT_PADRAO);
const MP_USER_ACCESS_TOKEN_KEY = 'mp_user_access_token';
const MP_USER_WEBHOOK_SECRET_KEY = 'mp_user_webhook_secret';
const MP_USER_WHATSAPP_NUMERO_KEY = 'mp_user_whatsapp_numero';

function obterCredenciaisMercadoPagoUsuario() {
    const common = window.FinCommon || null;
    const safeGet = typeof common?.safeGetItem === 'function'
        ? (key, fallback = '') => common.safeGetItem(key, fallback)
        : (() => {
            try {
                return (key, fallback = '') => localStorage.getItem(key) ?? fallback;
            } catch (_) {
                return (_key, fallback = '') => fallback;
            }
        })();

    return {
        accessToken: String(safeGet(MP_USER_ACCESS_TOKEN_KEY, '') || '').trim(),
        webhookSecret: String(safeGet(MP_USER_WEBHOOK_SECRET_KEY, '') || '').trim(),
        whatsappNumero: String(safeGet(MP_USER_WHATSAPP_NUMERO_KEY, '') || '').trim()
    };
}

function montarHeadersMercadoPagoRequest(baseHeaders = {}) {
    const headers = { ...(baseHeaders || {}) };
    const cred = obterCredenciaisMercadoPagoUsuario();
    if (cred.accessToken) headers['X-Fin-MP-Access-Token'] = cred.accessToken;
    if (cred.webhookSecret) headers['X-Fin-MP-Webhook-Secret'] = cred.webhookSecret;
    if (cred.whatsappNumero) headers['X-Fin-MP-Whatsapp-Numero'] = cred.whatsappNumero;
    return headers;
}

let cobrancas = safeGetJSON(STORAGE_CLIENTES, []);
let saldoCarteira = safeGetNumber(STORAGE_SALDO, 0);
let historicoCarteira = safeGetJSON(STORAGE_HISTORICO, []);
let saldoPoupanca = safeGetNumber(STORAGE_POUPANCA, 0);
let historicoPoupanca = safeGetJSON(STORAGE_HIST_POUPANCA, []);
function obterMesInicial() {
    return new Date().getMonth();
}

function limparMesDaQueryAtual() {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('mes')) return;
        url.searchParams.delete('mes');
        const search = url.searchParams.toString();
        const novoHref = `${url.pathname}${search ? `?${search}` : ''}${url.hash || ''}`;
        window.history.replaceState(window.history.state, '', novoHref);
    } catch (_) {
        // Ignora navegadores/URLs sem suporte.
    }
}

function forcarMesAtualTelaPrincipal() {
    const mesAtualSistema = new Date().getMonth();
    limparMesDaQueryAtual();
    if (mesAtivo === mesAtualSistema) return false;

    mesAtivo = mesAtualSistema;
    const menu = getEl('menu-meses');
    if (menu) menu.dataset.colapsado = '1';
    return true;
}

async function sincronizarMesAtualComServidor() {
    if (window.location.protocol === 'file:') return false;

    try {
        const resp = await fetch('/manifest.webmanifest', {
            method: 'HEAD',
            cache: 'no-store'
        });
        const rawDate = String(resp.headers.get('date') || '').trim();
        if (!rawDate) return false;

        const dataServidor = new Date(rawDate);
        if (!Number.isFinite(dataServidor.getTime())) return false;

        const mesServidor = dataServidor.getMonth();
        if (!Number.isInteger(mesServidor) || mesServidor < 0 || mesServidor > 11) return false;

        // Evita sobrescrever o mes correto por diferencas pequenas de fuso/virada UTC.
        // So forca o mes do servidor quando o relogio local aparenta estar realmente errado.
        const agoraLocal = new Date();
        const diferencaMs = Math.abs(dataServidor.getTime() - agoraLocal.getTime());
        const DIFERENCA_MAXIMA_FUSO_MS = 36 * 60 * 60 * 1000;
        if (diferencaMs <= DIFERENCA_MAXIMA_FUSO_MS) return false;

        limparMesDaQueryAtual();
        if (mesAtivo === mesServidor) return false;

        mesAtivo = mesServidor;
        const menu = getEl('menu-meses');
        if (menu) menu.dataset.colapsado = '1';

        if (typeof atualizarTudo === 'function') {
            atualizarTudo();
        }
        return true;
    } catch (_) {
        return false;
    }
}

let abaAtiva = 'todos';
let mesAtivo = obterMesInicial();
let temaTransicaoTimer = null;
let buscaDebounceTimer = null;
let notificacaoSinoJaClicado = false;
let modoNotificacoesHoje = 'hoje';
let sincronizacaoMercadoPagoTimer = null;
let sincronizacaoMercadoPagoEmAndamento = false;
let sincronizacaoMercadoPagoEventosRegistrados = false;
let resolverModalFormaPagamento = null;
let filtroFormaPagamentoExtratoCarteira = 'todos';
let sequenciaIdDespesaAutoCarteira = 0;
let notificacaoPagamentoBrowserPermissaoTentadaSessao = false;
let notificacaoLembreteCobrancaPermissaoTentadaSessao = false;
let stackToastPagamentoConcluido = null;
let qrMercadoPagoModalUi = null;
let qrMercadoPagoScriptPromise = null;
let qrMercadoPagoLinkAtual = '';
let qrMercadoPagoAbrirUrlAtual = '';
let qrMercadoPagoToastCopiaTituloAtual = '';
let qrMercadoPagoToastCopiaMensagemAtual = '';
let qrMercadoPagoStatusPollTimer = null;
let qrMercadoPagoStatusPollToken = 0;
let qrMercadoPagoStatusPollEmAndamento = false;
let lembretesCobrancaLocaisTimer = null;
let lembretesCobrancaLocaisCheckEmAndamento = false;
let lembretesCobrancaLocaisEventosRegistrados = false;

const FORMAS_PAGAMENTO_META = Object.freeze({
    pix: Object.freeze({ rotulo: 'PIX', icone: 'fa-qrcode' }),
    dinheiro: Object.freeze({ rotulo: 'Dinheiro', icone: 'fa-money-bill-wave' }),
    debito: Object.freeze({ rotulo: 'Debito', icone: 'fa-credit-card' }),
    credito: Object.freeze({ rotulo: 'Credito', icone: 'fa-credit-card' }),
    transferencia: Object.freeze({ rotulo: 'Transferencia', icone: 'fa-building-columns' }),
    boleto: Object.freeze({ rotulo: 'Boleto', icone: 'fa-barcode' }),
    mercado_pago: Object.freeze({ rotulo: 'Mercado Pago', icone: 'fa-wallet' })
});

const FORMAS_PAGAMENTO_MANUAL = Object.freeze([
    'pix',
    'dinheiro',
    'debito',
    'credito',
    'transferencia',
    'boleto'
]);

const MODAL_FORMA_PAGAMENTO_ID = 'modal-forma-pagamento-manual';
const FILTRO_FORMA_EXTRATO_SEM_FORMA = 'sem_forma';
const FILTRO_FORMA_EXTRATO_COM_FORMA = 'com_forma';
const STORAGE_NOTIFICACOES_PAGAMENTO_BROWSER_DISPONIVEL = 'pagamento_notificacoes_browser_disponivel';
const STORAGE_LEMBRETES_COBRANCA_LOCAL_ENVIADOS = 'cobranca_lembretes_locais_enviados_v1';
const STORAGE_LEMBRETES_DESPESA_LOCAL_ENVIADOS = 'despesa_lembretes_locais_enviados_v1';
const STORAGE_ALERTAS_SISTEMA_LOCAL_ENVIADOS = 'sistema_alertas_locais_enviados_v1';
const STORAGE_MP_STATUS_NOTIFICADOS = 'mercado_pago_status_notificados_v1';
const STORAGE_ORDEM_CLIENTES_MANUAL = 'clientes_ordem_manual_v1';
const LEMBRETES_COBRANCA_LOCAL_INTERVAL_MS = 10 * 60 * 1000;
const LEMBRETES_COBRANCA_LOCAL_RETENCAO_DIAS = 45;
const LEMBRETES_COBRANCA_LOCAL_MAX_REGISTROS = 1200;
const ALERTA_SALDO_CARTEIRA_BAIXO_PADRAO = 50;

const CATEGORIAS_EXTRATO_ROTULOS = Object.freeze({
    mercado_pago: 'Mercado Pago',
    recebimento_manual: 'Recebimento manual',
    estorno_recebimento: 'Estorno de recebimento',
    transferencia_poupanca: 'TransferÃªncia para poupanÃ§a',
    modo_comercio: 'Modo ComÃ©rcio'
});

let ordemClientesManualPorMes = safeGetJSON(STORAGE_ORDEM_CLIENTES_MANUAL, {});
let dragReordenacaoClientes = {
    ativo: false,
    li: null,
    pointerId: null,
    lista: null,
    pressTimer: null,
    startX: 0,
    startY: 0
};

const isPaginaEconomias = () => Boolean(getEl('lista-extrato') || getEl('extrato-poupanca'));

function garantirStackToastPagamentoConcluido() {
    if (stackToastPagamentoConcluido && document.body?.contains(stackToastPagamentoConcluido)) return stackToastPagamentoConcluido;
    if (!document?.body) return null;

    const stack = document.createElement('div');
    stack.id = 'fin-pagamento-toast-stack';
    stack.className = 'fin-pagamento-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    stack.setAttribute('aria-atomic', 'false');
    document.body.appendChild(stack);
    stackToastPagamentoConcluido = stack;
    return stack;
}

function mostrarToastPagamentoConcluido({ titulo = '', mensagem = '', tipo = 'sucesso', duracaoMs = 4800 } = {}) {
    const stack = garantirStackToastPagamentoConcluido();
    if (!stack) return null;

    const toast = document.createElement('section');
    toast.className = `fin-pagamento-toast fin-pagamento-toast-${tipo}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
        <div class="fin-pagamento-toast-icone" aria-hidden="true">
            <i class="fa-solid fa-circle-check"></i>
        </div>
        <div class="fin-pagamento-toast-conteudo">
            <div class="fin-pagamento-toast-titulo">${escapeHtml(titulo)}</div>
            <div class="fin-pagamento-toast-msg">${escapeHtml(mensagem)}</div>
        </div>
        <button type="button" class="fin-pagamento-toast-fechar" aria-label="${escapeHtml(t('dashboardPage.notifications.completed.close', 'Fechar notificacao'))}">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
    `;

    const fechar = () => {
        if (!toast.parentNode) return;
        toast.classList.add('saindo');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 180);
    };

    const btnFechar = toast.querySelector('.fin-pagamento-toast-fechar');
    if (btnFechar) btnFechar.addEventListener('click', fechar);

    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visivel'));
    if (duracaoMs > 0) setTimeout(fechar, duracaoMs);
    return toast;
}

function podeUsarNotificacaoNavegadorPagamento() {
    return typeof window.Notification !== 'undefined'
        && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(String(window.location?.hostname || '')));
}

function executarNotificacaoNavegadorPagamento(payload = {}) {
    if (!podeUsarNotificacaoNavegadorPagamento()) return;
    if (Notification.permission !== 'granted') return;
    if (document?.visibilityState === 'visible') return;

    const titulo = String(payload.titulo || t('dashboardPage.notifications.completed.browserTitle', 'Pagamento concluido'));
    const mensagem = String(payload.mensagem || '');
    const opcoes = {
        body: mensagem,
        icon: '/icons/icon-192.png',
        badge: '/icons/favicon-32.png',
        tag: String(payload.tag || `pagamento-${Date.now()}`),
        renotify: false
    };

    const focarPainel = () => {
        try { window.focus(); } catch (_) {}
        try { window.location.href = 'index.html'; } catch (_) {}
    };

    const fallbackNotification = () => {
        try {
            const n = new Notification(titulo, opcoes);
            n.onclick = () => {
                focarPainel();
                try { n.close(); } catch (_) {}
            };
        } catch (_) {
            /* noop */
        }
    };

    if (navigator?.serviceWorker?.ready && typeof navigator.serviceWorker.ready.then === 'function') {
        navigator.serviceWorker.ready
            .then(reg => (reg && typeof reg.showNotification === 'function'
                ? reg.showNotification(titulo, opcoes)
                : fallbackNotification()))
            .catch(fallbackNotification);
        return;
    }

    fallbackNotification();
}

function tentarHabilitarNotificacaoNavegadorPagamento(solicitarPermissao = false) {
    if (!podeUsarNotificacaoNavegadorPagamento()) return;

    const permissaoAtual = String(Notification.permission || 'default');
    if (permissaoAtual === 'granted') {
        safeSetItem(STORAGE_NOTIFICACOES_PAGAMENTO_BROWSER_DISPONIVEL, '1');
        return;
    }
    if (permissaoAtual === 'denied') {
        safeSetItem(STORAGE_NOTIFICACOES_PAGAMENTO_BROWSER_DISPONIVEL, '0');
        return;
    }

    if (!solicitarPermissao || notificacaoPagamentoBrowserPermissaoTentadaSessao) return;
    notificacaoPagamentoBrowserPermissaoTentadaSessao = true;

    try {
        Notification.requestPermission()
            .then(resultado => {
                const granted = resultado === 'granted';
                safeSetItem(STORAGE_NOTIFICACOES_PAGAMENTO_BROWSER_DISPONIVEL, granted ? '1' : '0');
                if (granted) {
                    mostrarToastPagamentoConcluido({
                        titulo: t('dashboardPage.notifications.completed.browserEnabledTitle', 'Notificacoes ativadas'),
                        mensagem: t('dashboardPage.notifications.completed.browserEnabledMessage', 'O navegador agora pode avisar quando um pagamento for concluido.'),
                        tipo: 'info',
                        duracaoMs: 3000
                    });
                }
            })
            .catch(() => {});
    } catch (_) {
        /* noop */
    }
}

function obterRotuloOrigemPagamentoConcluido(origem = '') {
    if (origem === 'mercado_pago') return t('dashboardPage.notifications.completed.sourceMercadoPago', 'via Mercado Pago');
    if (origem === 'edicao_manual') return t('dashboardPage.notifications.completed.sourceEdit', 'via ajuste manual');
    return t('dashboardPage.notifications.completed.sourceManual', 'via marcacao manual');
}

let feedbackPagamentoAudioCtx = null;
let ultimoFeedbackPagamentoConcluidoTs = 0;

function executarFeedbackLevePagamentoConcluido(opcoes = {}) {
    const agora = Date.now();
    if ((agora - ultimoFeedbackPagamentoConcluidoTs) < 650) return;
    ultimoFeedbackPagamentoConcluidoTs = agora;

    const docVisivel = !document || document.visibilityState !== 'hidden';
    const origem = String(opcoes?.origem || '');

    // Para eventos automaticos em segundo plano, evita vibrar/tocar sem contexto visual.
    if (!docVisivel && origem === 'mercado_pago') return;

    try {
        if (navigator?.vibrate && docVisivel) {
            navigator.vibrate([16, 22, 12]);
        }
    } catch (_) {
        /* noop */
    }

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx || !docVisivel) return;

        feedbackPagamentoAudioCtx = feedbackPagamentoAudioCtx || new AudioCtx();
        const ctx = feedbackPagamentoAudioCtx;

        Promise.resolve(typeof ctx.resume === 'function' ? ctx.resume() : null)
            .then(() => {
                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(760, now);
                osc.frequency.exponentialRampToValueAtTime(1080, now + 0.09);

                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.045, now + 0.018);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.16);
            })
            .catch(() => {});
    } catch (_) {
        /* noop */
    }
}

function notificarPagamentoConcluido(cliente, opcoes = {}) {
    if (!cliente) return;

    const nomeCliente = String(cliente.nome || t('dashboardPage.modals.whatsapp.customerFallbackName', 'Cliente')).trim();
    const valorRecebido = Number(opcoes?.valorRecebido);
    const valorExibicao = Number.isFinite(valorRecebido) && valorRecebido > 0
        ? valorRecebido
        : (Number(cliente.pagoParcial) || Number(cliente.valor) || 0);
    const forma = obterMetaFormaPagamento(opcoes?.formaPagamento || cliente.formaPagamento)?.rotulo || '';
    const origem = String(opcoes?.origem || 'manual');
    const complementoForma = forma
        ? t('dashboardPage.notifications.completed.methodSuffix', ' via {forma}', { forma })
        : '';

    const titulo = t('dashboardPage.notifications.completed.title', 'Pagamento concluido');
    const mensagemBase = t(
        'dashboardPage.notifications.completed.message',
        '{nome} recebeu {valor}{forma}.',
        { nome: nomeCliente, valor: formatarMoeda(valorExibicao), forma: complementoForma }
    );
    const detalheOrigem = obterRotuloOrigemPagamentoConcluido(origem);
    const mensagem = detalheOrigem ? `${mensagemBase} (${detalheOrigem})` : mensagemBase;

    executarFeedbackLevePagamentoConcluido({ origem });
    mostrarToastPagamentoConcluido({ titulo, mensagem, tipo: 'sucesso', duracaoMs: 5200 });

    tentarHabilitarNotificacaoNavegadorPagamento(Boolean(opcoes?.solicitarPermissaoBrowser));
    executarNotificacaoNavegadorPagamento({
        titulo,
        mensagem,
        tag: `pagamento-concluido-${String(opcoes?.paymentId || cliente.id || Date.now())}`
    });

    try {
        window.dispatchEvent(new CustomEvent('fin:pagamento-concluido', {
            detail: {
                id: cliente.id,
                nome: nomeCliente,
                valor: valorExibicao,
                formaPagamento: normalizarFormaPagamento(opcoes?.formaPagamento || cliente.formaPagamento),
                origem,
                paymentId: String(opcoes?.paymentId || ''),
                em: Date.now()
            }
        }));
    } catch (_) {
        /* noop */
    }
}

function inicioDoDiaLocal(data) {
    const d = data instanceof Date ? new Date(data.getTime()) : new Date(data);
    d.setHours(0, 0, 0, 0);
    return d;
}

function diferencaDiasCalendario(a, b) {
    const diaA = inicioDoDiaLocal(a);
    const diaB = inicioDoDiaLocal(b);
    return Math.round((diaA.getTime() - diaB.getTime()) / 86400000);
}

function obterMapaLembretesCobrancaLocalEnviados() {
    const raw = safeGetJSON(STORAGE_LEMBRETES_COBRANCA_LOCAL_ENVIADOS, {});
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function salvarMapaLembretesCobrancaLocalEnviados(mapa) {
    const bruto = mapa && typeof mapa === 'object' ? { ...mapa } : {};
    const agora = Date.now();
    const retencaoMs = LEMBRETES_COBRANCA_LOCAL_RETENCAO_DIAS * 86400000;

    for (const [chave, valor] of Object.entries(bruto)) {
        const ts = Number(valor);
        if (!Number.isFinite(ts) || ts <= 0 || (agora - ts) > retencaoMs) {
            delete bruto[chave];
        }
    }

    const entradas = Object.entries(bruto);
    if (entradas.length > LEMBRETES_COBRANCA_LOCAL_MAX_REGISTROS) {
        entradas
            .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
            .slice(LEMBRETES_COBRANCA_LOCAL_MAX_REGISTROS)
            .forEach(([chave]) => { delete bruto[chave]; });
    }

    safeSetJSON(STORAGE_LEMBRETES_COBRANCA_LOCAL_ENVIADOS, bruto);
}

function obterMapaNotificacoesLocais(storageKey) {
    const raw = safeGetJSON(storageKey, {});
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function salvarMapaNotificacoesLocais(storageKey, mapa) {
    const bruto = mapa && typeof mapa === 'object' ? { ...mapa } : {};
    const agora = Date.now();
    const retencaoMs = LEMBRETES_COBRANCA_LOCAL_RETENCAO_DIAS * 86400000;

    for (const [chave, valor] of Object.entries(bruto)) {
        const ts = Number(valor);
        if (!Number.isFinite(ts) || ts <= 0 || (agora - ts) > retencaoMs) {
            delete bruto[chave];
        }
    }

    const entradas = Object.entries(bruto);
    if (entradas.length > LEMBRETES_COBRANCA_LOCAL_MAX_REGISTROS) {
        entradas
            .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
            .slice(LEMBRETES_COBRANCA_LOCAL_MAX_REGISTROS)
            .forEach(([chave]) => { delete bruto[chave]; });
    }

    safeSetJSON(storageKey, bruto);
}

function montarChaveLembreteCobrancaLocal(cliente, tipoLembrete) {
    const id = String(cliente?.id ?? '').trim() || `nome:${String(cliente?.nome || '').trim().toLowerCase()}`;
    const data = String(cliente?.data || '').trim();
    const tipo = String(tipoLembrete || '').trim();
    return `v1|${id}|${data}|${tipo}`;
}

function montarMensagemWhatsappLembreteCobranca(cliente, tipoLembrete, valorRestante) {
    const primeiroNome = String(cliente?.nome || '').split(' ')[0] || t('dashboardPage.modals.whatsapp.customerFallbackName', 'Cliente');
    const valor = formatarMoeda(Number(valorRestante) || 0);
    const dataVencimento = formatarDataBr(String(cliente?.data || ''));
    const dataBase = getVencimentoDate(cliente?.data);
    const diasAtraso = Math.max(1, diferencaDiasCalendario(inicioDoDiaLocal(new Date()), dataBase));

    if (tipoLembrete === 'amanha') {
        return t(
            'dashboardPage.notifications.dueReminders.whatsappTomorrow',
            'Bom dia {nome}. Passando para lembrar que sua mensalidade no valor de {valor} vence amanha ({data}).',
            { nome: primeiroNome, valor, data: dataVencimento }
        );
    }

    if (tipoLembrete === 'atrasado') {
        return t(
            'dashboardPage.notifications.dueReminders.whatsappOverdue',
            'Bom dia {nome}. Sua mensalidade no valor de {valor} venceu em {data} e esta com {dias} dia(s) de atraso. Pode me confirmar o pagamento hoje?',
            { nome: primeiroNome, valor, data: dataVencimento, dias: diasAtraso }
        );
    }

    return t(
        'dashboardPage.modals.whatsapp.options.dueDateText',
        'Bom dia {nome}. Hoje e o dia da mensalidade no valor de {valor}.',
        { nome: primeiroNome, valor }
    );
}

function coletarLembretesLocaisCobrancaPendentes() {
    if (!Array.isArray(cobrancas) || !cobrancas.length) return [];

    const mapaEnviados = obterMapaLembretesCobrancaLocalEnviados();
    const hoje = inicioDoDiaLocal(new Date());
    const grupos = new Map();

    for (const cliente of cobrancas) {
        if (!cliente || cliente.pago) continue;

        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;
        const valorRestante = Math.max(0, Number((valorTotal - valorPago).toFixed(2)));
        if (!(valorRestante > 0)) continue;

        const telefoneNormalizado = normalizarTelefoneWhatsapp(cliente.telefone);
        if (!telefoneNormalizado) continue;

        const dataVencimento = getVencimentoDate(cliente.data);
        if (!(dataVencimento instanceof Date) || !Number.isFinite(dataVencimento.getTime())) continue;
        dataVencimento.setHours(0, 0, 0, 0);

        const diasParaVencer = diferencaDiasCalendario(dataVencimento, hoje);
        if (diasParaVencer !== 0 && diasParaVencer !== 1) continue;

        const tipoLembrete = diasParaVencer === 0 ? 'hoje' : 'amanha';
        const chaveRegistro = montarChaveLembreteCobrancaLocal(cliente, tipoLembrete);
        if (Object.prototype.hasOwnProperty.call(mapaEnviados, chaveRegistro)) continue;

        const nomeBase = String(cliente.nome || '').split(' (')[0].trim()
            || t('dashboardPage.modals.whatsapp.customerFallbackName', 'Cliente');
        const dataIso = String(cliente.data || '').trim();
        const chaveGrupo = `${telefoneNormalizado}|${dataIso}|${tipoLembrete}`;

        if (!grupos.has(chaveGrupo)) {
            grupos.set(chaveGrupo, {
                chaveGrupo,
                nome: nomeBase,
                telefone: telefoneNormalizado,
                data: dataIso,
                dataTimestamp: dataVencimento.getTime(),
                tipoLembrete,
                valorRestante: 0,
                quantidade: 0,
                clienteBase: cliente,
                registrosParaMarcar: []
            });
        }

        const grupo = grupos.get(chaveGrupo);
        grupo.valorRestante += valorRestante;
        grupo.quantidade += 1;
        grupo.registrosParaMarcar.push(chaveRegistro);
        if (!grupo.clienteBase && cliente) grupo.clienteBase = cliente;
    }

    const itens = Array.from(grupos.values()).map(grupo => {
        const clienteRef = grupo.clienteBase || {};
        const mensagemWhatsapp = montarMensagemWhatsappLembreteCobranca({
            ...clienteRef,
            nome: grupo.nome,
            telefone: grupo.telefone,
            data: grupo.data
        }, grupo.tipoLembrete, grupo.valorRestante);

        const urlWhatsapp = montarWhatsLinkComTexto(grupo.telefone, mensagemWhatsapp);
        if (!urlWhatsapp) return null;

        return {
            ...grupo,
            mensagemWhatsapp,
            urlWhatsapp,
            tag: `cobranca-${grupo.tipoLembrete}-${String(grupo.nome || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${grupo.data || 'sem-data'}`
        };
    }).filter(Boolean);

    itens.sort((a, b) => {
        const ordemTipo = (a.tipoLembrete === b.tipoLembrete) ? 0 : (a.tipoLembrete === 'hoje' ? -1 : 1);
        if (ordemTipo !== 0) return ordemTipo;
        const ordemData = (a.dataTimestamp || 0) - (b.dataTimestamp || 0);
        if (ordemData !== 0) return ordemData;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    return itens;
}

async function garantirPermissaoNotificacaoLembreteCobranca(solicitarPermissao = false) {
    if (!podeUsarNotificacaoNavegadorPagamento()) return false;
    if (typeof Notification === 'undefined') return false;

    const permissaoAtual = String(Notification.permission || 'default');
    if (permissaoAtual === 'granted') return true;
    if (permissaoAtual === 'denied') return false;
    if (!solicitarPermissao || notificacaoLembreteCobrancaPermissaoTentadaSessao) return false;

    notificacaoLembreteCobrancaPermissaoTentadaSessao = true;

    let resultado = 'default';
    try {
        if (window.FinPwa && typeof window.FinPwa.requestNotificationPermission === 'function') {
            resultado = await window.FinPwa.requestNotificationPermission();
        } else {
            resultado = await Notification.requestPermission();
        }
    } catch (_) {
        resultado = 'default';
    }

    if (resultado === 'granted') {
        mostrarToastPagamentoConcluido({
            titulo: t('dashboardPage.notifications.dueReminders.enabledTitle', 'Lembretes de vencimento ativados'),
            mensagem: t('dashboardPage.notifications.dueReminders.enabledMessage', 'O app pode avisar sobre cobrancas que vencem hoje ou amanha.'),
            tipo: 'info',
            duracaoMs: 3200
        });
        return true;
    }

    return false;
}

async function dispararNotificacaoLocalPadrao({
    titulo = '',
    body = '',
    tag = '',
    url = '',
    appUrl = '',
    data = {},
    actions = []
} = {}) {
    const notificationPayload = {
        title: String(titulo || '').trim(),
        body: String(body || '').trim(),
        tag: String(tag || `fin-local-${Date.now()}`),
        renotify: false,
        icon: '/icons/icon-192.png',
        badge: '/icons/favicon-32.png',
        data: {
            ...(data && typeof data === 'object' ? data : {}),
            url: String(url || '').trim(),
            appUrl: String(appUrl || `${window.location.origin}/index.html`).trim()
        },
        actions: Array.isArray(actions) ? actions : []
    };

    if (window.FinPwa && typeof window.FinPwa.showLocalNotification === 'function') {
        try {
            const ok = await window.FinPwa.showLocalNotification(notificationPayload);
            if (ok) return true;
        } catch (_) {
            /* fallback abaixo */
        }
    }

    try {
        const n = new Notification(notificationPayload.title, {
            body: notificationPayload.body,
            icon: notificationPayload.icon,
            badge: notificationPayload.badge,
            tag: notificationPayload.tag,
            data: notificationPayload.data
        });
        const targetUrl = String(notificationPayload.data.url || '').trim() || String(notificationPayload.data.appUrl || '').trim();
        if (targetUrl) {
            n.onclick = () => {
                try { n.close(); } catch (_) {}
                try { window.open(targetUrl, '_blank'); } catch (_) {}
            };
        }
        return true;
    } catch (_) {
        return false;
    }
}

async function dispararNotificacaoLembreteCobranca(item) {
    if (!item || !item.urlWhatsapp) return false;

    const titulo = item.tipoLembrete === 'amanha'
        ? t('dashboardPage.notifications.dueReminders.titleTomorrow', 'Cobranca de {nome} vence amanha! Enviar lembrete?', { nome: item.nome })
        : t('dashboardPage.notifications.dueReminders.titleToday', 'Cobranca de {nome} vence hoje! Enviar lembrete?', { nome: item.nome });

    const body = t(
        'dashboardPage.notifications.dueReminders.body',
        'Valor pendente: {valor}. Toque para abrir o WhatsApp com mensagem pronta.',
        { valor: formatarMoeda(item.valorRestante) }
    );

    return dispararNotificacaoLocalPadrao({
        titulo,
        body,
        tag: item.tag,
        url: item.urlWhatsapp,
        appUrl: `${window.location.origin}/index.html`,
        data: {
            finType: 'cobranca_whatsapp_reminder',
            clienteNome: item.nome,
            dataVencimento: item.data,
            tipoLembrete: item.tipoLembrete
        },
        actions: [
            { action: 'send-reminder', title: t('dashboardPage.notifications.dueReminders.actionSend', 'Enviar lembrete') }
        ]
    });
}

async function verificarLembretesLocaisCobranca({ solicitarPermissao = false } = {}) {
    if (lembretesCobrancaLocaisCheckEmAndamento) return 0;
    lembretesCobrancaLocaisCheckEmAndamento = true;

    try {
        const pendentes = coletarLembretesLocaisCobrancaPendentes();
        if (!pendentes.length) return 0;

        const temPermissao = await garantirPermissaoNotificacaoLembreteCobranca(solicitarPermissao);
        if (!temPermissao) return 0;

        const mapaEnviados = obterMapaLembretesCobrancaLocalEnviados();
        let enviados = 0;

        for (const item of pendentes) {
            const ok = await dispararNotificacaoLembreteCobranca(item);
            if (!ok) continue;

            enviados += 1;
            const agora = Date.now();
            for (const chave of item.registrosParaMarcar) {
                mapaEnviados[chave] = agora;
            }
        }

        if (enviados > 0) salvarMapaLembretesCobrancaLocalEnviados(mapaEnviados);
        return enviados;
    } finally {
        lembretesCobrancaLocaisCheckEmAndamento = false;
    }
}

function iniciarLembretesLocaisCobranca() {
    if (lembretesCobrancaLocaisTimer) clearInterval(lembretesCobrancaLocaisTimer);

    setTimeout(() => {
        verificarNotificacoesLocaisContextoApp({ solicitarPermissao: true }).catch(() => {});
    }, 900);

    lembretesCobrancaLocaisTimer = setInterval(() => {
        verificarNotificacoesLocaisContextoApp({ solicitarPermissao: false }).catch(() => {});
    }, LEMBRETES_COBRANCA_LOCAL_INTERVAL_MS);

    if (!lembretesCobrancaLocaisEventosRegistrados) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                verificarNotificacoesLocaisContextoApp({ solicitarPermissao: false }).catch(() => {});
            }
        });

        window.addEventListener('beforeunload', () => {
            if (lembretesCobrancaLocaisTimer) {
                clearInterval(lembretesCobrancaLocaisTimer);
                lembretesCobrancaLocaisTimer = null;
            }
        }, { once: true });

        lembretesCobrancaLocaisEventosRegistrados = true;
    }
}

function coletarLembretesLocaisDespesasPendentes() {
    const listaDespesas = safeGetJSON(STORAGE.DESPESAS, []);
    if (!Array.isArray(listaDespesas) || !listaDespesas.length) return [];

    const mapaEnviados = obterMapaNotificacoesLocais(STORAGE_LEMBRETES_DESPESA_LOCAL_ENVIADOS);
    const hoje = inicioDoDiaLocal(new Date());
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const itens = [];

    for (const item of listaDespesas) {
        if (!item || item.status === 'pago') continue;

        const dataItem = getVencimentoDate(item.data);
        if (!(dataItem instanceof Date) || !Number.isFinite(dataItem.getTime())) continue;
        dataItem.setHours(0, 0, 0, 0);

        let tipoLembrete = '';
        if (dataItem.getTime() === hoje.getTime()) tipoLembrete = 'hoje';
        else if (dataItem.getTime() === amanha.getTime()) tipoLembrete = 'amanha';
        else continue;

        const despesaId = String(item.id ?? '').trim() || String(item.nome || '').trim().toLowerCase();
        const chave = `v1|${despesaId}|${String(item.data || '')}|${tipoLembrete}`;
        if (Object.prototype.hasOwnProperty.call(mapaEnviados, chave)) continue;

        itens.push({
            chave,
            id: despesaId,
            nome: String(item.nome || 'Despesa').trim() || 'Despesa',
            valor: Number(item.valor) || 0,
            data: String(item.data || ''),
            tipoLembrete,
            dataTimestamp: dataItem.getTime()
        });
    }

    itens.sort((a, b) => (a.dataTimestamp - b.dataTimestamp)
        || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));

    return itens;
}

async function dispararNotificacaoLembreteDespesa(item) {
    if (!item) return false;

    const titulo = item.tipoLembrete === 'amanha'
        ? t('despesas.localNotifications.titleTomorrow', 'Despesa {nome} vence amanha', { nome: item.nome })
        : t('despesas.localNotifications.titleToday', 'Despesa {nome} vence hoje', { nome: item.nome });
    const body = t(
        'despesas.localNotifications.body',
        'Valor: {valor}. Toque para abrir Despesas.',
        { valor: formatarMoeda(item.valor) }
    );

    return dispararNotificacaoLocalPadrao({
        titulo,
        body,
        tag: `despesa-${item.tipoLembrete}-${item.id}-${item.data}`,
        url: `${window.location.origin}/despesas.html`,
        appUrl: `${window.location.origin}/despesas.html`,
        data: {
            finType: 'despesa_due_reminder',
            despesaId: item.id,
            dataVencimento: item.data,
            tipoLembrete: item.tipoLembrete
        }
    });
}

async function verificarLembretesLocaisDespesas({ solicitarPermissao = false } = {}) {
    const pendentes = coletarLembretesLocaisDespesasPendentes();
    if (!pendentes.length) return 0;

    const temPermissao = await garantirPermissaoNotificacaoLembreteCobranca(solicitarPermissao);
    if (!temPermissao) return 0;

    const mapaEnviados = obterMapaNotificacoesLocais(STORAGE_LEMBRETES_DESPESA_LOCAL_ENVIADOS);
    let enviados = 0;
    const limitePorExecucao = 6;

    for (const item of pendentes.slice(0, limitePorExecucao)) {
        const ok = await dispararNotificacaoLembreteDespesa(item);
        if (!ok) continue;
        enviados += 1;
        mapaEnviados[item.chave] = Date.now();
    }

    if (enviados > 0) salvarMapaNotificacoesLocais(STORAGE_LEMBRETES_DESPESA_LOCAL_ENVIADOS, mapaEnviados);
    return enviados;
}

function obterSaldoCarteiraBaixoThreshold() {
    const candidatos = [
        'saldo_carteira_alerta_minimo',
        'wallet_low_balance_threshold',
        'fin_wallet_low_balance_threshold'
    ];
    for (const chave of candidatos) {
        const raw = safeGetItem(chave, '');
        const valor = Number(String(raw || '').replace(',', '.'));
        if (Number.isFinite(valor) && valor >= 0) return valor;
    }
    return ALERTA_SALDO_CARTEIRA_BAIXO_PADRAO;
}

function obterMetaEconomiaObjetivo() {
    const candidatos = [
        'meta_economia_valor',
        'meta_poupanca_valor',
        'savings_goal_value',
        'fin_savings_goal'
    ];
    for (const chave of candidatos) {
        const raw = safeGetItem(chave, '');
        const valor = Number(String(raw || '').replace(',', '.'));
        if (Number.isFinite(valor) && valor > 0) return valor;
    }
    return 0;
}

async function verificarAlertasLocaisSaldoMeta({ solicitarPermissao = false } = {}) {
    const thresholdBaixo = obterSaldoCarteiraBaixoThreshold();
    const metaEconomia = obterMetaEconomiaObjetivo();

    const eventos = [];
    const hojeIso = new Date().toISOString().slice(0, 10);

    if (Number.isFinite(saldoCarteira)) {
        if (saldoCarteira <= 0) {
            eventos.push({
                chave: `saldo-zero|${hojeIso}`,
                titulo: t('economias.localNotifications.walletZeroTitle', 'Saldo da carteira zerou'),
                body: t('economias.localNotifications.walletZeroBody', 'Seu saldo da carteira esta em {valor}. Toque para abrir Economias.', { valor: formatarMoeda(saldoCarteira) }),
                tag: 'wallet-zero',
                url: `${window.location.origin}/economias.html`,
                appUrl: `${window.location.origin}/economias.html`,
                data: { finType: 'wallet_zero' }
            });
        } else if (thresholdBaixo > 0 && saldoCarteira <= thresholdBaixo) {
            eventos.push({
                chave: `saldo-baixo|${hojeIso}|${thresholdBaixo}`,
                titulo: t('economias.localNotifications.walletLowTitle', 'Saldo da carteira perto de zero'),
                body: t('economias.localNotifications.walletLowBody', 'Saldo atual: {valor} (alerta ate {limite}). Toque para abrir Economias.', {
                    valor: formatarMoeda(saldoCarteira),
                    limite: formatarMoeda(thresholdBaixo)
                }),
                tag: 'wallet-low',
                url: `${window.location.origin}/economias.html`,
                appUrl: `${window.location.origin}/economias.html`,
                data: { finType: 'wallet_low', limite: thresholdBaixo }
            });
        }
    }

    if (metaEconomia > 0 && Number.isFinite(saldoPoupanca) && saldoPoupanca >= metaEconomia) {
        eventos.push({
            chave: `meta-poupanca|${metaEconomia}`,
            titulo: t('economias.localNotifications.goalReachedTitle', 'Meta de economia atingida'),
            body: t('economias.localNotifications.goalReachedBody', 'Poupanca em {valor} (meta {meta}). Toque para abrir Economias.', {
                valor: formatarMoeda(saldoPoupanca),
                meta: formatarMoeda(metaEconomia)
            }),
            tag: `savings-goal-${metaEconomia}`,
            url: `${window.location.origin}/economias.html`,
            appUrl: `${window.location.origin}/economias.html`,
            data: { finType: 'savings_goal_reached', meta: metaEconomia }
        });
    }

    if (!eventos.length) return 0;

    const temPermissao = await garantirPermissaoNotificacaoLembreteCobranca(solicitarPermissao);
    if (!temPermissao) return 0;

    const mapaEnviados = obterMapaNotificacoesLocais(STORAGE_ALERTAS_SISTEMA_LOCAL_ENVIADOS);
    let enviados = 0;

    for (const evento of eventos) {
        if (Object.prototype.hasOwnProperty.call(mapaEnviados, evento.chave)) continue;
        const ok = await dispararNotificacaoLocalPadrao(evento);
        if (!ok) continue;
        enviados += 1;
        mapaEnviados[evento.chave] = Date.now();
    }

    if (enviados > 0) salvarMapaNotificacoesLocais(STORAGE_ALERTAS_SISTEMA_LOCAL_ENVIADOS, mapaEnviados);
    return enviados;
}

function jaNotificouStatusMercadoPago(paymentId, status) {
    const id = String(paymentId || '').trim();
    const st = String(status || '').trim().toLowerCase();
    if (!id || !st) return true;
    const mapa = obterMapaNotificacoesLocais(STORAGE_MP_STATUS_NOTIFICADOS);
    return Boolean(mapa[`${id}|${st}`]);
}

function marcarStatusMercadoPagoNotificado(paymentId, status) {
    const id = String(paymentId || '').trim();
    const st = String(status || '').trim().toLowerCase();
    if (!id || !st) return false;
    const mapa = obterMapaNotificacoesLocais(STORAGE_MP_STATUS_NOTIFICADOS);
    mapa[`${id}|${st}`] = Date.now();
    salvarMapaNotificacoesLocais(STORAGE_MP_STATUS_NOTIFICADOS, mapa);
    return true;
}

async function notificarStatusMercadoPagoTerminal({ paymentId = '', status = '', detalhe = '', referencia = '' } = {}) {
    const st = String(status || '').trim().toLowerCase();
    const id = String(paymentId || '').trim();
    if (!id || !st || st === 'approved' || st === 'pending' || st === 'in_process' || st === 'authorized') return false;
    if (jaNotificouStatusMercadoPago(id, st)) return false;

    const mapaTitulos = {
        rejected: t('dashboardPage.notifications.mercadoPago.failedRejectedTitle', 'Pagamento Mercado Pago recusado'),
        cancelled: t('dashboardPage.notifications.mercadoPago.failedCancelledTitle', 'Pagamento Mercado Pago cancelado'),
        expired: t('dashboardPage.notifications.mercadoPago.failedExpiredTitle', 'Pagamento Mercado Pago expirou')
    };
    const titulo = mapaTitulos[st] || t('dashboardPage.notifications.mercadoPago.failedGenericTitle', 'Falha no pagamento Mercado Pago');
    const body = detalhe
        ? t('dashboardPage.notifications.mercadoPago.failedBodyDetail', '{detalhe}. Toque para revisar.', { detalhe })
        : t('dashboardPage.notifications.mercadoPago.failedBody', 'O pagamento nao foi concluido. Toque para revisar no painel.');

    const permitiu = await garantirPermissaoNotificacaoLembreteCobranca(false);
    if (!permitiu) return false;

    const ok = await dispararNotificacaoLocalPadrao({
        titulo,
        body,
        tag: `mp-status-${id}-${st}`,
        url: `${window.location.origin}/index.html`,
        appUrl: `${window.location.origin}/index.html`,
        data: { finType: 'mercadopago_status_terminal', paymentId: id, status: st, referencia: String(referencia || '') }
    });
    if (ok) marcarStatusMercadoPagoNotificado(id, st);
    return ok;
}

async function verificarNotificacoesLocaisContextoApp({ solicitarPermissao = false } = {}) {
    await Promise.allSettled([
        verificarLembretesLocaisCobranca({ solicitarPermissao }),
        verificarLembretesLocaisDespesas({ solicitarPermissao: false }),
        verificarAlertasLocaisSaldoMeta({ solicitarPermissao: false })
    ]);
}

function normalizarFormaPagamento(valor) {
    const bruto = String(valor ?? '').trim().toLowerCase();
    if (!bruto) return '';

    const chave = (typeof bruto.normalize === 'function' ? bruto.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : bruto)
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');

    if (['mercadopago', 'mercado_pago', 'mp'].includes(chave)) return 'mercado_pago';
    if (Object.prototype.hasOwnProperty.call(FORMAS_PAGAMENTO_META, chave)) return chave;
    return '';
}

function obterMetaFormaPagamento(formaPagamento) {
    const chave = normalizarFormaPagamento(formaPagamento);
    if (!chave) return null;
    return { chave, ...FORMAS_PAGAMENTO_META[chave] };
}

function obterFormaPagamentoHistorico(item) {
    const formaSalva = normalizarFormaPagamento(item?.formaPagamento);
    if (formaSalva) return formaSalva;
    if (String(item?.categoria || '') === 'mercado_pago') return 'mercado_pago';
    return '';
}

function criarBadgeFormaPagamentoHTML(formaPagamento, classeExtra = '') {
    const meta = obterMetaFormaPagamento(formaPagamento);
    if (!meta) return '';

    const classes = ['badge-forma-pagamento'];
    if (classeExtra) classes.push(classeExtra);

    return `
        <span class="${classes.join(' ')}" title="Forma de pagamento: ${escapeHtml(meta.rotulo)}">
            <i class="fa-solid ${meta.icone}" aria-hidden="true"></i>
            <span>${escapeHtml(meta.rotulo)}</span>
        </span>
    `;
}

function obterRotuloCategoriaExtrato(item) {
    const categoria = String(item?.categoria || '').trim();
    if (!categoria) return t('economias.extrato.details.noCategory', 'Sem categoria');
    return CATEGORIAS_EXTRATO_ROTULOS[categoria] || categoria.replace(/_/g, ' ');
}

function obterRotuloTipoExtrato(item) {
    const isEntrada = item?.tipo === 'depositar' || item?.tipo === 'entrada';
    return isEntrada
        ? t('economias.extrato.details.typeIn', 'Entrada')
        : t('economias.extrato.details.typeOut', 'Saida');
}

function formatarDataHoraDetalhadaExtrato(item) {
    const timestamp = Number(item?.timestamp);
    if (Number.isFinite(timestamp)) {
        const data = new Date(timestamp);
        if (!Number.isNaN(data.getTime())) {
            return data.toLocaleString(localeAtualI18n(), {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }
    return String(item?.data || '-');
}

function montarDetalhesExtratoHTML(item) {
    const forma = obterMetaFormaPagamento(obterFormaPagamentoHistorico(item))?.rotulo || t('economias.extrato.details.notInformed', 'Nao informado');
    const linhas = [
        [t('economias.extrato.details.type', 'Tipo'), obterRotuloTipoExtrato(item)],
        [t('economias.extrato.details.category', 'Categoria'), obterRotuloCategoriaExtrato(item)],
        [t('economias.extrato.details.paymentMethod', 'Forma de pagamento'), forma],
        [t('economias.extrato.details.value', 'Valor'), formatarMoeda(Number(item?.valor) || 0)],
        [t('economias.extrato.details.datetime', 'Data/Hora'), formatarDataHoraDetalhadaExtrato(item)]
    ];

    return linhas.map(([rotulo, valor]) => `
        <div class="item-extrato-det-row">
            <span class="item-extrato-det-label">${escapeHtml(rotulo)}</span>
            <span class="item-extrato-det-value">${escapeHtml(String(valor))}</span>
        </div>
    `).join('');
}

function concluirModalFormaPagamento(valor) {
    const modal = getEl(MODAL_FORMA_PAGAMENTO_ID);
    if (modal) modal.style.display = 'none';

    const resolver = resolverModalFormaPagamento;
    resolverModalFormaPagamento = null;
    if (typeof resolver === 'function') resolver(valor);
    return true;
}

function fecharModalFormaPagamento() {
    return concluirModalFormaPagamento(null);
}

function garantirModalFormaPagamento() {
    if (!document?.body) return null;

    let modal = document.getElementById(MODAL_FORMA_PAGAMENTO_ID);
    if (modal) return modal;

    const botoes = FORMAS_PAGAMENTO_MANUAL.map(chave => {
        const meta = FORMAS_PAGAMENTO_META[chave];
        return `
            <button type="button" class="btn-forma-pagamento-opcao" data-forma-pagamento="${chave}">
                <i class="fa-solid ${meta.icone}" aria-hidden="true"></i>
                <span>${escapeHtml(meta.rotulo)}</span>
            </button>
        `;
    }).join('');

    modal = document.createElement('div');
    modal.id = MODAL_FORMA_PAGAMENTO_ID;
    modal.className = 'modal-geral modal-forma-pagamento';
    modal.innerHTML = `
        <div class="modal-content modal-forma-pagamento-conteudo" role="dialog" aria-modal="true" aria-labelledby="modal-forma-pagamento-titulo">
            <span class="close-modal" data-acao="cancelar-forma-pagamento">&times;</span>
            <h3 id="modal-forma-pagamento-titulo">Forma de pagamento</h3>
            <p class="forma-pagamento-manual-subtitulo" id="forma-pagamento-manual-subtitulo"></p>
            <div class="forma-pagamento-manual-opcoes">${botoes}</div>
            <div class="forma-pagamento-manual-acoes">
                <button type="button" class="btn-mini" data-acao="cancelar-forma-pagamento">Cancelar</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', event => {
        if (event.target === modal) fecharModalFormaPagamento();
    });

    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            fecharModalFormaPagamento();
        }
    });

    modal.querySelectorAll('[data-acao="cancelar-forma-pagamento"]').forEach(botao => {
        botao.addEventListener('click', fecharModalFormaPagamento);
    });

    modal.querySelectorAll('[data-forma-pagamento]').forEach(botao => {
        botao.addEventListener('click', () => {
            concluirModalFormaPagamento(botao.getAttribute('data-forma-pagamento') || '');
        });
    });

    document.body.appendChild(modal);
    return modal;
}

function solicitarFormaPagamentoManual(cliente, valor) {
    const modal = garantirModalFormaPagamento();
    if (!modal || typeof Promise !== 'function') return Promise.resolve('');

    if (typeof resolverModalFormaPagamento === 'function') {
        const resolverAnterior = resolverModalFormaPagamento;
        resolverModalFormaPagamento = null;
        resolverAnterior(null);
    }

    const subtitulo = modal.querySelector('#forma-pagamento-manual-subtitulo');
    if (subtitulo) {
        const nomeCliente = String(cliente?.nome || 'Cliente').trim() || 'Cliente';
        const valorNumerico = Number(valor);
        const valorTexto = Number.isFinite(valorNumerico) && valorNumerico > 0 ? ` (${formatarMoeda(valorNumerico)})` : '';
        subtitulo.textContent = `Como foi recebido de ${nomeCliente}${valorTexto}?`;
    }

    modal.style.display = 'flex';

    const primeiroBotao = modal.querySelector('[data-forma-pagamento]');
    if (primeiroBotao && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => primeiroBotao.focus());
    }

    return new Promise(resolve => {
        resolverModalFormaPagamento = resolve;
    });
}

function extrairReferenciaHistorico(item) {
    if (!item) return null;

    const timestamp = Number(item.timestamp);
    if (Number.isFinite(timestamp)) {
        const data = new Date(timestamp);
        const mes = data.getMonth();
        const ano = data.getFullYear();
        if (!Number.isInteger(mes)) return null;
        return { mes, ano };
    }

    const textoData = String(item.data ?? '');
    const match = textoData.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
    if (!match) return null;

    const mes = Number(match[2]) - 1;
    if (!Number.isInteger(mes) || mes < 0 || mes > 11) return null;

    const ano = match[3] ? Number(match[3]) : new Date().getFullYear();
    if (!Number.isInteger(ano)) return null;

    return { mes, ano };
}

function calcularSaldoHistoricoDoMes(listaDados) {
    const anoAtual = new Date().getFullYear();
    return (listaDados || []).reduce((total, item) => {
        const referencia = extrairReferenciaHistorico(item);
        if (!referencia) return total;
        if (referencia.ano !== anoAtual || referencia.mes !== mesAtivo) return total;

        const valor = Number(item.valor) || 0;
        const isEntrada = item.tipo === 'depositar' || item.tipo === 'entrada';
        return total + (isEntrada ? valor : -valor);
    }, 0);
}

function obterDataReferenciaMesSelecionado() {
    const agora = new Date();
    if (!isPaginaEconomias()) return agora;

    const ano = agora.getFullYear();
    const ultimoDiaMes = new Date(ano, mesAtivo + 1, 0).getDate();
    const dia = Math.min(agora.getDate(), ultimoDiaMes);

    return new Date(
        ano,
        mesAtivo,
        dia,
        agora.getHours(),
        agora.getMinutes(),
        agora.getSeconds(),
        agora.getMilliseconds()
    );
}

function obterDataReferenciaPorIso(dataIso) {
    const base = getVencimentoDate(dataIso);
    if (Number.isNaN(base.getTime())) return obterDataReferenciaMesSelecionado();

    const agora = new Date();
    base.setHours(
        agora.getHours(),
        agora.getMinutes(),
        agora.getSeconds(),
        agora.getMilliseconds()
    );
    return base;
}

function formatarDataIsoLocal(valor) {
    const data = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(data.getTime())) return new Date().toISOString().split('T')[0];

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function gerarIdDespesaAutoCarteira() {
    sequenciaIdDespesaAutoCarteira = (sequenciaIdDespesaAutoCarteira + 1) % 1000;
    return (Date.now() * 1000) + sequenciaIdDespesaAutoCarteira;
}

function adicionarDespesaAutomaticaPorSaidaCarteira(valor, descricao, dataReferencia) {
    try {
        const despesas = safeGetJSON(STORAGE.DESPESAS, []);
        despesas.push({
            id: gerarIdDespesaAutoCarteira(),
            nome: String(descricao || '').trim() || 'Retirada da carteira',
            valor: Number(valor) || 0,
            data: formatarDataIsoLocal(dataReferencia),
            status: 'pago',
            recorrente: false,
            baseRecorrenteId: null,
            origem: 'extrato_carteira_manual'
        });
        safeSetJSON(STORAGE.DESPESAS, despesas);
        return true;
    } catch (erro) {
        console.error('Falha ao criar despesa automatica pela saida da carteira:', erro);
        return false;
    }
}

function filtrarHistoricoPorMes(listaDados) {
    const anoAtual = new Date().getFullYear();
    return (listaDados || []).filter(item => {
        const referencia = extrairReferenciaHistorico(item);
        if (!referencia) return true;
        return referencia.ano === anoAtual && referencia.mes === mesAtivo;
    });
}

limitarHistorico(historicoCarteira);
limitarHistorico(historicoPoupanca);

/* =========================================
   Persistencia
   ========================================= */
function salvarCobrancas() {
    safeSetJSON(STORAGE_CLIENTES, cobrancas);
}

function salvarCarteira() {
    safeSetItem(STORAGE_SALDO, String(saldoCarteira));
    safeSetJSON(STORAGE_HISTORICO, historicoCarteira);
}

function sincronizarCarteiraDoStorageExterno() {
    saldoCarteira = safeGetNumber(STORAGE_SALDO, saldoCarteira);
    historicoCarteira = safeGetJSON(STORAGE_HISTORICO, historicoCarteira);
    if (Array.isArray(historicoCarteira)) limitarHistorico(historicoCarteira);
    if (isPaginaEconomias()) atualizarInterfaceEconomias();
}

window.__finSyncCarteiraFromStorage = sincronizarCarteiraDoStorageExterno;

function salvarPoupanca() {
    safeSetItem(STORAGE_POUPANCA, String(saldoPoupanca));
    safeSetJSON(STORAGE_HIST_POUPANCA, historicoPoupanca);
}

/* =========================================
   Navegacao UI
   ========================================= */
function toggleSidebar() {
    toggleSidebarPadrao();
}

function fecharSidebarMobile() {
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.add('sidebar-closed');
}

function abrirModoComercio() {
    const larguraTela = window.screen?.availWidth || 1280;
    const alturaTela = window.screen?.availHeight || 900;
    const largura = Math.max(980, Math.min(1280, Math.floor(larguraTela * 0.92)));
    const altura = Math.max(700, Math.min(900, Math.floor(alturaTela * 0.9)));
    const left = Math.max(0, Math.floor((larguraTela - largura) / 2));
    const top = Math.max(0, Math.floor((alturaTela - altura) / 2));
    const features = [
        `width=${largura}`,
        `height=${altura}`,
        `left=${left}`,
        `top=${top}`,
        'resizable=yes',
        'scrollbars=yes'
    ].join(',');

    const popup = window.open('comercio.html', 'finances_modo_comercio', features);
    if (popup && typeof popup.focus === 'function') {
        popup.focus();
        return true;
    }

    window.location.href = 'comercio.html';
    return false;
}

function aplicarEstadoInicialSidebar() {
    aplicarEstadoInicialSidebarPadrao({ storageKey: STORAGE_SIDEBAR_RETORNO_FECHADA });
}

function voltarComSidebarFechada(destino = 'index.html') {
    safeSetItem(STORAGE_SIDEBAR_RETORNO_FECHADA, '1');
    safeSetItem(STORAGE_PULAR_SPLASH_ENTRADA, '1');
    const resolvedDestino = (window.FinCommon && typeof window.FinCommon.resolveMenuHrefWithAutoPatchNotes === 'function')
        ? window.FinCommon.resolveMenuHrefWithAutoPatchNotes(destino)
        : destino;
    window.location.href = resolvedDestino;
}

function iniciarAutoOcultarSubtituloEconomias() {
    const subtitulo = document.querySelector('.subtitulo-economias');
    if (!subtitulo) return;

    setTimeout(() => {
        subtitulo.classList.add('oculto');
    }, 8000);
}

function iniciarParticulasSplash() {
    const canvas = document.getElementById('intro-splash-canvas');
    if (!canvas) return;

    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzirMovimento) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const start = performance.now();

    const particles = [];
    const maxParticulas = Math.min(90, Math.max(35, Math.floor((window.innerWidth * window.innerHeight) / 26000)));

    const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth = window.innerWidth;
        h = canvas.clientHeight = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rand = (min, max) => min + Math.random() * (max - min);

    const spawn = () => {
        particles.length = 0;
        for (let i = 0; i < maxParticulas; i += 1) {
            particles.push({
                x: rand(0, w),
                y: rand(0, h),
                r: rand(0.8, 2.6),
                vx: rand(-0.10, 0.10),
                vy: rand(-0.06, 0.14),
                a: rand(0.10, 0.42),
                tw: rand(0.004, 0.012),
                ph: rand(0, Math.PI * 2)
            });
        }
    };

    const draw = t => {
        const time = t - start;

        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, 0, w, h);

        for (const p of particles) {
            p.x += p.vx * (1 + Math.sin(time * 0.001));
            p.y += p.vy * (1 + Math.cos(time * 0.001));

            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            if (p.y > h + 10) p.y = -10;

            const twinkle = 0.55 + 0.45 * Math.sin(time * p.tw + p.ph);
            const alpha = p.a * twinkle;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < particles.length; i += 1) {
            const a = particles[i];
            for (let j = i + 1; j < particles.length; j += 1) {
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 120 * 120) {
                    const d = Math.sqrt(d2);
                    const alpha = (1 - d / 120) * 0.08;
                    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
        resize();
        spawn();
    };

    window.addEventListener('resize', onResize, { passive: true });
    resize();
    spawn();
    raf = requestAnimationFrame(draw);

    const splash = document.getElementById('intro-splash');
    const stop = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
    };

    const obs = new MutationObserver(() => {
        if (!splash || !splash.isConnected) {
            stop();
            obs.disconnect();
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

function prepararSomSplash() {
    const btn = document.getElementById('intro-splash-sound');
    if (!btn) return;

    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzirMovimento) {
        btn.style.display = 'none';
        return;
    }

    let ctx = null;

    const tocar = async () => {
        try {
            ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
            await ctx.resume();

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.30);

            btn.textContent = 'som ligado';
            btn.disabled = true;
            btn.style.opacity = '0.55';
        } catch (_) {
            btn.style.display = 'none';
        }
    };

    btn.addEventListener('click', tocar, { once: true });
}

function ativarParallaxLogo() {
    const logo = document.querySelector('.logo-svg-pro');
    if (!logo) return;

    document.addEventListener('mousemove', e => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        logo.style.transform = `scale(1) rotateX(${y}deg) rotateY(${x}deg)`;
    });
}

function iniciarSplashAbertura() {
    const splash = getEl('intro-splash');
    if (!splash) {
        iniciarAnimacaoEntradaPagina();
        return;
    }

    if (safeGetItem(STORAGE_PULAR_SPLASH_ENTRADA) === '1') {
        safeRemoveItem(STORAGE_PULAR_SPLASH_ENTRADA);
        splash.remove();
        iniciarAnimacaoEntradaPagina();
        return;
    }

    iniciarParticulasSplash();
    ativarParallaxLogo();
    prepararSomSplash();

    const barraProgresso = splash.querySelector('.intro-splash-progress-fill');

    const atrasoWordmark = Math.max(0, DURACAO_SPLASH_TOTAL - DURACAO_SPLASH_FADE);
    const duracaoProgresso = Math.max(1, atrasoWordmark);
    const inicio = performance.now();

    const atualizarBarra = agora => {
        if (!barraProgresso || !splash.isConnected) return;
        const progresso = Math.min(1, (agora - inicio) / duracaoProgresso);
        barraProgresso.style.transform = `scaleX(${progresso})`;
        if (progresso < 1) requestAnimationFrame(atualizarBarra);
    };

    if (barraProgresso) requestAnimationFrame(atualizarBarra);

    setTimeout(() => {
        splash.classList.add('splash-show-wordmark');
    }, atrasoWordmark);

    setTimeout(() => {
        iniciarAnimacaoEntradaPagina();
        splash.classList.add('splash-fade');
    }, atrasoWordmark + DURACAO_SPLASH_TELA_WORDMARK);

    setTimeout(() => {
        splash.classList.add('splash-hidden');
        splash.remove();
    }, atrasoWordmark + DURACAO_SPLASH_TELA_WORDMARK + DURACAO_SPLASH_FADE + 40);
}

function parseValorEdicao(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return NaN;

    // Aceita formatos com virgula/ponto e remove separador de milhar quando necessario.
    const normalizado = texto.includes(',')
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto;

    return Number.parseFloat(normalizado);
}

function formatarValorEdicao(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    return numero.toFixed(2).replace('.', ',');
}

function normalizarCampoValorEdicao(input) {
    if (!input) return;
    const valor = parseValorEdicao(input.value);
    input.value = Number.isFinite(valor) ? formatarValorEdicao(valor) : '';
}

function prepararLimpezaCampoValor(input) {
    if (!input) return;

    input.addEventListener('focus', () => {
        if (input.dataset.autoClearArmed === '1') {
            input.dataset.autoClearOriginal = input.value;
            input.dataset.autoClearPending = '1';
            input.dataset.autoClearDigitou = '0';
            input.value = '';
            input.dataset.autoClearArmed = '0';
            return;
        }

        input.select();
    });

    input.addEventListener('input', () => {
        if (input.dataset.autoClearPending === '1') {
            input.dataset.autoClearDigitou = '1';
        }
    });

    input.addEventListener('blur', () => {
        const aguardandoAutoRestore = input.dataset.autoClearPending === '1';
        const digitouAlgo = input.dataset.autoClearDigitou === '1';
        const valorVazio = input.value.trim() === '';

        if (aguardandoAutoRestore && !digitouAlgo && valorVazio) {
            input.value = input.dataset.autoClearOriginal || '';
        } else {
            normalizarCampoValorEdicao(input);
        }

        input.dataset.autoClearPending = '0';
        input.dataset.autoClearDigitou = '0';
        input.dataset.autoClearOriginal = '';
    });
}

function configurarGestosSidebarMobile() {
    configurarGestosSidebarMobilePadrao();
}

function obterDataIsoCadastroNoMesSelecionado(dataIsoBase = '') {
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const baseValida = /^\d{4}-\d{2}-\d{2}$/.test(String(dataIsoBase || '').trim());
    const dataBase = baseValida ? getVencimentoDate(dataIsoBase) : new Date(anoAtual, mesAtivo, agora.getDate());
    const ano = Number.isFinite(dataBase.getFullYear()) ? dataBase.getFullYear() : anoAtual;
    const diaDesejado = Number.isFinite(dataBase.getDate()) ? dataBase.getDate() : agora.getDate();
    const ultimoDiaMes = new Date(ano, mesAtivo + 1, 0).getDate();
    const dia = Math.min(Math.max(1, diaDesejado), ultimoDiaMes);

    return formatarDataIsoLocal(new Date(ano, mesAtivo, dia));
}

function sincronizarDataCadastroComMesSelecionado(forcar = false) {
    const dataEl = getEl('data');
    if (!dataEl) return;

    const valorAtual = String(dataEl.value || '').trim();
    if (!forcar && valorAtual) {
        const dataAtual = getVencimentoDate(valorAtual);
        if (!Number.isNaN(dataAtual.getTime()) && dataAtual.getMonth() === mesAtivo) return;
    }

    dataEl.value = obterDataIsoCadastroNoMesSelecionado(valorAtual);
}

function toggleFormCadastro() {
    const modal = getEl('container-cadastro');
    if (!modal) return;
    const abrindo = modal.style.display !== 'flex';
    modal.style.display = abrindo ? 'flex' : 'none';

    if (abrindo) {
        sincronizarDataCadastroComMesSelecionado(true);
    }
}

/* =========================================
   Dashboard de cobrancas
   ========================================= */
function adicionarCobranca() {
    const nomeEl = getEl('nome');
    const valorEl = getEl('valor');
    const dataEl = getEl('data');
    const repetirEl = getEl('repetir');
    const telefoneEl = getEl('telefone');

    if (!nomeEl || !valorEl || !dataEl || !repetirEl || !telefoneEl) return;

    const nome = nomeEl.value.trim();
    const valor = Number(valorEl.value);
    const data = obterDataIsoCadastroNoMesSelecionado(dataEl.value);
    const repetir = Math.max(1, parseInt(repetirEl.value, 10) || 1);
    const telefone = telefoneEl.value.trim();

    if (!nome || !Number.isFinite(valor) || valor <= 0 || !data) {
        alert(t('script.alerts.fillFields', 'Preencha todos os campos.'));
        return;
    }

    const idBase = Date.now() * 1000;
    for (let i = 0; i < repetir; i++) {
        const vencimento = getVencimentoDate(data);
        vencimento.setDate(vencimento.getDate() + (i * 7));

        cobrancas.push({
            id: idBase + i,
            nome: repetir > 1 ? `${nome} (${i + 1}/${repetir})` : nome,
            telefone,
            valor: valor.toFixed(2),
            pagoParcial: '0.00',
            data: formatarDataIsoLocal(vencimento),
            pago: false,
            formaPagamento: ''
        });
    }

    dataEl.value = obterDataIsoCadastroNoMesSelecionado(data);
    toggleFormCadastro();
    atualizarTudo();
}

async function togglePago(id) {
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;

    const cliente = cobrancas[index];
    const valorTotal = Number(cliente.valor) || 0;
    const valorJaPago = Number(cliente.pagoParcial) || 0;
    const dataReferenciaCliente = obterDataReferenciaPorIso(cliente.data);
    let notificarConclusao = null;

    if (!cliente.pago) {
        const valorAReceber = valorTotal - valorJaPago;
        if (valorAReceber > 0) {
            const formaPagamento = normalizarFormaPagamento(await solicitarFormaPagamentoManual(cliente, valorAReceber));
            if (!formaPagamento) return;
            cliente.pago = true;
            cliente.pagoParcial = cliente.valor;
            cliente.formaPagamento = formaPagamento;
            registrarTransacaoCarteira(
                'entrada',
                valorAReceber,
                `Recebido: ${cliente.nome}`,
                dataReferenciaCliente,
                'recebimento_manual',
                { formaPagamento }
            );
            notificarConclusao = {
                origem: 'manual',
                valorRecebido: valorAReceber,
                formaPagamento,
                solicitarPermissaoBrowser: true
            };
        }
    } else {
        if (valorJaPago > 0) {
            registrarTransacaoCarteira(
                'saida',
                valorJaPago,
                `Estorno: ${cliente.nome}`,
                dataReferenciaCliente,
                'estorno_recebimento',
                { formaPagamento: cliente.formaPagamento }
            );
            alert(t('script.alerts.reversalDone', 'Estorno realizado: {valor} removido da carteira.', { valor: formatarMoeda(valorJaPago) }));
        }
        cliente.pago = false;
        cliente.pagoParcial = '0.00';
        cliente.formaPagamento = '';
    }

    cobrancas[index] = cliente;
    atualizarTudo();
    if (notificarConclusao) notificarPagamentoConcluido(cliente, notificarConclusao);
}

function registrarTransacaoCarteira(tipo, valor, descricao, dataReferencia = new Date(), categoria = '', opcoes = {}) {
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return;
    const dataHistorico = dataReferencia instanceof Date ? new Date(dataReferencia.getTime()) : new Date();
    if (Number.isNaN(dataHistorico.getTime())) return;
    const formaPagamento = normalizarFormaPagamento(opcoes?.formaPagamento);

    if (tipo === 'entrada') saldoCarteira += valorNumerico;
    else saldoCarteira -= valorNumerico;

    const itemHistorico = {
        tipo: tipo === 'entrada' ? 'depositar' : 'sacar',
        valor: valorNumerico,
        descricao,
        categoria: String(categoria || ''),
        timestamp: dataHistorico.getTime(),
        data: dataHistorico.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    };

    if (formaPagamento) itemHistorico.formaPagamento = formaPagamento;
    historicoCarteira.unshift(itemHistorico);

    limitarHistorico(historicoCarteira);
    salvarCarteira();
    atualizarInterfaceEconomias();
}

function criarItemHTML(cliente, hoje) {
    const valorTotal = Number(cliente.valor) || 0;
    const valorPago = Number(cliente.pagoParcial) || 0;
    const valorFaltante = Math.max(0, valorTotal - valorPago);
    const dataVencimento = getVencimentoDate(cliente.data);
    const progresso = valorTotal > 0 ? Math.min(100, (valorPago / valorTotal) * 100) : 0;
    const estaAtrasado = !cliente.pago && dataVencimento < hoje;
    const diasAtraso = estaAtrasado
        ? Math.max(1, Math.floor((hoje.getTime() - dataVencimento.getTime()) / 86400000))
        : 0;
    const classe = cliente.pago ? 'pago-row' : (estaAtrasado ? 'atrasado-row' : 'pendente-row');
    const badgeFormaPagamento = cliente.pago
        ? criarBadgeFormaPagamentoHTML(cliente.formaPagamento, 'badge-forma-pagamento-cliente')
        : '';
    const textoAtraso = diasAtraso === 1
        ? t('dashboardPage.overdueBadge.oneDay', '1 dia de atraso')
        : t('dashboardPage.overdueBadge.manyDays', '{dias} dias de atraso', { dias: diasAtraso });
    const badgeAtraso = estaAtrasado
        ? `
            <div class="cliente-atraso-badge" title="${escapeHtml(textoAtraso)}">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                <span>${escapeHtml(textoAtraso)}</span>
            </div>
          `
        : '';
    return `
        <div class="${classe} cliente-card">
            <div class="cliente-card-topo">
                <div class="cliente-card-identificacao">
                    <strong>${escapeHtml(cliente.nome)}</strong>
                    <br>
                    <small>${escapeHtml(formatarDataBr(cliente.data))}</small>
                    ${badgeAtraso}
                    ${badgeFormaPagamento ? `<div class="cliente-forma-pagamento-wrap">${badgeFormaPagamento}</div>` : ''}
                </div>
                <div class="acoes">
                    <button class="btn-proximo" onclick="copiarProximo(${cliente.id})" aria-label="Copiar para o prÃ³ximo mÃªs"><i class="fa-solid fa-forward" aria-hidden="true"></i></button>
                    <button onclick="abrirMenuWhats(${cliente.id})" class="btn-whatsapp"><i class="fab fa-whatsapp" aria-hidden="true"></i></button>
                    <button class="btn-editar" onclick="abrirEdicao(${cliente.id})" aria-label="Editar"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                    <button class="btn-pagar" onclick="togglePago(${cliente.id})" aria-label="${cliente.pago ? 'Desmarcar como pago' : 'Marcar como pago'}"><i class="fa-solid ${cliente.pago ? 'fa-rotate-left' : 'fa-check'}" aria-hidden="true"></i></button>
                    <button class="btn-excluir" onclick="excluir(${cliente.id})" aria-label="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                </div>
            </div>
            <div class="progress-container"><div class="progress-bar" style="width:${progresso}%"></div></div>
            <div class="info-valores">
                <span style="color:var(--success)">${escapeHtml(t('dashboardPage.clientAmounts.paid', 'Pago'))}: ${formatarMoeda(valorPago)}</span>
                <span style="color:var(--danger)">${escapeHtml(t('dashboardPage.clientAmounts.remaining', 'Falta'))}: ${formatarMoeda(valorFaltante)}</span>
                <span style="color:var(--text-muted)">${escapeHtml(t('dashboardPage.clientAmounts.total', 'Total'))}: ${formatarMoeda(valorTotal)}</span>
            </div>
        </div>
    `;
}

function atualizarContadorBusca(totalClientes, termoBusca) {
    const contador = getEl('contador-busca');
    if (!contador) return;

    if (!termoBusca) {
        contador.hidden = true;
        contador.textContent = '';
        return;
    }

    const plural = totalClientes === 1 ? 'cliente' : 'clientes';
    contador.textContent = `${totalClientes} ${plural}`;
    contador.hidden = false;
}

function alternarPainelNotificacoes(forcarAberto = null) {
    const container = getEl('notificacoes-hoje');
    const botao = getEl('btn-notificacoes-hoje');
    const painel = getEl('notificacoes-hoje-painel');
    if (!container || !botao || !painel) return;

    const abrir = typeof forcarAberto === 'boolean' ? forcarAberto : painel.hidden;
    painel.hidden = !abrir;
    container.classList.toggle('aberto', abrir);
    botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

function configurarPainelNotificacoes() {
    const container = getEl('notificacoes-hoje');
    const botao = getEl('btn-notificacoes-hoje');
    const painel = getEl('notificacoes-hoje-painel');
    const botaoAlternar = getEl('btn-notificacoes-hoje-alternar');
    if (!container || !botao || !painel) return;

    botao.addEventListener('click', event => {
        event.stopPropagation();
        notificacaoSinoJaClicado = true;
        botao.classList.remove('balancando');
        alternarPainelNotificacoes();
    });

    if (botaoAlternar) {
        botaoAlternar.addEventListener('click', event => {
            event.stopPropagation();
            modoNotificacoesHoje = modoNotificacoesHoje === 'hoje' ? 'vencidas' : 'hoje';
            atualizarNotificacoesPagamentoHoje();
        });
    }

    painel.addEventListener('click', event => {
        const botaoCobrar = event.target?.closest?.('[data-notificacao-cobrar]');
        if (botaoCobrar) {
            event.preventDefault();
            cobrarNotificacaoPainel({
                telefone: botaoCobrar.dataset.telefone || '',
                nome: botaoCobrar.dataset.nome || '',
                data: botaoCobrar.dataset.data || '',
                valorRestante: Number(botaoCobrar.dataset.valor || 0),
                tipo: botaoCobrar.dataset.tipo || ''
            });
        }
        event.stopPropagation();
    });

    document.addEventListener('click', event => {
        if (!container.contains(event.target)) alternarPainelNotificacoes(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') alternarPainelNotificacoes(false);
    });
}

function agruparNotificacoesPendentes(filtroData) {
    const grupos = new Map();

    for (const cliente of cobrancas) {
        if (cliente.pago) continue;

        const dataVencimento = getVencimentoDate(cliente.data);
        dataVencimento.setHours(0, 0, 0, 0);
        if (!filtroData(dataVencimento)) continue;

        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;
        const valorRestante = Math.max(0, valorTotal - valorPago);
        if (valorRestante <= 0) continue;

        const nomeBase = String(cliente.nome || '').split(' (')[0];
        if (!grupos.has(nomeBase)) {
            grupos.set(nomeBase, {
                nome: nomeBase,
                data: cliente.data,
                dataTimestamp: dataVencimento.getTime(),
                telefone: normalizarTelefoneWhatsapp(cliente.telefone),
                valorRestante: 0,
                quantidade: 0
            });
        }

        const acumulado = grupos.get(nomeBase);
        acumulado.valorRestante += valorRestante;
        acumulado.quantidade += 1;
        if (!acumulado.telefone) acumulado.telefone = normalizarTelefoneWhatsapp(cliente.telefone);

        const dataIsoAtual = String(cliente.data || '');
        if (dataVencimento.getTime() < acumulado.dataTimestamp || !acumulado.data) {
            acumulado.data = dataIsoAtual;
            acumulado.dataTimestamp = dataVencimento.getTime();
        }
    }

    const notificacoes = Array.from(grupos.values());
    notificacoes.sort((a, b) => {
        const ordemData = (a.dataTimestamp || 0) - (b.dataTimestamp || 0);
        if (ordemData !== 0) return ordemData;
        const ordemNome = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
        if (ordemNome !== 0) return ordemNome;
        return a.valorRestante - b.valorRestante;
    });

    return notificacoes;
}

function getNotificacoesPagamentoHoje() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return agruparNotificacoesPendentes(dataVencimento => dataVencimento.getTime() === hoje.getTime());
}

function getNotificacoesPagamentoVencidas() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return agruparNotificacoesPendentes(dataVencimento => dataVencimento.getTime() < hoje.getTime());
}

function cobrarNotificacaoPainel(payload = {}) {
    const telefone = String(payload?.telefone || '').trim();
    const nome = String(payload?.nome || '').trim() || t('dashboardPage.modals.whatsapp.customerFallbackName', 'Cliente');
    const data = String(payload?.data || '').trim();
    const valorRestante = Number(payload?.valorRestante) || 0;
    const tipo = String(payload?.tipo || '').trim() === 'vencidas' ? 'atrasado' : 'hoje';

    if (!telefone) {
        alert(t('dashboardPage.notifications.whatsapp.noPhone', 'Cliente sem WhatsApp valido para cobranca automatica.'));
        return false;
    }

    const texto = montarMensagemWhatsappLembreteCobranca({ nome, data, telefone }, tipo, valorRestante);
    if (!abrirWhatsComTexto(telefone, texto)) {
        alert(t('dashboardPage.notifications.whatsapp.openError', 'Nao foi possivel abrir o WhatsApp para esta cobranca.'));
        return false;
    }

    return true;
}

function normalizarTextoBusca(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizarMapaOrdemClientes(raw) {
    const origem = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const normalizado = {};

    for (const [mesKey, mapa] of Object.entries(origem)) {
        if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) continue;
        const mapaMes = {};
        for (const [grupoKey, ordem] of Object.entries(mapa)) {
            const key = String(grupoKey || '').trim();
            const indice = Number(ordem);
            if (!key || !Number.isFinite(indice)) continue;
            mapaMes[key] = Math.max(0, Math.floor(indice));
        }
        if (Object.keys(mapaMes).length) normalizado[String(mesKey)] = mapaMes;
    }

    return normalizado;
}

ordemClientesManualPorMes = normalizarMapaOrdemClientes(ordemClientesManualPorMes);

function obterMapaOrdemClientesMesAtual() {
    const key = String(mesAtivo);
    const mapa = ordemClientesManualPorMes[key];
    return (mapa && typeof mapa === 'object' && !Array.isArray(mapa))
        ? mapa
        : {};
}

function salvarMapaOrdemClientesMesAtual(mapaMes = {}) {
    const key = String(mesAtivo);
    const mapaLimpo = {};
    for (const [grupoKey, ordem] of Object.entries(mapaMes || {})) {
        const keyGrupo = String(grupoKey || '').trim();
        const indice = Number(ordem);
        if (!keyGrupo || !Number.isFinite(indice)) continue;
        mapaLimpo[keyGrupo] = Math.max(0, Math.floor(indice));
    }

    if (Object.keys(mapaLimpo).length) ordemClientesManualPorMes[key] = mapaLimpo;
    else delete ordemClientesManualPorMes[key];

    safeSetJSON(STORAGE_ORDEM_CLIENTES_MANUAL, ordemClientesManualPorMes);
}

function obterChaveGrupoCliente(nomeBase = '') {
    const base = String(nomeBase || '').split(' (')[0];
    const chave = normalizarTextoBusca(base);
    return chave || `grupo-${base.toLowerCase()}`;
}

function limparIndicadoresReordenacao(lista) {
    if (!lista) return;
    lista.querySelectorAll('.is-drop-before, .is-drop-after').forEach(item => {
        item.classList.remove('is-drop-before', 'is-drop-after');
    });
    lista.querySelectorAll('.is-dragging').forEach(item => {
        item.classList.remove('is-dragging');
    });
}

function salvarOrdemManualClientesDaLista(lista) {
    if (!lista) return;
    const itens = Array.from(lista.querySelectorAll(':scope > li[data-grupo-key]'));
    if (!itens.length) return;

    const novoMapa = {};
    itens.forEach((item, indice) => {
        const key = String(item.dataset.grupoKey || '').trim();
        if (!key) return;
        novoMapa[key] = indice;
    });

    salvarMapaOrdemClientesMesAtual(novoMapa);
}

function eventoReordenacaoInterativo(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
        'button, a, input, select, textarea, label, [contenteditable="true"], [data-no-reorder], .acoes'
    ));
}

function resetarEstadoDragReordenacao() {
    if (dragReordenacaoClientes.pressTimer) {
        window.clearTimeout(dragReordenacaoClientes.pressTimer);
    }
    dragReordenacaoClientes.ativo = false;
    dragReordenacaoClientes.li = null;
    dragReordenacaoClientes.pointerId = null;
    dragReordenacaoClientes.lista = null;
    dragReordenacaoClientes.pressTimer = null;
    dragReordenacaoClientes.startX = 0;
    dragReordenacaoClientes.startY = 0;
}

function animarTrocaCarouselReordenacao(origem, alvo) {
    if (!origem || !alvo || origem === alvo) return;

    origem.classList.remove('is-carousel-origem');
    alvo.classList.remove('is-carousel-alvo');
    // Reinicia a animacao para toda nova troca.
    void origem.offsetWidth;
    origem.classList.add('is-carousel-origem');
    alvo.classList.add('is-carousel-alvo');

    window.setTimeout(() => {
        origem.classList.remove('is-carousel-origem');
        alvo.classList.remove('is-carousel-alvo');
    }, 360);
}

function configurarReordenacaoListaClientes(lista, habilitar = false) {
    if (!lista) return;

    lista.dataset.reorderEnabled = habilitar ? '1' : '0';
    lista.querySelectorAll(':scope > li[data-grupo-key]').forEach(li => {
        li.draggable = habilitar;
    });

    if (!habilitar) {
        resetarEstadoDragReordenacao();
        limparIndicadoresReordenacao(lista);
        lista.querySelectorAll('.is-carousel-origem, .is-carousel-alvo').forEach(item => {
            item.classList.remove('is-carousel-origem', 'is-carousel-alvo');
        });
        return;
    }

    if (lista.dataset.reorderBind === '1') return;
    lista.dataset.reorderBind = '1';

    lista.addEventListener('dragstart', event => {
        if (lista.dataset.reorderEnabled !== '1') return;
        if (eventoReordenacaoInterativo(event.target)) {
            event.preventDefault();
            return;
        }

        const li = event.target?.closest?.('li[data-grupo-key]');
        if (!li) {
            event.preventDefault();
            return;
        }

        dragReordenacaoClientes.ativo = true;
        dragReordenacaoClientes.li = li;
        dragReordenacaoClientes.lista = lista;
        li.classList.add('is-dragging');

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', li.dataset.grupoKey || '');
        }
    });

    lista.addEventListener('dragover', event => {
        if (!dragReordenacaoClientes.ativo || lista.dataset.reorderEnabled !== '1') return;
        const alvo = event.target?.closest?.('li[data-grupo-key]');
        if (!alvo || alvo === dragReordenacaoClientes.li) return;

        event.preventDefault();
        limparIndicadoresReordenacao(lista);

        const rect = alvo.getBoundingClientRect();
        const inserirAntes = event.clientY < rect.top + (rect.height / 2);
        alvo.classList.add(inserirAntes ? 'is-drop-before' : 'is-drop-after');
    });

    lista.addEventListener('drop', event => {
        if (!dragReordenacaoClientes.ativo || lista.dataset.reorderEnabled !== '1') return;
        const alvo = event.target?.closest?.('li[data-grupo-key]');
        const origem = dragReordenacaoClientes.li;
        if (!alvo || !origem || alvo === origem) {
            limparIndicadoresReordenacao(lista);
            return;
        }

        event.preventDefault();
        const rect = alvo.getBoundingClientRect();
        const inserirAntes = event.clientY < rect.top + (rect.height / 2);
        animarTrocaCarouselReordenacao(origem, alvo);
        lista.insertBefore(origem, inserirAntes ? alvo : alvo.nextSibling);

        salvarOrdemManualClientesDaLista(lista);
        limparIndicadoresReordenacao(lista);
    });

    lista.addEventListener('dragend', () => {
        resetarEstadoDragReordenacao();
        limparIndicadoresReordenacao(lista);
    });

    // Suporte touch/pointer (mobile) com gesto de pressionar e arrastar.
    lista.addEventListener('pointerdown', event => {
        if (lista.dataset.reorderEnabled !== '1') return;
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        if (eventoReordenacaoInterativo(event.target)) return;

        const li = event.target?.closest?.('li[data-grupo-key]');
        if (!li) return;

        resetarEstadoDragReordenacao();
        dragReordenacaoClientes.pointerId = event.pointerId;
        dragReordenacaoClientes.lista = lista;
        dragReordenacaoClientes.li = li;
        dragReordenacaoClientes.startX = event.clientX;
        dragReordenacaoClientes.startY = event.clientY;
        dragReordenacaoClientes.pressTimer = window.setTimeout(() => {
            if (dragReordenacaoClientes.pointerId !== event.pointerId || dragReordenacaoClientes.li !== li) return;
            dragReordenacaoClientes.ativo = true;
            li.classList.add('is-dragging');
            try { li.setPointerCapture(event.pointerId); } catch (_) {}
        }, 180);
    });

    lista.addEventListener('pointermove', event => {
        if (dragReordenacaoClientes.pointerId !== event.pointerId) return;
        if (lista.dataset.reorderEnabled !== '1') return;

        if (!dragReordenacaoClientes.ativo) {
            const distancia = Math.hypot(
                (event.clientX - dragReordenacaoClientes.startX),
                (event.clientY - dragReordenacaoClientes.startY)
            );
            if (distancia > 10) resetarEstadoDragReordenacao();
            return;
        }

        const origem = dragReordenacaoClientes.li;
        if (!origem) return;

        const alvoElemento = document.elementFromPoint(event.clientX, event.clientY);
        const alvo = alvoElemento?.closest?.('#listaPrincipal > li[data-grupo-key]');
        if (!alvo || alvo === origem) return;

        const rect = alvo.getBoundingClientRect();
        const inserirAntes = event.clientY < rect.top + (rect.height / 2);

        limparIndicadoresReordenacao(lista);
        alvo.classList.add(inserirAntes ? 'is-drop-before' : 'is-drop-after');
        animarTrocaCarouselReordenacao(origem, alvo);
        lista.insertBefore(origem, inserirAntes ? alvo : alvo.nextSibling);
        event.preventDefault();
    }, { passive: false });

    const finalizarPointer = event => {
        if (dragReordenacaoClientes.pointerId !== event.pointerId) return;
        if (dragReordenacaoClientes.ativo) salvarOrdemManualClientesDaLista(lista);
        limparIndicadoresReordenacao(lista);
        resetarEstadoDragReordenacao();
    };

    lista.addEventListener('pointerup', finalizarPointer);
    lista.addEventListener('pointercancel', finalizarPointer);
}

function clienteEhParcelado(cliente) {
    return String(cliente?.nome || '').includes('(');
}

function clienteCorrespondeSituacao(cliente, dataVencimento, hoje, situacao) {
    if (situacao === 'atrasados') return !cliente.pago && dataVencimento < hoje;
    if (situacao === 'pendentes') return !cliente.pago && dataVencimento >= hoje;
    if (situacao === 'pagos') return !!cliente.pago;
    if (situacao === 'parcelados') return clienteEhParcelado(cliente);
    return true;
}

function extrairFiltroBusca(texto) {
    const termoNormalizado = normalizarTextoBusca(texto);
    const semPontuacao = termoNormalizado.replace(/[.,;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!semPontuacao) {
        return {
            ativa: false,
            listarTudo: false,
            situacao: null,
            nome: '',
            termoOriginal: ''
        };
    }

    if (semPontuacao === 'a' || semPontuacao === 'all') {
        return {
            ativa: true,
            listarTudo: true,
            situacao: null,
            nome: '',
            termoOriginal: semPontuacao
        };
    }

    const aliasesSituacao = [
        { situacao: 'atrasados', termos: ['devendo', 'devedor', 'devedores', 'atrasado', 'atrasados', 'vencido', 'vencidos'] },
        { situacao: 'pendentes', termos: ['a pagar', 'apagar', 'pendente', 'pendentes', 'restante', 'restantes'] },
        { situacao: 'pagos', termos: ['pago', 'pagos', 'recebido', 'recebidos', 'quitado', 'quitados'] },
        { situacao: 'parcelados', termos: ['parcelado', 'parcelados', 'parcela', 'parcelas'] }
    ];

    let situacaoDetectada = null;
    let nomeRestante = semPontuacao;

    for (const grupo of aliasesSituacao) {
        for (const alias of grupo.termos) {
            const regexAlias = new RegExp(`\\b${escaparRegex(alias)}\\b`, 'g');
            if (regexAlias.test(nomeRestante)) {
                if (!situacaoDetectada) situacaoDetectada = grupo.situacao;
                nomeRestante = nomeRestante.replace(regexAlias, ' ').replace(/\s+/g, ' ').trim();
            }
        }
    }

    nomeRestante = nomeRestante
        .replace(/\b(todos|todo|tudo)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        ativa: true,
        listarTudo: false,
        situacao: situacaoDetectada,
        nome: nomeRestante,
        termoOriginal: semPontuacao
    };
}

function atualizarNotificacoesPagamentoHoje() {
    const container = getEl('notificacoes-hoje');
    const botao = getEl('btn-notificacoes-hoje');
    const painel = getEl('notificacoes-hoje-painel');
    const lista = getEl('notificacoes-hoje-lista');
    const badge = getEl('notificacoes-hoje-badge');
    const titulo = getEl('notificacoes-hoje-titulo');
    const botaoAlternar = getEl('btn-notificacoes-hoje-alternar');
    if (!container || !botao || !painel || !lista || !badge) return;

    const notificacoesHoje = getNotificacoesPagamentoHoje();
    const notificacoesVencidas = getNotificacoesPagamentoVencidas();
    const totalNotificacoes = notificacoesHoje.length + notificacoesVencidas.length;

    badge.textContent = String(totalNotificacoes);
    botao.setAttribute('aria-label', t('dashboardPage.notifications.countAria', 'Notificacoes de pagamentos: {total}', { total: totalNotificacoes }));

    if (!totalNotificacoes) {
        alternarPainelNotificacoes(false);
        notificacaoSinoJaClicado = false;
        modoNotificacoesHoje = 'hoje';
        botao.classList.remove('balancando');
        container.hidden = true;
        painel.removeAttribute('data-modo');
        lista.innerHTML = '';
        return;
    }

    if (modoNotificacoesHoje === 'hoje' && !notificacoesHoje.length && notificacoesVencidas.length) {
        modoNotificacoesHoje = 'vencidas';
    } else if (modoNotificacoesHoje === 'vencidas' && !notificacoesVencidas.length && notificacoesHoje.length) {
        modoNotificacoesHoje = 'hoje';
    }

    const mostrandoVencidas = modoNotificacoesHoje === 'vencidas';
    const notificacoesAtuais = mostrandoVencidas ? notificacoesVencidas : notificacoesHoje;

    container.hidden = false;
    if (!notificacaoSinoJaClicado) botao.classList.add('balancando');

    if (titulo) {
        titulo.textContent = mostrandoVencidas ? t('dashboardPage.notifications.titleOverdue', 'Vencidas') : t('dashboardPage.notifications.titleToday', 'Pagamentos de hoje');
    }

    if (botaoAlternar) {
        const podeAlternar = notificacoesHoje.length > 0 && notificacoesVencidas.length > 0;
        botaoAlternar.hidden = !podeAlternar;
        botaoAlternar.disabled = !podeAlternar;

        if (podeAlternar) {
            const labelAlternar = mostrandoVencidas ? t('dashboardPage.notifications.toggleBackToday', 'Voltar para pagamentos de hoje') : t('dashboardPage.notifications.toggleViewOverdue', 'Ver vencidas');
            botaoAlternar.setAttribute('aria-label', labelAlternar);
            botaoAlternar.setAttribute('title', labelAlternar);

            const iconeAlternar = botaoAlternar.querySelector('i');
            if (iconeAlternar) {
                iconeAlternar.className = `fa-solid ${mostrandoVencidas ? 'fa-arrow-left' : 'fa-arrow-right'}`;
            }
        }
    }

    painel.dataset.modo = mostrandoVencidas ? 'vencidas' : 'hoje';

    if (!notificacoesAtuais.length) {
        lista.innerHTML = `<li class="notificacoes-vazio">${mostrandoVencidas ? t('dashboardPage.notifications.emptyOverdue', 'Nenhuma cobranca vencida.') : t('dashboardPage.notifications.emptyToday', 'Nenhum pagamento para hoje.')}</li>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    const hojeRef = inicioDoDiaLocal(new Date());

    for (const item of notificacoesAtuais) {
        const li = document.createElement('li');
        li.className = `notificacoes-item ${mostrandoVencidas ? 'notificacao-atrasada' : 'notificacao-hoje'}`;
        const complementoQuantidade = item.quantidade > 1 ? ` - ${t('dashboardPage.notifications.entriesCount', '{q} lancamentos', { q: item.quantidade })}` : '';
        const textoData = mostrandoVencidas ? t('dashboardPage.notifications.overdueSince', 'Venceu em') : t('dashboardPage.notifications.dueToday', 'Vence hoje');
        const dataFormatada = formatarDataBr(item.data);
        const diasAtraso = mostrandoVencidas ? Math.max(1, diferencaDiasCalendario(hojeRef, new Date(item.dataTimestamp || Date.now()))) : 0;
        const textoDiasAtraso = diasAtraso === 1
            ? t('dashboardPage.notifications.overdueDaysSingle', '1 dia de atraso')
            : t('dashboardPage.notifications.overdueDaysPlural', '{dias} dias de atraso', { dias: diasAtraso });
        const telefoneCobrar = normalizarTelefoneWhatsapp(item.telefone);
        const podeCobrar = Boolean(telefoneCobrar);
        const tituloBotaoCobrar = podeCobrar
            ? t('dashboardPage.notifications.whatsapp.autoChargeTitle', 'Cobranca automatica por WhatsApp')
            : t('dashboardPage.notifications.whatsapp.noPhone', 'Cliente sem WhatsApp valido para cobranca automatica.');
        li.innerHTML = `
            <div class="notificacoes-item-info">
                <span class="notificacoes-item-nome">${escapeHtml(item.nome)}</span>
                <span class="notificacoes-item-data">
                    ${textoData} (${escapeHtml(dataFormatada)})${escapeHtml(complementoQuantidade)}
                    ${mostrandoVencidas ? `<span class="notificacoes-item-atraso-texto" title="${escapeHtml(textoDiasAtraso)}"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> ${escapeHtml(textoDiasAtraso)}</span>` : ''}
                </span>
            </div>
            <div class="notificacoes-item-acoes">
                <span class="notificacoes-item-valor">${formatarMoeda(item.valorRestante)}</span>
                <button
                    type="button"
                    class="notificacoes-item-cobrar"
                    data-notificacao-cobrar="1"
                    data-tipo="${mostrandoVencidas ? 'vencidas' : 'hoje'}"
                    data-nome="${escapeHtml(item.nome)}"
                    data-data="${escapeHtml(String(item.data || ''))}"
                    data-telefone="${escapeHtml(telefoneCobrar)}"
                    data-valor="${escapeHtml(String(Number(item.valorRestante || 0)))}"
                    title="${escapeHtml(tituloBotaoCobrar)}"
                    ${podeCobrar ? '' : 'disabled'}
                >
                    <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
                    <span>${escapeHtml(t('dashboardPage.notifications.whatsapp.autoChargeButton', 'Cobrar'))}</span>
                </button>
            </div>
        `;
        fragment.appendChild(li);
    }

    lista.innerHTML = '';
    lista.appendChild(fragment);
}

function renderizarLista() {
    const lista = getEl('listaPrincipal');
    if (!lista) return;

    const buscaEl = getEl('buscaNome');
    const filtroBusca = extrairFiltroBusca(buscaEl?.value || '');
    const buscaAtiva = filtroBusca.ativa;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const filtrados = cobrancas.filter(cliente => {
        const dataVencimento = getVencimentoDate(cliente.data);
        let passouFiltroPrincipal = false;

        if (buscaAtiva) {
            if (filtroBusca.listarTudo) {
                passouFiltroPrincipal = true;
            } else {
                passouFiltroPrincipal = true;
                if (filtroBusca.situacao && !clienteCorrespondeSituacao(cliente, dataVencimento, hoje, filtroBusca.situacao)) {
                    passouFiltroPrincipal = false;
                }
                if (passouFiltroPrincipal && filtroBusca.nome) {
                    passouFiltroPrincipal = normalizarTextoBusca(cliente.nome).includes(filtroBusca.nome);
                }
            }
        } else {
            passouFiltroPrincipal = dataVencimento.getMonth() === mesAtivo
                && clienteCorrespondeSituacao(cliente, dataVencimento, hoje, abaAtiva);
        }

        return passouFiltroPrincipal;
    });

    const filtradosOrdenados = buscaAtiva
        ? [...filtrados].sort((a, b) => {
            const nomeBaseA = a.nome.split(' (')[0];
            const nomeBaseB = b.nome.split(' (')[0];
            const ordemNome = nomeBaseA.localeCompare(nomeBaseB, 'pt-BR', { sensitivity: 'base' });
            if (ordemNome !== 0) return ordemNome;

            const ordemData = getVencimentoDate(a.data).getTime() - getVencimentoDate(b.data).getTime();
            if (ordemData !== 0) return ordemData;

            return (a.id || 0) - (b.id || 0);
        })
        : (abaAtiva === 'todos'
            ? [...filtrados].sort((a, b) => {
                const prioridadeA = a.pago ? 2 : (getVencimentoDate(a.data) < hoje ? 0 : 1);
                const prioridadeB = b.pago ? 2 : (getVencimentoDate(b.data) < hoje ? 0 : 1);
                if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

                const ordemData = getVencimentoDate(a.data).getTime() - getVencimentoDate(b.data).getTime();
                if (ordemData !== 0) return ordemData;

                const nomeBaseA = a.nome.split(' (')[0];
                const nomeBaseB = b.nome.split(' (')[0];
                return nomeBaseA.localeCompare(nomeBaseB, 'pt-BR', { sensitivity: 'base' });
            })
            : filtrados);

    const habilitarReordenacao = !buscaAtiva && abaAtiva === 'todos';
    const grupos = new Map();
    for (const cliente of filtradosOrdenados) {
        const nomeBase = cliente.nome.split(' (')[0];
        const grupoKey = obterChaveGrupoCliente(nomeBase);
        if (!grupos.has(grupoKey)) {
            grupos.set(grupoKey, {
                chave: grupoKey,
                nome: nomeBase,
                itens: []
            });
        }
        grupos.get(grupoKey).itens.push(cliente);
    }

    let gruposOrdenados = Array.from(grupos.values()).map((grupo, indiceOriginal) => ({
        ...grupo,
        indiceOriginal
    }));

    if (habilitarReordenacao) {
        const mapaOrdem = obterMapaOrdemClientesMesAtual();
        gruposOrdenados.sort((a, b) => {
            const ordemA = Number(mapaOrdem[a.chave]);
            const ordemB = Number(mapaOrdem[b.chave]);
            const aTemOrdem = Number.isFinite(ordemA);
            const bTemOrdem = Number.isFinite(ordemB);

            if (aTemOrdem && bTemOrdem && ordemA !== ordemB) return ordemA - ordemB;
            if (aTemOrdem && !bTemOrdem) return -1;
            if (!aTemOrdem && bTemOrdem) return 1;
            return a.indiceOriginal - b.indiceOriginal;
        });
    }

    atualizarContadorBusca(gruposOrdenados.length, buscaAtiva ? filtroBusca.termoOriginal : '');

    lista.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const grupo of gruposOrdenados) {
        const { chave, nome, itens } = grupo;
        const li = document.createElement('li');
        li.dataset.grupoKey = chave;
        li.classList.add('cliente-reorder-item');

        if (itens.length > 1 || abaAtiva === 'parcelados' || buscaAtiva) {
            li.classList.add('item-agrupado');
            const faltaTotal = itens.reduce((acumulado, item) => acumulado + ((Number(item.valor) || 0) - (Number(item.pagoParcial) || 0)), 0);
            li.innerHTML = `
                <div class="pasta-header-parcela" onclick="this.parentElement.classList.toggle('aberto')">
                    <span class="pasta-header-grupo-titulo">
                        <span><i class="fa-solid fa-folder" aria-hidden="true"></i> ${escapeHtml(nome)} (${itens.length})</span>
                    </span>
                    <span style="background:var(--badge-bg); color:var(--badge-text); padding:4px 10px; border-radius:15px; font-size:0.8rem">${formatarMoeda(faltaTotal)}</span>
                </div>
                <div class="sub-lista">${itens.map(item => criarItemHTML(item, hoje)).join('')}</div>
            `;
        } else {
            li.innerHTML = criarItemHTML(itens[0], hoje);
        }

        fragment.appendChild(li);
    }

    lista.appendChild(fragment);
    configurarReordenacaoListaClientes(lista, habilitarReordenacao);
}

function abrirEdicao(id) {
    const cliente = cobrancas.find(item => item.id === id);
    if (!cliente) return;

    const editId = getEl('edit-id');
    const editNome = getEl('edit-nome');
    const editTelefone = getEl('edit-telefone');
    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    const editData = getEl('edit-data');
    const modal = getEl('modalEdicao');

    if (!editId || !editNome || !editValor || !editPagoParcial || !editData || !modal) return;

    editId.value = cliente.id;
    editNome.value = cliente.nome;
    if (editTelefone) editTelefone.value = cliente.telefone || '';
    editValor.value = formatarValorEdicao(cliente.valor);
    editPagoParcial.value = formatarValorEdicao(cliente.pagoParcial);
    editValor.dataset.autoClearArmed = '1';
    editPagoParcial.dataset.autoClearArmed = '1';
    editData.value = cliente.data;
    modal.style.display = 'flex';
}

function fecharModal() {
    const modal = getEl('modalEdicao');
    if (modal) modal.style.display = 'none';
}

function salvarEdicao() {
    const editId = getEl('edit-id');
    const editNome = getEl('edit-nome');
    const editTelefone = getEl('edit-telefone');
    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    const editData = getEl('edit-data');

    if (!editId || !editNome || !editValor || !editPagoParcial || !editData) return;

    const id = Number(editId.value);
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;

    const original = cobrancas[index];
    const originalPago = Boolean(original?.pago);
    const novoNome = editNome.value.trim();
    const novoTelefone = editTelefone ? editTelefone.value.trim() : (original.telefone || '');
    const novoValor = parseValorEdicao(editValor.value);
    const novoPago = parseValorEdicao(editPagoParcial.value);
    const novaData = editData.value;

    if (!novoNome || !Number.isFinite(novoValor) || novoValor <= 0 || !Number.isFinite(novoPago) || novoPago < 0 || !novaData) {
        return;
    }

    const antigoPago = Number(original.pagoParcial) || 0;
    const diferenca = novoPago - antigoPago;
    const dataReferenciaEdicao = obterDataReferenciaPorIso(novaData);
    if (diferenca > 0) registrarTransacaoCarteira('entrada', diferenca, `Ajuste manual: ${novoNome}`, dataReferenciaEdicao);
    else if (diferenca < 0) registrarTransacaoCarteira('saida', Math.abs(diferenca), `CorreÃ§Ã£o manual: ${novoNome}`, dataReferenciaEdicao);

    const cobrancaAtualizada = {
        ...original,
        nome: novoNome,
        telefone: novoTelefone,
        valor: novoValor.toFixed(2),
        pagoParcial: novoPago.toFixed(2),
        data: novaData,
        pago: novoPago >= novoValor,
        formaPagamento: (novoPago >= novoValor) ? normalizarFormaPagamento(original.formaPagamento) : ''
    };
    cobrancas[index] = cobrancaAtualizada;

    fecharModal();
    atualizarTudo();

    if (!originalPago && cobrancaAtualizada.pago) {
        notificarPagamentoConcluido(cobrancaAtualizada, {
            origem: 'edicao_manual',
            valorRecebido: diferenca > 0 ? diferenca : (Number(cobrancaAtualizada.valor) || 0),
            formaPagamento: cobrancaAtualizada.formaPagamento
        });
    }
}

function mudarAba(aba) {
    abaAtiva = aba;
    document.querySelectorAll('.tab-btn').forEach(botao => botao.classList.remove('active'));
    const botao = document.querySelector(`[data-aba="${aba}"]`);
    if (botao) botao.classList.add('active');
    renderizarLista();
}

function toggleMenuAno() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    const colapsadoAtual = menu.dataset.colapsado === '1';
    menu.dataset.colapsado = colapsadoAtual ? '0' : '1';
    gerarMenuMeses();
}

function abrirResumoAno(ano = new Date().getFullYear()) {
    window.location.href = `resumo-ano.html?ano=${encodeURIComponent(String(ano))}`;
}

function navegarMesTitulo(delta) {
    const passo = Number(delta) || 0;
    if (!passo) return;

    const novoIndice = (mesAtivo + passo + 12) % 12;
    selecionarMesAtivo(novoIndice);
}

function configurarHoverTituloPolo() {
    const titulo = getEl('titulo-pagina');
    if (!titulo || titulo.dataset.hoverPoloConfigurado === '1') return;

    titulo.dataset.hoverPoloConfigurado = '1';
    titulo.addEventListener('mouseenter', () => {
        if (mesAtivo === 2) titulo.textContent = 'POLO';
    });

    titulo.addEventListener('mouseleave', () => {
        titulo.textContent = nomeMesI18n(mesAtivo, 'long') || '';
    });
}

function selecionarMesAtivo(indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice > 11) return;
    mesAtivo = indice;

    const menu = getEl('menu-meses');
    if (menu) menu.dataset.colapsado = '1';

    atualizarTudo();
    fecharSidebarMobile();
}

function gerarMenuMeses() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    if (menu.dataset.colapsado !== '0' && menu.dataset.colapsado !== '1') {
        menu.dataset.colapsado = '1';
    }

    const colapsado = menu.dataset.colapsado === '1';
    const anoAtual = new Date().getFullYear();
    const mesSelecionadoCompleto = nomeMesI18n(mesAtivo, 'long') || '';
    const mesSelecionadoInicial = mesSelecionadoCompleto;
    const exibirLinkAno = !isPaginaEconomias() && !getEl("totalAtrasados");
    const headerClass = exibirLinkAno ? 'menu-ano-header' : 'menu-ano-header menu-ano-header--single';
    const botaoAnoHtml = exibirLinkAno
        ? `
            <button type="button" class="menu-ano-link" onclick="abrirResumoAno(${anoAtual})" aria-label="${escapeHtml(t('economias.monthMenu.openYearSummary', 'Abrir resumo anual de {ano}', { ano: anoAtual }))}">
                <span>${anoAtual}</span>
                <i class="fa-solid fa-chart-column" aria-hidden="true"></i>
            </button>
        `
        : '';

    const mesesDisponiveis = nomesMeses
        .map((mes, indice) => ({ mes: nomeMesI18n(indice, 'long'), indice }))
        .filter(item => item.indice !== mesAtivo);

    menu.innerHTML = `
        <div class="${headerClass}">
            ${botaoAnoHtml}
            <button type="button" class="menu-ano-toggle ${colapsado ? 'collapsed' : 'expanded'}" onclick="toggleMenuAno()" aria-label="${colapsado ? t('despesas.menu.expandMonths', 'Expandir meses') : t('despesas.menu.collapseMonths', 'Recolher meses')} - ${t('despesas.menu.currentMonth', 'Mes atual')}: ${escapeHtml(mesSelecionadoCompleto)}">
                <span class="menu-ano-toggle-label">${escapeHtml(mesSelecionadoInicial)}</span>
                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
        </div>
        <div class="menu-meses-lista ${colapsado ? 'is-collapsed' : 'menu-meses-lista--cascade'}">
            ${mesesDisponiveis.map(item => `
                <button onclick="selecionarMesAtivo(${item.indice})">
                    ${item.mes}
                </button>
            `).join('')}
        </div>
    `;

    const titulo = getEl('titulo-pagina');
    if (titulo) titulo.textContent = nomeMesI18n(mesAtivo, 'long');
    configurarHoverTituloPolo();
}

function atualizarTudo() {
    salvarCobrancas();

    const totalAtrasadosEl = getEl('totalAtrasados');
    if (!totalAtrasadosEl) {
        if (isPaginaEconomias()) gerarMenuMeses();
        atualizarInterfaceEconomias();
        return;
    }

    let atrasados = 0;
    let pendentes = 0;
    let recebido = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const cliente of cobrancas) {
        const dataVencimento = getVencimentoDate(cliente.data);
        if (dataVencimento.getMonth() !== mesAtivo) continue;

        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;
        recebido += cliente.pago ? valorTotal : valorPago;

        if (!cliente.pago) {
            if (dataVencimento < hoje) atrasados += (valorTotal - valorPago);
            else pendentes += (valorTotal - valorPago);
        }
    }

    totalAtrasadosEl.textContent = formatarMoeda(atrasados);
    const totalPendentesEl = getEl('totalPendentes');
    const totalRecebidoEl = getEl('totalRecebido');
    if (totalPendentesEl) totalPendentesEl.textContent = formatarMoeda(pendentes);
    if (totalRecebidoEl) totalRecebidoEl.textContent = formatarMoeda(recebido);

    gerarMenuMeses();
    renderizarLista();
    atualizarNotificacoesPagamentoHoje();
    setTimeout(() => {
        verificarNotificacoesLocaisContextoApp({ solicitarPermissao: false }).catch(() => {});
    }, 0);
    atualizarInterfaceEconomias();
}

function excluir(id) {
    if (!confirm(t('script.confirms.deleteTransaction', 'Excluir este lancamento?'))) return;
    cobrancas = cobrancas.filter(cliente => cliente.id !== id);
    atualizarTudo();
}

function copiarProximo(id) {
    const cliente = cobrancas.find(item => item.id === id);
    if (!cliente) return;

    const novaData = getVencimentoDate(cliente.data);
    novaData.setMonth(novaData.getMonth() + 1);

    cobrancas.push({
        ...cliente,
        id: (Date.now() * 1000) + Math.floor(Math.random() * 1000),
        data: formatarDataIsoLocal(novaData),
        pago: false,
        pagoParcial: '0.00',
        formaPagamento: ''
    });

    atualizarTudo();
}

/* =========================================
   Economias: carteira e poupanca
   ========================================= */
function isTransferenciaParaPoupanca(item) {
    if (!item || item.tipo !== 'sacar') return false;
    if (String(item.categoria ?? '') === 'transferencia_poupanca') return true;

    const descricao = String(item.descricao ?? '');
    const normalizada = typeof descricao.normalize === 'function'
        ? descricao.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : descricao;
    const compacta = normalizada.toLowerCase().replace(/[^a-z0-9]/g, '');

    const mencionaPoupanca = compacta.includes('poupan');
    const mencionaTransferencia = compacta.includes('transfer') || compacta.includes('carteira');
    return mencionaPoupanca && mencionaTransferencia;
}

function normalizarTextoComparacaoExtrato(texto) {
    const bruto = String(texto ?? '');
    return (typeof bruto.normalize === 'function'
        ? bruto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : bruto)
        .toLowerCase();
}

function traduzirDescricaoExtrato(item) {
    const descricaoOriginal = String(item?.descricao ?? '');
    if (!descricaoOriginal) return '';

    const categoria = String(item?.categoria || '').trim();
    const ehPoupanca = Array.isArray(historicoPoupanca) && historicoPoupanca.includes(item);
    const normalizada = normalizarTextoComparacaoExtrato(descricaoOriginal).trim();
    const possuiSeparador = descricaoOriginal.includes(':');

    if (normalizada.startsWith('corre') && normalizada.includes('manual')) {
        if (possuiSeparador) {
            const sufixo = descricaoOriginal.slice(descricaoOriginal.indexOf(':') + 1);
            return `${t('economias.extrato.descriptions.manualCorrection', 'Correcao manual')}:${sufixo}`;
        }
        return t('economias.extrato.descriptions.manualCorrection', 'Correcao manual');
    }

    const tentarPrefixo = (chaves, i18nKey, fallback) => {
        for (const chave of chaves) {
            const normalizadaChave = normalizarTextoComparacaoExtrato(chave).trim();
            if (!normalizada.startsWith(normalizadaChave)) continue;

            const indiceSeparador = descricaoOriginal.indexOf(':');
            if (indiceSeparador === -1) return t(i18nKey, fallback);

            const sufixo = descricaoOriginal.slice(indiceSeparador + 1);
            return `${t(i18nKey, fallback)}:${sufixo}`;
        }
        return null;
    };

    const tentativas = [
        [['Recebido'], 'economias.extrato.descriptions.received', 'Recebido'],
        [['Estorno'], 'economias.extrato.descriptions.reversal', 'Estorno'],
        [['Ajuste manual'], 'economias.extrato.descriptions.manualAdjustment', 'Ajuste manual'],
        [['Correcao manual', 'CorreÃ§Ã£o manual'], 'economias.extrato.descriptions.manualCorrection', 'Correcao manual'],
        [['Despesa cadastrada como paga'], 'economias.extrato.descriptions.expenseCreatedPaid', 'Despesa cadastrada como paga'],
        [['Pagamento de despesa'], 'economias.extrato.descriptions.expensePayment', 'Pagamento de despesa'],
        [['Estorno de despesa'], 'economias.extrato.descriptions.expenseReversal', 'Estorno de despesa'],
        [['Estorno de ajuste de despesa'], 'economias.extrato.descriptions.expenseAdjustmentReversal', 'Estorno de ajuste de despesa'],
        [['Estorno de ajuste de recorrencia'], 'economias.extrato.descriptions.recurringAdjustmentReversal', 'Estorno de ajuste de recorrencia'],
        [['Ajuste de recorrencia paga'], 'economias.extrato.descriptions.paidRecurringAdjustment', 'Ajuste de recorrencia paga'],
        [['Modo Comercio'], 'economias.extrato.descriptions.commerceMode', 'Modo Comercio']
    ];

    for (const [prefixos, chaveI18n, fallback] of tentativas) {
        const traduzida = tentarPrefixo(prefixos, chaveI18n, fallback);
        if (traduzida) return traduzida;
    }

    if (normalizada === normalizarTextoComparacaoExtrato('Resgate da Poupanca')) {
        return t('economias.extrato.descriptions.savingsWithdrawalToWallet', 'Resgate da Poupanca');
    }

    if (normalizada === normalizarTextoComparacaoExtrato('Transferencia para Poupanca')) {
        return t('economias.extrato.descriptions.transferToSavings', 'Transferencia para Poupanca');
    }
    if (normalizada === normalizarTextoComparacaoExtrato('TransferÃªncia para PoupanÃ§a')) {
        return t('economias.extrato.descriptions.transferToSavings', 'Transferencia para Poupanca');
    }

    if (normalizada === normalizarTextoComparacaoExtrato('Vindo da Carteira')) {
        return t('economias.extrato.descriptions.comingFromWallet', 'Vindo da Carteira');
    }

    if (normalizada === normalizarTextoComparacaoExtrato('Enviado para Carteira')) {
        return t('economias.extrato.descriptions.sentToWallet', 'Enviado para Carteira');
    }

    if (categoria === 'transferencia_poupanca') {
        return t('economias.extrato.descriptions.transferToSavings', 'Transferencia para Poupanca');
    }

    if (ehPoupanca && normalizada === normalizarTextoComparacaoExtrato('Investimento')) {
        return t('economias.extrato.descriptions.savingsInvestment', 'Investimento');
    }

    if (ehPoupanca && normalizada === normalizarTextoComparacaoExtrato('Resgate')) {
        return t('economias.extrato.descriptions.savingsRedeem', 'Resgate');
    }

    return descricaoOriginal;
}

function obterOpcoesFiltroFormaPagamentoExtrato() {
    return [
        { valor: 'todos', rotulo: t('economias.extrato.filter.all', 'Todos') },
        { valor: FILTRO_FORMA_EXTRATO_COM_FORMA, rotulo: t('economias.extrato.filter.withMethod', 'Com metodo identificado') },
        { valor: FILTRO_FORMA_EXTRATO_SEM_FORMA, rotulo: t('economias.extrato.filter.withoutMethod', 'Sem identificacao') },
        ...Object.keys(FORMAS_PAGAMENTO_META).map(chave => ({
            valor: chave,
            rotulo: FORMAS_PAGAMENTO_META[chave].rotulo
        }))
    ];
}

function inicializarFiltroExtratoCarteira() {
    const select = getEl('filtro-forma-pagamento-extrato');
    if (!(select instanceof HTMLSelectElement)) return;

    if (select.dataset.formaPagamentoInit !== '1') {
        const opcoes = obterOpcoesFiltroFormaPagamentoExtrato();
        select.innerHTML = opcoes.map(opcao => `<option value="${escapeHtml(opcao.valor)}">${escapeHtml(opcao.rotulo)}</option>`).join('');
        select.dataset.formaPagamentoInit = '1';

        select.addEventListener('change', () => {
            filtroFormaPagamentoExtratoCarteira = String(select.value || 'todos');
            renderizarExtratoCarteira();
        });
    }

    const valorAtual = filtroFormaPagamentoExtratoCarteira || 'todos';
    if ([...select.options].some(opt => opt.value === valorAtual)) {
        select.value = valorAtual;
    } else {
        select.value = 'todos';
        filtroFormaPagamentoExtratoCarteira = 'todos';
    }
}

function atualizarVisibilidadeFiltroExtratoCarteira() {
    const toolbar = getEl('extrato-carteira-toolbar');
    if (!toolbar) return;
    const abaCarteira = getEl('aba-carteira');
    const carteiraVisivel = Boolean(abaCarteira && abaCarteira.style.display !== 'none');
    toolbar.hidden = !carteiraVisivel;
}

function filtrarHistoricoCarteiraPorFormaPagamento(lista) {
    const filtro = String(filtroFormaPagamentoExtratoCarteira || 'todos');
    if (filtro === 'todos') return lista;

    return (lista || []).filter(item => {
        const forma = obterFormaPagamentoHistorico(item);
        if (filtro === FILTRO_FORMA_EXTRATO_COM_FORMA) return Boolean(forma);
        if (filtro === FILTRO_FORMA_EXTRATO_SEM_FORMA) return !forma;
        return forma === filtro;
    });
}

function itemExtratoEhEstornoOuDevolucao(item) {
    const categoria = String(item?.categoria || '').trim().toLowerCase();
    const descricao = String(item?.descricao || '').trim().toLowerCase();
    const descricaoTraduzida = String(traduzirDescricaoExtrato(item) || '').trim().toLowerCase();

    const textos = [categoria, descricao, descricaoTraduzida].filter(Boolean);
    if (!textos.length) return false;

    return textos.some(texto => (
        texto.includes('estorno')
        || texto.includes('devolu')
        || texto.includes('reversal')
        || texto.includes('refund')
    ));
}

function renderizarListaGenerica(elementId, listaDados, corEntrada, corSaida) {
    const container = getEl(elementId);
    if (!container) return;

    container.innerHTML = '';
    if (!listaDados.length) {
        container.innerHTML = `<p style="opacity:0.5; text-align:center; padding:20px;">${escapeHtml(t('economias.extrato.emptyMonth', 'Nenhuma movimentacao em {mes}.', { mes: nomeMesI18n(mesAtivo, 'long') }))}</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of listaDados) {
        const isEntrada = item.tipo === 'depositar' || item.tipo === 'entrada';
        const isSaidaParaPoupanca = isTransferenciaParaPoupanca(item);
        const isEstornoOuDevolucao = itemExtratoEhEstornoOuDevolucao(item);
        const cor = isSaidaParaPoupanca
            ? 'var(--poupanca-primary)'
            : (isEstornoOuDevolucao ? 'var(--warning)' : (isEntrada ? corEntrada : corSaida));

        const div = document.createElement('details');
        div.className = `item-extrato item-extrato-expansivel ${isEntrada ? 'entrada' : 'saida'}${isSaidaParaPoupanca ? ' saida-poupanca' : ''}${isEstornoOuDevolucao ? ' item-extrato-estorno' : ''}`;
        div.style.setProperty('--extrato-valor', cor);
        const badgeFormaPagamento = criarBadgeFormaPagamentoHTML(
            obterFormaPagamentoHistorico(item),
            'badge-forma-pagamento-extrato'
        );
        div.innerHTML = `
            <summary class="item-extrato-resumo">
                <div class="item-extrato-info">
                    <div class="item-extrato-icone" aria-hidden="true">
                        <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}" aria-hidden="true"></i>
                    </div>
                    <div class="item-extrato-textos">
                        <div class="item-extrato-descricao-linha">
                            <div class="item-extrato-descricao">${escapeHtml(traduzirDescricaoExtrato(item))}</div>
                            ${badgeFormaPagamento}
                        </div>
                        <div class="data-extrato">${escapeHtml(item.data)}</div>
                    </div>
                </div>
                <div class="item-extrato-valor-bloco">
                    <div class="item-extrato-valor">${isEntrada ? '+' : '-'} ${formatarMoeda(item.valor)}</div>
                    <span class="item-extrato-expand-indicador" aria-hidden="true">
                        <i class="fa-solid fa-chevron-down"></i>
                    </span>
                </div>
            </summary>
            <div class="item-extrato-detalhes">
                <div class="item-extrato-detalhes-grid">
                    ${montarDetalhesExtratoHTML(item)}
                </div>
            </div>
        `;
        fragment.appendChild(div);
    }

    container.appendChild(fragment);
}

function renderizarExtratoCarteira() {
    const historicoMes = filtrarHistoricoPorMes(historicoCarteira);
    const historicoFiltrado = filtrarHistoricoCarteiraPorFormaPagamento(historicoMes);
    renderizarListaGenerica('lista-extrato', historicoFiltrado, 'var(--success)', 'var(--danger)');
}

function renderizarExtratoPoupanca() {
    renderizarListaGenerica('extrato-poupanca', filtrarHistoricoPorMes(historicoPoupanca), 'var(--poupanca-primary)', 'var(--poupanca-secondary)');
}

function atualizarInterfaceEconomias() {
    const emEconomias = isPaginaEconomias();
    const saldoCarteiraVisivel = emEconomias ? calcularSaldoHistoricoDoMes(historicoCarteira) : saldoCarteira;
    const saldoPoupancaVisivel = emEconomias ? calcularSaldoHistoricoDoMes(historicoPoupanca) : saldoPoupanca;
    const saldoCarteiraFormatado = formatarMoeda(saldoCarteiraVisivel);
    const saldoPoupancaFormatado = formatarMoeda(saldoPoupancaVisivel);

    const saldoTelaCheia = getEl('saldo-tela-cheia');
    if (saldoTelaCheia) saldoTelaCheia.textContent = saldoCarteiraFormatado;

    const saldoPoupancaEl = getEl('saldo-poupanca');
    if (saldoPoupancaEl) saldoPoupancaEl.textContent = saldoPoupancaFormatado;

    const labelSaldoCarteira = document.querySelector('#aba-carteira .saldo-grande small');
    if (labelSaldoCarteira) {
        labelSaldoCarteira.textContent = emEconomias
            ? t('economias.wallet.monthBalance', 'Saldo do mes ({mes})', { mes: nomeMesI18n(mesAtivo, 'long') })
            : t('economias.wallet.availableBalance', 'Saldo disponivel (carteira)');
    }

    const labelSaldoPoupanca = document.querySelector('#aba-poupanca .saldo-grande small');
    if (labelSaldoPoupanca) {
        labelSaldoPoupanca.textContent = emEconomias
            ? t('economias.savings.monthBalance', 'Poupanca do mes ({mes})', { mes: nomeMesI18n(mesAtivo, 'long') })
            : t('economias.savings.totalInvested', 'Total investido (poupanca)');
    }

    inicializarFiltroExtratoCarteira();
    atualizarVisibilidadeFiltroExtratoCarteira();

    if (getEl('lista-extrato')) renderizarExtratoCarteira();
    if (getEl('extrato-poupanca')) renderizarExtratoPoupanca();
}

function realizarOperacao(tipo) {
    const inputValor = getEl('valor-operacao');
    const inputDesc = getEl('desc-operacao');
    if (!inputValor) return;

    const valor = parseValorInput(inputValor.value);
    if (!Number.isFinite(valor) || valor <= 0) return alert(t('script.alerts.invalidValue', 'Valor invalido.'));
    const saldoReferencia = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoCarteira) : saldoCarteira;
    if (tipo === 'sacar' && valor > saldoReferencia) return alert(t('script.alerts.insufficientMonthlyBalance', 'Saldo insuficiente no mes selecionado.'));
    const dataReferencia = obterDataReferenciaMesSelecionado();
    const descricaoOperacao = inputDesc?.value?.trim() || (tipo === 'depositar' ? 'Deposito manual' : 'Saida manual');

    registrarTransacaoCarteira(
        tipo === 'depositar' ? 'entrada' : 'saida',
        valor,
        descricaoOperacao,
        dataReferencia
    );

    if (tipo === 'sacar') {
        const despesaAutomaticaCriada = adicionarDespesaAutomaticaPorSaidaCarteira(valor, descricaoOperacao, dataReferencia);
        if (!despesaAutomaticaCriada) {
            alert(t(
                'script.alerts.autoExpenseCreateFailed',
                'Saida registrada, mas nao foi possivel adicionar a despesa automaticamente.'
            ));
        }
    }

    inputValor.value = '';
    if (inputDesc) inputDesc.value = '';
}

function operarPoupanca(tipo) {
    const inputValor = getEl('valor-poupanca');
    const inputDesc = getEl('desc-poupanca');
    if (!inputValor) return;

    const valor = parseValorInput(inputValor.value);
    if (!Number.isFinite(valor) || valor <= 0) return alert(t('script.alerts.invalidValue', 'Valor invalido.'));
    const saldoReferencia = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoPoupanca) : saldoPoupanca;
    if (tipo === 'sacar' && valor > saldoReferencia) return alert(t('script.alerts.insufficientMonthlyBalance', 'Saldo insuficiente no mes selecionado.'));
    const dataReferencia = obterDataReferenciaMesSelecionado();

    if (tipo === 'depositar') saldoPoupanca += valor;
    else saldoPoupanca -= valor;

    historicoPoupanca.unshift({
        tipo,
        valor,
        descricao: inputDesc?.value?.trim() || (tipo === 'depositar' ? 'Investimento' : 'Resgate'),
        timestamp: dataReferencia.getTime(),
        data: dataReferencia.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });

    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    inputValor.value = '';
    if (inputDesc) inputDesc.value = '';
    atualizarInterfaceEconomias();
}

function mudarAbaEconomia(aba) {
    const abaCarteira = getEl('aba-carteira');
    const abaPoupanca = getEl('aba-poupanca');
    if (!abaCarteira || !abaPoupanca) return;

    abaCarteira.style.display = 'none';
    abaPoupanca.style.display = 'none';
    document.querySelectorAll('.tab-eco').forEach(btn => btn.classList.remove('active'));

    if (aba === 'carteira') {
        abaCarteira.style.display = 'block';
        const botao = document.querySelectorAll('.tab-eco')[0];
        if (botao) botao.classList.add('active');
    } else {
        abaPoupanca.style.display = 'block';
        const botao = document.querySelectorAll('.tab-eco')[1];
        if (botao) botao.classList.add('active');
    }

    atualizarInterfaceEconomias();
}

/* =========================================
   Tema e backup
   ========================================= */
function carregarTema() {
    carregarTemaSalvo();
    carregarTemaExecutivo();
}

function alternarTema() {
    temaTransicaoTimer = alternarTemaComAnimacao({
        storageKey: STORAGE_TEMA,
        duracaoMs: DURACAO_TRANSICAO_TEMA,
        timerAtual: temaTransicaoTimer
    });
}

function exportarDados() {
    exportarBackupStorage({ nomeBase: 'backup_sistema_2026' });
}

function importarDados(event) {
    importarBackupStorage(event, { mensagemSucesso: 'Backup restaurado com sucesso!' });
}

function resetarSistema() {
    confirmarResetSistema({
        textoConfirmacaoInicial: 'AtenÃ§Ã£o: vocÃª solicitou zerar tudo (clientes, despesas, carteira, poupanÃ§a e extratos). Deseja continuar?',
        textoConfirmacaoFinal: 'Esta aÃ§Ã£o apagarÃ¡ permanentemente todas essas informaÃ§Ãµes. Confirmar?',
        textoSucesso: 'Dados zerados com sucesso (clientes, despesas, carteira, poupanÃ§a e extratos).'
    });
}

/* =========================================
   Transferencias carteira/poupanca
   ========================================= */
function abrirModalTransferencia() {
    const inputValor = getEl('valor-operacao');
    const inputDesc = getEl('desc-operacao');

    const numValor = parseValorInput(inputValor?.value ?? '');
    if (!Number.isFinite(numValor) || numValor <= 0) {
        if (inputValor) {
            inputValor.focus();
            if (typeof inputValor.select === 'function') inputValor.select();
        }
        alert(t('script.alerts.invalidWalletTransferValue', 'Informe um valor valido no campo da Carteira para transferir.'));
        return;
    }

    const saldoCarteiraMes = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoCarteira) : saldoCarteira;
    if (numValor > saldoCarteiraMes) {
        alert(t('script.alerts.insufficientWalletMonth', 'Saldo insuficiente na Carteira para o mes selecionado.'));
        return;
    }

    const descricaoBase = inputDesc?.value?.trim() || 'TransferÃªncia para PoupanÃ§a';
    const dataReferencia = obterDataReferenciaMesSelecionado();

    registrarTransacaoCarteira('saida', numValor, descricaoBase, dataReferencia, 'transferencia_poupanca');

    saldoPoupanca += numValor;
    historicoPoupanca.unshift({
        tipo: 'depositar',
        valor: numValor,
        descricao: 'Vindo da Carteira',
        timestamp: dataReferencia.getTime(),
        data: dataReferencia.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    if (inputValor) inputValor.value = '';
    if (inputDesc) inputDesc.value = '';
    atualizarInterfaceEconomias();
}

function abrirModalResgate() {
    const inputValor = getEl('valor-poupanca');
    const inputDesc = getEl('desc-poupanca');

    const numValor = parseValorInput(inputValor?.value ?? '');
    if (!Number.isFinite(numValor) || numValor <= 0) {
        if (inputValor) {
            inputValor.focus();
            if (typeof inputValor.select === 'function') inputValor.select();
        }
        alert(t('script.alerts.invalidSavingsWithdrawValue', 'Informe um valor valido no campo da Poupanca para resgatar.'));
        return;
    }

    const saldoPoupancaMes = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoPoupanca) : saldoPoupanca;
    if (numValor > saldoPoupancaMes) {
        alert(t('script.alerts.insufficientSavingsMonth', 'Saldo insuficiente na Poupanca para o mes selecionado.'));
        return;
    }

    const descricaoBase = inputDesc?.value?.trim() || 'Enviado para Carteira';
    const dataReferencia = obterDataReferenciaMesSelecionado();

    saldoPoupanca -= numValor;
    historicoPoupanca.unshift({
        tipo: 'sacar',
        valor: numValor,
        descricao: descricaoBase,
        timestamp: dataReferencia.getTime(),
        data: dataReferencia.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    registrarTransacaoCarteira('entrada', numValor, 'Resgate da Poupanca', dataReferencia);

    if (inputValor) inputValor.value = '';
    if (inputDesc) inputDesc.value = '';
    atualizarInterfaceEconomias();
}

/* =========================================
   Mercado Pago: sincronizacao webhook
   ========================================= */
function normalizarReferenciaMercadoPago(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return '';

    const numero = Number(texto);
    if (Number.isFinite(numero)) return String(Math.trunc(numero));
    return texto;
}

function encontrarIndiceClientePorReferenciaMercadoPago(referencia) {
    const texto = normalizarReferenciaMercadoPago(referencia);
    if (!texto) return -1;

    const numero = Number(texto);
    if (Number.isFinite(numero)) {
        return cobrancas.findIndex(cliente => Number(cliente?.id) === numero);
    }

    return cobrancas.findIndex(cliente => String(cliente?.id ?? '') === texto);
}

function existeLancamentoMercadoPagoPorPaymentId(paymentId) {
    const id = String(paymentId || '').trim();
    if (!id) return false;

    const marcador = `MP #${id}`;
    return (historicoCarteira || []).some(item => String(item?.descricao || '').includes(marcador));
}

function obterDataReferenciaPagamentoMercadoPago(cliente, pagamentoMeta = {}) {
    const aprovacao = String(pagamentoMeta?.aprovadoEm || pagamentoMeta?.dateApproved || '').trim();
    if (aprovacao) {
        const dataAprovacao = new Date(aprovacao);
        if (Number.isFinite(dataAprovacao.getTime())) return dataAprovacao;
    }

    return obterDataReferenciaPorIso(cliente?.data);
}


function aplicarPagamentoAutomaticoMercadoPago(referencia, pagamentoMeta = {}) {
    const indice = encontrarIndiceClientePorReferenciaMercadoPago(referencia);
    if (indice === -1) return { encontrado: false, aplicado: false, podeAck: false };

    const cliente = cobrancas[indice];
    if (!cliente) return { encontrado: false, aplicado: false, podeAck: false };

    const paymentId = String(pagamentoMeta?.paymentId || pagamentoMeta?.payment_id || '').trim();
    const jaLancadoNoExtrato = existeLancamentoMercadoPagoPorPaymentId(paymentId);

    const valorTotal = Number(cliente.valor) || 0;
    const valorJaPago = Number(cliente.pagoParcial) || 0;
    const valorAReceberAberto = Math.max(0, Number((valorTotal - valorJaPago).toFixed(2)));

    const marcouPagoAgora = !cliente.pago;
    let alterouCliente = false;
    if (marcouPagoAgora) {
        cliente.pago = true;
        cliente.pagoParcial = cliente.valor;
        alterouCliente = true;
    }

    if (normalizarFormaPagamento(cliente.formaPagamento) !== 'mercado_pago') {
        cliente.formaPagamento = 'mercado_pago';
        alterouCliente = true;
    }

    if (alterouCliente) {
        cobrancas[indice] = cliente;
    }

    let lancouExtrato = false;
    if (!jaLancadoNoExtrato) {
        let valorLancamento = 0;
        if (marcouPagoAgora) {
            valorLancamento = valorAReceberAberto;
        } else {
            const valorMeta = Number(pagamentoMeta?.valor);
            if (Number.isFinite(valorMeta) && valorMeta > 0) {
                valorLancamento = Number(valorMeta.toFixed(2));
            }
        }

        if (valorLancamento > 0) {
            const dataReferencia = obterDataReferenciaPagamentoMercadoPago(cliente, pagamentoMeta);
            const sufixo = paymentId ? ` (MP #${paymentId})` : '';
            registrarTransacaoCarteira(
                'entrada',
                valorLancamento,
                `Recebido via Mercado Pago: ${cliente.nome}${sufixo}`,
                dataReferencia,
                'mercado_pago',
                { formaPagamento: 'mercado_pago' }
            );
            lancouExtrato = true;
        }
    }

    const aplicado = alterouCliente || lancouExtrato;
    const podeAck = aplicado || jaLancadoNoExtrato;

    if (marcouPagoAgora) {
        notificarPagamentoConcluido(cliente, {
            origem: 'mercado_pago',
            valorRecebido: valorAReceberAberto > 0 ? valorAReceberAberto : (Number(cliente.valor) || 0),
            formaPagamento: 'mercado_pago',
            paymentId
        });
    }

    return { encontrado: true, aplicado, podeAck };
}

function coletarReferenciasMercadoPagoPendentes(payload) {
    const refs = Array.isArray(payload?.refs) ? payload.refs : [];
    const resultado = [];

    for (const item of refs) {
        const referencia = normalizarReferenciaMercadoPago(
            item?.externalReference ?? item?.external_reference ?? item?.reference ?? item
        );
        if (!referencia) continue;

        const paymentId = String(item?.paymentId ?? item?.payment_id ?? '').trim();
        const valor = Number(item?.valor ?? item?.transactionAmount ?? item?.transaction_amount);
        const aprovadoEm = String(item?.aprovadoEm ?? item?.dateApproved ?? item?.date_approved ?? '').trim();

        resultado.push({
            referencia,
            paymentId,
            valor: Number.isFinite(valor) ? Number(valor) : 0,
            aprovadoEm
        });
    }

    return resultado;
}

async function enviarAckMercadoPago(referencias) {
    const refs = [...new Set((referencias || []).map(valor => normalizarReferenciaMercadoPago(valor)).filter(Boolean))];
    if (!refs.length) return;

    try {
        await fetch(MERCADO_PAGO_ACK_ENDPOINT, {
            method: 'POST',
            headers: montarHeadersMercadoPagoRequest({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ refs })
        });
    } catch (_) {
        // Se falhar o ack, a proxima sincronizacao tenta novamente.
    }
}

async function sincronizarPagamentosMercadoPago() {
    if (sincronizacaoMercadoPagoEmAndamento) return;
    sincronizacaoMercadoPagoEmAndamento = true;

    try {
        const resposta = await fetch(MERCADO_PAGO_PAID_REFS_ENDPOINT, {
            cache: 'no-store',
            headers: montarHeadersMercadoPagoRequest()
        });
        if (!resposta.ok) return;

        let payload = {};
        try {
            payload = await resposta.json();
        } catch (_) {
            payload = {};
        }

        const pendentes = coletarReferenciasMercadoPagoPendentes(payload);
        if (!pendentes.length) return;

        let houveAtualizacao = false;
        const refsParaAck = [];

        for (const item of pendentes) {
            const resultado = aplicarPagamentoAutomaticoMercadoPago(item.referencia, item);
            if (resultado.podeAck) refsParaAck.push(item.referencia);
            if (resultado.aplicado) houveAtualizacao = true;
        }

        if (houveAtualizacao) {
            atualizarTudo();
        }

        if (refsParaAck.length) {
            await enviarAckMercadoPago(refsParaAck);
        }
    } catch (_) {
        // Silencioso para nÃ£o interromper o uso da tela.
    } finally {
        sincronizacaoMercadoPagoEmAndamento = false;
    }
}

async function sincronizarPagamentoMercadoPagoViaQueryString() {
    const params = new URLSearchParams(window.location.search || '');
    const paymentId = String(params.get('payment_id') || params.get('collection_id') || '').trim();
    if (!paymentId) return;

    try {
        const url = `${MERCADO_PAGO_CONFIRM_ENDPOINT}?id=${encodeURIComponent(paymentId)}`;
        const resposta = await fetch(url, {
            cache: 'no-store',
            headers: montarHeadersMercadoPagoRequest()
        });
        if (!resposta.ok) return;

        await sincronizarPagamentosMercadoPago();
    } catch (_) {
        // ignorado
    }
}

function iniciarSincronizacaoPagamentosMercadoPago() {
    sincronizarPagamentoMercadoPagoViaQueryString();
    sincronizarPagamentosMercadoPago();

    if (sincronizacaoMercadoPagoTimer) clearInterval(sincronizacaoMercadoPagoTimer);
    sincronizacaoMercadoPagoTimer = setInterval(() => {
        sincronizarPagamentosMercadoPago();
    }, MERCADO_PAGO_SYNC_INTERVAL_MS);

    if (!sincronizacaoMercadoPagoEventosRegistrados) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                sincronizarPagamentosMercadoPago();
            }
        });

        window.addEventListener('beforeunload', () => {
            if (sincronizacaoMercadoPagoTimer) {
                clearInterval(sincronizacaoMercadoPagoTimer);
                sincronizacaoMercadoPagoTimer = null;
            }
        }, { once: true });

        sincronizacaoMercadoPagoEventosRegistrados = true;
    }
}
/* =========================================
   Whatsapp
   ========================================= */
function normalizarTelefoneWhatsapp(telefone) {
    const digitos = String(telefone || '').replace(/\D/g, '');
    if (!digitos) return '';
    if (digitos.startsWith('55') && digitos.length > 11) return digitos.slice(2);
    return digitos;
}

function montarWhatsLinkComTexto(telefone, texto) {
    const telefoneBase = normalizarTelefoneWhatsapp(telefone);
    if (!telefoneBase || telefoneBase.length < 10) return '';

    const destino = telefoneBase.startsWith('55') ? telefoneBase : `55${telefoneBase}`;
    return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

function abrirWhatsComTexto(telefone, texto) {
    const link = montarWhatsLinkComTexto(telefone, texto);
    if (!link) return false;
    window.open(link, '_blank');
    return true;
}

async function gerarLinkMercadoPago(cliente) {
    const valorTotal = Number(cliente?.valor) || 0;
    const valorPago = Number(cliente?.pagoParcial) || 0;
    const valorRestante = Math.max(0, Number((valorTotal - valorPago).toFixed(2)));

    if (!Number.isFinite(valorRestante) || valorRestante <= 0) {
        throw new Error('Este cliente nÃ£o possui saldo em aberto.');
    }

    const nomeCliente = String(cliente?.nome || '').trim() || 'Cliente';

    const payload = {
        id: cliente?.id,
        nome: nomeCliente,
        valor: valorRestante,
        descricao: `Mensalidade - ${nomeCliente}`,
        telefone: String(cliente?.telefone || '').trim(),
        data: String(cliente?.data || ''),
        siteBaseUrl: String(window?.location?.origin || '').trim()
    };

    let resposta;
    try {
        resposta = await fetch(MERCADO_PAGO_ENDPOINT, {
            method: 'POST',
            headers: montarHeadersMercadoPagoRequest({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
    } catch (_) {
        throw new Error('Servidor de pagamento indisponivel. Inicie o server.js para usar Mercado Pago.');
    }

    let dados = {};
    try {
        dados = await resposta.json();
    } catch (_) {
        dados = {};
    }

    if (!resposta.ok) {
        const detalhe = String(dados?.error || dados?.message || '').trim();
        throw new Error(detalhe || `Falha ao gerar link (${resposta.status}).`);
    }

    const url = String(dados?.url || '').trim();
    if (!url) throw new Error('Resposta sem link de pagamento.');

    return { url, valor: valorRestante };
}

async function enviarLinkMercadoPagoPorWhatsapp(cliente) {
    const { url, valor } = await gerarLinkMercadoPago(cliente);
    const primeiroNome = String(cliente?.nome || '').split(' ')[0] || 'Cliente';
    const texto = `Bom dia ${primeiroNome}. Segue o link de pagamento Mercado Pago no valor de ${formatarMoeda(valor)}.\n\n${url}`;

    const enviouWhatsapp = abrirWhatsComTexto(cliente?.telefone, texto);
    if (enviouWhatsapp) return true;

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert(t('script.alerts.noPhoneLinkCopied', 'Cliente sem telefone valido. Link copiado para a area de transferencia.'));
        return true;
    }

    window.open(url, '_blank');
    alert(t('script.alerts.noPhoneLinkOpened', 'Cliente sem telefone valido. Link aberto em nova aba.'));
    return true;
}

async function gerarPixMercadoPago(cliente) {
    const nomeCliente = String(cliente?.nome || '').trim() || 'Cliente';
    const valorTotal = Number(cliente?.valor) || 0;
    const valorPago = Number(cliente?.pagoParcial) || 0;
    const valorRestante = Math.max(0, Number((valorTotal - valorPago).toFixed(2)));

    if (!Number.isFinite(valorRestante) || valorRestante <= 0) {
        throw new Error(t('dashboardPage.modals.qrPayment.noPendingBalance', 'Nao ha saldo pendente para gerar PIX.'));
    }

    const payload = {
        id: cliente?.id,
        nome: nomeCliente,
        valor: valorRestante,
        descricao: `Mensalidade - ${nomeCliente}`,
        telefone: String(cliente?.telefone || '').trim(),
        data: String(cliente?.data || ''),
        siteBaseUrl: String(window?.location?.origin || '').trim()
    };

    let resposta;
    try {
        resposta = await fetch(MERCADO_PAGO_PIX_ENDPOINT, {
            method: 'POST',
            headers: montarHeadersMercadoPagoRequest({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
    } catch (_) {
        throw new Error(t('dashboardPage.modals.qrPayment.serverUnavailable', 'Servidor de pagamento indisponivel. Inicie o server.js para usar PIX Mercado Pago.'));
    }

    let dados = {};
    try {
        dados = await resposta.json();
    } catch (_) {
        dados = {};
    }

    if (!resposta.ok) {
        const detalhe = String(dados?.error || dados?.message || '').trim();
        throw new Error(detalhe || t('dashboardPage.modals.qrPayment.generateError', 'Nao foi possivel gerar o QR Code.'));
    }

    const qrCode = String(dados?.qrCode || '').trim();
    const qrCodeBase64 = String(dados?.qrCodeBase64 || '').trim();
    if (!qrCode && !qrCodeBase64) {
        throw new Error(t('dashboardPage.modals.qrPayment.missingQrData', 'Resposta sem dados de QR PIX.'));
    }

    return {
        valor: Number(dados?.valor) || valorRestante,
        paymentId: String(dados?.paymentId || '').trim(),
        status: String(dados?.status || '').trim(),
        qrCode,
        qrCodeBase64,
        ticketUrl: String(dados?.ticketUrl || '').trim()
    };
}

function garantirModalQrMercadoPago() {
    if (qrMercadoPagoModalUi?.modal && document.body?.contains(qrMercadoPagoModalUi.modal)) return qrMercadoPagoModalUi;
    if (!document?.body) return null;

    const modal = document.createElement('div');
    modal.id = 'modalQrMercadoPago';
    modal.className = 'modal-geral modal-qr-mercado-pago';
    modal.innerHTML = `
      <div class="modal-content">
        <button type="button" class="close-modal close-modal-btn" id="btn-fechar-qr-mp" aria-label="${escapeHtml(t('dashboardPage.modals.qrPayment.close', 'Fechar'))}">
          <span aria-hidden="true">&times;</span>
        </button>
        <h3 id="qr-mp-titulo">${escapeHtml(t('dashboardPage.modals.qrPayment.title', 'QR Code de pagamento'))}</h3>
        <p id="qr-mp-subtitulo" class="qr-mp-subtitulo">${escapeHtml(t('dashboardPage.modals.qrPayment.subtitle', 'Use este QR para abrir o checkout do Mercado Pago no celular.'))}</p>
        <div id="qr-mp-loading" class="qr-mp-loading" hidden>
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <span>${escapeHtml(t('dashboardPage.modals.qrPayment.generating', 'Gerando QR Code de pagamento...'))}</span>
        </div>
        <div id="qr-mp-box" class="qr-mp-box">
          <div id="qr-mp-canvas" class="qr-mp-canvas" aria-live="polite"></div>
        </div>
        <div id="qr-mp-meta" class="qr-mp-meta" hidden>
          <div class="qr-mp-meta-item">
            <small>${escapeHtml(t('dashboardPage.modals.qrPayment.customerLabel', 'Cliente'))}</small>
            <strong id="qr-mp-cliente">-</strong>
          </div>
          <div class="qr-mp-meta-item">
            <small>${escapeHtml(t('dashboardPage.modals.qrPayment.amountLabel', 'Valor'))}</small>
            <strong id="qr-mp-valor">-</strong>
          </div>
        </div>
        <div class="qr-mp-status-wrap" id="qr-mp-status-wrap" hidden>
          <div class="qr-mp-status-top">
            <small id="qr-mp-status-label">${escapeHtml(t('dashboardPage.modals.qrPayment.statusTitle', 'Status do pagamento'))}</small>
            <span class="qr-mp-status-badge" id="qr-mp-status-badge">${escapeHtml(t('dashboardPage.modals.qrPayment.statusAwaiting', 'Aguardando'))}</span>
          </div>
          <div class="qr-mp-status-msg" id="qr-mp-status-msg">${escapeHtml(t('dashboardPage.modals.qrPayment.statusChecking', 'Aguardando consulta de status...'))}</div>
          <div class="qr-mp-status-meta" id="qr-mp-status-meta"></div>
        </div>
        <div class="qr-mp-link-wrap" id="qr-mp-link-wrap" hidden>
          <label class="qr-mp-link-label" for="qr-mp-link" id="qr-mp-link-label">${escapeHtml(t('dashboardPage.modals.qrPayment.copyFieldLinkLabel', 'Link de pagamento'))}</label>
          <textarea id="qr-mp-link" rows="3" readonly></textarea>
        </div>
        <div class="qr-mp-acoes">
          <button type="button" class="btn-acao-principal qr-mp-btn-secondary" id="btn-qr-mp-copiar">
            <i class="fa-solid fa-copy" aria-hidden="true"></i>
            <span>${escapeHtml(t('dashboardPage.modals.qrPayment.copyLink', 'Copiar link'))}</span>
          </button>
          <button type="button" class="btn-acao-principal" id="btn-qr-mp-abrir">
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            <span>${escapeHtml(t('dashboardPage.modals.qrPayment.openCheckout', 'Abrir checkout'))}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const ui = {
        modal,
        titulo: modal.querySelector('#qr-mp-titulo'),
        subtitulo: modal.querySelector('#qr-mp-subtitulo'),
        loading: modal.querySelector('#qr-mp-loading'),
        box: modal.querySelector('#qr-mp-box'),
        canvas: modal.querySelector('#qr-mp-canvas'),
        meta: modal.querySelector('#qr-mp-meta'),
        cliente: modal.querySelector('#qr-mp-cliente'),
        valor: modal.querySelector('#qr-mp-valor'),
        statusWrap: modal.querySelector('#qr-mp-status-wrap'),
        statusLabel: modal.querySelector('#qr-mp-status-label'),
        statusBadge: modal.querySelector('#qr-mp-status-badge'),
        statusMsg: modal.querySelector('#qr-mp-status-msg'),
        statusMeta: modal.querySelector('#qr-mp-status-meta'),
        linkWrap: modal.querySelector('#qr-mp-link-wrap'),
        linkLabel: modal.querySelector('#qr-mp-link-label'),
        linkInput: modal.querySelector('#qr-mp-link'),
        btnFechar: modal.querySelector('#btn-fechar-qr-mp'),
        btnCopiar: modal.querySelector('#btn-qr-mp-copiar'),
        btnAbrir: modal.querySelector('#btn-qr-mp-abrir')
    };

    const fechar = () => fecharModalQrMercadoPago();
    if (ui.btnFechar) ui.btnFechar.addEventListener('click', fechar);
    modal.addEventListener('click', event => {
        if (event.target === modal) fechar();
    });
    if (!window.__finQrMercadoPagoEscBound) {
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape') fecharModalQrMercadoPago();
        });
        window.__finQrMercadoPagoEscBound = true;
    }

    if (ui.btnCopiar) {
        ui.btnCopiar.addEventListener('click', async () => {
            const codigo = String(qrMercadoPagoLinkAtual || '').trim();
            if (!codigo) return;
            let copiou = false;
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(codigo);
                    copiou = true;
                }
            } catch (_) {}

            if (!copiou) {
                try {
                    ui.linkInput?.focus();
                    ui.linkInput?.select();
                    copiou = Boolean(document.execCommand('copy'));
                } catch (_) {}
            }

            if (copiou) {
                mostrarToastPagamentoConcluido({
                    titulo: qrMercadoPagoToastCopiaTituloAtual || t('dashboardPage.modals.qrPayment.linkCopiedTitle', 'Link copiado'),
                    mensagem: qrMercadoPagoToastCopiaMensagemAtual || t('dashboardPage.modals.qrPayment.linkCopiedMessage', 'O link de pagamento foi copiado para a area de transferencia.'),
                    tipo: 'info',
                    duracaoMs: 2500
                });
            }
        });
    }

    if (ui.btnAbrir) {
        ui.btnAbrir.addEventListener('click', () => {
            const link = String(qrMercadoPagoAbrirUrlAtual || '').trim();
            if (!link) return;
            window.open(link, '_blank', 'noopener,noreferrer');
        });
    }

    qrMercadoPagoModalUi = ui;
    return ui;
}

function pararMonitoramentoStatusQrMercadoPago({ preservarUi = false } = {}) {
    if (qrMercadoPagoStatusPollTimer) {
        clearInterval(qrMercadoPagoStatusPollTimer);
        qrMercadoPagoStatusPollTimer = null;
    }
    qrMercadoPagoStatusPollToken += 1;
    qrMercadoPagoStatusPollEmAndamento = false;
    if (!preservarUi) {
        atualizarStatusPagamentoQrMercadoPago({ visivel: false });
    }
}

function mapearStatusMercadoPagoParaModal(statusRaw) {
    const status = String(statusRaw || '').trim().toLowerCase();
    switch (status) {
        case 'approved':
            return { texto: t('dashboardPage.modals.qrPayment.statusApproved', 'Aprovado'), classe: 'is-success', terminal: true };
        case 'pending':
            return { texto: t('dashboardPage.modals.qrPayment.statusPending', 'Pendente'), classe: 'is-pending', terminal: false };
        case 'in_process':
            return { texto: t('dashboardPage.modals.qrPayment.statusInProcess', 'Em processamento'), classe: 'is-pending', terminal: false };
        case 'authorized':
            return { texto: t('dashboardPage.modals.qrPayment.statusAuthorized', 'Autorizado'), classe: 'is-info', terminal: false };
        case 'rejected':
            return { texto: t('dashboardPage.modals.qrPayment.statusRejected', 'Recusado'), classe: 'is-error', terminal: true };
        case 'cancelled':
            return { texto: t('dashboardPage.modals.qrPayment.statusCancelled', 'Cancelado'), classe: 'is-error', terminal: true };
        case 'expired':
            return { texto: t('dashboardPage.modals.qrPayment.statusExpired', 'Expirado'), classe: 'is-error', terminal: true };
        case 'refunded':
            return { texto: t('dashboardPage.modals.qrPayment.statusRefunded', 'Estornado'), classe: 'is-error', terminal: true };
        case 'charged_back':
            return { texto: t('dashboardPage.modals.qrPayment.statusChargedBack', 'Chargeback'), classe: 'is-error', terminal: true };
        default:
            return { texto: t('dashboardPage.modals.qrPayment.statusUnknown', 'Status desconhecido'), classe: 'is-info', terminal: false };
    }
}

function atualizarStatusPagamentoQrMercadoPago({
    visivel = false,
    status = '',
    mensagem = '',
    paymentId = '',
    atualizadoEm = null,
    erro = false
} = {}) {
    const ui = garantirModalQrMercadoPago();
    if (!ui) return;

    if (ui.statusWrap) ui.statusWrap.hidden = !visivel;
    if (!visivel) return;

    const info = erro
        ? { texto: t('dashboardPage.modals.qrPayment.statusError', 'Erro na consulta'), classe: 'is-error' }
        : mapearStatusMercadoPagoParaModal(status);

    if (ui.statusLabel) ui.statusLabel.textContent = t('dashboardPage.modals.qrPayment.statusTitle', 'Status do pagamento');
    if (ui.statusBadge) {
        ui.statusBadge.textContent = info.texto;
        ui.statusBadge.className = `qr-mp-status-badge ${info.classe}`.trim();
    }

    if (ui.statusMsg) {
        ui.statusMsg.textContent = mensagem || (
            erro
                ? t('dashboardPage.modals.qrPayment.statusPollError', 'Nao foi possivel atualizar o status agora. Tentando novamente...')
                : t('dashboardPage.modals.qrPayment.statusChecking', 'Consultando status do pagamento...')
        );
    }

    const metaPartes = [];
    const paymentIdTexto = String(paymentId || '').trim();
    if (paymentIdTexto) {
        metaPartes.push(t('dashboardPage.modals.qrPayment.statusPaymentId', 'Pagamento #{id}', { id: paymentIdTexto }));
    }
    const dataRef = atualizadoEm instanceof Date ? atualizadoEm : (atualizadoEm ? new Date(atualizadoEm) : null);
    if (dataRef && Number.isFinite(dataRef.getTime())) {
        const hora = dataRef.toLocaleTimeString(localeAtualI18n(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        metaPartes.push(t('dashboardPage.modals.qrPayment.statusUpdatedAt', 'Atualizado as {hora}', { hora }));
    }
    if (ui.statusMeta) ui.statusMeta.textContent = metaPartes.join(' â€¢ ');
}

async function consultarStatusPagamentoMercadoPagoNoModal(paymentId) {
    const id = String(paymentId || '').trim();
    if (!id) throw new Error('payment_id_invalido');

    const url = `${MERCADO_PAGO_CONFIRM_ENDPOINT}?id=${encodeURIComponent(id)}`;
    const resposta = await fetch(url, {
        cache: 'no-store',
        headers: montarHeadersMercadoPagoRequest()
    });

    let payload = {};
    try {
        payload = await resposta.json();
    } catch (_) {
        payload = {};
    }

    if (!resposta.ok || !payload?.ok) {
        const detalhe = String(payload?.error || payload?.message || '').trim();
        throw new Error(detalhe || 'Falha ao consultar status do pagamento.');
    }

    return payload?.resultado || {};
}

function iniciarMonitoramentoStatusPagamentoQrMercadoPago({ paymentId = '', referencia = '' } = {}) {
    const id = String(paymentId || '').trim();
    const ref = String(referencia || '').trim();
    if (!id) {
        pararMonitoramentoStatusQrMercadoPago();
        return;
    }

    pararMonitoramentoStatusQrMercadoPago({ preservarUi: true });
    const token = qrMercadoPagoStatusPollToken + 1;
    qrMercadoPagoStatusPollToken = token;
    let sincronizacaoDisparada = false;

    const tick = async () => {
        if (token !== qrMercadoPagoStatusPollToken) return;
        if (qrMercadoPagoStatusPollEmAndamento) return;

        const ui = garantirModalQrMercadoPago();
        if (!ui?.modal || ui.modal.style.display === 'none') {
            pararMonitoramentoStatusQrMercadoPago();
            return;
        }

        qrMercadoPagoStatusPollEmAndamento = true;
        try {
            const resultado = await consultarStatusPagamentoMercadoPagoNoModal(id);
            if (token !== qrMercadoPagoStatusPollToken) return;

            const statusAtual = String(resultado?.status || '').trim().toLowerCase();
            const detalheStatus = String(resultado?.statusDetail || resultado?.status_detail || '').trim();
            const info = mapearStatusMercadoPagoParaModal(statusAtual);
            const mensagem = detalheStatus
                ? `${info.texto} â€¢ ${detalheStatus}`
                : (
                    info.terminal
                        ? info.texto
                        : t('dashboardPage.modals.qrPayment.statusChecking', 'Consultando status do pagamento...')
                );

            atualizarStatusPagamentoQrMercadoPago({
                visivel: true,
                status: statusAtual,
                mensagem,
                paymentId: id,
                atualizadoEm: new Date()
            });

            if (statusAtual === 'approved' && !sincronizacaoDisparada) {
                sincronizacaoDisparada = true;
                try {
                    await sincronizarPagamentosMercadoPago();
                } catch (_) {
                    // sincronizacao silenciosa
                }
                if (ref) {
                    try {
                        const aplicacaoLocal = aplicarPagamentoAutomaticoMercadoPago(ref, { paymentId: id });
                        if (aplicacaoLocal?.aplicado) atualizarTudo();
                    } catch (_) {}
                }
            }

            if (info.terminal) {
                if (statusAtual && statusAtual !== 'approved') {
                    try {
                        await notificarStatusMercadoPagoTerminal({
                            paymentId: id,
                            status: statusAtual,
                            detalhe: detalheStatus,
                            referencia: ref
                        });
                    } catch (_) {
                        // notificacao local silenciosa
                    }
                }
                if (qrMercadoPagoStatusPollTimer) {
                    clearInterval(qrMercadoPagoStatusPollTimer);
                    qrMercadoPagoStatusPollTimer = null;
                }
            }
        } catch (_) {
            if (token !== qrMercadoPagoStatusPollToken) return;
            atualizarStatusPagamentoQrMercadoPago({
                visivel: true,
                status: '',
                mensagem: t('dashboardPage.modals.qrPayment.statusPollError', 'Nao foi possivel atualizar o status agora. Tentando novamente...'),
                paymentId: id,
                atualizadoEm: new Date(),
                erro: true
            });
        } finally {
            if (token === qrMercadoPagoStatusPollToken) {
                qrMercadoPagoStatusPollEmAndamento = false;
            }
        }
    };

    atualizarStatusPagamentoQrMercadoPago({
        visivel: true,
        status: 'pending',
        mensagem: t('dashboardPage.modals.qrPayment.statusChecking', 'Consultando status do pagamento...'),
        paymentId: id,
        atualizadoEm: new Date()
    });
    tick();
    qrMercadoPagoStatusPollTimer = setInterval(tick, MERCADO_PAGO_MODAL_STATUS_POLL_INTERVAL_MS);
}

function fecharModalQrMercadoPago() {
    const ui = garantirModalQrMercadoPago();
    if (!ui?.modal) return;
    pararMonitoramentoStatusQrMercadoPago();
    ui.modal.style.display = 'none';
}

function atualizarEstadoModalQrMercadoPago({
    carregando = false,
    cliente = '',
    valor = '',
    codigoCopia = '',
    urlAbrir = '',
    rotuloCampo = '',
    rotuloBtnCopiar = '',
    rotuloBtnAbrir = '',
    ocultarAbrir = false,
    toastCopiaTitulo = '',
    toastCopiaMensagem = ''
} = {}) {
    const ui = garantirModalQrMercadoPago();
    if (!ui) return;

    qrMercadoPagoLinkAtual = String(codigoCopia || '').trim();
    qrMercadoPagoAbrirUrlAtual = String(urlAbrir || '').trim();
    qrMercadoPagoToastCopiaTituloAtual = String(toastCopiaTitulo || '').trim();
    qrMercadoPagoToastCopiaMensagemAtual = String(toastCopiaMensagem || '').trim();

    if (ui.loading) ui.loading.hidden = !carregando;
    if (ui.meta) ui.meta.hidden = !cliente && !valor;
    if (ui.linkWrap) ui.linkWrap.hidden = !qrMercadoPagoLinkAtual;
    if (ui.linkLabel) ui.linkLabel.textContent = rotuloCampo || t('dashboardPage.modals.qrPayment.copyFieldLinkLabel', 'Link de pagamento');
    if (ui.linkInput) ui.linkInput.value = qrMercadoPagoLinkAtual;
    if (ui.btnCopiar) ui.btnCopiar.disabled = !qrMercadoPagoLinkAtual || carregando;
    if (ui.btnCopiar?.querySelector('span')) {
        ui.btnCopiar.querySelector('span').textContent = rotuloBtnCopiar || t('dashboardPage.modals.qrPayment.copyLink', 'Copiar link');
    }
    if (ui.btnAbrir) {
        ui.btnAbrir.hidden = Boolean(ocultarAbrir);
        ui.btnAbrir.disabled = !qrMercadoPagoAbrirUrlAtual || carregando;
        if (ui.btnAbrir.querySelector('span')) {
            ui.btnAbrir.querySelector('span').textContent = rotuloBtnAbrir || t('dashboardPage.modals.qrPayment.openCheckout', 'Abrir checkout');
        }
    }

    if (ui.cliente) ui.cliente.textContent = cliente || '-';
    if (ui.valor) ui.valor.textContent = valor || '-';

    if (ui.canvas && !carregando && !qrMercadoPagoLinkAtual) {
        ui.canvas.innerHTML = `<div class="qr-mp-placeholder">${escapeHtml(t('dashboardPage.modals.qrPayment.noData', 'Nenhum QR gerado ainda.'))}</div>`;
    }
}

function carregarBibliotecaQrMercadoPago() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (qrMercadoPagoScriptPromise) return qrMercadoPagoScriptPromise;

    qrMercadoPagoScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.async = true;
        script.onload = () => {
            if (window.QRCode) resolve(window.QRCode);
            else reject(new Error('Biblioteca QR indisponivel.'));
        };
        script.onerror = () => reject(new Error('Falha ao carregar biblioteca de QR Code.'));
        document.head.appendChild(script);
    });

    return qrMercadoPagoScriptPromise;
}

function renderizarQrMercadoPagoNoModal(payload) {
    const ui = garantirModalQrMercadoPago();
    if (!ui?.canvas) return;
    const link = typeof payload === 'string'
        ? String(payload || '').trim()
        : String(payload?.textoQr || payload?.url || '').trim();
    const qrBase64 = typeof payload === 'string'
        ? ''
        : String(payload?.qrCodeBase64 || '').trim();

    ui.canvas.innerHTML = '';
    if (!link && !qrBase64) {
        ui.canvas.innerHTML = `<div class="qr-mp-placeholder">${escapeHtml(t('dashboardPage.modals.qrPayment.noData', 'Nenhum QR gerado ainda.'))}</div>`;
        return;
    }

    if (qrBase64) {
        const img = document.createElement('img');
        img.alt = t('dashboardPage.modals.qrPayment.imageAlt', 'QR Code de pagamento Mercado Pago');
        img.loading = 'eager';
        img.decoding = 'async';
        img.src = qrBase64;
        img.className = 'qr-mp-imagem';
        ui.canvas.appendChild(img);
        return;
    }

    const renderFallback = () => {
        const img = document.createElement('img');
        img.alt = t('dashboardPage.modals.qrPayment.imageAlt', 'QR Code de pagamento Mercado Pago');
        img.loading = 'eager';
        img.decoding = 'async';
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(link)}`;
        img.className = 'qr-mp-imagem';
        ui.canvas.appendChild(img);
    };

    if (!window.QRCode) {
        renderFallback();
        return;
    }

    try {
        const container = document.createElement('div');
        container.className = 'qr-mp-qrcodejs';
        ui.canvas.appendChild(container);
        // qrcodejs usa o global QRCode.
        new window.QRCode(container, {
            text: link,
            width: 320,
            height: 320,
            colorDark: '#0c1d33',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel?.M || 0
        });
        const img = container.querySelector('img');
        const canvas = container.querySelector('canvas');
        if (img) img.classList.add('qr-mp-imagem');
        if (canvas) canvas.classList.add('qr-mp-canvas-el');
    } catch (_) {
        ui.canvas.innerHTML = '';
        renderFallback();
    }
}

async function abrirModalQrMercadoPago(cliente) {
    const ui = garantirModalQrMercadoPago();
    if (!ui?.modal || !cliente) return;

    pararMonitoramentoStatusQrMercadoPago();
    ui.modal.style.display = 'flex';
    if (ui.titulo) ui.titulo.textContent = t('dashboardPage.modals.qrPayment.title', 'QR Code de pagamento');
    if (ui.subtitulo) ui.subtitulo.textContent = t('dashboardPage.modals.qrPayment.subtitle', 'Use este QR para abrir o checkout do Mercado Pago no celular.');
    atualizarStatusPagamentoQrMercadoPago({ visivel: false });
    atualizarEstadoModalQrMercadoPago({
        carregando: true,
        cliente: String(cliente.nome || ''),
        valor: '',
        codigoCopia: '',
        urlAbrir: '',
        rotuloCampo: t('dashboardPage.modals.qrPayment.copyFieldLinkLabel', 'Link de pagamento'),
        rotuloBtnCopiar: t('dashboardPage.modals.qrPayment.copyLink', 'Copiar link'),
        rotuloBtnAbrir: t('dashboardPage.modals.qrPayment.openCheckout', 'Abrir checkout'),
        ocultarAbrir: false,
        toastCopiaTitulo: t('dashboardPage.modals.qrPayment.linkCopiedTitle', 'Link copiado'),
        toastCopiaMensagem: t('dashboardPage.modals.qrPayment.linkCopiedMessage', 'O link de pagamento foi copiado para a area de transferencia.')
    });
    if (ui.canvas) {
        ui.canvas.innerHTML = `<div class="qr-mp-placeholder carregando">${escapeHtml(t('dashboardPage.modals.qrPayment.generating', 'Gerando QR Code de pagamento...'))}</div>`;
    }

    let resultado;
    try {
        resultado = await gerarLinkMercadoPago(cliente);
    } catch (erro) {
        atualizarEstadoModalQrMercadoPago({
            carregando: false,
            cliente: String(cliente.nome || ''),
            valor: '',
            codigoCopia: '',
            urlAbrir: '',
            rotuloCampo: t('dashboardPage.modals.qrPayment.copyFieldLinkLabel', 'Link de pagamento'),
            rotuloBtnCopiar: t('dashboardPage.modals.qrPayment.copyLink', 'Copiar link'),
            rotuloBtnAbrir: t('dashboardPage.modals.qrPayment.openCheckout', 'Abrir checkout'),
            ocultarAbrir: false,
            toastCopiaTitulo: t('dashboardPage.modals.qrPayment.linkCopiedTitle', 'Link copiado'),
            toastCopiaMensagem: t('dashboardPage.modals.qrPayment.linkCopiedMessage', 'O link de pagamento foi copiado para a area de transferencia.')
        });
        if (ui.canvas) {
            const detalhe = String(erro?.message || '').trim();
            ui.canvas.innerHTML = `<div class="qr-mp-placeholder erro">${escapeHtml(t('dashboardPage.modals.qrPayment.generateError', 'Nao foi possivel gerar o QR Code.'))}${detalhe ? `<small>${escapeHtml(detalhe)}</small>` : ''}</div>`;
        }
        throw erro;
    }

    try {
        await carregarBibliotecaQrMercadoPago();
    } catch (_) {
        /* usa fallback por imagem */
    }

    atualizarEstadoModalQrMercadoPago({
        carregando: false,
        cliente: String(cliente.nome || ''),
        valor: formatarMoeda(Number(resultado?.valor) || 0),
        codigoCopia: String(resultado?.url || ''),
        urlAbrir: String(resultado?.url || ''),
        rotuloCampo: t('dashboardPage.modals.qrPayment.copyFieldLinkLabel', 'Link de pagamento'),
        rotuloBtnCopiar: t('dashboardPage.modals.qrPayment.copyLink', 'Copiar link'),
        rotuloBtnAbrir: t('dashboardPage.modals.qrPayment.openCheckout', 'Abrir checkout'),
        ocultarAbrir: false,
        toastCopiaTitulo: t('dashboardPage.modals.qrPayment.linkCopiedTitle', 'Link copiado'),
        toastCopiaMensagem: t('dashboardPage.modals.qrPayment.linkCopiedMessage', 'O link de pagamento foi copiado para a area de transferencia.')
    });
    renderizarQrMercadoPagoNoModal(String(resultado?.url || ''));
}

async function abrirModalPixMercadoPago(cliente) {
    const ui = garantirModalQrMercadoPago();
    if (!ui?.modal || !cliente) return;

    pararMonitoramentoStatusQrMercadoPago();
    ui.modal.style.display = 'flex';
    if (ui.titulo) ui.titulo.textContent = t('dashboardPage.modals.qrPayment.pixTitle', 'PIX copia e cola (Mercado Pago)');
    if (ui.subtitulo) ui.subtitulo.textContent = t('dashboardPage.modals.qrPayment.pixSubtitle', 'Mostre o QR EMV ou copie o codigo PIX para pagamento imediato.');
    atualizarStatusPagamentoQrMercadoPago({
        visivel: true,
        status: 'pending',
        mensagem: t('dashboardPage.modals.qrPayment.statusPreparing', 'Gerando PIX e iniciando acompanhamento de status...'),
        atualizadoEm: new Date()
    });
    atualizarEstadoModalQrMercadoPago({
        carregando: true,
        cliente: String(cliente.nome || ''),
        valor: '',
        codigoCopia: '',
        urlAbrir: '',
        rotuloCampo: t('dashboardPage.modals.qrPayment.copyFieldPixLabel', 'Codigo PIX copia e cola'),
        rotuloBtnCopiar: t('dashboardPage.modals.qrPayment.copyPixCode', 'Copiar codigo PIX'),
        rotuloBtnAbrir: t('dashboardPage.modals.qrPayment.openTicket', 'Abrir comprovante/checkout'),
        ocultarAbrir: true,
        toastCopiaTitulo: t('dashboardPage.modals.qrPayment.pixCopiedTitle', 'Codigo PIX copiado'),
        toastCopiaMensagem: t('dashboardPage.modals.qrPayment.pixCopiedMessage', 'O codigo PIX foi copiado para a area de transferencia.')
    });

    if (ui.canvas) {
        ui.canvas.innerHTML = `<div class="qr-mp-placeholder carregando">${escapeHtml(t('dashboardPage.modals.qrPayment.generating', 'Gerando QR Code de pagamento...'))}</div>`;
    }

    let resultado;
    try {
        resultado = await gerarPixMercadoPago(cliente);
    } catch (erro) {
        atualizarEstadoModalQrMercadoPago({
            carregando: false,
            cliente: String(cliente.nome || ''),
            valor: '',
            codigoCopia: '',
            urlAbrir: '',
            rotuloCampo: t('dashboardPage.modals.qrPayment.copyFieldPixLabel', 'Codigo PIX copia e cola'),
            rotuloBtnCopiar: t('dashboardPage.modals.qrPayment.copyPixCode', 'Copiar codigo PIX'),
            rotuloBtnAbrir: t('dashboardPage.modals.qrPayment.openTicket', 'Abrir comprovante/checkout'),
            ocultarAbrir: true,
            toastCopiaTitulo: t('dashboardPage.modals.qrPayment.pixCopiedTitle', 'Codigo PIX copiado'),
            toastCopiaMensagem: t('dashboardPage.modals.qrPayment.pixCopiedMessage', 'O codigo PIX foi copiado para a area de transferencia.')
        });
        if (ui.canvas) {
            const detalhe = String(erro?.message || '').trim();
            ui.canvas.innerHTML = `<div class="qr-mp-placeholder erro">${escapeHtml(t('dashboardPage.modals.qrPayment.generateError', 'Nao foi possivel gerar o QR Code.'))}${detalhe ? `<small>${escapeHtml(detalhe)}</small>` : ''}</div>`;
        }
        throw erro;
    }

    try {
        await carregarBibliotecaQrMercadoPago();
    } catch (_) {
        /* usa fallback por imagem/base64 */
    }

    atualizarEstadoModalQrMercadoPago({
        carregando: false,
        cliente: String(cliente.nome || ''),
        valor: formatarMoeda(Number(resultado?.valor) || 0),
        codigoCopia: String(resultado?.qrCode || ''),
        urlAbrir: String(resultado?.ticketUrl || ''),
        rotuloCampo: t('dashboardPage.modals.qrPayment.copyFieldPixLabel', 'Codigo PIX copia e cola'),
        rotuloBtnCopiar: t('dashboardPage.modals.qrPayment.copyPixCode', 'Copiar codigo PIX'),
        rotuloBtnAbrir: t('dashboardPage.modals.qrPayment.openTicket', 'Abrir comprovante/checkout'),
        ocultarAbrir: !String(resultado?.ticketUrl || '').trim(),
        toastCopiaTitulo: t('dashboardPage.modals.qrPayment.pixCopiedTitle', 'Codigo PIX copiado'),
        toastCopiaMensagem: t('dashboardPage.modals.qrPayment.pixCopiedMessage', 'O codigo PIX foi copiado para a area de transferencia.')
    });
    iniciarMonitoramentoStatusPagamentoQrMercadoPago({
        paymentId: String(resultado?.paymentId || ''),
        referencia: String(cliente?.id || '')
    });
    renderizarQrMercadoPagoNoModal({
        textoQr: String(resultado?.qrCode || ''),
        qrCodeBase64: String(resultado?.qrCodeBase64 || '')
    });
}

function abrirMenuWhats(id) {
    const cliente = cobrancas.find(item => item.id === id);
    if (!cliente) return;

    const modal = getEl('modalWhatsapp');
    const lista = getEl('lista-mensagens');
    const titulo = getEl('whats-titulo');
    if (!modal || !lista || !titulo) return;

    const primeiroNome = String(cliente.nome || '').split(' ')[0] || t('dashboardPage.modals.whatsapp.customerFallbackName', 'Cliente');
    const telefone = normalizarTelefoneWhatsapp(cliente.telefone);
    const valorTotalNumero = Number(cliente.valor) || 0;
    const valorPagoNumero = Number(cliente.pagoParcial) || 0;
    const saldoDevedorNumero = Math.max(0, Number((valorTotalNumero - valorPagoNumero).toFixed(2)));
    const valorTotal = formatarMoeda(valorTotalNumero);
    const valorPago = formatarMoeda(valorPagoNumero);
    const saldoDevedor = formatarMoeda(saldoDevedorNumero);

    titulo.innerText = t('dashboardPage.modals.whatsapp.messageFor', 'Mensagem para {nome}', { nome: primeiroNome });
    lista.innerHTML = '';

    let opcoes = [
        {
            titulo: t('dashboardPage.modals.whatsapp.options.dueDateTitle', 'Dia do vencimento'),
            texto: t('dashboardPage.modals.whatsapp.options.dueDateText', 'Bom dia {nome}. Hoje e o dia da mensalidade no valor de {valor}.', { nome: primeiroNome, valor: valorTotal })
        },
        {
            titulo: t('dashboardPage.modals.whatsapp.options.openReminderTitle', 'Lembrete em aberto'),
            texto: t('dashboardPage.modals.whatsapp.options.openReminderText', 'Bom dia. Percebemos que a mensalidade esta em aberto. Se precisar conversar, estou a disposicao.')
        },
        {
            titulo: t('dashboardPage.modals.whatsapp.options.negotiationTitle', 'Negociacao'),
            texto: t('dashboardPage.modals.whatsapp.options.negotiationText', 'Bom dia. Sobre a mensalidade em aberto, podemos negociar a melhor forma de pagamento.')
        },
        {
            titulo: t('dashboardPage.modals.whatsapp.options.newDueDateTitle', 'Novo vencimento'),
            texto: t('dashboardPage.modals.whatsapp.options.newDueDateText', 'Boa tarde. Conforme combinado, atualizamos o vencimento da mensalidade.')
        }
    ];

    if (!cliente.pago && saldoDevedorNumero > 0) {
        opcoes.unshift(
            {
                titulo: t('dashboardPage.modals.whatsapp.options.mpPixQrTitle', 'PIX instantaneo (QR + copia e cola)'),
                texto: t('dashboardPage.modals.whatsapp.options.mpPixQrText', 'Gerar PIX nativo com QR e codigo copia e cola de {valor}.', { valor: saldoDevedor }),
                tipo: 'mercadopago_pix_qr'
            },
            {
                titulo: t('dashboardPage.modals.whatsapp.options.mpQrTitle', 'Checkout Mercado Pago (QR do link)'),
                texto: t('dashboardPage.modals.whatsapp.options.mpQrText', 'Gerar QR do link de checkout de {valor} para exibir na tela.', { valor: saldoDevedor }),
                tipo: 'mercadopago_qr'
            },
            {
                titulo: t('dashboardPage.modals.whatsapp.options.mpLinkTitle', 'Link Mercado Pago'),
                texto: t('dashboardPage.modals.whatsapp.options.mpLinkText', 'Gerar e enviar link de pagamento de {valor}.', { valor: saldoDevedor }),
                tipo: 'mercadopago'
            }
        );
    }

    if ((Number(cliente.pagoParcial) || 0) > 0 && !cliente.pago) {
        const opcaoSaldo = {
            titulo: t('dashboardPage.modals.whatsapp.options.remainingBalanceTitle', 'Saldo restante'),
            texto: t('dashboardPage.modals.whatsapp.options.remainingBalanceText', 'Recebi o valor parcial de {valorPago}. O saldo restante e {saldo}.', { valorPago, saldo: saldoDevedor })
        };

        if (['mercadopago', 'mercadopago_qr', 'mercadopago_pix_qr'].includes(String(opcoes[0]?.tipo || ''))) opcoes.splice(1, 0, opcaoSaldo);
        else opcoes.unshift(opcaoSaldo);
    }

    if (cliente.pago) {
        opcoes = [
            {
                titulo: t('dashboardPage.modals.whatsapp.options.thankPaymentTitle', 'Agradecer pagamento'),
                texto: t('dashboardPage.modals.whatsapp.options.thankPaymentText', 'Recebi seu pagamento de {valor}. Obrigado.', { valor: valorTotal })
            },
            {
                titulo: t('dashboardPage.modals.whatsapp.options.newDueDateTitle', 'Novo vencimento'),
                texto: t('dashboardPage.modals.whatsapp.options.nextMonthDueDateText', 'Conforme combinado, atualizamos o vencimento para o proximo mes.')
            }
        ];
    }

    const fragment = document.createDocumentFragment();

    for (const opcao of opcoes) {
        const btn = document.createElement('button');
        btn.className = 'btn-acao-principal';
        if (opcao.tipo === 'mercadopago') btn.classList.add('btn-opcao-mercado-pago');
        if (opcao.tipo === 'mercadopago_qr') btn.classList.add('btn-opcao-mercado-pago-qr');
        if (opcao.tipo === 'mercadopago_pix_qr') btn.classList.add('btn-opcao-mercado-pago-qr');

        btn.style.textAlign = 'left';
        btn.style.padding = '15px';
        btn.style.marginBottom = '5px';

        const textoPreview = String(opcao.texto || '').slice(0, 72);
        const textoEllipsis = textoPreview.length >= 72 ? `${textoPreview}...` : textoPreview;
        btn.innerHTML = `<strong>${escapeHtml(opcao.titulo)}</strong><br><small style="display:block; margin-top:5px; opacity:0.7; line-height:1.2">${escapeHtml(textoEllipsis)}</small>`;

        btn.onclick = async () => {
            if (opcao.tipo === 'mercadopago_pix_qr') {
                const htmlOriginal = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<strong>${escapeHtml(t('dashboardPage.modals.qrPayment.generating', 'Gerando QR Code de pagamento...'))}</strong>`;

                try {
                    await abrirModalPixMercadoPago(cliente);
                    fecharModalWhats();
                } catch (erro) {
                    const detalhe = String(erro?.message || '').trim();
                    alert(t('dashboardPage.modals.qrPayment.generateErrorWithDetail', 'Nao foi possivel gerar o QR Code do Mercado Pago.\\n{detalhe}', { detalhe }));
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = htmlOriginal;
                }
                return;
            }

            if (opcao.tipo === 'mercadopago_qr') {
                const htmlOriginal = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<strong>${escapeHtml(t('dashboardPage.modals.qrPayment.generating', 'Gerando QR Code de pagamento...'))}</strong>`;

                try {
                    await abrirModalQrMercadoPago(cliente);
                    fecharModalWhats();
                } catch (erro) {
                    const detalhe = String(erro?.message || '').trim();
                    alert(t('dashboardPage.modals.qrPayment.generateErrorWithDetail', 'Nao foi possivel gerar o QR Code do Mercado Pago.\\n{detalhe}', { detalhe }));
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = htmlOriginal;
                }
                return;
            }

            if (opcao.tipo === 'mercadopago') {
                const htmlOriginal = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<strong>${escapeHtml(t('dashboardPage.modals.whatsapp.generatingMpLink', 'Gerando link Mercado Pago...'))}</strong>`;

                try {
                    await enviarLinkMercadoPagoPorWhatsapp(cliente);
                    fecharModalWhats();
                } catch (erro) {
                    const detalhe = String(erro?.message || '').trim();
                    alert(t('script.alerts.cannotGenerateMpLink', 'Nao foi possivel gerar o link do Mercado Pago.\\n{detalhe}', { detalhe }));
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = htmlOriginal;
                }
                return;
            }

            if (!telefone) {
                alert(t('script.alerts.noPhoneRegistered', 'Cliente sem telefone cadastrado.'));
                return;
            }

            const abriu = abrirWhatsComTexto(telefone, opcao.texto);
            if (!abriu) {
                alert(t('script.alerts.invalidWhatsappPhone', 'Telefone invalido para WhatsApp.'));
                return;
            }

            fecharModalWhats();
        };

        fragment.appendChild(btn);
    }

    lista.appendChild(fragment);
    modal.style.display = 'flex';
}

function fecharModalWhats() {
    const modal = getEl('modalWhatsapp');
    if (modal) modal.style.display = 'none';
}

/* =========================================
   Boot
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    forcarMesAtualTelaPrincipal();
    carregarTema();
    iniciarSplashAbertura();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    configurarPainelNotificacoes();
    iniciarAutoOcultarSubtituloEconomias();
    atualizarTudo();
    atualizarInterfaceEconomias();
    iniciarSincronizacaoPagamentosMercadoPago();
    iniciarLembretesLocaisCobranca();

    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    prepararLimpezaCampoValor(editValor);
    prepararLimpezaCampoValor(editPagoParcial);

    const busca = getEl('buscaNome');
    if (busca) {
        busca.addEventListener('input', () => {
            clearTimeout(buscaDebounceTimer);
            buscaDebounceTimer = setTimeout(renderizarLista, 120);
        });
    }

    // Fallback robusto: usa a data do servidor para evitar iniciar em mes errado
    // quando o dispositivo do cliente estiver com relogio incorreto.
    setTimeout(() => { sincronizarMesAtualComServidor(); }, 120);
});

window.addEventListener('pageshow', () => {
    if (document.readyState === 'loading') return;
    const mudouMes = forcarMesAtualTelaPrincipal();
    iniciarLembretesLocaisCobranca();
    if (mudouMes && typeof atualizarTudo === 'function') {
        atualizarTudo();
    } else {
        limparMesDaQueryAtual();
        verificarNotificacoesLocaisContextoApp({ solicitarPermissao: false }).catch(() => {});
    }
    setTimeout(() => { sincronizarMesAtualComServidor(); }, 80);
});

window.addEventListener('fin:i18n-change', () => {
    const filtroExtrato = getEl('filtro-forma-pagamento-extrato');
    if (filtroExtrato instanceof HTMLSelectElement) {
        delete filtroExtrato.dataset.formaPagamentoInit;
    }
    if (typeof atualizarNotificacoesPagamentoHoje === 'function') atualizarNotificacoesPagamentoHoje();
    if (typeof gerarMenuMeses === 'function') gerarMenuMeses();
    if (typeof atualizarInterfaceEconomias === 'function') atualizarInterfaceEconomias();
    if (typeof renderizarLista === 'function' && getEl('listaCobrancas')) renderizarLista();
});


























