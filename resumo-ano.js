const DURACAO_TRANSICAO_TEMA = 420;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js não foi carregado antes de resumo-ano.js');
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

let resumoAnualAtual = [];
let graficoResumoAtivo = false;
let modoGraficoAtual = 'comparativo';
let temaTransicaoTimer = null;
let resumoAnoCanvasResizeObserver = null;
let resumoAnoCanvasAnimationFrame = 0;
let resumoAnoChart = null;
const ordenacaoTabelaResumo = {
    metrica: 'recebido',
    ordem: 'desc'
};

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

function carregarDados() {
    const clientes = safeGetJSON(STORAGE_CLIENTES, []);
    const despesas = safeGetJSON(STORAGE_DESPESAS, []);
    return { clientes, despesas };
}

function calcularResumoAnual(ano, clientes, despesas) {
    const meses = Array.from({ length: 12 }, (_, mes) => ({
        mes,
        recebido: 0,
        pendente: 0,
        despesasPagas: 0,
        liquido: 0
    }));

    for (const cliente of clientes) {
        const data = getDataLocal(cliente.data);
        if (data.getFullYear() !== ano) continue;

        const mes = data.getMonth();
        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;

        meses[mes].recebido += cliente.pago ? valorTotal : valorPago;
        if (!cliente.pago) {
            meses[mes].pendente += Math.max(0, valorTotal - valorPago);
        }
    }

    for (const despesa of despesas) {
        const data = getDataLocal(despesa.data);
        if (data.getFullYear() !== ano) continue;

        const mes = data.getMonth();
        const valor = Number(despesa.valor) || 0;
        if (despesa.status === 'pago') meses[mes].despesasPagas += valor;
    }

    for (const item of meses) {
        item.liquido = item.recebido - item.despesasPagas;
    }

    return meses;
}


function obterConfiguracaoModoGrafico(modo) {
    const configuracoes = {
        comparativo: {
            titulo: t('resumoAno.chartTitles.comparativo', 'Evolução mensal - recebido, despesas e lucro'),
            series: ['recebido', 'despesas', 'lucro'],
            seriePrincipal: 'lucro'
        },
        recebido: {
            titulo: t('resumoAno.chartTitles.recebido', 'Evolução mensal - recebido'),
            series: ['recebido'],
            seriePrincipal: 'recebido'
        },
        despesas: {
            titulo: t('resumoAno.chartTitles.despesas', 'Evolução mensal - despesas pagas'),
            series: ['despesas'],
            seriePrincipal: 'despesas'
        },
        lucro: {
            titulo: t('resumoAno.chartTitles.lucro', 'Evolução mensal - lucro'),
            series: ['lucro'],
            seriePrincipal: 'lucro'
        },
        pendente: {
            titulo: t('resumoAno.chartTitles.pendente', 'Evolução mensal - pendente'),
            series: ['pendente'],
            seriePrincipal: 'pendente'
        }
    };

    return configuracoes[modo] || configuracoes.comparativo;
}

function formatarNumeroEixo(valor) {
    const numero = Number(valor) || 0;
    const absoluto = Math.abs(numero);
    if (absoluto >= 1_000_000) return `${(numero / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (absoluto >= 1_000) return `${(numero / 1_000).toFixed(1).replace('.', ',')}k`;
    return Math.round(numero).toString();
}

function hexParaRgba(hex, alpha = 1) {
    const texto = String(hex || '').trim();
    const cor = texto.startsWith('#') ? texto.slice(1) : texto;
    if (!/^[a-fA-F0-9]{6}$/.test(cor)) return `rgba(255,255,255,${alpha})`;

    const r = parseInt(cor.slice(0, 2), 16);
    const g = parseInt(cor.slice(2, 4), 16);
    const b = parseInt(cor.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function desenharRetanguloArredondadoCanvas(ctx, x, y, largura, altura, raio) {
    const r = Math.max(0, Math.min(raio, largura / 2, altura / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + largura, y, x + largura, y + altura, r);
    ctx.arcTo(x + largura, y + altura, x, y + altura, r);
    ctx.arcTo(x, y + altura, x, y, r);
    ctx.arcTo(x, y, x + largura, y, r);
    ctx.closePath();
}

function tracarCurvaSuaveCanvas(ctx, pontos, tensao = 0.92) {
    if (!Array.isArray(pontos) || pontos.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(pontos[0].x, pontos[0].y);
    if (pontos.length === 1) return;

    const fator = Math.max(0.35, Math.min(1.2, tensao)) / 6;

    for (let i = 0; i < pontos.length - 1; i += 1) {
        const p0 = pontos[i - 1] || pontos[i];
        const p1 = pontos[i];
        const p2 = pontos[i + 1];
        const p3 = pontos[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) * fator;
        const cp1y = p1.y + (p2.y - p0.y) * fator;
        const cp2x = p2.x - (p3.x - p1.x) * fator;
        const cp2y = p2.y - (p3.y - p1.y) * fator;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
}

function obterIndicesRotuloResumo(valores) {
    const indices = new Set();
    if (!Array.isArray(valores) || valores.length === 0) return indices;

    let indiceMax = 0;
    let indiceMin = 0;
    for (let i = 1; i < valores.length; i += 1) {
        if (valores[i] > valores[indiceMax]) indiceMax = i;
        if (valores[i] < valores[indiceMin]) indiceMin = i;
    }

    indices.add(indiceMax);
    indices.add(indiceMin);
    indices.add(valores.length - 1);
    if (valores.length > 6) indices.add(Math.floor(valores.length / 2));
    return indices;
}

function limparGraficoCanvasContexto() {
    if (resumoAnoChart) {
        resumoAnoChart.destroy();
        resumoAnoChart = null;
    }

    if (resumoAnoCanvasResizeObserver) {
        resumoAnoCanvasResizeObserver.disconnect();
        resumoAnoCanvasResizeObserver = null;
    }

    if (resumoAnoCanvasAnimationFrame) {
        cancelAnimationFrame(resumoAnoCanvasAnimationFrame);
        resumoAnoCanvasAnimationFrame = 0;
    }
}

function renderizarGraficoResumoChart(canvas, mesesOrdenados, seriesAtivas) {
    if (!canvas || !window.Chart || !Array.isArray(seriesAtivas) || !seriesAtivas.length) return false;

    const isLight = document.body.classList.contains('light-mode');
    const estilo = getComputedStyle(document.body);
    const corTexto = estilo.getPropertyValue('--text-main').trim() || '#e5e7eb';
    const corMuted = estilo.getPropertyValue('--text-muted').trim() || '#9ca3af';
    const corGrid = isLight ? 'rgba(53, 76, 116, 0.14)' : 'rgba(255, 255, 255, 0.10)';
    const corZero = isLight ? 'rgba(64, 92, 135, 0.28)' : 'rgba(255, 255, 255, 0.31)';
    const corTooltipFundo = isLight ? 'rgba(248, 251, 255, 0.97)' : 'rgba(8, 12, 18, 0.94)';
    const corTooltipBorda = isLight ? 'rgba(83, 108, 148, 0.26)' : 'rgba(255, 255, 255, 0.16)';
    const corPontoBorda = isLight ? 'rgba(241, 247, 255, 0.92)' : 'rgba(8, 11, 18, 0.86)';
    const somenteUmaSerie = seriesAtivas.length === 1;
    const labels = mesesOrdenados.map(item => nomeMesI18n(item.mes, 'short'));

    const datasets = seriesAtivas.map(serie => ({
        label: serie.rotulo,
        data: serie.valores,
        borderColor: serie.cor,
        backgroundColor: contexto => {
            if (!somenteUmaSerie) return hexParaRgba(serie.cor, 0.18);
            const chart = contexto?.chart;
            const area = chart?.chartArea;
            const ctx = chart?.ctx;
            if (!area || !ctx) return hexParaRgba(serie.cor, 0.20);
            const grad = ctx.createLinearGradient(0, area.top, 0, area.bottom);
            grad.addColorStop(0, hexParaRgba(serie.cor, 0.24));
            grad.addColorStop(1, hexParaRgba(serie.cor, 0.02));
            return grad;
        },
        fill: somenteUmaSerie ? 'origin' : false,
        tension: 0.34,
        cubicInterpolationMode: 'monotone',
        borderWidth: somenteUmaSerie ? 3.1 : 2.5,
        pointRadius: contexto => {
            const largura = contexto?.chart?.width || 0;
            if (largura < 760) return somenteUmaSerie ? 2.8 : 2.2;
            return somenteUmaSerie ? 3.5 : 2.9;
        },
        pointHoverRadius: contexto => {
            const largura = contexto?.chart?.width || 0;
            return largura < 760 ? 5 : 6;
        },
        pointBackgroundColor: serie.cor,
        pointBorderColor: corPontoBorda,
        pointBorderWidth: 1.4,
        pointHitRadius: 18
    }));

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    resumoAnoChart = new window.Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 680,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 8,
                    right: 8,
                    bottom: 2,
                    left: 4
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: corTooltipFundo,
                    borderColor: corTooltipBorda,
                    borderWidth: 1,
                    titleColor: corTexto,
                    bodyColor: corTexto,
                    padding: 10,
                    displayColors: true,
                    callbacks: {
                        label(contexto) {
                            const nome = contexto.dataset?.label || t('resumoAno.graph.seriesFallback', 'Série');
                            const valor = Number(contexto.parsed?.y) || 0;
                            return `${nome}: ${formatarMoeda(valor)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: corMuted,
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        padding: 8,
                        font: {
                            family: 'Montserrat, "Segoe UI", sans-serif',
                            size: 11,
                            weight: '700'
                        },
                        callback(value) {
                            const indice = Number(value);
                            const total = this?.getLabels?.().length || 0;
                            const largura = this?.chart?.width || 0;
                            if (largura < 760 && indice % 2 !== 0 && indice !== total - 1) return '';
                            return this.getLabelForValue(indice);
                        }
                    },
                    border: {
                        color: isLight ? 'rgba(83, 108, 148, 0.20)' : 'rgba(255, 255, 255, 0.14)'
                    }
                },
                y: {
                    grace: '8%',
                    ticks: {
                        color: corMuted,
                        padding: 8,
                        font: {
                            family: 'Montserrat, "Segoe UI", sans-serif',
                            size: 11,
                            weight: '700'
                        },
                        callback(valor) {
                            return formatarNumeroEixo(valor);
                        }
                    },
                    grid: {
                        drawBorder: false,
                        color(contexto) {
                            const valor = Number(contexto.tick?.value);
                            return valor === 0 ? corZero : corGrid;
                        },
                        borderDash(contexto) {
                            const valor = Number(contexto.tick?.value);
                            return valor === 0 ? [7, 6] : [3, 7];
                        },
                        lineWidth(contexto) {
                            const valor = Number(contexto.tick?.value);
                            return valor === 0 ? 1.4 : 1;
                        }
                    },
                    border: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'R$',
                        color: corTexto,
                        font: {
                            family: 'Montserrat, "Segoe UI", sans-serif',
                            size: 11,
                            weight: '700'
                        },
                        padding: { top: 4, bottom: 6 }
                    }
                }
            }
        }
    });

    return true;
}

function desenharGraficoResumoCanvas(stage, canvas, mesesOrdenados, seriesAtivas) {
    if (!stage || !canvas || !seriesAtivas.length) return;

    const isLight = document.body.classList.contains('light-mode');
    const estilo = getComputedStyle(document.body);
    const corTexto = estilo.getPropertyValue('--text-main').trim() || '#e5e7eb';
    const corMuted = estilo.getPropertyValue('--text-muted').trim() || '#9ca3af';
    const corGrid = isLight ? 'rgba(53, 76, 116, 0.14)' : 'rgba(255, 255, 255, 0.11)';
    const corZero = isLight ? 'rgba(64, 92, 135, 0.28)' : 'rgba(255, 255, 255, 0.31)';
    const corBorda = isLight ? 'rgba(72, 98, 138, 0.26)' : 'rgba(255, 255, 255, 0.12)';
    const corCapsula = isLight ? 'rgba(248, 251, 255, 0.92)' : 'rgba(7, 11, 18, 0.74)';
    const corCapsulaBorda = isLight ? 'rgba(83, 108, 148, 0.24)' : 'rgba(255, 255, 255, 0.16)';

    const valoresTodos = seriesAtivas.flatMap(serie => serie.valores);
    let yMin = Math.min(0, ...valoresTodos);
    let yMax = Math.max(...valoresTodos);
    if (Math.abs(yMax - yMin) < 0.000001) {
        yMax += 1;
        yMin -= 1;
    }

    const amplitude = yMax - yMin;
    const folga = Math.max(1, amplitude * 0.08);
    yMax += folga;
    yMin -= folga;

    const desenhar = progresso => {
        const larguraCss = Math.max(860, Math.floor(stage.clientWidth || 860));
        const alturaCss = Math.max(286, Math.floor(stage.clientHeight || 348));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const margem = {
            topo: 18,
            direita: 16,
            baixo: larguraCss < 980 ? 54 : 48,
            esquerda: 60
        };

        canvas.width = Math.max(1, Math.floor(larguraCss * dpr));
        canvas.height = Math.max(1, Math.floor(alturaCss * dpr));
        canvas.style.width = `${larguraCss}px`;
        canvas.style.height = `${alturaCss}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, larguraCss, alturaCss);

        const plotW = larguraCss - margem.esquerda - margem.direita;
        const plotH = alturaCss - margem.topo - margem.baixo;
        const totalPontos = mesesOrdenados.length;
        const divisorX = Math.max(1, totalPontos - 1);
        const mapX = indice => (totalPontos === 1
            ? margem.esquerda + (plotW / 2)
            : margem.esquerda + (indice * (plotW / divisorX)));
        const mapY = valor => margem.topo + ((yMax - valor) / (yMax - yMin)) * plotH;

        const gradFundo = ctx.createLinearGradient(0, margem.topo, 0, margem.topo + plotH);
        gradFundo.addColorStop(0, isLight ? 'rgba(248, 252, 255, 0.76)' : 'rgba(255, 255, 255, 0.05)');
        gradFundo.addColorStop(1, isLight ? 'rgba(234, 242, 253, 0.30)' : 'rgba(255, 255, 255, 0.00)');
        desenharRetanguloArredondadoCanvas(ctx, margem.esquerda, margem.topo, plotW, plotH, 12);
        ctx.fillStyle = gradFundo;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = corBorda;
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.strokeStyle = corGrid;
        ctx.setLineDash([3, 7]);
        const totalLinhas = 5;
        for (let i = 0; i <= totalLinhas; i += 1) {
            const fator = i / totalLinhas;
            const y = margem.topo + (fator * plotH);
            ctx.beginPath();
            ctx.moveTo(margem.esquerda, y);
            ctx.lineTo(larguraCss - margem.direita, y);
            ctx.stroke();

            const valor = yMax - fator * (yMax - yMin);
            ctx.setLineDash([]);
            ctx.fillStyle = corMuted;
            ctx.font = '700 11px "Montserrat", "Segoe UI", sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatarNumeroEixo(valor), margem.esquerda - 10, y);
            ctx.setLineDash([3, 7]);
        }

        const eixoZeroY = mapY(0);
        if (eixoZeroY >= margem.topo && eixoZeroY <= margem.topo + plotH) {
            ctx.setLineDash([7, 6]);
            ctx.strokeStyle = corZero;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(margem.esquerda, eixoZeroY);
            ctx.lineTo(larguraCss - margem.direita, eixoZeroY);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.fillStyle = corMuted;
        ctx.font = '700 11px "Montserrat", "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const exibirTodosMeses = larguraCss >= 980;
        const yMes = margem.topo + plotH + 11;

        for (let i = 0; i < mesesOrdenados.length; i += 1) {
            if (!exibirTodosMeses && i % 2 !== 0 && i !== mesesOrdenados.length - 1) continue;
            const x = mapX(i);
            const textoMes = nomeMesI18n(mesesOrdenados[i].mes, 'short');
            ctx.fillText(textoMes, x, yMes);
        }

        const clipW = plotW * Math.max(0, Math.min(1, progresso));
        ctx.save();
        ctx.beginPath();
        ctx.rect(margem.esquerda - 4, margem.topo - 10, clipW + 8, plotH + 20);
        ctx.clip();

        const plotBottomY = margem.topo + plotH;

        for (let serieIndice = 0; serieIndice < seriesAtivas.length; serieIndice += 1) {
            const serie = seriesAtivas[serieIndice];
            const pontos = serie.valores.map((valor, indice) => ({
                x: mapX(indice),
                y: mapY(valor),
                valor
            }));

            if (seriesAtivas.length === 1) {
                const gradArea = ctx.createLinearGradient(0, margem.topo, 0, plotBottomY);
                gradArea.addColorStop(0, hexParaRgba(serie.cor, 0.22));
                gradArea.addColorStop(1, hexParaRgba(serie.cor, 0.02));
                ctx.fillStyle = gradArea;
                tracarCurvaSuaveCanvas(ctx, pontos);
                ctx.lineTo(pontos[pontos.length - 1].x, plotBottomY);
                ctx.lineTo(pontos[0].x, plotBottomY);
                ctx.closePath();
                ctx.fill();
            }

            ctx.lineWidth = seriesAtivas.length === 1 ? 3.2 : 2.7;
            ctx.strokeStyle = serie.cor;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = hexParaRgba(serie.cor, isLight ? 0.12 : 0.24);
            ctx.shadowBlur = seriesAtivas.length === 1 ? 7 : 5;
            tracarCurvaSuaveCanvas(ctx, pontos, 0.96);
            ctx.stroke();
            ctx.shadowBlur = 0;

            const indicesRotulo = obterIndicesRotuloResumo(serie.valores);
            const mostrarValores = larguraCss >= 960;
            const raioPonto = seriesAtivas.length === 1 ? 4.1 : 3.4;

            for (let i = 0; i < pontos.length; i += 1) {
                const ponto = pontos[i];
                const exibirPonto = larguraCss >= 900 || indicesRotulo.has(i) || i === 0 || i === pontos.length - 1;
                if (!exibirPonto) continue;

                ctx.beginPath();
                ctx.fillStyle = serie.cor;
                ctx.arc(ponto.x, ponto.y, raioPonto, 0, Math.PI * 2);
                ctx.fill();

                ctx.lineWidth = 1.5;
                ctx.strokeStyle = isLight ? 'rgba(241, 247, 255, 0.92)' : 'rgba(8, 11, 18, 0.86)';
                ctx.stroke();

                if (mostrarValores && indicesRotulo.has(i)) {
                    const texto = formatarNumeroEixo(ponto.valor);
                    ctx.font = '800 10px "Montserrat", "Segoe UI", sans-serif';
                    const textoLargura = ctx.measureText(texto).width;
                    const caixaLargura = textoLargura + 14;
                    const caixaAltura = 17;
                    const caixaX = ponto.x - caixaLargura / 2;
                    const espacoAcima = ponto.y - margem.topo;
                    const mostrarAcima = espacoAcima > 28;
                    const caixaY = mostrarAcima ? ponto.y - (caixaAltura + 10) : ponto.y + 10;

                    desenharRetanguloArredondadoCanvas(ctx, caixaX, caixaY, caixaLargura, caixaAltura, 8);
                    ctx.fillStyle = corCapsula;
                    ctx.fill();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = corCapsulaBorda;
                    ctx.stroke();

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = serie.cor;
                    ctx.fillText(texto, ponto.x, caixaY + caixaAltura / 2 + 0.1);
                }
            }
        }

        ctx.restore();

        ctx.strokeStyle = corBorda;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(margem.esquerda, margem.topo + plotH);
        ctx.lineTo(larguraCss - margem.direita, margem.topo + plotH);
        ctx.stroke();

        ctx.fillStyle = corTexto;
        ctx.font = '700 11px "Montserrat", "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('R$', margem.esquerda + 6, margem.topo + 6);
    };

    const duracao = 680;
    const inicio = performance.now();

    const animar = agora => {
        const progresso = Math.min(1, (agora - inicio) / duracao);
        desenhar(progresso);
        if (progresso < 1) {
            resumoAnoCanvasAnimationFrame = requestAnimationFrame(animar);
        } else {
            resumoAnoCanvasAnimationFrame = 0;
        }
    };

    resumoAnoCanvasAnimationFrame = requestAnimationFrame(animar);

    if (typeof ResizeObserver !== 'undefined') {
        resumoAnoCanvasResizeObserver = new ResizeObserver(() => {
            desenhar(1);
        });
        resumoAnoCanvasResizeObserver.observe(stage);
    }
}

function renderizarGraficoResumo(meses) {
    const lista = getEl('resumo-ano-grafico-lista');
    const titulo = getEl('resumo-ano-grafico-titulo') || document.querySelector('.resumo-ano-grafico-titulo');
    const graficoWrap = getEl('resumo-ano-grafico-wrap');
    const principal = getEl('resumo-ano-melhor-mes');
    const secundario = getEl('resumo-ano-insights');
    const configuracao = obterConfiguracaoModoGrafico(modoGraficoAtual);
    if (!lista) return;

    limparGraficoCanvasContexto();

    if (graficoWrap) {
        graficoWrap.dataset.metrica = configuracao.seriePrincipal;
        graficoWrap.dataset.modo = modoGraficoAtual;
    }

    if (!Array.isArray(meses) || meses.length === 0) {
        lista.innerHTML = `<p class="resumo-ano-grafico-vazio">${escapeHtml(t('resumoAno.graph.noData', 'Sem dados para exibir no ano selecionado.'))}</p>`;
        if (principal) {
            principal.textContent = '-';
            principal.className = 'resumo-ano-melhor-mes destaque-neutro';
        }
        if (secundario) secundario.textContent = '-';
        return;
    }

    const estiloResumo = getComputedStyle(document.body);
    const obterCorSerie = (variavel, fallback) => {
        const cor = estiloResumo.getPropertyValue(variavel).trim();
        return cor || fallback;
    };

    const definicoesSeries = {
        recebido: { campo: 'recebido', rotulo: t('resumoAno.series.recebido', 'Recebido'), cor: obterCorSerie('--resumo-ano-serie-recebido', '#3b82f6') },
        despesas: { campo: 'despesasPagas', rotulo: t('resumoAno.series.despesas', 'Despesas'), cor: obterCorSerie('--resumo-ano-serie-despesas', '#f97316') },
        lucro: { campo: 'liquido', rotulo: t('resumoAno.series.lucro', 'Lucro'), cor: obterCorSerie('--resumo-ano-serie-lucro', '#9ca3af') },
        pendente: { campo: 'pendente', rotulo: t('resumoAno.series.pendente', 'Pendente'), cor: obterCorSerie('--resumo-ano-serie-pendente', '#f1c40f') }
    };

    const mesesOrdenados = [...meses].sort((a, b) => a.mes - b.mes);
    const seriesAtivas = configuracao.series
        .map(chave => ({ chave, ...definicoesSeries[chave] }))
        .filter(serie => Boolean(serie?.campo))
        .map(serie => ({
            ...serie,
            valores: mesesOrdenados.map(item => Number(item[serie.campo]) || 0)
        }));

    if (!seriesAtivas.length) {
        lista.innerHTML = `<p class="resumo-ano-grafico-vazio">${escapeHtml(t('resumoAno.graph.noSeries', 'Nenhuma série disponível para o modo selecionado.'))}</p>`;
        return;
    }

    if (titulo) titulo.textContent = configuracao.titulo;

    const legenda = seriesAtivas
        .map(serie => `<span class="resumo-ano-line-legenda-item"><i style="--line-color:${serie.cor};"></i>${serie.rotulo}</span>`)
        .join('');

    lista.innerHTML = `
        <div class="resumo-ano-line-wrap">
            <div class="resumo-ano-canvas-stage">
                <canvas class="resumo-ano-line-canvas" role="img" aria-label="${escapeHtml(t('resumoAno.graph.chartAria', 'Gráfico de evolução mensal'))}"></canvas>
            </div>
        </div>
        <div class="resumo-ano-line-legenda">
            ${legenda}
        </div>
    `;

    const canvas = lista.querySelector('.resumo-ano-line-canvas');
    const stage = lista.querySelector('.resumo-ano-canvas-stage');
    const usouChart = renderizarGraficoResumoChart(canvas, mesesOrdenados, seriesAtivas);
    if (!usouChart) {
        desenharGraficoResumoCanvas(stage, canvas, mesesOrdenados, seriesAtivas);
    }

    const seriePrincipal = seriesAtivas.find(serie => serie.chave === configuracao.seriePrincipal) || seriesAtivas[0];
    const valoresPrincipal = seriePrincipal.valores;
    let indiceMax = 0;
    let indiceMin = 0;

    for (let i = 1; i < valoresPrincipal.length; i += 1) {
        if (valoresPrincipal[i] > valoresPrincipal[indiceMax]) indiceMax = i;
        if (valoresPrincipal[i] < valoresPrincipal[indiceMin]) indiceMin = i;
    }

    if (principal) {
        const valorPico = valoresPrincipal[indiceMax];
        principal.textContent = t('resumoAno.graph.insights.peakOf', 'Pico de {serie}: {mes} ({valor})', {
            serie: seriePrincipal.rotulo,
            mes: nomeMesI18n(mesesOrdenados[indiceMax].mes, 'long'),
            valor: formatarMoeda(valorPico)
        });
        principal.className = `resumo-ano-melhor-mes ${valorPico >= 0 ? 'destaque-positivo' : 'destaque-neutro'}`;
    }

    if (secundario) {
        const valorMinimo = valoresPrincipal[indiceMin];
        const totalRecebido = mesesOrdenados.reduce((acc, item) => acc + item.recebido, 0);
        const totalDespesas = mesesOrdenados.reduce((acc, item) => acc + item.despesasPagas, 0);
        const totalLiquido = mesesOrdenados.reduce((acc, item) => acc + item.liquido, 0);
        secundario.textContent = t(
            'resumoAno.graph.insights.lowestLine',
            'Menor {serie}: {mes} ({valor}) | Recebido: {recebido} | Despesas: {despesas} | Lucro anual: {lucro}',
            {
                serie: seriePrincipal.rotulo.toLowerCase(),
                mes: nomeMesI18n(mesesOrdenados[indiceMin].mes, 'long'),
                valor: formatarMoeda(valorMinimo),
                recebido: formatarMoeda(totalRecebido),
                despesas: formatarMoeda(totalDespesas),
                lucro: formatarMoeda(totalLiquido)
            }
        );
    }
}

function aplicarVisualizacaoResumo() {
    const tabelaWrap = getEl('resumo-ano-tabela-wrap');
    const graficoWrap = getEl('resumo-ano-grafico-wrap');
    const botao = getEl('btn-alternar-grafico');
    const controlesTabela = document.querySelector('.resumo-ano-tabela-controles');
    if (!tabelaWrap || !graficoWrap || !botao) return;

    const mostrarGrafico = graficoResumoAtivo;
    tabelaWrap.classList.remove('resumo-ano-oculto');
    graficoWrap.classList.remove('resumo-ano-oculto');
    tabelaWrap.classList.toggle('resumo-ano-painel-oculto', mostrarGrafico);
    graficoWrap.classList.toggle('resumo-ano-painel-oculto', !mostrarGrafico);
    tabelaWrap.setAttribute('aria-hidden', mostrarGrafico ? 'true' : 'false');
    graficoWrap.setAttribute('aria-hidden', mostrarGrafico ? 'false' : 'true');
    if (controlesTabela) controlesTabela.classList.toggle('oculto-grafico', mostrarGrafico);

    if (mostrarGrafico) {
        botao.innerHTML = `<i class="fa-solid fa-table-list"></i><span>${escapeHtml(t('resumoAno.graph.toggleShowTable', 'Ver tabela'))}</span>`;
    } else {
        botao.innerHTML = `<i class="fa-solid fa-chart-column"></i><span>${escapeHtml(t('resumoAno.graph.toggleShowGraph', 'Ver gráfico'))}</span>`;
    }
}

function alternarGraficoResumo() {
    graficoResumoAtivo = !graficoResumoAtivo;
    aplicarVisualizacaoResumo();
}

function obterValorOrdenacaoTabela(item, metrica) {
    if (metrica === 'mes') return item.mes;
    if (metrica === 'recebido') return item.recebido;
    if (metrica === 'pendente') return item.pendente;
    if (metrica === 'despesasPagas') return item.despesasPagas;
    return item.liquido;
}

function obterMesesOrdenadosTabela(meses) {
    const itens = [...meses];
    const { metrica, ordem } = ordenacaoTabelaResumo;

    itens.sort((a, b) => {
        const valorA = obterValorOrdenacaoTabela(a, metrica);
        const valorB = obterValorOrdenacaoTabela(b, metrica);

        if (valorA !== valorB) {
            return ordem === 'asc' ? valorA - valorB : valorB - valorA;
        }

        return a.mes - b.mes;
    });

    return itens;
}

function atualizarBotaoOrdenacaoTabelaResumo() {
    const botao = getEl('btn-ordenar-tabela-resumo');
    if (!botao) return;

    if (ordenacaoTabelaResumo.ordem === 'asc') {
        botao.innerHTML = `<i class="fa-solid fa-arrow-up-wide-short"></i><span>${escapeHtml(t('resumoAno.graph.sortAsc', 'Crescente'))}</span>`;
    } else {
        botao.innerHTML = `<i class="fa-solid fa-arrow-down-wide-short"></i><span>${escapeHtml(t('resumoAno.graph.sortDesc', 'Decrescente'))}</span>`;
    }
}

function alternarOrdemTabelaResumo() {
    ordenacaoTabelaResumo.ordem = ordenacaoTabelaResumo.ordem === 'asc' ? 'desc' : 'asc';
    atualizarBotaoOrdenacaoTabelaResumo();
    renderizarResumo(obterAnoSelecionado(), resumoAnualAtual);
}

function configurarControlesTabelaResumo() {
    const seletorMetrica = getEl('resumo-tabela-metrica');
    if (!seletorMetrica) return;

    seletorMetrica.value = ordenacaoTabelaResumo.metrica;
    seletorMetrica.addEventListener('change', () => {
        ordenacaoTabelaResumo.metrica = seletorMetrica.value;
        renderizarResumo(obterAnoSelecionado(), resumoAnualAtual);
    });

    atualizarBotaoOrdenacaoTabelaResumo();
}

function configurarControlesGraficoResumo() {
    const seletorModo = getEl('resumo-grafico-modo');
    if (!seletorModo) return;

    seletorModo.value = modoGraficoAtual;
    seletorModo.addEventListener('change', () => {
        modoGraficoAtual = seletorModo.value;
        renderizarGraficoResumo(resumoAnualAtual);
    });
}

function renderizarResumo(ano, meses) {
    const titulo = getEl('titulo-resumo-ano');
    if (titulo) titulo.textContent = `${t('resumoAno.mainTitle', 'Resumo anual')} ${ano}`;

    const totalRecebido = meses.reduce((acc, mes) => acc + mes.recebido, 0);
    const totalPendente = meses.reduce((acc, mes) => acc + mes.pendente, 0);
    const totalDespesas = meses.reduce((acc, mes) => acc + mes.despesasPagas, 0);
    const totalLiquido = meses.reduce((acc, mes) => acc + mes.liquido, 0);

    const recebidoEl = getEl('resumo-total-recebido');
    const pendenteEl = getEl('resumo-total-pendente');
    const lucroEl = getEl('resumo-total-lucro');
    const despesasEl = getEl('resumo-total-despesas');

    if (recebidoEl) recebidoEl.textContent = formatarMoeda(totalRecebido);
    if (pendenteEl) pendenteEl.textContent = formatarMoeda(totalPendente);
    if (lucroEl) lucroEl.textContent = formatarMoeda(totalLiquido);
    if (despesasEl) despesasEl.textContent = formatarMoeda(totalDespesas);
    if (lucroEl) lucroEl.style.color = totalLiquido >= 0 ? 'var(--success)' : 'var(--danger)';

    const corpo = getEl('resumo-ano-corpo');
    if (!corpo) return;
    const tabela = getEl('tabela-resumo-ano');
    if (tabela) {
        tabela.dataset.metricaOrdenacao = ordenacaoTabelaResumo.metrica;
        tabela.dataset.ordemOrdenacao = ordenacaoTabelaResumo.ordem;
    }

    const fragment = document.createDocumentFragment();

    const mesesOrdenadosTabela = obterMesesOrdenadosTabela(meses);

    for (let indice = 0; indice < mesesOrdenadosTabela.length; indice += 1) {
        const item = mesesOrdenadosTabela[indice];
        const tr = document.createElement('tr');
        if (indice === 0) tr.className = 'resumo-tabela-linha-topo';
        tr.innerHTML = `
            <td><strong>${escapeHtml(nomeMesI18n(item.mes, 'long'))}</strong></td>
            <td>${formatarMoeda(item.recebido)}</td>
            <td>${formatarMoeda(item.pendente)}</td>
            <td class="${item.liquido >= 0 ? 'resumo-liquido-positivo' : 'resumo-liquido-negativo'}">${formatarMoeda(item.liquido)}</td>
            <td>${formatarMoeda(item.despesasPagas)}</td>
            <td>
                <div class="resumo-acoes-mes">
                    <button class="btn-mini" onclick="abrirMesNoIndex(${item.mes})">${escapeHtml(t('resumoAno.graph.actions.index', 'Index'))}</button>
                    <button class="btn-mini btn-mini-alt" onclick="abrirMesEmDespesas(${item.mes})">${escapeHtml(t('resumoAno.graph.actions.despesas', 'Despesas'))}</button>
                    <button class="btn-mini btn-mini-eco" onclick="abrirEconomias(${item.mes})">${escapeHtml(t('resumoAno.graph.actions.economias', 'Economias'))}</button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    }

    corpo.innerHTML = '';
    corpo.appendChild(fragment);

    resumoAnualAtual = meses;
    atualizarBotaoOrdenacaoTabelaResumo();
    renderizarGraficoResumo(resumoAnualAtual);
    aplicarVisualizacaoResumo();
}

function normalizarMesAcaoResumo(mes) {
    // A pedido do usuario, links de navegacao sempre abrem no mes atual
    // (em vez de reutilizar o mes historico da linha do resumo anual).
    void mes;
    return new Date().getMonth();
}

function abrirMesNoIndex(mes) {
    void mes;
    // O index sempre inicia no mes atual; nao repassa mes por query string.
    window.location.href = 'index.html';
}

function abrirMesEmDespesas(mes) {
    void mes;
    window.location.href = 'despesas.html';
}

function abrirEconomias(mes) {
    void mes;
    window.location.href = 'economias.html';
}

function irParaInicio() {
    safeSetItem(STORAGE_SIDEBAR_RETORNO_FECHADA, '1');
    safeSetItem(STORAGE_PULAR_SPLASH_ENTRADA, '1');
    window.location.href = 'index.html';
}

function reaplicarIdiomaResumoAno() {
    if (!resumoAnualAtual || !resumoAnualAtual.length) return;
    renderizarResumo(obterAnoSelecionado(), resumoAnualAtual);
}

window.addEventListener('fin:i18n-change', reaplicarIdiomaResumoAno);

document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    iniciarAnimacaoEntradaPagina();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    configurarControlesTabelaResumo();
    configurarControlesGraficoResumo();
    const ano = obterAnoSelecionado();
    const { clientes, despesas } = carregarDados();
    const resumo = calcularResumoAnual(ano, clientes, despesas);
    renderizarResumo(ano, resumo);
});











