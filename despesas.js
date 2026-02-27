function obterMesInicialDespesas() {
    // Sempre abrir no mes atual (nao reaproveitar ?mes= da URL).
    return new Date().getMonth();
}

let dataAtual = new Date(new Date().getFullYear(), obterMesInicialDespesas(), 1);

function limparMesDaQueryAtualDespesas() {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('mes')) return;
        url.searchParams.delete('mes');
        const search = url.searchParams.toString();
        const novoHref = `${url.pathname}${search ? `?${search}` : ''}${url.hash || ''}`;
        window.history.replaceState(window.history.state, '', novoHref);
    } catch (_) {
        // Ignora ambientes sem suporte.
    }
}

function forcarMesAtualDespesas() {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    limparMesDaQueryAtualDespesas();

    if (dataAtual instanceof Date
        && !Number.isNaN(dataAtual.getTime())
        && dataAtual.getMonth() === mesAtual
        && dataAtual.getFullYear() === anoAtual) {
        return false;
    }

    dataAtual = new Date(anoAtual, mesAtual, 1);
    const menu = getEl('menu-meses');
    if (menu) menu.dataset.colapsado = '1';
    return true;
}

const DURACAO_TRANSICAO_TEMA = 420;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js não foi carregado antes de despesas.js');
}

const {
    STORAGE,
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    formatarDataBr,
    getDataLocal,
    getHojeLocal,
    escapeHtml,
    limitarHistorico,
    exportarBackupStorage,
    importarBackupStorage,
    safeGetItem,
    safeSetItem,
    safeGetJSON,
    safeSetJSON,
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

const STORAGE_DESPESAS = STORAGE.DESPESAS;
const STORAGE_CARTEIRA = STORAGE.SALDO_CARTEIRA;
const STORAGE_HISTORICO = STORAGE.HISTORICO_CARTEIRA;
const STORAGE_CLIENTES = STORAGE.CLIENTES;
const STORAGE_POUPANCA = STORAGE.SALDO_POUPANCA;
const STORAGE_HIST_POUPANCA = STORAGE.HISTORICO_POUPANCA;
const STORAGE_SIDEBAR_RETORNO_FECHADA = STORAGE.SIDEBAR_RETORNO_FECHADA;
const STORAGE_PULAR_SPLASH_ENTRADA = STORAGE.PULAR_SPLASH_ENTRADA_ONCE;
const STORAGE_TEMA = STORAGE.TEMA_SISTEMA;
const STORAGE_ECONOMIAS_LEGADO = STORAGE.ECONOMIAS_LEGADO;

let listaDespesas = safeGetJSON(STORAGE_DESPESAS, []);
const saldoCarteiraSalvo = safeGetItem(STORAGE_CARTEIRA);
const saldoCarteiraLegado = safeGetItem(STORAGE_ECONOMIAS_LEGADO);
let saldoCarteira = Number(saldoCarteiraSalvo ?? saldoCarteiraLegado ?? 0) || 0;
let historicoCarteira = safeGetJSON(STORAGE_HISTORICO, []);
let filtroAtual = 'todos';
let editandoId = null;
let registrosMesCache = [];
let sequenciaIdDespesa = 0;
let notificacaoDespesaSinoJaClicado = false;

let temaTransicaoTimer = null;

const getSerieRecorrenteId = despesa => despesa.baseRecorrenteId ?? despesa.id;
const isMesmoMesAno = (data, mes, ano) => data.getMonth() === mes && data.getFullYear() === ano;
const getTimestampDespesa = despesa => getDataLocal(despesa.data).getTime();
const gerarIdDespesa = () => {
    sequenciaIdDespesa = (sequenciaIdDespesa + 1) % 1000;
    return (Date.now() * 1000) + sequenciaIdDespesa;
};
const getStatusEfetivoDespesa = (item, dataItem, hoje) => {
    if (item.status === 'pago') return 'pago';
    return dataItem < hoje ? 'atrasado' : 'pendente';
};

function obterDataReferenciaDespesa(dataIso) {
    const base = getDataLocal(dataIso);
    if (Number.isNaN(base.getTime())) return new Date();

    const agora = new Date();
    base.setHours(
        agora.getHours(),
        agora.getMinutes(),
        agora.getSeconds(),
        agora.getMilliseconds()
    );
    return base;
}

document.addEventListener('DOMContentLoaded', () => {
    forcarMesAtualDespesas();
    carregarTema();
    iniciarAnimacaoEntradaPagina();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    configurarPainelNotificacoesDespesas();
    iniciarAutoOcultarSubtitulo();
    gerarRecorrentesAutomatico();
    atualizarLista();
});

window.addEventListener('pageshow', () => {
    if (document.readyState === 'loading') return;
    const mudouMes = forcarMesAtualDespesas();
    if (mudouMes) {
        gerarRecorrentesAutomatico();
        atualizarLista();
    } else {
        limparMesDaQueryAtualDespesas();
    }
});

function toggleSidebar() {
    toggleSidebarPadrao();
}

function fecharSidebarMobile() {
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.add('sidebar-closed');
}

function toggleMenuAno() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    const colapsadoAtual = menu.dataset.colapsado === '1';
    menu.dataset.colapsado = colapsadoAtual ? '0' : '1';
    gerarMenuMeses();
}

function abrirResumoAno(ano = dataAtual.getFullYear()) {
    window.location.href = `resumo-ano.html?ano=${encodeURIComponent(String(ano))}`;
}

function selecionarMesDespesa(mes) {
    if (!Number.isInteger(mes) || mes < 0 || mes > 11) return;
    dataAtual = new Date(dataAtual.getFullYear(), mes, 1);

    const menu = getEl('menu-meses');
    if (menu) menu.dataset.colapsado = '1';

    gerarRecorrentesAutomatico();
    atualizarLista();
    fecharSidebarMobile();
}

function gerarMenuMeses() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    if (menu.dataset.colapsado !== '0' && menu.dataset.colapsado !== '1') {
        menu.dataset.colapsado = '1';
    }

    const colapsado = menu.dataset.colapsado === '1';
    const mesAtual = dataAtual.getMonth();
    const mesSelecionadoCompleto = nomeMesI18n(mesAtual, 'long');
    const mesSelecionadoInicial = mesSelecionadoCompleto;
    const mesesDisponiveis = nomesMeses
        .map((mesNome, indice) => ({ mesNome, indice }))
        .filter(item => item.indice !== mesAtual);

    menu.innerHTML = `
        <div class="menu-ano-header menu-ano-header--single">
            <button type="button" class="menu-ano-toggle ${colapsado ? 'collapsed' : 'expanded'}" onclick="toggleMenuAno()" aria-label="${colapsado ? escapeHtml(t('despesas.menu.expandMonths', 'Expandir meses')) : escapeHtml(t('despesas.menu.collapseMonths', 'Recolher meses'))} - ${escapeHtml(t('despesas.menu.currentMonth', 'Mês atual'))}: ${escapeHtml(mesSelecionadoCompleto)}">
                <span class="menu-ano-toggle-label">${escapeHtml(mesSelecionadoInicial)}</span>
                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
        </div>
        <div class="menu-meses-lista ${colapsado ? 'is-collapsed' : 'menu-meses-lista--cascade'}">
            ${mesesDisponiveis.map(item => `
                <button onclick="selecionarMesDespesa(${item.indice})">
                    ${escapeHtml(nomeMesI18n(item.indice, 'long'))}
                </button>
            `).join('')}
        </div>
    `;
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

function iniciarAutoOcultarSubtitulo() {
    const subtitulo = document.querySelector('.subtitulo-despesas');
    if (!subtitulo) return;

    setTimeout(() => {
        subtitulo.classList.add('oculto');
    }, 8000);
}

function alternarPainelNotificacoesDespesas(forcarAberto = null) {
    const container = getEl('notificacoes-despesas');
    const botao = getEl('btn-notificacoes-despesas');
    const painel = getEl('notificacoes-despesas-painel');
    if (!container || !botao || !painel) return;

    const abrir = typeof forcarAberto === 'boolean' ? forcarAberto : painel.hidden;
    painel.hidden = !abrir;
    container.classList.toggle('aberto', abrir);
    botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

function configurarPainelNotificacoesDespesas() {
    const container = getEl('notificacoes-despesas');
    const botao = getEl('btn-notificacoes-despesas');
    const painel = getEl('notificacoes-despesas-painel');
    if (!container || !botao || !painel) return;

    botao.addEventListener('click', event => {
        event.stopPropagation();
        notificacaoDespesaSinoJaClicado = true;
        botao.classList.remove('balancando');
        alternarPainelNotificacoesDespesas();
    });

    painel.addEventListener('click', event => {
        event.stopPropagation();
    });

    document.addEventListener('click', event => {
        if (!container.contains(event.target)) alternarPainelNotificacoesDespesas(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') alternarPainelNotificacoesDespesas(false);
    });
}

function obterNotificacoesDespesas() {
    const hoje = getHojeLocal();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    const notificacoes = {
        atrasadas: [],
        hoje: [],
        amanha: []
    };

    for (const item of listaDespesas) {
        if (item.status === 'pago') continue;

        const dataItem = getDataLocal(item.data);
        dataItem.setHours(0, 0, 0, 0);
        if (!isMesmoMesAno(dataItem, mesAtual, anoAtual)) continue;

        const registro = { item, dataItem };
        if (dataItem < hoje) notificacoes.atrasadas.push(registro);
        else if (dataItem.getTime() === hoje.getTime()) notificacoes.hoje.push(registro);
        else if (dataItem.getTime() === amanha.getTime()) notificacoes.amanha.push(registro);
    }

    const ordenar = (a, b) => {
        const ordemData = a.dataItem - b.dataItem;
        if (ordemData !== 0) return ordemData;
        return String(a.item.nome || '').localeCompare(String(b.item.nome || ''), 'pt-BR', { sensitivity: 'base' });
    };

    notificacoes.atrasadas.sort(ordenar);
    notificacoes.hoje.sort(ordenar);
    notificacoes.amanha.sort(ordenar);

    notificacoes.total = notificacoes.atrasadas.length + notificacoes.hoje.length + notificacoes.amanha.length;
    return notificacoes;
}

function atualizarNotificacoesDespesas() {
    const container = getEl('notificacoes-despesas');
    const botao = getEl('btn-notificacoes-despesas');
    const painel = getEl('notificacoes-despesas-painel');
    const lista = getEl('notificacoes-despesas-lista');
    const badge = getEl('notificacoes-despesas-badge');
    if (!container || !botao || !painel || !lista || !badge) return;

    const notificacoes = obterNotificacoesDespesas();
    badge.textContent = String(notificacoes.total);
    botao.setAttribute('aria-label', `${t('despesas.notifications.alerts', 'Alertas de despesas')}: ${notificacoes.total}`);

    if (!notificacoes.total) {
        alternarPainelNotificacoesDespesas(false);
        notificacaoDespesaSinoJaClicado = false;
        botao.classList.remove('balancando');
        container.hidden = true;
        lista.innerHTML = '';
        return;
    }

    container.hidden = false;
    if (!notificacaoDespesaSinoJaClicado) botao.classList.add('balancando');

    const fragment = document.createDocumentFragment();
    const adicionarSecao = (titulo, itens, classeTipo, textoData) => {
        if (!itens.length) return;

        const cabecalho = document.createElement('li');
        cabecalho.className = `notificacoes-secao ${classeTipo}`;
        cabecalho.innerHTML = `<span class="notificacoes-secao-titulo">${escapeHtml(titulo)}</span>`;
        fragment.appendChild(cabecalho);

        for (const registro of itens) {
            const { item } = registro;
            const li = document.createElement('li');
            li.className = `notificacoes-item ${classeTipo}`;
            li.innerHTML = `
                <div class="notificacoes-item-info">
                    <span class="notificacoes-item-nome">${escapeHtml(item.nome)}</span>
                    <span class="notificacoes-item-data">${escapeHtml(textoData)} (${escapeHtml(formatarDataBr(item.data))})</span>
                </div>
                <span class="notificacoes-item-valor">${formatarMoeda(item.valor)}</span>
            `;
            fragment.appendChild(li);
        }
    };

    adicionarSecao(`${t('despesas.notifications.overdue', 'Vencidas')} (${notificacoes.atrasadas.length})`, notificacoes.atrasadas, 'notificacao-atrasada', t('despesas.notifications.overdueOn', 'Venceu em'));
    adicionarSecao(`${t('despesas.notifications.dueToday', 'Vencem hoje')} (${notificacoes.hoje.length})`, notificacoes.hoje, 'notificacao-hoje', t('despesas.notifications.dueTodaySingle', 'Vence hoje'));
    adicionarSecao(`${t('despesas.notifications.dueTomorrow', 'Vencem amanhã')} (${notificacoes.amanha.length})`, notificacoes.amanha, 'notificacao-amanha', t('despesas.notifications.dueTomorrowSingle', 'Vence amanhã'));

    lista.innerHTML = '';
    lista.appendChild(fragment);
}

function configurarGestosSidebarMobile() {
    configurarGestosSidebarMobilePadrao();
}

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
    exportarBackupStorage({ nomeBase: 'backup_financas' });
}

function importarDados(event) {
    importarBackupStorage(event);
}

function resetarSistema() {
    confirmarResetSistema();
}

function registrarTransacaoCarteira(tipo, valor, descricao, dataReferencia = new Date()) {
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return;

    const dataHistorico = dataReferencia instanceof Date ? new Date(dataReferencia.getTime()) : new Date();
    if (Number.isNaN(dataHistorico.getTime())) return;

    if (tipo === 'entrada') saldoCarteira += valorNumerico;
    else saldoCarteira -= valorNumerico;

    historicoCarteira.unshift({
        tipo: tipo === 'entrada' ? 'depositar' : 'sacar',
        valor: valorNumerico,
        descricao,
        timestamp: dataHistorico.getTime(),
        data: dataHistorico.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoCarteira);
}

function registrarAjusteCarteira(delta, descricaoEntrada, descricaoSaida, dataReferencia = new Date()) {
    if (!Number.isFinite(delta) || delta === 0) return;
    if (delta > 0) registrarTransacaoCarteira('entrada', delta, descricaoEntrada, dataReferencia);
    else registrarTransacaoCarteira('saida', Math.abs(delta), descricaoSaida, dataReferencia);
}

function obterReferenciaRecorrente(itensSerie, mes, ano) {
    const inicioMesAlvo = new Date(ano, mes, 1).getTime();
    let referenciaAnteriorMaisRecente = null;
    let timestampAnteriorMaisRecente = -Infinity;
    let referenciaMaisAntiga = null;
    let timestampMaisAntigo = Infinity;

    for (const item of itensSerie) {
        const timestamp = getTimestampDespesa(item);

        if (timestamp <= inicioMesAlvo && timestamp > timestampAnteriorMaisRecente) {
            timestampAnteriorMaisRecente = timestamp;
            referenciaAnteriorMaisRecente = item;
        }

        if (timestamp < timestampMaisAntigo) {
            timestampMaisAntigo = timestamp;
            referenciaMaisAntiga = item;
        }
    }

    return referenciaAnteriorMaisRecente ?? referenciaMaisAntiga;
}

function propagarEdicaoRecorrente(despesaAtual, novoNome, novoValor) {
    if (!despesaAtual.recorrente) return [];

    const serieId = getSerieRecorrenteId(despesaAtual);
    const dataBaseEdicao = getDataLocal(despesaAtual.data);
    const ajustesCarteira = [];

    listaDespesas = listaDespesas.map(item => {
        if (item.id === despesaAtual.id) return item;
        if (!item.recorrente || getSerieRecorrenteId(item) !== serieId) return item;

        const dataItem = getDataLocal(item.data);
        if (dataItem <= dataBaseEdicao) return item;

        const valorAnteriorItem = Number(item.valor) || 0;
        const deltaItem = valorAnteriorItem - novoValor;
        if (item.status === 'pago' && Number.isFinite(deltaItem) && deltaItem !== 0) {
            ajustesCarteira.push({
                delta: deltaItem,
                nome: item.nome,
                data: item.data
            });
        }

        return {
            ...item,
            nome: novoNome,
            valor: novoValor
        };
    });

    return ajustesCarteira;
}

function toggleFormDespesa() {
    const modalDespesaEl = getEl('modalDespesa');
    if (!modalDespesaEl) return;
    if (modalDespesaEl.classList.contains('active')) {
        fecharModalDespesa();
        return;
    }
    modalDespesaEl.classList.add('active');
}

function fecharModalDespesa() {
    const modalDespesaEl = getEl('modalDespesa');
    const nomeDespesaEl = getEl('nomeDespesa');
    const valorDespesaEl = getEl('valorDespesa');
    const dataVencimentoEl = getEl('dataVencimento');
    const statusDespesaEl = getEl('statusDespesa');
    const recorrenteDespesaEl = getEl('recorrenteDespesa');
    const tituloModalEl = getEl('tituloModal');

    if (modalDespesaEl) modalDespesaEl.classList.remove('active');
    if (nomeDespesaEl) nomeDespesaEl.value = '';
    if (valorDespesaEl) valorDespesaEl.value = '';
    if (dataVencimentoEl) dataVencimentoEl.value = '';
    if (statusDespesaEl) statusDespesaEl.value = 'pendente';
    if (recorrenteDespesaEl) recorrenteDespesaEl.checked = false;
    if (tituloModalEl) tituloModalEl.textContent = t('despesas.modal.createTitle', 'Cadastrar Conta');
    editandoId = null;
}

function salvarDespesa() {
    const nomeDespesaEl = getEl('nomeDespesa');
    const valorDespesaEl = getEl('valorDespesa');
    const dataVencimentoEl = getEl('dataVencimento');
    const statusDespesaEl = getEl('statusDespesa');
    const recorrenteDespesaEl = getEl('recorrenteDespesa');

    if (!nomeDespesaEl || !valorDespesaEl || !dataVencimentoEl || !statusDespesaEl || !recorrenteDespesaEl) return;

    const nome = nomeDespesaEl.value.trim();
    const valor = Number(valorDespesaEl.value);
    const data = dataVencimentoEl.value;
    const status = statusDespesaEl.value;
    const recorrente = recorrenteDespesaEl.checked;

    if (!nome || !Number.isFinite(valor) || valor <= 0 || !data) {
        alert(t('despesas.alerts.fillFields', 'Preencha todos os campos'));
        return;
    }

    if (editandoId !== null) {
        const index = listaDespesas.findIndex(d => d.id === editandoId);
        if (index === -1) {
            alert(t('despesas.alerts.notFound', 'Despesa não encontrada'));
            return;
        }

        const despesaAtual = listaDespesas[index];
        const valorAnterior = Number(despesaAtual.valor) || 0;
        const impactoAnterior = despesaAtual.status === 'pago' ? -valorAnterior : 0;
        const impactoNovo = status === 'pago' ? -valor : 0;
        const dataReferenciaEdicao = obterDataReferenciaDespesa(data);

        registrarAjusteCarteira(
            impactoNovo - impactoAnterior,
            `Estorno de ajuste de despesa: ${nome}`,
            `Ajuste de despesa paga: ${nome}`,
            dataReferenciaEdicao
        );

        const ajustesRecorrencia = (despesaAtual.recorrente && recorrente)
            ? propagarEdicaoRecorrente(despesaAtual, nome, valor)
            : [];

        for (const ajuste of ajustesRecorrencia) {
            registrarAjusteCarteira(
                ajuste.delta,
                `Estorno de ajuste de recorrencia: ${ajuste.nome}`,
                `Ajuste de recorrencia paga: ${ajuste.nome}`,
                obterDataReferenciaDespesa(ajuste.data)
            );
        }

        listaDespesas[index] = {
            ...despesaAtual,
            nome,
            valor,
            data,
            status,
            recorrente,
            baseRecorrenteId: recorrente ? getSerieRecorrenteId(despesaAtual) : null
        };
    } else {
        const id = gerarIdDespesa();
        if (status === 'pago') {
            registrarTransacaoCarteira('saida', valor, `Despesa cadastrada como paga: ${nome}`, obterDataReferenciaDespesa(data));
        }

        listaDespesas.push({
            id,
            nome,
            valor,
            data,
            status,
            recorrente,
            baseRecorrenteId: recorrente ? id : null
        });
    }

    salvarStorage();
    fecharModalDespesa();
    atualizarLista();
}

function gerarRecorrentesAutomatico() {
    const mes = dataAtual.getMonth();
    const ano = dataAtual.getFullYear();
    const seriesRecorrentes = new Map();
    let houveInclusao = false;

    for (const despesa of listaDespesas) {
        if (!despesa.recorrente) continue;

        const serieRecorrenteId = getSerieRecorrenteId(despesa);
        if (!seriesRecorrentes.has(serieRecorrenteId)) {
            seriesRecorrentes.set(serieRecorrenteId, []);
        }
        seriesRecorrentes.get(serieRecorrenteId).push(despesa);
    }

    seriesRecorrentes.forEach((itensSerie, serieRecorrenteId) => {
        const jaExisteNoMes = itensSerie.some(item => isMesmoMesAno(getDataLocal(item.data), mes, ano));
        if (jaExisteNoMes) return;

        const referencia = obterReferenciaRecorrente(itensSerie, mes, ano);
        if (!referencia) return;

        const diaOriginal = getDataLocal(referencia.data).getDate();
        const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
        const diaAjustado = Math.min(diaOriginal, ultimoDiaDoMes);
        const novaData = new Date(ano, mes, diaAjustado);

        listaDespesas.push({
            id: gerarIdDespesa(),
            nome: referencia.nome,
            valor: referencia.valor,
            data: novaData.toISOString().split('T')[0],
            status: 'pendente',
            recorrente: true,
            baseRecorrenteId: serieRecorrenteId
        });
        houveInclusao = true;
    });

    if (houveInclusao) salvarStorage();
}

function obterRegistrosMesAtual(hoje) {
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();
    const registros = [];

    for (const item of listaDespesas) {
        const dataItem = getDataLocal(item.data);
        if (!isMesmoMesAno(dataItem, mesAtual, anoAtual)) continue;

        registros.push({
            item,
            dataItem,
            statusEfetivo: getStatusEfetivoDespesa(item, dataItem, hoje)
        });
    }

    registros.sort((a, b) => a.dataItem - b.dataItem);
    return registros;
}

function atualizarLista() {
    const hoje = getHojeLocal();
    const registrosMes = obterRegistrosMesAtual(hoje);
    registrosMesCache = registrosMes;

    let totalPagar = 0;
    let totalPago = 0;

    for (const registro of registrosMes) {
        if (registro.statusEfetivo === 'pago') totalPago += Number(registro.item.valor) || 0;
        else totalPagar += Number(registro.item.valor) || 0;
    }

    const totalPagarEl = getEl('totalPagar');
    const totalPagoEl = getEl('totalPago');
    const totalGeralEl = getEl('totalGeral');

    if (totalPagarEl) totalPagarEl.innerText = formatarMoeda(totalPagar);
    if (totalPagoEl) totalPagoEl.innerText = formatarMoeda(totalPago);
    if (totalGeralEl) totalGeralEl.innerText = formatarMoeda(totalPago + totalPagar);

    renderLista(registrosMes);
    atualizarNotificacoesDespesas();
    gerarMenuMeses();
}

function renderLista(registrosMes = registrosMesCache) {
    const listaDespesasEl = getEl('listaDespesas');
    if (!listaDespesasEl) return;
    listaDespesasEl.innerHTML = '';

    const fragment = document.createDocumentFragment();

    for (const registro of registrosMes) {
        if (filtroAtual !== 'todos' && registro.statusEfetivo !== filtroAtual) continue;

        const item = registro.item;
        const li = document.createElement('li');
        li.className = `lista-item ${registro.statusEfetivo}`;

        li.innerHTML = `
            <div class="lista-info">
                <div class="lista-texto">
                    <strong class="despesa-nome">${escapeHtml(item.nome)}</strong>
                    <span class="despesa-data">${escapeHtml(formatarDataBr(item.data))}</span>
                </div>
                <span class="despesa-valor">${formatarMoeda(item.valor)}</span>
            </div>

            <div class="lista-acoes">
                <button class="btn-editar" onclick="editarDespesa(${item.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>

                <button class="btn-check ${registro.statusEfetivo === 'pago' ? 'pago' : ''}" onclick="marcarComoPago(${item.id})">
                    <i class="fa-solid ${registro.statusEfetivo === 'pago' ? 'fa-undo' : 'fa-check'}"></i>
                </button>

                <button class="btn-excluir" onclick="excluirDespesa(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        fragment.appendChild(li);
    }

    listaDespesasEl.appendChild(fragment);
}

function editarDespesa(id) {
    const item = listaDespesas.find(d => d.id === id);
    if (!item) return;

    const nomeDespesaEl = getEl('nomeDespesa');
    const valorDespesaEl = getEl('valorDespesa');
    const dataVencimentoEl = getEl('dataVencimento');
    const statusDespesaEl = getEl('statusDespesa');
    const recorrenteDespesaEl = getEl('recorrenteDespesa');
    const tituloModalEl = getEl('tituloModal');

    if (!nomeDespesaEl || !valorDespesaEl || !dataVencimentoEl || !statusDespesaEl || !recorrenteDespesaEl) return;

    editandoId = id;
    nomeDespesaEl.value = item.nome;
    valorDespesaEl.value = item.valor;
    dataVencimentoEl.value = item.data;
    statusDespesaEl.value = item.status === 'pago' ? 'pago' : 'pendente';
    recorrenteDespesaEl.checked = item.recorrente;
    if (tituloModalEl) tituloModalEl.textContent = t('despesas.modal.editTitle', 'Editar Conta');

    const modalDespesaEl = getEl('modalDespesa');
    if (modalDespesaEl) modalDespesaEl.classList.add('active');
}

function marcarComoPago(id) {
    const index = listaDespesas.findIndex(d => d.id === id);
    if (index === -1) return;

    const item = listaDespesas[index];
    const valor = Number(item.valor) || 0;
    const statusAtual = item.status === 'pago' ? 'pago' : 'pendente';

    const dataReferenciaItem = obterDataReferenciaDespesa(item.data);
    if (statusAtual !== 'pago') {
        item.status = 'pago';
        registrarTransacaoCarteira('saida', valor, `Pagamento de despesa: ${item.nome}`, dataReferenciaItem);
    } else {
        item.status = 'pendente';
        registrarTransacaoCarteira('entrada', valor, `Estorno de despesa: ${item.nome}`, dataReferenciaItem);
    }

    salvarStorage();
    atualizarLista();
}

function excluirDespesa(id) {
    listaDespesas = listaDespesas.filter(d => d.id !== id);
    salvarStorage();
    atualizarLista();
}

function filtrarDespesas(tipo, btn) {
    filtroAtual = tipo;
    document.querySelectorAll('.tab-btn').forEach(botao => botao.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderLista();
}

function salvarStorage() {
    safeSetJSON(STORAGE_DESPESAS, listaDespesas);
    safeSetItem(STORAGE_CARTEIRA, String(saldoCarteira));
    safeSetJSON(STORAGE_HISTORICO, historicoCarteira);
}

window.addEventListener('fin:i18n-change', () => {
    gerarMenuMeses();
    atualizarLista();
});








