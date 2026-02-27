const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const { handleNfceApiRoute } = require('./routes/nfce');

function carregarArquivoEnv(caminhoEnv, opcoes = {}) {
    const sobrescrever = Boolean(opcoes?.sobrescrever);
    const filtro = typeof opcoes?.filtro === 'function' ? opcoes.filtro : null;

    if (!fs.existsSync(caminhoEnv)) return;

    const conteudo = fs.readFileSync(caminhoEnv, 'utf-8');
    for (const linha of conteudo.split(/\r?\n/)) {
        const texto = linha.trim();
        if (!texto || texto.startsWith('#')) continue;

        const indiceIgual = texto.indexOf('=');
        if (indiceIgual <= 0) continue;

        const chave = texto.slice(0, indiceIgual).trim();
        const valorBruto = texto.slice(indiceIgual + 1).trim();
        const valor = valorBruto.replace(/^"|"$/g, '').replace(/^'|'$/g, '');

        if (!chave) continue;
        if (filtro && !filtro(chave)) continue;

        const atual = String(process.env[chave] ?? '').trim();
        if (!sobrescrever && atual) continue;
        process.env[chave] = valor;
    }
}

const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const ENV_FILE = path.join(BASE_DIR, '.env');
carregarArquivoEnv(ENV_FILE);

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = PUBLIC_DIR;
const WEBHOOK_STORE_FILE = path.join(BASE_DIR, 'mercado_pago_webhooks.json');
const WEBHOOK_MAX_REGISTROS = 1500;
const MP_ENV_KEYS = new Set(['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MERCADO_PAGO_WHATSAPP_NUMERO']);
const NGROK_ORIGIN_FALLBACK = 'https://narrowly-noncognizable-felicia.ngrok-free.dev';
const BLOCKED_STATIC_BASENAMES = new Set([
    '.env',
    'server.js',
    'package.json',
    'package-lock.json',
    'mercado_pago_webhooks.json'
]);
const BLOCKED_STATIC_EXTENSIONS = new Set(['.ps1', '.bat']);
const BACKEND_APP_CHANGELOG = Object.freeze({
    title: Object.freeze({
        'pt-BR': 'Atualizacao do servidor (backend)',
        'en-US': 'Server update (backend)'
    }),
    changes: Object.freeze({
        'pt-BR': Object.freeze([
            'Versao do backend exposta em /api/app-version com data/hora e fingerprint automaticos.',
            'Patch notes do menu podem combinar atualizacoes do frontend (PWA) e do servidor.',
            'Deteccao automatica de mudancas do servidor para abrir patch notes sem depender apenas do Service Worker.'
        ]),
        'en-US': Object.freeze([
            'Backend version exposed at /api/app-version with automatic release date/time and fingerprint.',
            'Menu patch notes can combine frontend (PWA) and server updates.',
            'Automatic server change detection to open patch notes without relying only on the Service Worker.'
        ])
    }),
    affectedAreas: Object.freeze([
        'Servidor HTTP nativo',
        'Patch notes / Painel de Controle',
        'API interna (/api/app-version)'
    ]),
    changedFiles: Object.freeze([
        'server.js',
        'public/menu.js'
    ])
});

function atualizarCredenciaisMercadoPago() {
    carregarArquivoEnv(ENV_FILE, {
        sobrescrever: true,
        filtro: chave => MP_ENV_KEYS.has(chave)
    });
}

function formatarVersaoBackendPorData(data) {
    if (!(data instanceof Date) || !Number.isFinite(data.getTime())) return 'backend-unknown';
    const y = String(data.getFullYear());
    const m = String(data.getMonth() + 1).padStart(2, '0');
    const d = String(data.getDate()).padStart(2, '0');
    const hh = String(data.getHours()).padStart(2, '0');
    const mm = String(data.getMinutes()).padStart(2, '0');
    return `backend-${y}.${m}.${d}-${hh}${mm}`;
}

function obterInfoVersaoBackend() {
    let stat = null;
    let releasedAt = new Date();
    let fingerprint = '';

    try {
        stat = fs.statSync(__filename);
        if (Number.isFinite(stat.mtimeMs)) {
            releasedAt = new Date(stat.mtimeMs);
        } else if (stat.mtime instanceof Date) {
            releasedAt = stat.mtime;
        }
    } catch (_) {
        // fallback para data atual.
    }

    try {
        const source = fs.readFileSync(__filename);
        fingerprint = crypto.createHash('sha1').update(source).digest('hex').slice(0, 12);
    } catch (_) {
        fingerprint = '';
    }

    return {
        version: formatarVersaoBackendPorData(releasedAt),
        releasedAt: releasedAt.toISOString(),
        fingerprint,
        source: 'server.js',
        title: BACKEND_APP_CHANGELOG.title,
        changes: BACKEND_APP_CHANGELOG.changes,
        affectedAreas: BACKEND_APP_CHANGELOG.affectedAreas,
        changedFiles: BACKEND_APP_CHANGELOG.changedFiles,
        sizeBytes: Number(stat && stat.size) || 0
    };
}

function extrairCredenciaisMpOverride(req) {
    const headers = req?.headers || {};
    const accessToken = String(headers['x-fin-mp-access-token'] || headers['x-mp-access-token'] || '').trim();
    const webhookSecret = String(headers['x-fin-mp-webhook-secret'] || headers['x-mp-webhook-secret'] || '').trim();
    const whatsappNumero = String(headers['x-fin-mp-whatsapp-numero'] || headers['x-mp-whatsapp-numero'] || '').trim();

    return {
        accessToken,
        webhookSecret,
        whatsappNumero
    };
}

function obterMpAccessToken(overrides = null) {
    const override = String(overrides?.accessToken || '').trim();
    if (override) return override;
    atualizarCredenciaisMercadoPago();
    return String(process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
}

function obterMpWebhookSecret(overrides = null) {
    const override = String(overrides?.webhookSecret || '').trim();
    if (override) return override;
    atualizarCredenciaisMercadoPago();
    return String(process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();
}

function normalizarTelefoneWhatsappServidor(telefone) {
    const digitos = String(telefone || '').replace(/\D/g, '');
    if (!digitos) return '';

    if (digitos.startsWith('55') && digitos.length > 11) {
        return digitos;
    }

    if (digitos.length >= 10) {
        return '55' + digitos;
    }

    return '';
}

function obterMpWhatsappNumero(overrides = null) {
    const override = normalizarTelefoneWhatsappServidor(overrides?.whatsappNumero || '');
    if (override) return override;
    atualizarCredenciaisMercadoPago();
    return normalizarTelefoneWhatsappServidor(process.env.MERCADO_PAGO_WHATSAPP_NUMERO || '');
}

function formatarStatusPagamentoTexto(status) {
    const valor = String(status || '').trim().toLowerCase();
    if (valor === 'approved') return 'Aprovado';
    if (valor === 'pending' || valor === 'in_process') return 'Pendente';
    if (valor === 'rejected' || valor === 'cancelled') return 'Recusado';
    if (!valor) return 'Desconhecido';
    return valor;
}

function formatarMoedaBr(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function obterDataPagamento(pagamento) {
    const candidatos = [
        pagamento?.date_approved,
        pagamento?.date_created,
        pagamento?.date_last_updated
    ];

    for (const item of candidatos) {
        const data = new Date(String(item || ''));
        if (Number.isFinite(data.getTime())) return data;
    }

    return null;
}

function formatarDataBr(data) {
    if (!(data instanceof Date) || !Number.isFinite(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR');
}

function formatarHoraBr(data) {
    if (!(data instanceof Date) || !Number.isFinite(data.getTime())) return '';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function extrairNomePagador(pagamento) {
    const candidatos = [
        pagamento?.additional_info?.payer?.first_name,
        pagamento?.payer?.first_name
    ];

    for (const item of candidatos) {
        const nome = String(item || '').trim();
        if (nome) return nome;
    }

    const descricao = String(pagamento?.description || '').trim();
    if (descricao) {
        const partes = descricao.split('-');
        const ultimo = String(partes[partes.length - 1] || '').trim();
        if (ultimo) return ultimo;
    }

    return 'Cliente';
}

function gerarProtocoloComprovante(pagamento) {
    const paymentId = String(pagamento?.id || '').trim();
    const referencia = String(pagamento?.external_reference || '').trim();
    const finalRef = referencia ? referencia.slice(-6) : '000000';
    return 'FIN-' + (paymentId || 'SEMID') + '-' + finalRef;
}

function escaparHtml(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function construirUrlComprovante(baseRetorno, paymentId) {
    const base = normalizarBaseUrl(baseRetorno) || ('http://localhost:' + PORT);
    const id = String(paymentId || '').trim();
    return base + '/api/mercadopago/comprovante?payment_id=' + encodeURIComponent(id);
}

function construirMensagemComprovanteWhatsapp(pagamento, opcoes = {}) {
    const status = formatarStatusPagamentoTexto(pagamento?.status);
    const valor = Number(pagamento?.transaction_amount);
    const dataPagamento = obterDataPagamento(pagamento);
    const nome = extrairNomePagador(pagamento);
    const protocolo = gerarProtocoloComprovante(pagamento);

    const linhas = [
        '*Comprovante Mercado Pago*',
        'Nome: ' + nome,
        'Status: ' + status
    ];

    if (Number.isFinite(valor)) {
        linhas.push('Valor: ' + formatarMoedaBr(valor));
    }

    const dataTxt = formatarDataBr(dataPagamento);
    if (dataTxt) {
        linhas.push('Data: ' + dataTxt);
    }

    const horaTxt = formatarHoraBr(dataPagamento);
    if (horaTxt) {
        linhas.push('Hora: ' + horaTxt);
    }

    const paymentId = String(pagamento?.id || '').trim();
    if (paymentId) {
        linhas.push('Pagamento ID: ' + paymentId);
    }

    linhas.push('Protocolo: ' + protocolo);

    const metodo = [pagamento?.payment_type_id, pagamento?.payment_method_id]
        .map(valorItem => String(valorItem || '').trim())
        .filter(Boolean)
        .join(' / ');
    if (metodo) {
        linhas.push('Metodo: ' + metodo);
    }

    const comprovanteUrl = String(opcoes?.comprovanteUrl || '').trim();
    if (comprovanteUrl) {
        linhas.push('Comprovante visual: ' + comprovanteUrl);
    }

    linhas.push('Sistema: Finances');

    return linhas.join('\n');
}

function construirLinkWhatsappComprovante(numeroDestino, mensagem) {
    const texto = encodeURIComponent(String(mensagem || '').trim());
    return 'https://wa.me/' + numeroDestino + '?text=' + texto;
}

function construirHtmlComprovantePagamento(pagamento, opcoes = {}) {
    const status = formatarStatusPagamentoTexto(pagamento?.status);
    const valor = Number(pagamento?.transaction_amount);
    const dataPagamento = obterDataPagamento(pagamento);
    const nome = extrairNomePagador(pagamento);
    const protocolo = gerarProtocoloComprovante(pagamento);
    const paymentId = String(pagamento?.id || '').trim() || '-';
    const referencia = String(pagamento?.external_reference || '').trim() || '-';
    const metodo = [pagamento?.payment_type_id, pagamento?.payment_method_id]
        .map(valorItem => String(valorItem || '').trim())
        .filter(Boolean)
        .join(' / ') || '-';

    const statusClass = String(pagamento?.status || '').toLowerCase() === 'approved' ? 'ok' : 'warn';
    const logoUrl = String(opcoes?.logoUrl || '/logo2.png');

    const dataTxt = formatarDataBr(dataPagamento) || '-';
    const horaTxt = formatarHoraBr(dataPagamento) || '-';
    const valorTxt = Number.isFinite(valor) ? formatarMoedaBr(valor) : '-';

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprovante de Pagamento</title>
<style>
:root { color-scheme: dark; }
body {
  margin: 0;
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #070d1a;
  color: #eaf2ff;
  min-height: 100vh;
  display: grid;
  place-items: center;
}
.card {
  width: min(92vw, 720px);
  border-radius: 18px;
  border: 1px solid #2a4d84;
  background: linear-gradient(140deg, rgba(7,20,46,0.95), rgba(5,14,30,0.98));
  box-shadow: 0 20px 60px rgba(0,0,0,.45);
  overflow: hidden;
  position: relative;
}
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('${escaparHtml(logoUrl)}') center/56% no-repeat;
  opacity: 0.07;
  pointer-events: none;
}
.topo {
  position: relative;
  z-index: 1;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(120,160,220,.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.titulo { font-size: 1.12rem; font-weight: 800; letter-spacing: .02em; }
.badge {
  font-weight: 700;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid;
  font-size: .85rem;
}
.badge.ok { color: #53f2a4; border-color: rgba(83,242,164,.45); background: rgba(83,242,164,.12); }
.badge.warn { color: #ffd98a; border-color: rgba(255,217,138,.45); background: rgba(255,217,138,.14); }
.grid {
  position: relative;
  z-index: 1;
  padding: 20px 24px 24px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}
.item {
  border: 1px solid rgba(120,160,220,.28);
  border-radius: 12px;
  background: rgba(9,25,55,.58);
  padding: 11px 12px;
}
.rotulo {
  color: #9fb6dc;
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.valor {
  margin-top: 6px;
  font-size: 1.02rem;
  font-weight: 700;
  color: #eff6ff;
  word-break: break-word;
}
.rodape {
  position: relative;
  z-index: 1;
  padding: 14px 24px 20px;
  color: #90a9d0;
  font-size: .82rem;
}
@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
  <section class="card" aria-label="Comprovante de pagamento">
    <header class="topo">
      <div class="titulo">Comprovante de Pagamento</div>
      <span class="badge ${statusClass}">${escaparHtml(status)}</span>
    </header>
    <div class="grid">
      <div class="item"><div class="rotulo">Nome</div><div class="valor">${escaparHtml(nome)}</div></div>
      <div class="item"><div class="rotulo">Valor</div><div class="valor">${escaparHtml(valorTxt)}</div></div>
      <div class="item"><div class="rotulo">Data</div><div class="valor">${escaparHtml(dataTxt)}</div></div>
      <div class="item"><div class="rotulo">Hora</div><div class="valor">${escaparHtml(horaTxt)}</div></div>
      <div class="item"><div class="rotulo">Pagamento ID</div><div class="valor">${escaparHtml(paymentId)}</div></div>
      <div class="item"><div class="rotulo">Metodo</div><div class="valor">${escaparHtml(metodo)}</div></div>
      <div class="item"><div class="rotulo">Protocolo</div><div class="valor">${escaparHtml(protocolo)}</div></div>
      <div class="item"><div class="rotulo">Referencia</div><div class="valor">${escaparHtml(referencia)}</div></div>
    </div>
    <footer class="rodape">Documento gerado automaticamente pelo sistema Finances.</footer>
  </section>
</body>
</html>`;
}

if (typeof fetch !== 'function') {
    throw new Error('Este servidor requer Node.js 18+ (fetch nativo).');
}

const MIME_TYPES = Object.freeze({
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8'
});

const SECURITY_HEADERS = Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Mantem compatibilidade com os CDNs usados pelo app (fonts/font-awesome/chart.js).
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'"
    ].join('; ')
});

function appendVaryHeader(res, nome) {
    const atual = String(res.getHeader('Vary') || '').trim();
    if (!atual) {
        res.setHeader('Vary', nome);
        return;
    }
    const valores = atual.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    if (!valores.includes(String(nome || '').trim().toLowerCase())) {
        res.setHeader('Vary', `${atual}, ${nome}`);
    }
}

function applySecurityHeaders(res) {
    for (const [chave, valor] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(chave, valor);
    }
}

function applyNoStoreHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}

function normalizeOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw);
        if (!/^https?:$/i.test(url.protocol)) return '';
        return url.origin;
    } catch (_) {
        return '';
    }
}

function obterOrigensCorsPermitidas() {
    const candidates = [
        'http://localhost:3000',
        'http://localhost:5173',
        process.env.CORS_NGROK_ORIGIN,
        process.env.NGROK_PUBLIC_ORIGIN,
        process.env.PUBLIC_ORIGIN,
        process.env.APP_PUBLIC_ORIGIN,
        process.env.NGROK_URL,
        NGROK_ORIGIN_FALLBACK
    ];

    const set = new Set();
    for (const item of candidates) {
        const origin = normalizeOrigin(item);
        if (origin) set.add(origin);
    }
    return set;
}

const CORS_ALLOWED_ORIGINS = obterOrigensCorsPermitidas();

function setCorsHeaders(req, res) {
    appendVaryHeader(res, 'Origin');

    const origin = normalizeOrigin(req?.headers?.origin || '');
    if (!origin) return { allowed: true, origin: '' };

    const allowed = CORS_ALLOWED_ORIGINS.has(origin);
    if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            [
                'Content-Type',
                'Authorization',
                'X-Fin-MP-Access-Token',
                'X-Fin-MP-Webhook-Secret',
                'X-Fin-MP-Whatsapp-Numero',
                'X-MP-Access-Token',
                'X-MP-Webhook-Secret',
                'X-MP-Whatsapp-Numero'
            ].join(', ')
        );
    }
    return { allowed, origin };
}

function sendJson(res, statusCode, payload) {
    applySecurityHeaders(res);
    setCorsHeaders(res.__finReq, res);
    applyNoStoreHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
    applySecurityHeaders(res);
    setCorsHeaders(res.__finReq, res);
    applyNoStoreHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(text || ''));
}

function normalizarTelefone(telefone) {
    const digitos = String(telefone || '').replace(/\D/g, '');
    if (!digitos) return null;

    const base = digitos.startsWith('55') && digitos.length > 11
        ? digitos.slice(2)
        : digitos;

    if (base.length < 10) return null;

    return {
        area_code: base.slice(0, 2),
        number: base.slice(2)
    };
}

function parseJsonBody(req, limiteBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let body = '';
        let bytes = 0;

        req.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > limiteBytes) {
                reject(new Error('Corpo da requisicao excedeu o limite permitido.'));
                req.destroy();
                return;
            }
            body += chunk;
        });

        req.on('end', () => {
            if (!body.trim()) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (_) {
                reject(new Error('JSON invalido no corpo da requisicao.'));
            }
        });

        req.on('error', reject);
    });
}

function carregarWebhookStore() {
    if (!fs.existsSync(WEBHOOK_STORE_FILE)) {
        return { registros: {}, atualizadoEm: new Date().toISOString() };
    }

    try {
        const bruto = fs.readFileSync(WEBHOOK_STORE_FILE, 'utf-8');
        const lido = JSON.parse(bruto);
        if (!lido || typeof lido !== 'object') {
            return { registros: {}, atualizadoEm: new Date().toISOString() };
        }

        const registros = (lido.registros && typeof lido.registros === 'object') ? lido.registros : {};
        return {
            registros,
            atualizadoEm: String(lido.atualizadoEm || new Date().toISOString())
        };
    } catch (_) {
        return { registros: {}, atualizadoEm: new Date().toISOString() };
    }
}

function compactarWebhookStore(store) {
    const entradas = Object.values(store?.registros || {});
    if (entradas.length <= WEBHOOK_MAX_REGISTROS) return store;

    entradas.sort((a, b) => {
        const ta = new Date(a?.ultimoEventoEm || 0).getTime();
        const tb = new Date(b?.ultimoEventoEm || 0).getTime();
        return tb - ta;
    });

    const recentes = entradas.slice(0, WEBHOOK_MAX_REGISTROS);
    const registros = {};
    for (const item of recentes) {
        const chave = String(item?.externalReference || '').trim();
        if (!chave) continue;
        registros[chave] = item;
    }

    return {
        registros,
        atualizadoEm: new Date().toISOString()
    };
}

function salvarWebhookStore(store) {
    const normalizado = compactarWebhookStore({
        registros: store?.registros || {},
        atualizadoEm: new Date().toISOString()
    });

    fs.writeFileSync(WEBHOOK_STORE_FILE, JSON.stringify(normalizado, null, 2), 'utf-8');
    return normalizado;
}

function listarReferenciasAprovadasPendentes(store) {
    const itens = Object.values(store?.registros || {});
    return itens
        .filter(item => String(item?.status || '').toLowerCase() === 'approved' && !item?.acked)
        .sort((a, b) => {
            const ta = new Date(a?.ultimoEventoEm || 0).getTime();
            const tb = new Date(b?.ultimoEventoEm || 0).getTime();
            return tb - ta;
        });
}

function ackReferenciasNoStore(store, refs) {
    const entradas = Array.isArray(refs) ? refs : [];
    const unicos = [...new Set(entradas.map(valor => String(valor || '').trim()).filter(Boolean))];

    let acked = 0;
    for (const ref of unicos) {
        const item = store.registros?.[ref];
        if (!item) continue;
        if (String(item.status || '').toLowerCase() !== 'approved') continue;
        if (item.acked) continue;

        item.acked = true;
        item.ackEm = new Date().toISOString();
        acked += 1;
    }

    return { acked, refs: unicos };
}

function normalizarBaseUrl(candidato) {
    const texto = String(candidato || '').trim();
    if (!texto) return '';

    const invalido = texto.toLowerCase();
    if (invalido === 'null' || invalido === 'undefined') return '';

    try {
        const url = new URL(texto);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        return `${url.protocol}//${url.host}`;
    } catch (_) {
        return '';
    }
}

function extrairOrigemDoReferer(referer) {
    const texto = String(referer || '').trim();
    if (!texto) return '';

    try {
        const url = new URL(texto);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        return `${url.protocol}//${url.host}`;
    } catch (_) {
        return '';
    }
}

function obterBaseRetorno(req, dados = {}) {
    const protoForward = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
    const hostForward = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
    const hostHeader = String(req?.headers?.host || '').trim();

    const viaForward = (protoForward && hostForward) ? `${protoForward}://${hostForward}` : '';
    const viaHost = hostHeader ? `http://${hostHeader}` : '';

    const candidatos = [
        dados?.siteBaseUrl,
        req?.headers?.origin,
        extrairOrigemDoReferer(req?.headers?.referer),
        viaForward,
        viaHost,
        `http://localhost:${PORT}`
    ];

    for (const candidato of candidatos) {
        const normalizado = normalizarBaseUrl(candidato);
        if (normalizado) return normalizado;
    }

    return `http://localhost:${PORT}`;
}
function criarPayloadPreferencia(dados, baseRetorno) {
    const nome = String(dados?.nome || '').trim() || 'Cliente';
    const descricaoBruta = String(dados?.descricao || '').trim();
    const descricao = descricaoBruta || ('Mensalidade - ' + nome);

    const valor = Number(dados?.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error('Valor invalido para criacao da cobranca.');
    }

    const valorFinal = Number(valor.toFixed(2));
    const externalReference = String(dados?.id || Date.now());
    const baseSeguro = normalizarBaseUrl(baseRetorno) || ('http://localhost:' + PORT);
    const redirectWhatsappUrl = baseSeguro + '/api/mercadopago/redirect-whatsapp';

    const payload = {
        external_reference: externalReference,
        statement_descriptor: 'FINANCESAPP',
        items: [
            {
                title: descricao,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: valorFinal
            }
        ],
        back_urls: {
            success: redirectWhatsappUrl
        }
    };

    if (baseSeguro.startsWith('https://')) {
        payload.auto_return = 'approved';
    }

    const telefone = normalizarTelefone(dados?.telefone);
    if (telefone) {
        payload.payer = {
            first_name: nome,
            phone: telefone
        };
    }

    return { payload, valorFinal };
}

function gerarEmailPayerPix(dados = {}) {
    const bruto = String(dados?.email || '').trim();
    if (bruto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruto)) return bruto;

    const referencia = String(dados?.id || Date.now()).replace(/[^\w.-]/g, '').slice(0, 32) || 'cliente';
    // Mercado Pago valida dominio do e-mail; usar exemplo publico evita rejeicao do fallback.
    return `pix-${referencia}@example.com`;
}

function montarPayloadPixMercadoPago(dados, originBase) {
    const nome = String(dados?.nome || '').trim() || 'Cliente';
    const descricaoBruta = String(dados?.descricao || '').trim();
    const descricao = descricaoBruta || ('Mensalidade - ' + nome);

    const valor = Number(dados?.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error('Valor invalido para criacao do PIX.');
    }

    const valorFinal = Number(valor.toFixed(2));
    const externalReference = String(dados?.id || Date.now());
    const baseSeguro = normalizarBaseUrl(originBase) || ('http://localhost:' + PORT);
    const expiraEm = new Date(Date.now() + (30 * 60 * 1000)).toISOString(); // 30 min

    const payload = {
        transaction_amount: valorFinal,
        description: descricao,
        payment_method_id: 'pix',
        external_reference: externalReference,
        date_of_expiration: expiraEm,
        payer: {
            email: gerarEmailPayerPix(dados),
            first_name: nome
        }
    };

    if (baseSeguro.startsWith('https://')) {
        payload.notification_url = baseSeguro + '/api/mercadopago/webhook';
    }

    const telefone = normalizarTelefone(dados?.telefone);
    if (telefone) {
        payload.payer.phone = telefone;
    }

    return { payload, valorFinal };
}

function normalizarQrBase64MercadoPago(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    if (/^data:image\//i.test(texto)) return texto;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(texto)) {
        return 'data:image/png;base64,' + texto.replace(/\s+/g, '');
    }
    return '';
}

async function criarPixMercadoPago(dados, originBase, mpOverrides = null) {
    const accessToken = obterMpAccessToken(mpOverrides);
    if (!accessToken) {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN nao configurado no servidor.');
    }
    const tokenTeste = accessToken.startsWith('TEST-');

    const { payload, valorFinal } = montarPayloadPixMercadoPago(dados, originBase);

    const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `pix-${Date.now()}-${Math.random().toString(16).slice(2)}`
        },
        body: JSON.stringify(payload)
    });

    let dadosResposta = {};
    try {
        dadosResposta = await resposta.json();
    } catch (_) {
        dadosResposta = {};
    }

    if (!resposta.ok) {
        const detalhe = String(dadosResposta?.message || dadosResposta?.error || '').trim();
        const causas = Array.isArray(dadosResposta?.cause) ? dadosResposta.cause : [];
        const causaTexto = causas
            .map(item => String(item?.description || item?.message || item?.code || '').trim())
            .filter(Boolean)
            .join(' | ');

        if (tokenTeste && String(detalhe || '').toLowerCase() === 'internal_error') {
            throw new Error('PIX nativo do Mercado Pago nao esta disponivel com token TEST (sandbox). Use token APP_USR de conta BR com PIX habilitado ou use "Checkout Mercado Pago (QR do link)".');
        }

        throw new Error(causaTexto || detalhe || `Erro Mercado Pago PIX (${resposta.status}).`);
    }

    const txData = dadosResposta?.point_of_interaction?.transaction_data || {};
    const qrCode = String(txData?.qr_code || '').trim();
    const qrCodeBase64 = normalizarQrBase64MercadoPago(txData?.qr_code_base64);
    const ticketUrl = String(txData?.ticket_url || '').trim();

    if (!qrCode && !qrCodeBase64) {
        throw new Error('Mercado Pago nao retornou dados de QR PIX.');
    }

    return {
        paymentId: String(dadosResposta?.id || '').trim(),
        status: String(dadosResposta?.status || '').trim(),
        valor: valorFinal,
        qrCode,
        qrCodeBase64,
        ticketUrl
    };
}

async function criarPreferenciaMercadoPago(dados, originBase, mpOverrides = null) {
    const accessToken = obterMpAccessToken(mpOverrides);
    if (!accessToken) {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN nao configurado no servidor.');
    }

    const { payload, valorFinal } = criarPayloadPreferencia(dados, originBase);

    const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(16).slice(2)}`
        },
        body: JSON.stringify(payload)
    });

    let dadosResposta = {};
    try {
        dadosResposta = await resposta.json();
    } catch (_) {
        dadosResposta = {};
    }

    if (!resposta.ok) {
        const detalhe = String(dadosResposta?.message || dadosResposta?.error || '').trim();
        throw new Error(detalhe || `Erro Mercado Pago (${resposta.status}).`);
    }

    const urlPagamento = String(dadosResposta?.init_point || '').trim();
    if (!urlPagamento) {
        throw new Error('Mercado Pago retornou resposta sem init_point.');
    }

    return {
        preferenceId: dadosResposta.id,
        url: urlPagamento,
        sandboxUrl: dadosResposta.sandbox_init_point || '',
        valor: valorFinal
    };
}

function extrairPaymentIdDeNotificacao(payload, searchParams) {
    const candidatos = [
        payload?.data?.id,
        payload?.id,
        payload?.resource?.id,
        payload?.resource_id,
        searchParams?.get('data.id'),
        searchParams?.get('id'),
        searchParams?.get('payment_id'),
        searchParams?.get('collection_id')
    ];

    for (const candidato of candidatos) {
        const texto = String(candidato || '').trim();
        if (texto && /^\d+$/.test(texto)) return texto;
    }

    const resourceTexto = String(payload?.resource || '').trim();
    const matchResource = resourceTexto.match(/payments\/(\d+)/i);
    if (matchResource?.[1]) return matchResource[1];

    return '';
}

async function consultarPagamentoMercadoPago(paymentId, mpOverrides = null) {
    const accessToken = obterMpAccessToken(mpOverrides);
    if (!accessToken) {
        throw new Error('MERCADO_PAGO_ACCESS_TOKEN nao configurado no servidor.');
    }

    const id = String(paymentId || '').trim();
    if (!id) {
        throw new Error('Payment ID invalido para consulta.');
    }

    const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    let dados = {};
    try {
        dados = await resposta.json();
    } catch (_) {
        dados = {};
    }

    if (!resposta.ok) {
        const detalhe = String(dados?.message || dados?.error || '').trim();
        throw new Error(detalhe || `Falha ao consultar pagamento ${id} (${resposta.status}).`);
    }

    return dados;
}

function registrarPagamentoNoWebhookStore(pagamento) {
    const externalReference = String(pagamento?.external_reference || '').trim();
    if (!externalReference) {
        return {
            registrado: false,
            motivo: 'payment_sem_external_reference'
        };
    }

    const status = String(pagamento?.status || '').toLowerCase();
    const paymentId = String(pagamento?.id || '').trim();
    const agoraIso = new Date().toISOString();

    const store = carregarWebhookStore();
    const anterior = store.registros[externalReference] || {};
    const statusAnterior = String(anterior.status || '').toLowerCase();
    const paymentIdAnterior = String(anterior.paymentId || '').trim();
    const valorAnterior = Number(anterior.transactionAmount) || 0;
    const valorAtual = Number(pagamento?.transaction_amount) || 0;
    const aprovacaoAnterior = String(anterior.dateApproved || '');
    const aprovacaoAtual = String(pagamento?.date_approved || '');
    const ehNovoPagamento = Boolean(paymentId) && paymentId !== paymentIdAnterior;
    const mudouDetalheAprovacao = aprovacaoAnterior !== aprovacaoAtual || valorAnterior !== valorAtual;

    let acked = true;
    if (status === 'approved') {
        if (statusAnterior !== 'approved') {
            acked = false;
        } else if (ehNovoPagamento || mudouDetalheAprovacao) {
            // Novo evento aprovado para a mesma referencia precisa voltar como pendente.
            acked = false;
        } else {
            acked = Boolean(anterior.acked);
        }
    }

    store.registros[externalReference] = {
        externalReference,
        paymentId,
        status,
        statusDetail: String(pagamento?.status_detail || ''),
        transactionAmount: Number(pagamento?.transaction_amount) || 0,
        dateApproved: String(pagamento?.date_approved || ''),
        dateCreated: String(pagamento?.date_created || ''),
        ultimoEventoEm: agoraIso,
        acked,
        ackEm: acked ? String(anterior.ackEm || agoraIso) : ''
    };

    salvarWebhookStore(store);

    return {
        registrado: true,
        externalReference,
        paymentId,
        status,
        acked
    };
}

async function processarPagamentoPorId(paymentId, mpOverrides = null) {
    const pagamento = await consultarPagamentoMercadoPago(paymentId, mpOverrides);
    const resultado = registrarPagamentoNoWebhookStore(pagamento);

    return {
        paymentId: String(paymentId),
        status: String(pagamento?.status || ''),
        statusDetail: String(pagamento?.status_detail || ''),
        externalReference: String(pagamento?.external_reference || ''),
        valor: Number(pagamento?.transaction_amount) || 0,
        dateApproved: String(pagamento?.date_approved || ''),
        dateCreated: String(pagamento?.date_created || ''),
        registrado: Boolean(resultado?.registrado),
        acked: Boolean(resultado?.acked)
    };
}

function parseHeaderAssinaturaMercadoPago(headerValor) {
    const texto = String(headerValor || '').trim();
    if (!texto) return { ts: '', v1: '' };

    const partes = texto.split(',');
    let ts = '';
    let v1 = '';

    for (const parte of partes) {
        const [chaveRaw, valorRaw] = String(parte || '').split('=');
        const chave = String(chaveRaw || '').trim().toLowerCase();
        const valor = String(valorRaw || '').trim();

        if (chave === 'ts') ts = valor;
        if (chave === 'v1') v1 = valor.toLowerCase();
    }

    return { ts, v1 };
}

function criarManifestoAssinaturaMercadoPago(urlObj, requestId, ts) {
    const partes = [];

    const dataIdUrl = String(urlObj?.searchParams?.get('data.id') || '').trim();
    if (dataIdUrl) {
        partes.push(`id:${dataIdUrl.toLowerCase()};`);
    }

    const reqId = String(requestId || '').trim();
    if (reqId) {
        partes.push(`request-id:${reqId};`);
    }

    const timestamp = String(ts || '').trim();
    if (timestamp) {
        partes.push(`ts:${timestamp};`);
    }

    return partes.join('');
}

function validarAssinaturaWebhookMercadoPago(req, urlObj) {
    const webhookSecret = obterMpWebhookSecret();
    if (!webhookSecret) {
        return { ok: true, skipped: true, reason: 'secret_not_configured' };
    }

    const assinaturaHeader = req?.headers?.['x-signature'];
    const requestId = req?.headers?.['x-request-id'];
    const { ts, v1 } = parseHeaderAssinaturaMercadoPago(assinaturaHeader);

    if (!ts || !v1) {
        return { ok: false, reason: 'missing_signature_headers' };
    }

    const manifesto = criarManifestoAssinaturaMercadoPago(urlObj, requestId, ts);
    if (!manifesto) {
        return { ok: false, reason: 'invalid_manifest' };
    }

    const esperado = crypto
        .createHmac('sha256', webhookSecret)
        .update(manifesto)
        .digest('hex')
        .toLowerCase();

    const recebido = String(v1 || '').toLowerCase();
    if (!esperado || !recebido || esperado.length !== recebido.length) {
        return { ok: false, reason: 'invalid_signature' };
    }

    const ok = crypto.timingSafeEqual(Buffer.from(esperado, 'utf8'), Buffer.from(recebido, 'utf8'));
    if (!ok) {
        return { ok: false, reason: 'signature_mismatch' };
    }

    return { ok: true, skipped: false, reason: '' };
}
async function handleApi(req, res, urlObj) {
    applySecurityHeaders(res);
    const cors = setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        applyNoStoreHeaders(res);
        if (!cors.allowed) {
            res.writeHead(403);
            res.end();
            return true;
        }
        res.writeHead(204);
        res.end();
        return true;
    }

    if (req.method === 'GET' && urlObj.pathname === '/api/app-version') {
        const backend = obterInfoVersaoBackend();
        sendJson(res, 200, {
            ok: true,
            backend,
            serverTime: new Date().toISOString()
        });
        return true;
    }

    const nfceHandled = await handleNfceApiRoute({
        req,
        res,
        urlObj,
        sendJson,
        parseJsonBody
    });
    if (nfceHandled) return true;

    if (req.method === 'GET' && urlObj.pathname === '/api/mercadopago/status') {
        const store = carregarWebhookStore();
        const pendentes = listarReferenciasAprovadasPendentes(store);
        const mpOverrides = extrairCredenciaisMpOverride(req);
        const token = obterMpAccessToken(mpOverrides);
        const secret = obterMpWebhookSecret(mpOverrides);
        const whatsappNumero = obterMpWhatsappNumero(mpOverrides);

        sendJson(res, 200, {
            ok: true,
            tokenConfigured: Boolean(token),
            webhookSecretConfigured: Boolean(secret),
            webhookSignatureValidation: Boolean(secret),
            whatsappReceiptConfigured: Boolean(whatsappNumero),
            usingRequestOverrides: Boolean(mpOverrides.accessToken || mpOverrides.webhookSecret || mpOverrides.whatsappNumero),
            webhookStorePath: WEBHOOK_STORE_FILE,
            pendentesAprovados: pendentes.length
        });
        return true;
    }

    if (req.method === 'POST' && urlObj.pathname === '/api/mercadopago/preference') {
        try {
            const dados = await parseJsonBody(req);
            const baseRetorno = obterBaseRetorno(req, dados);
            const mpOverrides = extrairCredenciaisMpOverride(req);
            const resultado = await criarPreferenciaMercadoPago(dados, baseRetorno, mpOverrides);

            sendJson(res, 200, {
                ok: true,
                preferenceId: resultado.preferenceId,
                url: resultado.url,
                sandboxUrl: resultado.sandboxUrl,
                valor: resultado.valor
            });
        } catch (erro) {
            sendJson(res, 400, {
                ok: false,
                error: String(erro?.message || 'Erro ao gerar link de pagamento.')
            });
        }
        return true;
    }

    if (req.method === 'POST' && urlObj.pathname === '/api/mercadopago/pix') {
        try {
            const dados = await parseJsonBody(req);
            const baseRetorno = obterBaseRetorno(req, dados);
            const mpOverrides = extrairCredenciaisMpOverride(req);
            const resultado = await criarPixMercadoPago(dados, baseRetorno, mpOverrides);

            sendJson(res, 200, {
                ok: true,
                paymentId: resultado.paymentId,
                status: resultado.status,
                valor: resultado.valor,
                qrCode: resultado.qrCode,
                qrCodeBase64: resultado.qrCodeBase64,
                ticketUrl: resultado.ticketUrl
            });
        } catch (erro) {
            sendJson(res, 400, {
                ok: false,
                error: String(erro?.message || 'Erro ao gerar PIX Mercado Pago.')
            });
        }
        return true;
    }

    if (req.method === 'GET' && urlObj.pathname === '/api/mercadopago/comprovante') {
        try {
            const paymentId = extrairPaymentIdDeNotificacao({}, urlObj.searchParams);
            if (!paymentId) {
                sendText(res, 400, 'Informe payment_id, collection_id, id ou data.id.');
                return true;
            }

            const pagamento = await consultarPagamentoMercadoPago(paymentId);
            registrarPagamentoNoWebhookStore(pagamento);

            const baseRetorno = obterBaseRetorno(req, {});
            const logoUrl = baseRetorno + '/logo2.png';
            const html = construirHtmlComprovantePagamento(pagamento, { logoUrl });

            applySecurityHeaders(res);
            setCorsHeaders(req, res);
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store'
            });
            res.end(html);
        } catch (erro) {
            sendText(res, 500, String(erro?.message || 'Erro ao gerar comprovante.'));
        }
        return true;
    }
        if (req.method === 'GET' && urlObj.pathname === '/api/mercadopago/redirect-whatsapp') {
        try {
            const numeroDestino = obterMpWhatsappNumero();
            if (!numeroDestino) {
                sendText(res, 500, 'MERCADO_PAGO_WHATSAPP_NUMERO nao configurado no servidor.');
                return true;
            }

            const paymentId = extrairPaymentIdDeNotificacao({}, urlObj.searchParams);
            const baseRetorno = obterBaseRetorno(req, {});
            let mensagem = '';

            if (paymentId) {
                const pagamento = await consultarPagamentoMercadoPago(paymentId);
                registrarPagamentoNoWebhookStore(pagamento);
                const comprovanteUrl = construirUrlComprovante(baseRetorno, paymentId);
                mensagem = construirMensagemComprovanteWhatsapp(pagamento, { comprovanteUrl });
            } else {
                const statusFallback = String(urlObj.searchParams.get('status') || '').trim();
                mensagem = [
                    '*Comprovante Mercado Pago*',
                    'Status: ' + formatarStatusPagamentoTexto(statusFallback),
                    'Pagamento retornou sem payment_id no redirect.',
                    'Sistema: Finances'
                ].join('\n');
            }

            const destino = construirLinkWhatsappComprovante(numeroDestino, mensagem);
            applySecurityHeaders(res);
            setCorsHeaders(req, res);
            res.writeHead(302, {
                Location: destino,
                'Cache-Control': 'no-store'
            });
            res.end();
        } catch (erro) {
            sendText(res, 500, String(erro?.message || 'Erro ao redirecionar para WhatsApp.'));
        }
        return true;
    }

    if ((req.method === 'POST' || req.method === 'GET') && urlObj.pathname === '/api/mercadopago/webhook') {
        try {
            const assinatura = validarAssinaturaWebhookMercadoPago(req, urlObj);
            if (!assinatura.ok) {
                sendJson(res, 401, {
                    ok: false,
                    error: 'Assinatura webhook invalida.',
                    reason: assinatura.reason || 'invalid_signature'
                });
                return true;
            }
            let payload = {};
            if (req.method === 'POST') {
                try {
                    payload = await parseJsonBody(req);
                } catch (_) {
                    payload = {};
                }
            }

            const paymentId = extrairPaymentIdDeNotificacao(payload, urlObj.searchParams);
            if (!paymentId) {
                sendJson(res, 202, {
                    ok: true,
                    ignored: true,
                    motivo: 'payment_id_nao_encontrado_no_evento'
                });
                return true;
            }

            const resultado = await processarPagamentoPorId(paymentId);
            sendJson(res, 200, {
                ok: true,
                via: 'webhook',
                resultado
            });
        } catch (erro) {
            sendJson(res, 500, {
                ok: false,
                error: String(erro?.message || 'Erro ao processar webhook do Mercado Pago.')
            });
        }
        return true;
    }

    if (req.method === 'GET' && urlObj.pathname === '/api/mercadopago/confirm-payment') {
        try {
            const paymentId = String(urlObj.searchParams.get('id') || urlObj.searchParams.get('payment_id') || '').trim();
            if (!paymentId) {
                sendJson(res, 400, { ok: false, error: 'Informe id ou payment_id.' });
                return true;
            }

            const mpOverrides = extrairCredenciaisMpOverride(req);
            const resultado = await processarPagamentoPorId(paymentId, mpOverrides);
            sendJson(res, 200, {
                ok: true,
                via: 'confirm-payment',
                resultado
            });
        } catch (erro) {
            sendJson(res, 500, {
                ok: false,
                error: String(erro?.message || 'Erro ao confirmar pagamento no Mercado Pago.')
            });
        }
        return true;
    }

    if (req.method === 'GET' && urlObj.pathname === '/api/mercadopago/paid-refs') {
        const store = carregarWebhookStore();
        const refs = listarReferenciasAprovadasPendentes(store).map(item => ({
            externalReference: String(item.externalReference || ''),
            paymentId: String(item.paymentId || ''),
            valor: Number(item.transactionAmount) || 0,
            aprovadoEm: String(item.dateApproved || ''),
            status: String(item.status || '')
        }));

        sendJson(res, 200, {
            ok: true,
            refs
        });
        return true;
    }

    if (req.method === 'POST' && urlObj.pathname === '/api/mercadopago/ack') {
        try {
            const payload = await parseJsonBody(req);
            const refs = Array.isArray(payload?.refs) ? payload.refs : [];

            const store = carregarWebhookStore();
            const resultado = ackReferenciasNoStore(store, refs);
            salvarWebhookStore(store);

            sendJson(res, 200, {
                ok: true,
                acked: resultado.acked,
                refs: resultado.refs
            });
        } catch (erro) {
            sendJson(res, 400, {
                ok: false,
                error: String(erro?.message || 'Erro ao confirmar processamento de refs.')
            });
        }
        return true;
    }

    return false;
}

function decodePathnameSeguro(urlPath) {
    try {
        return decodeURIComponent(String(urlPath || '').split('?')[0]);
    } catch (_) {
        return null;
    }
}

function pathTemSegmentoSuspeito(pathname) {
    const texto = String(pathname || '');
    if (!texto) return false;
    if (texto.includes('\0')) return true;
    if (texto.includes('\\')) return true;

    const segmentos = texto.split('/').filter(Boolean);
    return segmentos.some(seg => seg === '.' || seg === '..');
}

function pathEhDotfile(pathname) {
    const texto = String(pathname || '');
    if (texto.startsWith('/.')) return true;
    const segmentos = texto.split('/').filter(Boolean);
    return segmentos.some(seg => seg.startsWith('.'));
}

function pathEhExplicitamenteBloqueado(pathname) {
    const texto = String(pathname || '').toLowerCase();
    const basename = path.posix.basename(texto);
    if (BLOCKED_STATIC_BASENAMES.has(basename)) return true;

    const ext = path.posix.extname(texto);
    if (BLOCKED_STATIC_EXTENSIONS.has(ext)) return true;

    return false;
}

function resolveArquivo(urlPath) {
    const pathname = decodePathnameSeguro(urlPath);
    if (!pathname || !pathname.startsWith('/')) return null;

    if (pathTemSegmentoSuspeito(pathname)) return null;
    if (pathname.includes('..')) return null;
    if (pathEhDotfile(pathname)) return null;
    if (pathEhExplicitamenteBloqueado(pathname)) return null;

    const semBarraInicial = pathname.replace(/^\/+/, '');
    const arquivoRelativo = semBarraInicial || 'index.html';
    const arquivoCompleto = path.resolve(ROOT_DIR, arquivoRelativo);
    const relativo = path.relative(ROOT_DIR, arquivoCompleto);

    if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) {
        // relativo vazio significa exatamente ROOT_DIR (pasta), tratado no serveStatic.
        if (relativo !== '') return null;
    }

    return arquivoCompleto;
}

function serveStatic(req, res, urlObj) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendText(res, 405, 'Metodo nao permitido.');
        return;
    }

    let arquivo = resolveArquivo(urlObj.pathname);
    if (!arquivo) {
        sendText(res, 404, 'Arquivo nao encontrado.');
        return;
    }

    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) {
        arquivo = path.join(arquivo, 'index.html');
    }

    if (!fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) {
        sendText(res, 404, 'Arquivo nao encontrado.');
        return;
    }

    const ext = path.extname(arquivo).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    applySecurityHeaders(res);
    const headers = { 'Content-Type': contentType };
    const basename = path.basename(arquivo).toLowerCase();

    if (ext === '.webmanifest') {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (basename === 'service-worker.js') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Service-Worker-Allowed'] = '/';
    } else if (basename === 'mercado_pago_webhooks.json') {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (ext === '.html') {
        headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
        res.end();
        return;
    }

    fs.createReadStream(arquivo).pipe(res);
}

const server = http.createServer(async (req, res) => {
    try {
        res.__finReq = req;
        const base = `http://${req.headers.host || `localhost:${PORT}`}`;
        const urlObj = new URL(req.url || '/', base);

        if (urlObj.pathname.startsWith('/api/')) {
            const handled = await handleApi(req, res, urlObj);
            if (!handled) sendJson(res, 404, { ok: false, error: 'Rota de API nao encontrada.' });
            return;
        }

        serveStatic(req, res, urlObj);
    } catch (erro) {
        sendJson(res, 500, {
            ok: false,
            error: String(erro?.message || 'Erro interno no servidor.')
        });
    }
});

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (!obterMpAccessToken()) {
        console.log('Aviso: MERCADO_PAGO_ACCESS_TOKEN nao configurado.');
    }
});














