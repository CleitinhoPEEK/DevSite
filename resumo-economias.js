const DURACAO_TRANSICAO_TEMA = 420;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js não foi carregado antes de resumo-economias.js');
}

const {
    STORAGE,
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    getDataLocal,
    escapeHtml,
    exportarBackupStorage,
    importarBackupStorage,
    safeSetItem,
    safeGetJSON,
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

const STORAGE_CLIENTES = STORAGE.CLIENTES;
const STORAGE_DESPESAS = STORAGE.DESPESAS;
const STORAGE_SALDO = STORAGE.SALDO_CARTEIRA;
const STORAGE_HISTORICO = STORAGE.HISTORICO_CARTEIRA;
const STORAGE_POUPANCA = STORAGE.SALDO_POUPANCA;
const STORAGE_HIST_POUPANCA = STORAGE.HISTORICO_POUPANCA;
const STORAGE_SIDEBAR_RETORNO_FECHADA = STORAGE.SIDEBAR_RETORNO_FECHADA;
const STORAGE_PULAR_SPLASH_ENTRADA = STORAGE.PULAR_SPLASH_ENTRADA_ONCE;
const STORAGE_TEMA = STORAGE.TEMA_SISTEMA;
const STORAGE_ECONOMIAS_LEGADO = STORAGE.ECONOMIAS_LEGADO;

let temaTransicaoTimer = null;
let formaPagamentoResumoSelecionada = 'todos';

const RESUMO_FORMAS_PAGAMENTO_META = Object.freeze({
    pix: Object.freeze({ rotulo: 'PIX', icone: 'fa-qrcode' }),
    dinheiro: Object.freeze({ rotulo: 'Dinheiro', icone: 'fa-money-bill-wave' }),
    debito: Object.freeze({ rotulo: 'Debito', icone: 'fa-credit-card' }),
    credito: Object.freeze({ rotulo: 'Credito', icone: 'fa-credit-card' }),
    transferencia: Object.freeze({ rotulo: 'Transferencia', icone: 'fa-building-columns' }),
    boleto: Object.freeze({ rotulo: 'Boleto', icone: 'fa-barcode' }),
    mercado_pago: Object.freeze({ rotulo: 'Mercado Pago', icone: 'fa-wallet' }),
    sem_forma: Object.freeze({ rotulo: 'Sem identificação', icone: 'fa-circle-question' })
});

const RESUMO_FORMAS_PAGAMENTO_ORDEM = Object.freeze([
    'pix',
    'dinheiro',
    'debito',
    'credito',
    'transferencia',
    'boleto',
    'mercado_pago',
    'sem_forma'
]);

function normalizarFormaPagamentoResumo(valor) {
    const bruto = String(valor ?? '').trim().toLowerCase();
    if (!bruto) return '';

    const chave = (typeof bruto.normalize === 'function' ? bruto.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : bruto)
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');

    if (['mercadopago', 'mercado_pago', 'mp'].includes(chave)) return 'mercado_pago';
    return Object.prototype.hasOwnProperty.call(RESUMO_FORMAS_PAGAMENTO_META, chave) ? chave : '';
}

function obterFormaPagamentoHistoricoResumo(item) {
    const formaSalva = normalizarFormaPagamentoResumo(item?.formaPagamento);
    if (formaSalva) return formaSalva;
    if (String(item?.categoria || '') === 'mercado_pago') return 'mercado_pago';
    return '';
}

function isRecebimentoClienteHistorico(item) {
    if (!item) return false;
    const isEntrada = item.tipo === 'depositar' || item.tipo === 'entrada';
    if (!isEntrada) return false;

    const categoria = String(item.categoria || '');
    if (categoria === 'mercado_pago' || categoria === 'recebimento_manual') return true;

    const descricao = String(item.descricao || '').toLowerCase();
    return descricao.startsWith('recebido');
}

function obterMetaFormaPagamentoResumo(chave) {
    const forma = normalizarFormaPagamentoResumo(chave);
    if (!forma) return RESUMO_FORMAS_PAGAMENTO_META.sem_forma;
    return RESUMO_FORMAS_PAGAMENTO_META[forma] || RESUMO_FORMAS_PAGAMENTO_META.sem_forma;
}

function formatarMetodoResumo(chave) {
    if (chave === 'todos') return t('resumoEconomias.methods.all', 'Todos os métodos');
    return obterMetaFormaPagamentoResumo(chave).rotulo;
}

function obterAnoSelecionado() {
    const params = new URLSearchParams(window.location.search);
    const anoParam = Number(params.get('ano'));
    if (Number.isInteger(anoParam) && anoParam >= 2000 && anoParam <= 2100) return anoParam;
    return new Date().getFullYear();
}

function carregarTema() {
    carregarTemaSalvo();
    carregarTemaExecutivo();
}

function toggleSidebar() {
    toggleSidebarPadrao();
}

function aplicarEstadoInicialSidebar() {
    aplicarEstadoInicialSidebarPadrao({ storageKey: STORAGE_SIDEBAR_RETORNO_FECHADA });
}

function configurarGestosSidebarMobile() {
    configurarGestosSidebarMobilePadrao();
}

function irParaInicio() {
    safeSetItem(STORAGE_SIDEBAR_RETORNO_FECHADA, '1');
    safeSetItem(STORAGE_PULAR_SPLASH_ENTRADA, '1');
    window.location.href = 'index.html';
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

function extrairMesAnoHistorico(item, anoPadrao) {
    if (!item) return null;

    const timestamp = Number(item.timestamp);
    if (Number.isFinite(timestamp)) {
        const data = new Date(timestamp);
        const mes = data.getMonth();
        const ano = data.getFullYear();
        if (Number.isInteger(mes) && mes >= 0 && mes <= 11) return { mes, ano };
    }

    const textoData = String(item.data ?? '');
    const match = textoData.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
    if (!match) return null;

    const mes = Number(match[2]) - 1;
    const ano = match[3] ? Number(match[3]) : anoPadrao;
    if (!Number.isInteger(mes) || mes < 0 || mes > 11) return null;
    if (!Number.isInteger(ano)) return null;
    return { mes, ano };
}

function calcularResumoEconomiasAnual(anoSelecionado) {
    const historicoCarteira = safeGetJSON(STORAGE_HISTORICO, []);
    const historicoPoupanca = safeGetJSON(STORAGE_HIST_POUPANCA, []);
    const despesas = safeGetJSON(STORAGE_DESPESAS, []);

    const carteiraMes = Array.from({ length: 12 }, () => 0);
    const poupancaMes = Array.from({ length: 12 }, () => 0);
    const recebidoMes = Array.from({ length: 12 }, () => 0);
    const despesasMes = Array.from({ length: 12 }, () => 0);
    const recebidoPorFormaMes = Object.fromEntries(
        RESUMO_FORMAS_PAGAMENTO_ORDEM.map(chave => [chave, Array.from({ length: 12 }, () => 0)])
    );

    for (const item of historicoCarteira) {
        const referencia = extrairMesAnoHistorico(item, anoSelecionado);
        if (!referencia || referencia.ano !== anoSelecionado) continue;

        const valor = Number(item.valor) || 0;
        if (item.tipo === 'depositar' || item.tipo === 'entrada') {
            carteiraMes[referencia.mes] += valor;
            recebidoMes[referencia.mes] += valor;

            if (isRecebimentoClienteHistorico(item)) {
                const forma = obterFormaPagamentoHistoricoResumo(item) || 'sem_forma';
                if (recebidoPorFormaMes[forma]) {
                    recebidoPorFormaMes[forma][referencia.mes] += valor;
                } else {
                    recebidoPorFormaMes.sem_forma[referencia.mes] += valor;
                }
            }
        } else {
            carteiraMes[referencia.mes] -= valor;
        }
    }

    for (const item of historicoPoupanca) {
        const referencia = extrairMesAnoHistorico(item, anoSelecionado);
        if (!referencia || referencia.ano !== anoSelecionado) continue;

        const valor = Number(item.valor) || 0;
        if (item.tipo === 'depositar' || item.tipo === 'entrada') poupancaMes[referencia.mes] += valor;
        else poupancaMes[referencia.mes] -= valor;
    }

    for (const despesa of despesas) {
        if (!despesa || despesa.status !== 'pago') continue;
        const data = getDataLocal(despesa.data);
        if (data.getFullYear() !== anoSelecionado) continue;

        const mes = data.getMonth();
        const valor = Number(despesa.valor) || 0;
        despesasMes[mes] += valor;
    }

    const acumuladoPoupancaMes = [];
    let acumulado = 0;

    for (let mes = 0; mes < 12; mes += 1) {
        acumulado += poupancaMes[mes];
        acumuladoPoupancaMes.push(acumulado);
    }

    return { carteiraMes, poupancaMes, acumuladoPoupancaMes, recebidoMes, despesasMes, recebidoPorFormaMes };
}

function renderizarCardsResumo(resumo) {
    const totalRecebido = resumo.recebidoMes.reduce((acc, valor) => acc + valor, 0);
    const totalDespesas = resumo.despesasMes.reduce((acc, valor) => acc + valor, 0);

    const saldoCarteira = safeGetNumber(STORAGE_SALDO, 0) || safeGetNumber(STORAGE_ECONOMIAS_LEGADO, 0);
    const saldoPoupanca = safeGetNumber(STORAGE_POUPANCA, 0);

    const totalRecebidoEl = getEl('resumo-eco-total-recebido');
    const totalDespesasEl = getEl('resumo-eco-total-despesas');
    const saldoCarteiraEl = getEl('resumo-eco-saldo-carteira');
    const saldoPoupancaEl = getEl('resumo-eco-saldo-poupanca');

    if (totalRecebidoEl) totalRecebidoEl.textContent = formatarMoeda(totalRecebido);
    if (totalDespesasEl) totalDespesasEl.textContent = formatarMoeda(totalDespesas);
    if (saldoCarteiraEl) saldoCarteiraEl.textContent = formatarMoeda(saldoCarteira);
    if (saldoPoupancaEl) saldoPoupancaEl.textContent = formatarMoeda(saldoPoupanca);
}

function renderizarGraficoResumo(resumo) {
    const graficoEl = getEl('resumo-economias-grafico');
    if (!graficoEl) return;

    const valoresAbsolutos = [
        ...resumo.carteiraMes.map(valor => Math.abs(valor)),
        ...resumo.poupancaMes.map(valor => Math.abs(valor))
    ];
    const maxValor = Math.max(1, ...valoresAbsolutos);

    const fragment = document.createDocumentFragment();

    for (let mes = 0; mes < 12; mes += 1) {
        const valorCarteira = resumo.carteiraMes[mes];
        const valorPoupanca = resumo.poupancaMes[mes];

        const alturaCarteira = Math.round((Math.abs(valorCarteira) / maxValor) * 100);
        const alturaPoupanca = Math.round((Math.abs(valorPoupanca) / maxValor) * 100);

        const coluna = document.createElement('article');
        coluna.className = 'resumo-eco-coluna';
        coluna.innerHTML = `
            <div class="resumo-eco-coluna-barras">
                <div class="resumo-eco-bar ${valorCarteira >= 0 ? 'positivo' : 'negativo'}" style="height:${alturaCarteira}%;" title="${escapeHtml(t('resumoEconomias.chart.available', 'Disponível'))}: ${formatarMoeda(valorCarteira)}"></div>
                <div class="resumo-eco-bar poupanca ${valorPoupanca >= 0 ? 'positivo' : 'negativo'}" style="height:${alturaPoupanca}%;" title="${escapeHtml(t('resumoEconomias.chart.savings', 'Poupança'))}: ${formatarMoeda(valorPoupanca)}"></div>
            </div>
            <div class="resumo-eco-coluna-mes">${nomeMesI18n(mes, 'short')}</div>
        `;

        fragment.appendChild(coluna);
    }

    graficoEl.innerHTML = '';
    graficoEl.appendChild(fragment);
}

function classeValorResumo(valor) {
    if (valor > 0.0001) return "positivo";
    if (valor < -0.0001) return "negativo";
    return "neutro";
}

function iconeValorResumo(classe) {
    if (classe === "positivo") return "fa-arrow-trend-up";
    if (classe === "negativo") return "fa-arrow-trend-down";
    return "fa-minus";
}

function renderizarTabelaResumo(resumo) {
    const corpo = getEl("resumo-economias-corpo");
    if (!corpo) return;

    const fragment = document.createDocumentFragment();

    for (let mes = 0; mes < 12; mes += 1) {
        const valorDisponivel = resumo.carteiraMes[mes];
        const valorPoupanca = resumo.poupancaMes[mes];
        const valorAcumulado = resumo.acumuladoPoupancaMes[mes];

        const classeDisponivel = classeValorResumo(valorDisponivel);
        const classePoupanca = classeValorResumo(valorPoupanca);
        const classeAcumulado = classeValorResumo(valorAcumulado);

        const tr = document.createElement("tr");
        tr.className = "resumo-eco-linha";
        tr.dataset.tendencia = classeDisponivel;

        tr.innerHTML = `
            <td class="resumo-eco-col-mes">
                <div class="resumo-eco-celula-mes">
                    <span class="resumo-eco-mes-indice">${String(mes + 1).padStart(2, "0")}</span>
                    <span class="resumo-eco-mes-nome">${nomeMesI18n(mes, 'long')}</span>
                </div>
            </td>
            <td class="resumo-eco-col-valor">
                <span class="resumo-eco-pill ${classeDisponivel}">
                    <i class="fa-solid ${iconeValorResumo(classeDisponivel)}" aria-hidden="true"></i>
                    ${formatarMoeda(valorDisponivel)}
                </span>
            </td>
            <td class="resumo-eco-col-valor">
                <span class="resumo-eco-pill ${classePoupanca}">
                    <i class="fa-solid ${iconeValorResumo(classePoupanca)}" aria-hidden="true"></i>
                    ${formatarMoeda(valorPoupanca)}
                </span>
            </td>
            <td class="resumo-eco-col-valor">
                <span class="resumo-eco-pill acumulado ${classeAcumulado}">
                    <i class="fa-solid ${iconeValorResumo(classeAcumulado)}" aria-hidden="true"></i>
                    ${formatarMoeda(valorAcumulado)}
                </span>
            </td>
        `;

        fragment.appendChild(tr);
    }

    corpo.innerHTML = "";
    corpo.appendChild(fragment);
}

function obterSerieMensalFormaPagamentoResumo(resumo, formaSelecionada) {
    if (!resumo?.recebidoPorFormaMes) return Array.from({ length: 12 }, () => 0);

    if (formaSelecionada === 'todos') {
        const serie = Array.from({ length: 12 }, () => 0);
        for (const chave of RESUMO_FORMAS_PAGAMENTO_ORDEM) {
            const lista = resumo.recebidoPorFormaMes[chave];
            if (!Array.isArray(lista)) continue;
            for (let mes = 0; mes < 12; mes += 1) {
                serie[mes] += Number(lista[mes]) || 0;
            }
        }
        return serie;
    }

    const lista = resumo.recebidoPorFormaMes[formaSelecionada];
    if (!Array.isArray(lista)) return Array.from({ length: 12 }, () => 0);
    return lista.map(valor => Number(valor) || 0);
}

function preencherSelectMetodosResumo() {
    const select = getEl('resumo-eco-forma-select');
    if (!(select instanceof HTMLSelectElement)) return;

    if (select.dataset.metodosInit !== '1') {
        const opcoes = [
            { valor: 'todos', rotulo: t('resumoEconomias.methods.all', 'Todos os métodos') },
            ...RESUMO_FORMAS_PAGAMENTO_ORDEM.map(chave => ({
                valor: chave,
                rotulo: RESUMO_FORMAS_PAGAMENTO_META[chave].rotulo
            }))
        ];

        select.innerHTML = opcoes
            .map(opcao => `<option value="${opcao.valor}">${opcao.rotulo}</option>`)
            .join('');

        select.addEventListener('change', () => {
            formaPagamentoResumoSelecionada = String(select.value || 'todos');
            if (window.__resumoEconomiasCache) renderizarResumoPorMetodo(window.__resumoEconomiasCache);
        });

        select.dataset.metodosInit = '1';
    }

    select.value = formaPagamentoResumoSelecionada;
}

function renderizarCardsMetodosResumo(resumo) {
    const container = getEl('resumo-eco-metodos-cards');
    if (!container) return;

    const fragment = document.createDocumentFragment();
    const totais = {};

    for (const chave of RESUMO_FORMAS_PAGAMENTO_ORDEM) {
        const serie = Array.isArray(resumo?.recebidoPorFormaMes?.[chave]) ? resumo.recebidoPorFormaMes[chave] : [];
        totais[chave] = serie.reduce((acc, valor) => acc + (Number(valor) || 0), 0);
    }

    for (const chave of RESUMO_FORMAS_PAGAMENTO_ORDEM) {
        const meta = RESUMO_FORMAS_PAGAMENTO_META[chave];
        const total = totais[chave] || 0;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'resumo-eco-metodo-card';
        card.dataset.forma = chave;
        card.innerHTML = `
            <span class="resumo-eco-metodo-card-icone"><i class="fa-solid ${meta.icone}" aria-hidden="true"></i></span>
            <span class="resumo-eco-metodo-card-textos">
                <span class="resumo-eco-metodo-card-rotulo">${meta.rotulo}</span>
                <span class="resumo-eco-metodo-card-valor">${formatarMoeda(total)}</span>
            </span>
        `;
        card.addEventListener('click', () => {
            formaPagamentoResumoSelecionada = chave;
            const select = getEl('resumo-eco-forma-select');
            if (select) select.value = chave;
            renderizarResumoPorMetodo(resumo);
        });
        fragment.appendChild(card);
    }

    container.innerHTML = '';
    container.appendChild(fragment);
}

function renderizarTabelaMetodoResumo(resumo, formaSelecionada) {
    const corpo = getEl('resumo-eco-metodos-corpo');
    const totalEl = getEl('resumo-eco-metodo-total');
    const colunaEl = getEl('resumo-eco-metodo-coluna');
    if (!corpo) return;

    const serie = obterSerieMensalFormaPagamentoResumo(resumo, formaSelecionada);
    const total = serie.reduce((acc, valor) => acc + (Number(valor) || 0), 0);
    const rotuloMetodo = formatarMetodoResumo(formaSelecionada);

    if (colunaEl) colunaEl.textContent = rotuloMetodo;
    if (totalEl) totalEl.textContent = `${rotuloMetodo}: ${formatarMoeda(total)}`;

    const fragment = document.createDocumentFragment();
    for (let mes = 0; mes < 12; mes += 1) {
        const valor = Number(serie[mes]) || 0;
        const classe = valor > 0.0001 ? 'positivo' : 'neutro';

        const tr = document.createElement('tr');
        tr.className = 'resumo-eco-linha';
        tr.dataset.tendencia = classe;
        tr.innerHTML = `
            <td class="resumo-eco-col-mes">
                <div class="resumo-eco-celula-mes">
                    <span class="resumo-eco-mes-indice">${String(mes + 1).padStart(2, '0')}</span>
                    <span class="resumo-eco-mes-nome">${nomeMesI18n(mes, 'long')}</span>
                </div>
            </td>
            <td class="resumo-eco-col-valor">
                <span class="resumo-eco-pill ${classe}">
                    <i class="fa-solid ${classe === 'positivo' ? 'fa-arrow-trend-up' : 'fa-minus'}" aria-hidden="true"></i>
                    ${formatarMoeda(valor)}
                </span>
            </td>
        `;
        fragment.appendChild(tr);
    }

    corpo.innerHTML = '';
    corpo.appendChild(fragment);

    document.querySelectorAll('.resumo-eco-metodo-card').forEach(card => {
        card.classList.toggle('ativo', card.getAttribute('data-forma') === formaSelecionada);
    });
}

function renderizarResumoPorMetodo(resumo) {
    preencherSelectMetodosResumo();
    renderizarCardsMetodosResumo(resumo);
    renderizarTabelaMetodoResumo(resumo, formaPagamentoResumoSelecionada);
}

function inicializarResumoEconomias() {
    const anoSelecionado = obterAnoSelecionado();
    document.title = `${t('pages.resumoEconomiasTitle', 'Resumo Economias')} ${anoSelecionado}`;

    const titulo = getEl("titulo-resumo-economias");
    if (titulo) titulo.textContent = `${t('resumoEconomias.mainTitle', 'Resumo de economias')} ${anoSelecionado}`;

    const resumo = calcularResumoEconomiasAnual(anoSelecionado);
    window.__resumoEconomiasCache = resumo;
    renderizarCardsResumo(resumo);
    renderizarGraficoResumo(resumo);
    renderizarTabelaResumo(resumo);
    renderizarResumoPorMetodo(resumo);
}

document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    iniciarAnimacaoEntradaPagina();
    inicializarResumoEconomias();
});

window.addEventListener('fin:i18n-change', () => {
    inicializarResumoEconomias();
});




