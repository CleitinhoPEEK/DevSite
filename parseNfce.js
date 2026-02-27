const cheerio = require('cheerio');

const MESES_EXTENSO = Object.freeze({
    janeiro: '01',
    fevereiro: '02',
    marco: '03',
    abril: '04',
    maio: '05',
    junho: '06',
    julho: '07',
    agosto: '08',
    setembro: '09',
    outubro: '10',
    novembro: '11',
    dezembro: '12'
});

function limparEspacos(texto) {
    return String(texto || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizarLinha(texto) {
    return limparEspacos(String(texto || '').replace(/[\r\t]+/g, ' '));
}

function parseValorNumero(texto) {
    const bruto = String(texto || '').replace(/[^\d,.-]/g, '');
    if (!bruto) return null;

    const sinalNegativo = bruto.startsWith('-');
    const limpo = bruto.replace(/-/g, '');
    const idxVirgula = limpo.lastIndexOf(',');
    const idxPonto = limpo.lastIndexOf('.');
    const idxDecimal = Math.max(idxVirgula, idxPonto);

    let inteiro = limpo;
    let decimal = '';

    if (idxDecimal >= 0) {
        inteiro = limpo.slice(0, idxDecimal);
        decimal = limpo.slice(idxDecimal + 1);
    }

    inteiro = inteiro.replace(/[.,]/g, '');
    decimal = decimal.replace(/[.,]/g, '');

    if (!inteiro && !decimal) return null;

    const numero = Number(`${inteiro || '0'}${decimal ? `.${decimal}` : ''}`);
    if (!Number.isFinite(numero)) return null;
    return sinalNegativo ? -numero : numero;
}

function formatarMoedaBr(valor) {
    if (!Number.isFinite(valor)) return null;
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
}

function normalizarDataEmissao(texto) {
    const bruto = String(texto || '').trim();
    if (!bruto) return null;

    const matchNumerico = bruto.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (matchNumerico) {
        const [, dd, mm, yyyy, hh, mi, ss] = matchNumerico;
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
    }

    const textoNormalizado = bruto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const matchExtenso = textoNormalizado.match(
        /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/
    );
    if (!matchExtenso) return null;

    const dd = String(Number(matchExtenso[1]) || '').padStart(2, '0');
    const mm = MESES_EXTENSO[matchExtenso[2]] || '';
    const yyyy = matchExtenso[3] || '';
    const hh = matchExtenso[4] || '00';
    const mi = matchExtenso[5] || '00';
    const ss = matchExtenso[6] || '00';

    if (!dd || !mm || !yyyy) return null;
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

function extrairChaveAcessoDaQrUrl(qrUrl) {
    try {
        const url = new URL(String(qrUrl || '').trim());
        const p = String(url.searchParams.get('p') || '').trim();
        if (!p) return null;
        const primeiraParte = p.split('|')[0] || '';
        const apenasDigitos = primeiraParte.replace(/\D/g, '');
        if (apenasDigitos.length < 44) return null;
        return apenasDigitos.slice(0, 44);
    } catch (_) {
        return null;
    }
}

function extrairEstabelecimentoPorLinhas(linhas) {
    const lista = Array.isArray(linhas) ? linhas : [];
    const indiceCnpj = lista.findIndex(linha => /CNPJ\s*:?\s*/i.test(linha));
    if (indiceCnpj <= 0) return null;

    for (let i = indiceCnpj - 1; i >= 0; i -= 1) {
        const linha = normalizarLinha(lista[i]);
        if (!linha) continue;
        if (/^(chave de acesso|emiss[a\u00e3]o|valor|total|consulte|danfe|nfc-e|protocolo)/i.test(linha)) continue;
        if (/^\d{2}\/\d{2}\/\d{4}/.test(linha)) continue;
        if (/^[\d\s./-]+$/.test(linha)) continue;
        return linha;
    }

    return null;
}

function parseNfceHtml(html, qrUrl) {
    const $ = cheerio.load(String(html || ''));
    const textoBodyBruto = String(($('body').text() || $.root().text() || '')).replace(/\r/g, '\n');
    const textoNormalizado = limparEspacos(textoBodyBruto);
    const textoBusca = textoNormalizado
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const linhas = textoBodyBruto
        .split(/\n+/)
        .map(normalizarLinha)
        .filter(Boolean);

    const valorRegexes = [
        /Valor\s*a\s*pagar\s*R\$\s*:?\s*([0-9][0-9.,\s]*)/i,
        /TOTAL(?:\s+A\s+PAGAR)?\s*[:\-]?\s*R?\$?\s*([0-9][0-9.,\s]*)/i,
        /VALOR(?:\s+TOTAL)?\s*[:\-]?\s*R?\$?\s*([0-9][0-9.,\s]*)/i
    ];

    let valorRaw = null;
    for (const regex of valorRegexes) {
        const match = textoBusca.match(regex);
        if (match && match[1]) {
            valorRaw = match[1];
            break;
        }
    }

    const emissaoMatch = textoBusca.match(
        /Emiss[^:\d]{0,8}:\s*(\d{2}[\/-]\d{2}[\/-]\d{4}\s+\d{2}:\d{2}:\d{2}|\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i
    );
    const cnpjMatch = textoBusca.match(/CNPJ\s*:\s*([0-9./-]+)/i);
    const chaveMatch = textoBusca.match(/Chave de acesso\s*:?\s*([0-9\s]+)/i);

    const valor = parseValorNumero(valorRaw);
    const emissao = normalizarDataEmissao(emissaoMatch?.[1] || '');
    const cnpj = cnpjMatch?.[1] ? limparEspacos(cnpjMatch[1]) : null;

    let chaveAcesso = null;
    if (chaveMatch?.[1]) {
        const digits = String(chaveMatch[1]).replace(/\D/g, '');
        if (digits.length >= 44) chaveAcesso = digits.slice(0, 44);
    }
    if (!chaveAcesso) chaveAcesso = extrairChaveAcessoDaQrUrl(qrUrl);

    return {
        estabelecimento: extrairEstabelecimentoPorLinhas(linhas),
        cnpj: cnpj || null,
        emissao: emissao || null,
        valor: Number.isFinite(valor) ? valor : null,
        valorFormatado: Number.isFinite(valor) ? formatarMoedaBr(valor) : null,
        chaveAcesso: chaveAcesso || null
    };
}

module.exports = {
    parseNfceHtml,
    extrairChaveAcessoDaQrUrl
};
