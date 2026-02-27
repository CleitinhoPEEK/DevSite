(function () {
  'use strict';

  const C = window.FinCommon;
  if (!C) return;
  const { getEl, formatarMoeda, formatarDataBr } = C;

  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const ZXING_LIB_URLS = [
    '/vendor/zxing.min.js',
    'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js',
    'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'
  ];
  const JSQR_LIB_URLS = [
    '/vendor/jsqr.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
    'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
  ];
  const BARCODE_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'itf', 'codabar', 'upc_a', 'upc_e'];
  const LIVE_SCAN_MS = 700;
  const LIVE_SCAN_DEDUP_MS = 2500;
  const MESES = { janeiro:1, fevereiro:2, marco:3, 'março':3, abril:4, maio:5, junho:6, julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12 };

  const st = {
    open: false,
    busy: false,
    stream: null,
    img: '',
    res: null,
    tessP: null,
    zxingP: null,
    jsqrP: null,
    detAllP: null,
    detQrP: null,
    liveTimer: null,
    liveBusy: false,
    lastCode: '',
    lastCodeAt: 0
  };

  function E() {
    return {
      m: getEl('modalEscanearDespesa'),
      v: getEl('scannerDespesaVideo'),
      c: getEl('scannerDespesaCanvas'),
      img: getEl('scannerDespesaImagem'),
      ph: getEl('scannerDespesaPlaceholder'),
      s: getEl('scannerDespesaStatus'),
      pf: getEl('scannerDespesaProgressoFill'),
      pt: getEl('scannerDespesaProgressoTexto'),
      pn: getEl('scannerDespesaPreviewNome'),
      pv: getEl('scannerDespesaPreviewValor'),
      pd: getEl('scannerDespesaPreviewData'),
      po: getEl('scannerDespesaPreviewOrigem'),
      tb: getEl('scannerDespesaTextoBruto'),
      bCam: getEl('btnScannerDespesaCamera'),
      bCode: getEl('btnScannerDespesaDetectarCodigo'),
      bFoto: getEl('btnScannerDespesaFoto'),
      bOcr: getEl('btnScannerDespesaOCR'),
      bAplicar: getEl('btnScannerDespesaAplicar'),
      inFile: getEl('inputScannerDespesaArquivo')
    };
  }

  function toast(msg, tipo) {
    try {
      if (typeof window.showToast === 'function') return void window.showToast(msg, tipo || 'info');
      if (typeof window.mostrarToast === 'function') return void window.mostrarToast(msg, tipo || 'info');
    } catch (_) {}
    alert((tipo === 'error' ? 'Erro: ' : '') + String(msg || ''));
  }
  function toError(err, fallbackMsg) {
    if (err instanceof Error) return err;
    const msg = String((err && err.message) || err || fallbackMsg || 'Erro inesperado').trim();
    return new Error(msg || String(fallbackMsg || 'Erro inesperado'));
  }
  function isUnsupportedCodeReaderError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return (
      msg.includes('leitura de qr/codigo nao suportada') ||
      msg.includes('não suportada neste navegador') ||
      msg.includes('nao suportada neste navegador')
    );
  }
  function vibrarOk() { try { if (navigator?.vibrate) navigator.vibrate(20); } catch (_) {} }
  function setStatus(msg, tipo) { const e = E(); if (!e.s) return; e.s.textContent = String(msg || ''); e.s.classList.remove('scanner-despesa-status--ok', 'scanner-despesa-status--erro'); if (tipo === 'ok') e.s.classList.add('scanner-despesa-status--ok'); if (tipo === 'erro') e.s.classList.add('scanner-despesa-status--erro'); }
  function setProg(p) { p = Math.max(0, Math.min(100, Number(p) || 0)); const e = E(); if (e.pf) e.pf.style.width = `${p}%`; if (e.pt) e.pt.textContent = `${Math.round(p)}%`; }

  function fmtIso(d) { d = d instanceof Date ? d : new Date(d); return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : ''; }
  function validDateParts(y, m, d) { y=+y; m=+m; d=+d; if (!(y>=2000&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=31)) return false; const dt = new Date(Date.UTC(y,m-1,d,12)); return dt.getUTCFullYear()===y && dt.getUTCMonth()+1===m && dt.getUTCDate()===d; }
  function isoFromParts(y, m, d) { return validDateParts(y,m,d) ? `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` : ''; }
  function defaultDate() {
    const el = getEl('dataVencimento');
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(el?.value || ''))) return el.value;
    try {
      if (typeof dataAtual !== 'undefined' && dataAtual instanceof Date && Number.isFinite(dataAtual.getTime())) {
        const now = new Date(), y = dataAtual.getFullYear(), m = dataAtual.getMonth(), last = new Date(y,m+1,0).getDate();
        return fmtIso(new Date(y,m,Math.min(now.getDate(), last)));
      }
    } catch (_) {}
    return fmtIso(new Date());
  }

  function norm(t) { return String(t || '').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim(); }
  function noAcc(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function cleanLine(t) { return String(t || '').replace(/\s+/g,' ').replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g,'').trim(); }
  function moneyNum(x) {
    let s = String(x || '').replace(/R\$/gi,'').replace(/\s+/g,'').replace(/[Oo](?=\d)/g,'0').replace(/[^\d,.-]/g,'');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
    else if ((s.match(/\./g)||[]).length > 1) { const p = s.split('.'); const d = p.pop(); s = `${p.join('')}.${d}`; }
    const n = Number(s); return Number.isFinite(n) ? n : NaN;
  }
  function sugCategoria(texto) {
    const t = noAcc(texto).toLowerCase();
    if (/(mercado|supermercado|restaurante|lanchonete|padaria|ifood|delivery)/.test(t)) return 'Alimentacao';
    if (/(posto|gasolina|combustivel|uber|99|taxi|pedagio|estacionamento)/.test(t)) return 'Transporte';
    if (/(luz|energia|agua|internet|telefone|celular|gas|aluguel|condominio)/.test(t)) return 'Utilidades';
    if (/(farmacia|drogaria|medic|clinica|hospital)/.test(t)) return 'Saude';
    return '';
  }
  function extValor(txt) {
    const linhas = norm(txt).split('\n').map(v=>v.trim()).filter(Boolean), cand = [];
    const r1 = /\b(?:TOTAL|VALOR(?:\s+TOTAL)?|TOTAL\s+A\s+PAGAR)\b.{0,40}?(R?\$?\s*\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|R?\$?\s*\d+[.,]\d{2}|R?\$?\s*\d{1,3}(?:\.\d{3})+\.\d{2})/gi;
    const r2 = /\b(?:R\$\s*)?(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|\d{1,3}(?:\.\d{3})+\.\d{2})\b/gi;
    linhas.forEach((l, i) => {
      let m;
      while ((m = r1.exec(l))) { const v = moneyNum(m[1]); if (Number.isFinite(v) && v > 0) cand.push({v, s:100-i}); }
      while ((m = r2.exec(l))) {
        const v = moneyNum(m[1]); if (!Number.isFinite(v) || v <= 0) continue;
        let s = 10 - i*0.1; if (/R\$/i.test(l)) s += 8; if (/TOTAL|VALOR/i.test(l)) s += 18; cand.push({v,s});
      }
    });
    if (!cand.length) return null; cand.sort((a,b)=>(b.s-a.s)||(b.v-a.v)); return Number(cand[0].v.toFixed(2));
  }
  function extData(txt) {
    const b = norm(txt), n = noAcc(b).toLowerCase();
    let m = b.match(/\b(?:data[:\s-]*)?(\d{2})[\/-](\d{2})[\/-](\d{4})\b/i); if (m) { const iso=isoFromParts(+m[3],+m[2],+m[1]); if (iso) return iso; }
    m = b.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (m) { const iso=isoFromParts(+m[1],+m[2],+m[3]); if (iso) return iso; }
    m = b.match(/\b(\d{2})-(\d{2})-(\d{4})\b/); if (m) { const iso=isoFromParts(+m[3],+m[2],+m[1]); if (iso) return iso; }
    m = n.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\b/); if (m) { const iso=isoFromParts(+m[3],MESES[m[2]],+m[1]); if (iso) return iso; }
    m = b.match(/\b(\d{2})\/(\d{4})\b/); if (m) { const iso=isoFromParts(+m[2],+m[1],1); if (iso) return iso; }
    return '';
  }
  function goodDesc(l) { l = cleanLine(l); if (!l || l.length < 3) return false; if (/^\d[\d\s./-]*$/.test(l)) return false; if (/^(CNPJ|CPF|NFC-E|CUPOM|DOCUMENTO|CHAVE|ITEM|QTD|TOTAL|VALOR|DATA)\b/i.test(l)) return false; return true; }
  function extNome(txt) {
    const ls = norm(txt).split('\n').map(cleanLine).filter(Boolean);
    for (const l of ls) { const m = l.match(/\b(?:EMPRESA|ESTABELECIMENTO)\s*:\s*(.+)$/i); if (m && goodDesc(m[1])) return cleanLine(m[1]); }
    const r = /\b(SUPERMERCADO|MERCADO|POSTO|RESTAURANTE|LANCHONETE|PADARIA|FARMACIA|DROGARIA|CONTA DE LUZ|ENERGIA|AGUA|INTERNET|ALUGUEL)\b/i;
    for (const l of ls) if (r.test(l) && goodDesc(l)) return l;
    return ls.find(goodDesc) || '';
  }
  function parseTxt(txt) {
    txt = norm(txt);
    const nome = extNome(txt);
    return { nome, valor: extValor(txt), data: extData(txt), categoriaSugerida: sugCategoria(`${nome}\n${txt}`), origem:'Foto (OCR)', codigoLido:'', textoBruto:txt };
  }

  function parseTlvPix(s) { const out = {}; s = String(s||'').replace(/\s+/g,'').trim(); let i = 0; while (i+4<=s.length) { const tag=s.slice(i,i+2), len=Number(s.slice(i+2,i+4)); if (!Number.isFinite(len)||len<0) break; const stp=i+4, en=stp+len; if (en>s.length) break; out[tag]=s.slice(stp,en); i=en; } return out; }
  function parsePix(raw) {
    const s = String(raw||'').replace(/\s+/g,'').trim(); if (!/^000201/.test(s)) return null;
    const t = parseTlvPix(s), nome = String(t['59']||'').trim(), cidade = String(t['60']||'').trim(), v = moneyNum(t['54']||'');
    return { nome: nome ? `PIX - ${nome}${cidade?` (${cidade})`:''}` : 'Despesa via PIX (QR)', valor: Number.isFinite(v)&&v>0 ? Number(v.toFixed(2)) : null, data:'', categoriaSugerida:'Transferencia / PIX', origem:'QR Code PIX', codigoLido:s, textoBruto:s };
  }
  function fatorBoletoData(f) {
    const n = Number(f); if (!Number.isFinite(n)||n<=0) return '';
    const c = [];
    const b1 = new Date(Date.UTC(1997,9,7,12)); const d1 = new Date(b1); d1.setUTCDate(d1.getUTCDate()+n); c.push(d1);
    if (n>=1000) { const b2 = new Date(Date.UTC(2025,1,22,12)); const d2 = new Date(b2); d2.setUTCDate(d2.getUTCDate()+(n-1000)); c.push(d2); }
    const ok = c.filter(d=>d.getUTCFullYear()>=2000&&d.getUTCFullYear()<=2100); if (!ok.length) return '';
    ok.sort((a,b)=>Math.abs(a.getTime()-Date.now())-Math.abs(b.getTime()-Date.now())); const d = ok[0];
    return isoFromParts(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
  }
  function linha47to44(d) { d = String(d||'').replace(/\D/g,''); if (d.length!==47) return ''; return d.slice(0,4)+d.slice(32,33)+d.slice(33,47)+d.slice(4,9)+d.slice(10,20)+d.slice(21,31); }
  function parseBoleto44(code, origem) {
    const b = String(code||'').replace(/\D/g,''); if (b.length!==44) return null;
    const cents = Number(b.slice(9,19)), valor = Number.isFinite(cents)&&cents>0 ? Number((cents/100).toFixed(2)) : null;
    return { nome:`Boleto bancario (${b.slice(0,3)})`, valor, data:fatorBoletoData(b.slice(5,9)), categoriaSugerida:'Boleto', origem:origem||'Codigo de barras', codigoLido:b, textoBruto:b };
  }
  function parseArrec48(code) {
    const d = String(code||'').replace(/\D/g,''); if (d.length!==48) return null;
    const b44 = d.slice(0,11)+d.slice(12,23)+d.slice(24,35)+d.slice(36,47); let valor = null;
    if (b44.length===44 && ['6','8'].includes(b44[0])) { const n = Number(b44.slice(4,15)); if (Number.isFinite(n)&&n>0) valor = Number((n/100).toFixed(2)); }
    return { nome:'Conta / Convenio (codigo de barras)', valor, data:'', categoriaSugerida:'Utilidades', origem:'Codigo de barras', codigoLido:d, textoBruto:d };
  }
  function valorFromUrl(raw) { try { const u = new URL(raw); for (const k of ['amount','valor','value','transaction_amount','v','total','vl']) { const v = moneyNum(u.searchParams.get(k)); if (Number.isFinite(v)&&v>0) return Number(v.toFixed(2)); } } catch (_) {} return null; }
  function nomeFromUrl(raw) { try { const u = new URL(raw); const host = String(u.hostname||'').replace(/^www\./i,''); if (/mercadopago/i.test(host)) return 'Pagamento via Mercado Pago (QR)'; if (/sefaz|nfe|nfce/i.test(host+u.pathname)) return 'Nota fiscal / NFC-e (QR)'; return `Despesa via QR (${host||'link'})`; } catch (_) { return 'Despesa via link/QR'; } }
  function hasNfceHintText(raw) {
    const txt = noAcc(String(raw || '')).toLowerCase();
    return /(nfc-?e|nfce|chave\s*de\s*acesso|fazenda\.pr\.gov|sefaz|consumidor|cupom\s*fiscal|documento\s*auxiliar)/.test(txt);
  }
  function extractNfceKeyFromText(raw) {
    const txt = String(raw || '');
    const matches = txt.match(/(?:\d[\s.-]*){44,}/g) || [];
    for (const m of matches) {
      const only = String(m || '').replace(/\D/g, '');
      if (only.length >= 44) return only.slice(0, 44);
    }
    const fallback = txt.replace(/\D/g, '');
    return fallback.length >= 44 ? fallback.slice(0, 44) : '';
  }
  function normalizeNfceQrUrl(rawText) {
    let txt = String(rawText || '');
    if (!txt) return null;
    txt = txt.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '');
    txt = txt.replace(/\s+/g, '');
    txt = txt.replace(/gov\.b(?!r)/ig, 'gov.br');
    const m = txt.match(/(?:https?:\/\/)?(?:www\.)?fazenda\.pr\.gov\.br\/nfce\/qrcode\?p=[^"'<>`]+/i);
    if (!m || !m[0]) {
      if (!hasNfceHintText(txt)) return null;
      const chave = extractNfceKeyFromText(txt);
      if (!chave || chave.length !== 44) return null;
      return `https://www.fazenda.pr.gov.br/nfce/qrcode?p=${chave}|3|1`;
    }
    let urlTxt = String(m[0] || '').replace(/[)\],;.'"`]+$/g, '');
    if (!/^https?:\/\//i.test(urlTxt)) urlTxt = `https://${urlTxt}`;
    urlTxt = urlTxt.replace(/^http:\/\//i, 'https://').replace(/https?:\/\/https?:\/\//i, 'https://');
    try {
      const u = new URL(urlTxt);
      if (String(u.hostname || '').toLowerCase() !== 'www.fazenda.pr.gov.br') return null;
      if (!String(u.pathname || '').startsWith('/nfce/qrcode')) return null;
      const pRaw = String(u.searchParams.get('p') || '').trim();
      if (!pRaw) return null;
      const parts = pRaw.split('|');
      const chave = String(parts[0] || '').replace(/\D/g, '').slice(0, 44);
      if (chave.length !== 44) return null;
      const versao = String(parts[1] || '').replace(/\D/g, '') || '3';
      const tpAmb = String(parts[2] || '').replace(/\D/g, '') || '1';
      u.protocol = 'https:';
      u.hostname = 'www.fazenda.pr.gov.br';
      u.pathname = '/nfce/qrcode';
      u.search = '';
      u.searchParams.set('p', `${chave}|${versao}|${tpAmb}`);
      return u.toString();
    } catch (_) {
      return null;
    }
  }
  function emissaoBrToIso(txt) {
    const m = String(txt || '').match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return '';
    const isoData = isoFromParts(+m[3], +m[2], +m[1]);
    if (!isoData) return '';
    return isoData;
  }
  async function parseNfceViaBackend(qrUrl) {
    const resposta = await fetch('/api/nfce/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrUrl })
    });
    let payload = null;
    try { payload = await resposta.json(); } catch (_) { payload = null; }
    if (!resposta.ok) {
      const detalhe = String(payload?.error || `HTTP ${resposta.status}`).trim();
      throw new Error(detalhe || 'Falha ao consultar NFC-e no servidor.');
    }
    return (payload && typeof payload === 'object') ? payload : {};
  }
  function mergeNfceNoResultado(base, dadosNfce, qrUrl, origem) {
    const baseObj = (base && typeof base === 'object') ? base : {};
    const valorNfce = Number(dadosNfce?.valor);
    const dataIso = emissaoBrToIso(dadosNfce?.emissao || '');
    const nomeNfce = String(dadosNfce?.estabelecimento || '').trim();
    const nome = nomeNfce || baseObj.nome || nomeFromUrl(qrUrl);
    const valor = Number.isFinite(valorNfce) && valorNfce > 0
      ? Number(valorNfce.toFixed(2))
      : (Number.isFinite(baseObj.valor) ? baseObj.valor : null);
    const categoria = baseObj.categoriaSugerida || 'Impostos / Nota';
    return {
      ...baseObj,
      nome: nome || 'NFC-e (Parana)',
      valor,
      data: dataIso || baseObj.data || '',
      categoriaSugerida: categoria,
      origem: `${origem || baseObj.origem || 'QR / codigo'} • NFC-e PR`,
      codigoLido: qrUrl,
      textoBruto: String(baseObj.textoBruto || baseObj.codigoLido || qrUrl)
    };
  }
  async function parseCode(raw, origem) {
    raw = String(raw||'').trim(); if (!raw) return null;
    const origemFinal = origem || 'QR / codigo';
    const nfceUrl = normalizeNfceQrUrl(raw);
    if (nfceUrl) {
      const baseNfce = { nome:nomeFromUrl(nfceUrl), valor:valorFromUrl(nfceUrl), data:'', categoriaSugerida:'Impostos / Nota', origem:origemFinal, codigoLido:nfceUrl, textoBruto:raw };
      try {
        setStatus('NFC-e detectada. Consultando dados da SEFA...');
        const dadosNfce = await parseNfceViaBackend(nfceUrl);
        return mergeNfceNoResultado(baseNfce, dadosNfce, nfceUrl, origemFinal);
      } catch (err) {
        console.warn('[escanear-despesa] nfce-backend', err);
        return baseNfce;
      }
    }
    const pix = parsePix(raw); if (pix) return pix;
    const d = raw.replace(/\D/g,'');
    if (d.length===47) { const p = parseBoleto44(linha47to44(d), 'Linha digitavel (boleto)'); if (p) return p; }
    if (d.length===44 && d[0] !== '8') { const p = parseBoleto44(d, origemFinal); if (p) return p; }
    if (d.length===48) { const p = parseArrec48(d); if (p) return p; }
    if (/^https?:\/\//i.test(raw)) return { nome:nomeFromUrl(raw), valor:valorFromUrl(raw), data:'', categoriaSugerida:/nfe|nfce|sefaz/i.test(raw)?'Impostos / Nota':'', origem:origemFinal, codigoLido:raw, textoBruto:raw };
    const p = parseTxt(raw); p.origem = origemFinal; p.codigoLido = raw; if (!p.nome) p.nome='Despesa lida por codigo'; return p;
  }

  function renderRes(r) {
    const e = E(); st.res = r || null;
    if (e.pn) e.pn.textContent = r?.nome || '-';
    if (e.pv) e.pv.textContent = Number.isFinite(r?.valor) ? formatarMoeda(r.valor) : '-';
    if (e.pd) e.pd.textContent = r?.data ? formatarDataBr(r.data) : '-';
    const origem = r ? (r.categoriaSugerida ? `${r.origem} • Sugestao: ${r.categoriaSugerida}` : (r.origem || '-')) : '-';
    if (e.po) e.po.textContent = origem;
    if (e.tb) e.tb.value = String(r?.textoBruto || r?.codigoLido || '');
    if (e.bAplicar) e.bAplicar.disabled = !(r && (r.nome || r.data || Number.isFinite(r.valor)));
  }
  function resetRes() { renderRes(null); setProg(0); setStatus('Pronto para escanear.'); }
  function resetMidia() { const e = E(); st.img=''; if (e.v) e.v.hidden = true; if (e.img) { e.img.hidden = true; e.img.removeAttribute('src'); } if (e.ph) e.ph.hidden = false; if (e.bOcr) e.bOcr.disabled = true; }
  function showVideo() { const e = E(); if (e.v) e.v.hidden = false; if (e.img) e.img.hidden = true; if (e.ph) e.ph.hidden = true; }
  function showImage(url) { const e = E(); if (e.v) e.v.hidden = true; if (e.img) { e.img.src = url; e.img.hidden = false; } if (e.ph) e.ph.hidden = true; if (e.bOcr) e.bOcr.disabled = !url || st.busy; }

  function stopLive() { if (st.liveTimer) { clearInterval(st.liveTimer); st.liveTimer = null; } st.liveBusy = false; }
  function stopCam() {
    stopLive();
    const e = E();
    if (st.stream?.getTracks) for (const t of st.stream.getTracks()) { try { t.stop(); } catch (_) {} }
    st.stream = null;
    if (e.v) { try { e.v.pause(); } catch (_) {} try { e.v.srcObject = null; } catch (_) {} e.v.hidden = true; }
  }

  async function loadTess() {
    if (window.Tesseract) return window.Tesseract;
    if (st.tessP) return st.tessP;
    st.tessP = new Promise((res, rej) => {
      const ex = document.querySelector('script[data-tesseract-despesa="1"]');
      if (ex) { ex.addEventListener('load',()=>res(window.Tesseract),{once:true}); ex.addEventListener('error',()=>rej(new Error('Falha ao carregar Tesseract.js.')),{once:true}); return; }
      const s = document.createElement('script');
      s.src = TESS_URL; s.async = true; s.defer = true; s.crossOrigin = 'anonymous'; s.dataset.tesseractDespesa = '1';
      s.onload = () => window.Tesseract ? res(window.Tesseract) : rej(new Error('Tesseract indisponivel apos carregamento.'));
      s.onerror = () => rej(new Error('Falha ao carregar Tesseract.js (CDN).'));
      document.head.appendChild(s);
    });
    return st.tessP;
  }
  function hasZxingReady() {
    return !!(window.ZXing && typeof window.ZXing.MultiFormatReader === 'function');
  }
  function hasJsQrReady() {
    return typeof window.jsQR === 'function';
  }
  function loadScriptOnce(src, attrName) {
    return new Promise((res, rej) => {
      const scripts = Array.from(document.querySelectorAll(`script[${attrName}="1"]`));
      const ex = scripts.find((s) => String(s.dataset?.srcKey || '') === String(src));
      if (ex) {
        if (ex.dataset.loaded === '1') return res();
        if (ex.dataset.failed === '1') return rej(new Error(`Falha anterior ao carregar: ${src}`));
        ex.addEventListener('load', () => res(), { once: true });
        ex.addEventListener('error', () => rej(new Error(`Falha ao carregar script: ${src}`)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.setAttribute(attrName, '1');
      s.dataset.srcKey = String(src);
      if (/^https?:\/\//i.test(src)) s.crossOrigin = 'anonymous';
      s.onload = () => { s.dataset.loaded = '1'; res(); };
      s.onerror = () => { s.dataset.failed = '1'; rej(new Error(`Falha ao carregar script: ${src}`)); };
      document.head.appendChild(s);
    });
  }
  async function loadZxing() {
    if (hasZxingReady()) return window.ZXing;
    if (st.zxingP) return st.zxingP;
    st.zxingP = (async () => {
      let lastErr = null;
      for (const src of ZXING_LIB_URLS) {
        try {
          await loadScriptOnce(src, 'data-zxing-despesa');
          if (hasZxingReady()) return window.ZXing;
          throw new Error(`ZXing carregou sem API valida: ${src}`);
        } catch (err) {
          lastErr = toError(err, `Falha ao carregar ZXing: ${src}`);
        }
      }
      throw toError(lastErr, 'Leitura de QR/codigo nao suportada neste navegador. Use foto (OCR).');
    })();
    try {
      return await st.zxingP;
    } catch (err) {
      st.zxingP = null;
      throw toError(err, 'Leitura de QR/codigo nao suportada neste navegador. Use foto (OCR).');
    }
  }
  async function loadJsQr() {
    if (hasJsQrReady()) return window.jsQR;
    if (st.jsqrP) return st.jsqrP;
    st.jsqrP = (async () => {
      let lastErr = null;
      for (const src of JSQR_LIB_URLS) {
        try {
          await loadScriptOnce(src, 'data-jsqr-despesa');
          if (hasJsQrReady()) return window.jsQR;
          throw new Error(`jsQR carregou sem API valida: ${src}`);
        } catch (err) {
          lastErr = toError(err, `Falha ao carregar jsQR: ${src}`);
        }
      }
      throw toError(lastErr, 'Leitura de QR indisponivel neste navegador.');
    })();
    try {
      return await st.jsqrP;
    } catch (err) {
      st.jsqrP = null;
      throw toError(err, 'Leitura de QR indisponivel neste navegador.');
    }
  }
  function getZxingFormats(preferQr) {
    const ZX = window.ZXing;
    const F = ZX?.BarcodeFormat;
    if (!F) return [];
    if (preferQr) return [F.QR_CODE].filter(Boolean);
    return [F.QR_CODE, F.EAN_13, F.EAN_8, F.CODE_128, F.CODE_39, F.ITF, F.CODABAR, F.UPC_A, F.UPC_E].filter(Boolean);
  }
  function mapZxingFormat(fmt) {
    const ZX = window.ZXing;
    const formatos = ZX?.BarcodeFormat;
    if (!formatos || typeof formatos !== 'object') return 'unknown';
    for (const [nome, valor] of Object.entries(formatos)) {
      if (valor === fmt) return String(nome || 'unknown').toLowerCase();
    }
    return 'unknown';
  }
  function canvasFromSource(src) {
    if (!src) return null;
    if (src instanceof HTMLCanvasElement) return src;
    const e = E();
    const out = (e.c instanceof HTMLCanvasElement) ? e.c : document.createElement('canvas');
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    if (src instanceof HTMLVideoElement) {
      const w = src.videoWidth || 0, h = src.videoHeight || 0;
      if (!w || !h) return null;
      out.width = w; out.height = h; ctx.drawImage(src, 0, 0, w, h); return out;
    }
    if (src instanceof HTMLImageElement) {
      const w = src.naturalWidth || src.width || 0, h = src.naturalHeight || src.height || 0;
      if (!w || !h) return null;
      out.width = w; out.height = h; ctx.drawImage(src, 0, 0, w, h); return out;
    }
    return null;
  }
  function upscaleCanvas(base, scale) {
    const factor = Number(scale) || 1;
    if (!(base instanceof HTMLCanvasElement) || factor <= 1) return base;
    const w = base.width || 0, h = base.height || 0; if (!w || !h) return base;
    const c = document.createElement('canvas');
    c.width = Math.round(w * factor); c.height = Math.round(h * factor);
    const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return base;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, c.width, c.height);
    return c;
  }
  function cloneCanvas(base) {
    if (!(base instanceof HTMLCanvasElement)) return null;
    const c = document.createElement('canvas');
    c.width = base.width || 0;
    c.height = base.height || 0;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(base, 0, 0);
    return c;
  }
  function cropCanvas(base, x, y, w, h) {
    if (!(base instanceof HTMLCanvasElement)) return null;
    const bw = base.width || 0, bh = base.height || 0;
    if (!bw || !bh) return null;
    const cx = Math.max(0, Math.min(bw - 1, Math.floor(Number(x) || 0)));
    const cy = Math.max(0, Math.min(bh - 1, Math.floor(Number(y) || 0)));
    const cw = Math.max(1, Math.min(bw - cx, Math.floor(Number(w) || bw)));
    const ch = Math.max(1, Math.min(bh - cy, Math.floor(Number(h) || bh)));
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(base, cx, cy, cw, ch, 0, 0, cw, ch);
    return c;
  }
  function rotateCanvas(base, deg) {
    if (!(base instanceof HTMLCanvasElement)) return null;
    const angle = ((Number(deg) || 0) % 360 + 360) % 360;
    if (![90, 180, 270].includes(angle)) return cloneCanvas(base);
    const w = base.width || 0, h = base.height || 0;
    if (!w || !h) return null;
    const c = document.createElement('canvas');
    if (angle === 180) { c.width = w; c.height = h; } else { c.width = h; c.height = w; }
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(base, -w / 2, -h / 2);
    return c;
  }
  function runCanvasFilter(base, cfg) {
    const c = cloneCanvas(base);
    if (!(c instanceof HTMLCanvasElement)) return null;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const contrast = Number(cfg?.contrast) || 1;
    const threshold = Number(cfg?.threshold);
    const useThreshold = Number.isFinite(threshold);
    const invert = !!cfg?.invert;
    for (let i = 0; i < d.length; i += 4) {
      const y = (0.299 * d[i]) + (0.587 * d[i + 1]) + (0.114 * d[i + 2]);
      let v = ((y - 128) * contrast) + 128;
      if (useThreshold) v = v >= threshold ? 255 : 0;
      if (invert) v = 255 - v;
      v = Math.max(0, Math.min(255, v));
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function buildZxingAttemptCanvases(base, preferQr) {
    const out = [];
    const seen = new Set();
    const push = (c, tag) => {
      if (!(c instanceof HTMLCanvasElement)) return;
      const w = c.width || 0, h = c.height || 0;
      if (!w || !h) return;
      if (w < 60 || h < 60) return;
      const key = `${w}x${h}:${tag || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(c);
    };
    push(base, 'base');
    const w = base.width || 0, h = base.height || 0;
    if (!w || !h) return out;

    if (Math.min(w, h) < 900) push(upscaleCanvas(base, 2), 'up2');
    if (Math.min(w, h) < 500) push(upscaleCanvas(base, 3), 'up3');

    push(runCanvasFilter(base, { contrast: 1.4 }), 'gray-c14');
    push(runCanvasFilter(base, { contrast: 1.8 }), 'gray-c18');
    push(runCanvasFilter(base, { contrast: 2.2, threshold: 135 }), 'bin-135');
    push(runCanvasFilter(base, { contrast: 2.2, threshold: 110 }), 'bin-110');
    push(runCanvasFilter(base, { contrast: 2.2, threshold: 145, invert: true }), 'bin-inv');

    if (h > w * 1.15) {
      push(cropCanvas(base, 0, Math.floor(h * 0.28), w, Math.floor(h * 0.72)), 'bottom-72');
      push(cropCanvas(base, 0, Math.floor(h * 0.40), w, Math.floor(h * 0.60)), 'bottom-60');
    }
    push(cropCanvas(base, Math.floor(w * 0.12), Math.floor(h * 0.12), Math.floor(w * 0.76), Math.floor(h * 0.76)), 'center-76');

    if (preferQr) {
      const baseRot = cloneCanvas(base);
      push(rotateCanvas(baseRot, 90), 'rot90');
      push(rotateCanvas(baseRot, 270), 'rot270');
      const bin = runCanvasFilter(base, { contrast: 2.1, threshold: 128 });
      push(rotateCanvas(bin, 90), 'bin-rot90');
      push(rotateCanvas(bin, 270), 'bin-rot270');
    }

    return out;
  }
  function decodeCanvasWithZxing(canvas, preferQr) {
    const ZX = window.ZXing;
    if (!ZX || !(canvas instanceof HTMLCanvasElement)) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const source = new ZX.RGBLuminanceSource(img.data, img.width, img.height);
    const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(source));
    const reader = new ZX.MultiFormatReader();
    const hints = new Map();
    const formats = getZxingFormats(preferQr);
    if (formats.length) hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZX.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    try {
      const result = reader.decode(bitmap);
      const rawValue = String(result?.getText?.() || '').trim();
      if (!rawValue) return null;
      return { rawValue, format: mapZxingFormat(result?.getBarcodeFormat?.()) };
    } catch (err) {
      const nome = String(err?.name || '').toLowerCase();
      if (nome.includes('notfound')) return null;
      return null;
    } finally {
      try { if (typeof reader.reset === 'function') reader.reset(); } catch (_) {}
    }
  }
  async function detectFromZxing(src, preferQr) {
    await loadZxing();
    const base = canvasFromSource(src);
    if (!base) return null;
    const tentativas = buildZxingAttemptCanvases(base, !!preferQr);
    for (const c of tentativas) {
      const hit = decodeCanvasWithZxing(c, preferQr);
      if (hit?.rawValue) return hit;
    }
    return null;
  }
  function decodeCanvasWithJsQr(canvas) {
    if (!(canvas instanceof HTMLCanvasElement) || typeof window.jsQR !== 'function') return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    let img = null;
    try {
      img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_) {
      return null;
    }
    if (!img || !img.data || !img.width || !img.height) return null;
    try {
      const result = window.jsQR(new Uint8ClampedArray(img.data), img.width, img.height, {
        inversionAttempts: 'attemptBoth'
      });
      const rawValue = String(result?.data || '').trim();
      return rawValue ? { rawValue, format: 'qr_code' } : null;
    } catch (_) {
      return null;
    }
  }
  async function detectFromJsQr(src) {
    await loadJsQr();
    const base = canvasFromSource(src);
    if (!base) return null;
    const tentativas = buildZxingAttemptCanvases(base, true);
    for (const c of tentativas) {
      const hit = decodeCanvasWithJsQr(c);
      if (hit?.rawValue) return hit;
    }
    return null;
  }
  async function getDetAll() {
    if (!('BarcodeDetector' in window)) return null;
    if (st.detAllP) return st.detAllP;
    st.detAllP = (async () => {
      let formats = BARCODE_FORMATS.slice();
      try { if (typeof window.BarcodeDetector.getSupportedFormats === 'function') { const sup = await window.BarcodeDetector.getSupportedFormats(); if (Array.isArray(sup)&&sup.length) { const set = new Set(sup); const inter = BARCODE_FORMATS.filter(f=>set.has(f)); formats = inter.length ? inter : sup; } } } catch (_) {}
      try { return new window.BarcodeDetector({ formats }); } catch (_) { try { return new window.BarcodeDetector(); } catch (__){ return null; } }
    })();
    return st.detAllP;
  }
  async function getDetQr() {
    if (!('BarcodeDetector' in window)) return null;
    if (st.detQrP) return st.detQrP;
    st.detQrP = (async () => { try { return new window.BarcodeDetector({ formats:['qr_code'] }); } catch (_) { return getDetAll(); } })();
    return st.detQrP;
  }
  async function detectFrom(src, preferQr) {
    const det = preferQr ? await getDetQr() : await getDetAll();
    if (det?.detect) {
      try {
        const list = await det.detect(src);
        if (Array.isArray(list) && list.length) {
          const hit = list.find(x=>String(x?.rawValue||'').trim()) || list[0];
          const rawValue = String(hit?.rawValue||'').trim();
          if (rawValue) return { rawValue, format: String(hit?.format || 'unknown') };
        }
      } catch (_) {}
    }
    try {
      const zHit = await detectFromZxing(src, preferQr);
      if (zHit?.rawValue) return zHit;
    } catch (err) {
      if (!det?.detect) throw toError(err, 'Leitura de QR/codigo nao suportada neste navegador. Use foto (OCR).');
    }
    if (preferQr) {
      try {
        const qHit = await detectFromJsQr(src);
        if (qHit?.rawValue) return qHit;
      } catch (err) {
        if (!det?.detect) throw toError(err, 'Leitura de QR/codigo nao suportada neste navegador. Use foto (OCR).');
      }
    }
    if (!det?.detect) throw new Error('Leitura de QR/codigo nao suportada neste navegador. Use foto (OCR).');
    return null;
  }
  function drawFrame() {
    const e = E();
    if (!(e.v instanceof HTMLVideoElement) || !(e.c instanceof HTMLCanvasElement)) return null;
    const w = e.v.videoWidth || 0, h = e.v.videoHeight || 0; if (!w || !h) return null;
    e.c.width = w; e.c.height = h; const ctx = e.c.getContext('2d'); if (!ctx) return null; ctx.drawImage(e.v,0,0,w,h); return e.c;
  }
  function dataUrlToImg(url) { return new Promise((res,rej)=>{ const img = new Image(); img.onload=()=>res(img); img.onerror=()=>rej(new Error('Imagem invalida.')); img.src = url; }); }

  function lockUi(locked) {
    const e = E();
    if (locked) { [e.bCam,e.bCode,e.bFoto,e.bOcr,e.bAplicar].forEach(b=>{ if (b) b.disabled = true; }); return; }
    if (e.bCam) e.bCam.disabled = false;
    if (e.bCode) e.bCode.disabled = false;
    if (e.bFoto) e.bFoto.disabled = false;
    if (e.bOcr) e.bOcr.disabled = !st.img;
    if (e.bAplicar) e.bAplicar.disabled = !(st.res && (st.res.nome || st.res.data || Number.isFinite(st.res.valor)));
  }

  async function handleDetected(raw, format, auto) {
    const origem = format && format !== 'unknown' ? `QR / Codigo (${format})` : 'QR / Codigo';
    const r = await parseCode(raw, origem);
    renderRes(r);
    if (r && (r.nome || r.data || Number.isFinite(r.valor))) {
      vibrarOk();
      setStatus(auto ? 'Codigo detectado automaticamente.' : 'Codigo lido com sucesso.', 'ok');
      toast('Codigo lido com sucesso. Revise e aplique na despesa.', 'success');
    } else {
      setStatus('Codigo lido, mas sem dados suficientes para preencher.', 'erro');
      toast('Codigo detectado, mas nao foi possivel extrair nome/valor/data.', 'error');
    }
  }

  function startLiveScan() {
    stopLive();
    if (!st.open || !st.stream) return;
    setStatus('Camera pronta. Aponte para o QR/codigo (deteccao automatica ativa).', 'ok');
    st.liveTimer = setInterval(async () => {
      if (!st.open || !st.stream || st.busy || st.liveBusy) return;
      const e = E(); if (!e.v || e.v.hidden || !e.v.videoWidth) return;
      st.liveBusy = true;
      try {
        const frame = drawFrame(); if (!frame) return;
        const hit = await detectFrom(frame, true); if (!hit?.rawValue) return;
        const raw = String(hit.rawValue).trim(), now = Date.now();
        if (st.lastCode === raw && (now - st.lastCodeAt) < LIVE_SCAN_DEDUP_MS) return;
        st.lastCode = raw; st.lastCodeAt = now;
        await handleDetected(raw, hit.format || 'qr_code', true);
      } catch (_) {
        // silencioso no modo contínuo
      } finally {
        st.liveBusy = false;
      }
    }, LIVE_SCAN_MS);
  }

  async function startCam() {
    const e = E();
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('Camera nao suportada. Use foto/galeria.', 'erro'); toast('Camera nao suportada neste dispositivo.', 'error'); return false; }
    stopCam(); setStatus('Abrindo camera...');
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720} } });
      if (e.v) { e.v.srcObject = st.stream; showVideo(); try { await e.v.play(); } catch (_) {} }
      startLiveScan();
      return true;
    } catch (err) {
      const n = String(err?.name || err || '');
      if (/NotAllowedError|PermissionDeniedError/i.test(n)) { setStatus('Permissao da camera negada. Use foto/galeria.', 'erro'); toast('Permissao da camera negada. Use a galeria/foto.', 'error'); }
      else { setStatus('Falha ao abrir camera. Use foto/galeria.', 'erro'); toast('Nao foi possivel abrir a camera.', 'error'); }
      return false;
    }
  }

  async function scanCodeCameraManual() {
    const e = E(); if (e.bCode) e.bCode.disabled = true;
    try {
      if (!st.stream) { const ok = await startCam(); if (!ok) return; }
      setStatus('Lendo QR/codigo...');
      const frame = drawFrame(); if (!frame) throw new Error('Ainda sem imagem da camera. Tente novamente.');
      const hit = await detectFrom(frame, false); if (!hit) throw new Error('Nenhum QR/codigo de barras detectado.');
      await handleDetected(hit.rawValue, hit.format, false);
    } catch (err) {
      console.error('[escanear-despesa] camera-code', err); setStatus(err?.message || 'Falha ao ler codigo.', 'erro'); toast(err?.message || 'Falha ao ler QR/codigo.', 'error');
    } finally {
      if (e.bCode) e.bCode.disabled = false;
      if (st.stream) startLiveScan();
    }
  }

  function chooseImage() { const e = E(); if (!(e.inFile instanceof HTMLInputElement)) return toast('Campo de arquivo nao encontrado.', 'error'); e.inFile.value = ''; e.inFile.click(); }
  function fileToDataUrl(file) { return new Promise((res,rej)=>{ const r = new FileReader(); r.onload=()=>res(String(r.result||'')); r.onerror=()=>rej(new Error('Nao foi possivel ler a imagem.')); r.readAsDataURL(file); }); }
  async function onImageFile(ev) {
    const file = ev?.target?.files?.[0] || null; if (!file) return;
    if (!/^image\//i.test(String(file.type||''))) return toast('Selecione uma imagem valida.', 'error');
    try {
      stopCam(); setStatus('Carregando imagem...');
      const url = await fileToDataUrl(file); if (!/^data:image\//i.test(url)) throw new Error('Imagem invalida.');
      st.img = url; showImage(url); setProg(0); setStatus('Imagem pronta. O app tentara QR/codigo primeiro e OCR depois.', 'ok');
      try { await processarImagem({ auto:true, silentNoCode:true, silentNoOcrToast:true }); } catch (_) {}
    } catch (err) {
      console.error('[escanear-despesa] file', err); setStatus(err?.message || 'Falha ao carregar imagem.', 'erro'); toast(err?.message || 'Falha ao carregar imagem.', 'error');
    }
  }
  async function detectCodeFromSelectedImage() {
    if (!st.img) return toast('Selecione/capture uma imagem antes.', 'error');
    const e = E(); if (e.bCode) e.bCode.disabled = true;
    try {
      setStatus('Detectando QR/codigo na imagem...');
      const img = await dataUrlToImg(st.img); const hit = await detectFrom(img, false);
      if (!hit) throw new Error('Nenhum QR/codigo de barras encontrado na imagem.');
      await handleDetected(hit.rawValue, hit.format, true);
    } catch (rawErr) {
      const err = toError(rawErr, 'Falha ao ler codigo na imagem.');
      if (isUnsupportedCodeReaderError(err) || /zxing|falha ao carregar script|carregar zxing/i.test(err.message || '')) {
        setStatus('Leitura de QR/codigo indisponivel. Iniciando OCR da imagem...');
        await runOcr({ embedded: false, silentNoOcrToast: false });
        return;
      }
      console.error('[escanear-despesa] image-code', err); setStatus(err.message || 'Falha ao ler codigo na imagem.', 'erro'); toast(err.message || 'Falha ao ler codigo na imagem.', 'error');
    } finally { if (e.bCode) e.bCode.disabled = false; }
  }

  function ocrStatusLabel(s) {
    s = String(s || '').toLowerCase();
    if (s.includes('loading language')) return 'Carregando idioma (portugues)...';
    if (s.includes('loading tesseract core')) return 'Carregando motor OCR...';
    if (s.includes('initializing tesseract')) return 'Inicializando OCR...';
    if (s.includes('initializing api')) return 'Preparando OCR...';
    if (s.includes('recognizing text')) return 'Processando';
    if (s.includes('loading')) return 'Carregando OCR...';
    return `OCR: ${s}`;
  }

  async function runOcr(opts) {
    opts = Object.assign({ embedded:false, silentNoOcrToast:false }, opts || {});
    if (!st.img) { if (!opts.embedded) toast('Selecione ou capture uma imagem antes do OCR.', 'error'); return; }
    if (st.busy && !opts.embedded) return;
    if (!opts.embedded) { st.busy = true; lockUi(true); stopCam(); setProg(1); setStatus('Preparando OCR...'); }
    try {
      await loadTess();
      if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') throw new Error('Tesseract.js indisponivel neste navegador.');
      const ret = await window.Tesseract.recognize(st.img, 'por', { logger: (m) => {
        if (!m) return;
        const p = typeof m.progress === 'number' ? Math.round(m.progress * 100) : null;
        if (p != null) setProg(p);
        if (m.status) {
          const lbl = ocrStatusLabel(m.status);
          if (lbl === 'Processando' && p != null) setStatus(`Processando ${p}%...`);
          else if (p != null && !/^OCR:/i.test(lbl)) setStatus(`${lbl} ${p}%`);
          else setStatus(lbl);
        }
      }});
      const txt = String(ret?.data?.text || ''); if (!txt.trim()) throw new Error('Nao foi possivel extrair texto da imagem.');
      let r = parseTxt(txt);
      const nfceUrl = normalizeNfceQrUrl(txt);
      if (nfceUrl) {
        try {
          setStatus('NFC-e detectada no OCR. Consultando dados da SEFA...');
          const dadosNfce = await parseNfceViaBackend(nfceUrl);
          r = mergeNfceNoResultado(r, dadosNfce, nfceUrl, 'Foto (OCR)');
        } catch (err) {
          console.warn('[escanear-despesa] nfce-ocr', err);
          r.codigoLido = nfceUrl;
          r.textoBruto = txt;
        }
      }
      renderRes(r); setProg(100);
      if (r && (r.nome || r.data || Number.isFinite(r.valor))) { vibrarOk(); setStatus('OCR concluido com sucesso. Revise e aplique.', 'ok'); if (!opts.silentNoOcrToast) toast('OCR concluido. Revise e aplique na despesa.', 'success'); }
      else { setStatus('OCR concluido, mas sem campos reconhecidos.', 'erro'); if (!opts.silentNoOcrToast) toast('OCR concluido, mas nao encontrou nome/valor/data.', 'error'); }
    } catch (rawErr) {
      const err = toError(rawErr, 'Falha no OCR.');
      console.error('[escanear-despesa] ocr', err); setStatus(err.message || 'Falha no OCR.', 'erro'); setProg(0); if (!opts.silentNoOcrToast) toast(err.message || 'Falha ao processar foto via OCR.', 'error');
    } finally {
      if (!opts.embedded) { st.busy = false; lockUi(false); }
    }
  }

  async function processarImagem(opts) {
    opts = Object.assign({ auto:false, silentNoCode:false, silentNoOcrToast:false }, opts || {});
    if (!st.img) { if (!opts.auto) toast('Selecione ou capture uma imagem antes de processar.', 'error'); return; }
    if (st.busy) return;
    st.busy = true; lockUi(true); stopCam();
    try {
      const img = await dataUrlToImg(st.img);
      setProg(1); setStatus('Detectando QR Code na imagem...');
      try {
        const qr = await detectFrom(img, true);
        if (qr?.rawValue) { setProg(100); await handleDetected(qr.rawValue, qr.format || 'qr_code', true); return; }
      } catch (_) {}
      setProg(5); setStatus('QR nao encontrado. Detectando codigo de barras...');
      try {
        const bar = await detectFrom(img, false);
        if (bar?.rawValue) { setProg(100); await handleDetected(bar.rawValue, bar.format || 'unknown', true); return; }
      } catch (_) {}
      if (!opts.silentNoCode) setStatus('Nenhum QR/codigo encontrado. Iniciando OCR...');
      setProg(8);
      await runOcr({ embedded:true, silentNoOcrToast:opts.silentNoOcrToast });
    } catch (err) {
      console.error('[escanear-despesa] processarImagem', err); setStatus(err?.message || 'Falha ao processar imagem.', 'erro'); setProg(0); if (!opts.auto) toast(err?.message || 'Falha ao processar imagem.', 'error');
    } finally { st.busy = false; lockUi(false); }
  }

  function applyResult() {
    if (!st.res) return toast('Nenhum resultado para aplicar.', 'error');
    const nomeEl = getEl('nomeDespesa'), valorEl = getEl('valorDespesa'), dataEl = getEl('dataVencimento'), statusEl = getEl('statusDespesa');
    if (!nomeEl || !valorEl || !dataEl) return toast('Campos da despesa nao encontrados.', 'error');
    let c = 0;
    if (st.res.nome) { nomeEl.value = String(st.res.nome).trim(); c++; }
    if (Number.isFinite(st.res.valor) && st.res.valor > 0) { valorEl.value = String(Number(st.res.valor).toFixed(2)); c++; }
    if (st.res.data && /^\d{4}-\d{2}-\d{2}$/.test(st.res.data)) { dataEl.value = st.res.data; c++; }
    else if (!String(dataEl.value || '').trim()) dataEl.value = defaultDate();
    if (statusEl && !statusEl.value) statusEl.value = 'pendente';
    if (st.res.categoriaSugerida) { try { nomeEl.dataset.categoriaSugeridaScanner = st.res.categoriaSugerida; } catch (_) {} }
    if (c <= 0) return toast('Nao foi possivel preencher campos automaticamente.', 'error');
    vibrarOk();
    const catMsg = st.res.categoriaSugerida ? ` Categoria sugerida: ${st.res.categoriaSugerida}.` : '';
    toast(`Despesa preenchida com sucesso (${c} campo(s)).${catMsg}`, 'success');
    closeScannerModal();
  }

  function openScannerModal() {
    const e = E(); if (!e.m) return toast('Modal de scanner nao encontrado.', 'error');
    st.open = true; st.lastCode = ''; st.lastCodeAt = 0;
    e.m.classList.add('active'); resetMidia(); resetRes();
    startCam().then(ok => { if (!ok) setStatus('Use foto/galeria ou tente abrir a camera novamente.', 'erro'); });
  }
  function closeScannerModal() { const e = E(); st.open = false; st.busy = false; stopCam(); if (e.m) e.m.classList.remove('active'); resetMidia(); resetRes(); }

  function bind() {
    const e = E(); if (!e.m || e.m.dataset.bindScannerDespesa === '1') return; e.m.dataset.bindScannerDespesa = '1';
    e.bCam?.addEventListener('click', () => startCam());
    e.bFoto?.addEventListener('click', () => chooseImage());
    e.inFile?.addEventListener('change', onImageFile);
    e.bCode?.addEventListener('click', () => { if (st.img && (!st.stream || e.v?.hidden)) detectCodeFromSelectedImage(); else scanCodeCameraManual(); });
    e.bOcr?.addEventListener('click', () => processarImagem()); // QR/barcode primeiro, OCR depois
    e.bAplicar?.addEventListener('click', () => applyResult());
    e.m.addEventListener('click', ev => { if (ev.target === e.m) closeScannerModal(); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && st.open) closeScannerModal(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && st.open && !st.busy) stopCam();
      else if (document.visibilityState === 'visible' && st.open && !st.stream && !st.img) startCam().catch(() => {});
    });
    window.addEventListener('beforeunload', () => stopCam(), { once:true });
  }

  window.abrirModalEscanearDespesa = openScannerModal;
  window.fecharModalEscanearDespesa = closeScannerModal;
  window.processarImagemDespesa = processarImagem;
  window.normalizeNfceQrUrl = normalizeNfceQrUrl;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})();
