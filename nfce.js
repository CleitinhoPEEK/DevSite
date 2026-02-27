const { parseNfceHtml, extrairChaveAcessoDaQrUrl } = require('../utils/parseNfce');
const {
    normalizeNfceQrUrl,
    validarNfceQrUrlEstrita
} = require('../utils/normalizeUrl');

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_NFCE = new Map();

function limparCacheExpirado() {
    const agora = Date.now();
    for (const [chave, item] of CACHE_NFCE.entries()) {
        if (!item || item.expiraEm <= agora) CACHE_NFCE.delete(chave);
    }
}

function lerCache(chave) {
    if (!chave) return null;
    limparCacheExpirado();
    const item = CACHE_NFCE.get(chave);
    if (!item || item.expiraEm <= Date.now()) return null;
    return item.payload || null;
}

function salvarCache(chave, payload) {
    if (!chave || !payload) return;
    CACHE_NFCE.set(chave, {
        expiraEm: Date.now() + CACHE_TTL_MS,
        payload
    });
}

async function fetchHtmlNfce(urlObj) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const resposta = await fetch(urlObj.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Finances-NFCE-Parser/1.0 (+https://localhost)'
            }
        });

        if (!resposta.ok) {
            const erro = new Error(`SEFA retornou ${resposta.status}.`);
            erro.statusCode = 502;
            throw erro;
        }

        return await resposta.text();
    } catch (erro) {
        const err = new Error('Falha ao consultar SEFA.');
        err.statusCode = 502;
        err.cause = erro;
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

function criarPayloadNulo(qrUrl, chaveAcesso = null) {
    return {
        estabelecimento: null,
        cnpj: null,
        emissao: null,
        valor: null,
        valorFormatado: null,
        chaveAcesso: chaveAcesso || null,
        fonte: {
            url: String(qrUrl || '')
        }
    };
}

async function handleNfceApiRoute({ req, res, urlObj, sendJson, parseJsonBody }) {
    if (req.method !== 'POST' || urlObj.pathname !== '/api/nfce/parse') return false;

    let body = {};
    try {
        body = await parseJsonBody(req);
    } catch (_) {
        sendJson(res, 400, { error: 'JSON invalido no corpo da requisicao.' });
        return true;
    }

    const qrUrlRaw = String(body?.qrUrl || '').trim();
    if (!qrUrlRaw) {
        sendJson(res, 400, { error: 'qrUrl obrigatoria.' });
        return true;
    }

    const qrUrlNormalizada = normalizeNfceQrUrl(qrUrlRaw);
    if (!qrUrlNormalizada) {
        sendJson(res, 400, { error: 'qrUrl invalida.' });
        return true;
    }

    const validacao = validarNfceQrUrlEstrita(qrUrlNormalizada);
    if (!validacao.ok) {
        sendJson(res, validacao.status || 400, { error: validacao.error || 'qrUrl invalida.' });
        return true;
    }

    const qrUrlFinal = validacao.urlObj.toString();
    const chaveHint = extrairChaveAcessoDaQrUrl(qrUrlFinal);
    if (chaveHint) {
        const cached = lerCache(chaveHint);
        if (cached) {
            sendJson(res, 200, {
                ...cached,
                fonte: {
                    url: qrUrlFinal
                }
            });
            return true;
        }
    }

    let html = '';
    try {
        html = await fetchHtmlNfce(validacao.urlObj);
    } catch (erro) {
        sendJson(res, 502, { error: String(erro?.message || 'Falha ao consultar SEFA.') });
        return true;
    }

    let payload = criarPayloadNulo(qrUrlFinal, chaveHint);
    try {
        const parsed = parseNfceHtml(html, qrUrlFinal);
        payload = {
            ...payload,
            ...parsed,
            chaveAcesso: parsed?.chaveAcesso || chaveHint || null
        };
    } catch (_) {
        // HTML inesperado: mantem payload com campos null e HTTP 200.
    }

    if (payload.chaveAcesso) {
        salvarCache(payload.chaveAcesso, payload);
    }

    sendJson(res, 200, payload);
    return true;
}

module.exports = {
    handleNfceApiRoute
};
