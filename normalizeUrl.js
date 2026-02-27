const HOST_PERMITIDO_NFCE = 'www.fazenda.pr.gov.br';
const PATH_PERMITIDO_NFCE = '/nfce/qrcode';

function sanitizeRawText(rawText) {
    return String(rawText || '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .trim();
}

function cleanupCandidate(candidate) {
    return String(candidate || '')
        .replace(/\s+/g, '')
        .replace(/https?:\/\/https?:\/\//i, 'https://')
        .replace(/^http:\/\//i, 'https://')
        .replace(/gov\.b(?!r)/ig, 'gov.br')
        .replace(/[)\],;.'"`]+$/g, '');
}

function extractCandidateFromRaw(rawText) {
    const compact = sanitizeRawText(rawText).replace(/\s+/g, '');
    if (!compact) return '';

    const regex = /(?:https?:\/\/)?(?:www\.)?fazenda\.pr\.gov\.br\/nfce\/qrcode\?p=[^"'<>`]+/i;
    const hit = compact.match(regex);
    if (!hit || !hit[0]) return '';

    let candidate = cleanupCandidate(hit[0]);
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
    return candidate;
}

function normalizarParametroP(rawP) {
    const pTexto = String(rawP || '').trim();
    if (!pTexto) return null;

    const partes = pTexto.split('|');
    const chave = String(partes[0] || '').replace(/\D/g, '').slice(0, 44);
    if (chave.length !== 44) return null;

    const versao = String(partes[1] || '').replace(/\D/g, '') || '3';
    const tpAmb = String(partes[2] || '').replace(/\D/g, '') || '1';
    return `${chave}|${versao}|${tpAmb}`;
}

function normalizeNfceQrUrl(rawText) {
    const candidate = extractCandidateFromRaw(rawText);
    if (!candidate) return null;

    let urlObj = null;
    try {
        urlObj = new URL(candidate);
    } catch (_) {
        return null;
    }

    urlObj.protocol = 'https:';
    urlObj.hostname = HOST_PERMITIDO_NFCE;

    if (!String(urlObj.pathname || '').startsWith(PATH_PERMITIDO_NFCE)) {
        return null;
    }

    const pNormalizado = normalizarParametroP(urlObj.searchParams.get('p'));
    if (!pNormalizado) return null;

    urlObj.pathname = PATH_PERMITIDO_NFCE;
    urlObj.search = '';
    urlObj.searchParams.set('p', pNormalizado);
    return urlObj.toString();
}

function validarNfceQrUrlEstrita(qrUrl) {
    let urlObj = null;
    try {
        urlObj = new URL(String(qrUrl || '').trim());
    } catch (_) {
        return { ok: false, status: 400, error: 'qrUrl invalida.' };
    }

    if (urlObj.hostname !== HOST_PERMITIDO_NFCE) {
        return { ok: false, status: 400, error: 'Host nao permitido.' };
    }

    if (!String(urlObj.pathname || '').startsWith(PATH_PERMITIDO_NFCE)) {
        return { ok: false, status: 400, error: 'Path nao permitido.' };
    }

    const pNormalizado = normalizarParametroP(urlObj.searchParams.get('p'));
    if (!pNormalizado) {
        return { ok: false, status: 400, error: 'Parametro p ausente ou invalido.' };
    }

    urlObj.pathname = PATH_PERMITIDO_NFCE;
    urlObj.search = '';
    urlObj.searchParams.set('p', pNormalizado);
    return { ok: true, urlObj };
}

module.exports = {
    HOST_PERMITIDO_NFCE,
    PATH_PERMITIDO_NFCE,
    normalizeNfceQrUrl,
    validarNfceQrUrlEstrita
};

