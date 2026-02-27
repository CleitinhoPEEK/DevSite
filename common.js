(function attachFinCommon(global) {
    if (global.FinCommon) return;
    const LIMITE_HISTORICO_PADRAO = 400;
    const DURACAO_ENTRADA_PAGINA_PADRAO = 860;
    const CLASSE_ENTRADA_PAGINA = 'page-open-enter';
    const CLASSE_ENTRADA_PAGINA_ATIVA = 'page-open-enter-active';

    const STORAGE = Object.freeze({
        CLIENTES: 'cobrancas_2026',
        DESPESAS: 'minhas_despesas',
        SALDO_CARTEIRA: 'cofrinho_saldo',
        HISTORICO_CARTEIRA: 'cofrinho_historico',
        SALDO_POUPANCA: 'poupanca_saldo',
        HISTORICO_POUPANCA: 'poupanca_historico',
        SIDEBAR_RETORNO_FECHADA: 'sidebar_retorno_fechada',
        PULAR_SPLASH_ENTRADA_ONCE: 'pular_splash_entrada_once',
        TEMA_SISTEMA: 'tema_sistema',
        TEMA_EXECUTIVO: 'tema_executivo',
        ECONOMIAS_LEGADO: 'economias',
        AUTH_USERS: 'auth_usuarios',
        AUTH_SESSION: 'auth_sessao'
    });

    const NOMES_MESES = Object.freeze([
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]);

    const STORAGE_SCOPE_PREFIX = '__fin_user__';
    const STORAGE_MIGRACAO_LEGADO_KEY = '__fin_storage_scope_migrated_owner_v1';
    const STORAGE_CHAVES_GLOBAIS = new Set([
        STORAGE.AUTH_USERS,
        STORAGE.AUTH_SESSION,
        STORAGE_MIGRACAO_LEGADO_KEY
    ]);
    const getEl = id => document.getElementById(id);
    const getLocaleIdiomaAtual = () => {
        try {
            const fromI18n = typeof global.FinI18n?.getLanguage === 'function'
                ? global.FinI18n.getLanguage()
                : '';
            const bruto = String(fromI18n || global.localStorage?.getItem?.('idioma_sistema') || 'pt-BR').toLowerCase();
            if (bruto.startsWith('en')) return 'en-US';
            return 'pt-BR';
        } catch (_) {
            return 'pt-BR';
        }
    };
    const formatarMoeda = valor => Number(valor || 0).toLocaleString(getLocaleIdiomaAtual(), { style: 'currency', currency: 'BRL' });
    const parseValorInput = value => parseFloat(String(value ?? '').replace(',', '.'));
    const formatarDataBr = str => String(str ?? '').split('-').reverse().join('/');
    const getDataLocal = valor => new Date(`${valor}T00:00:00`);
    const getHojeLocal = () => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return hoje;
    };
    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const normalizarNomeUsuarioStorage = value => String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const getStorageLocal = () => global.localStorage ?? null;

    const safeParseJSON = (value, fallback = null) => {
        if (value == null) return fallback;
        try {
            const parsed = JSON.parse(value);
            return parsed ?? fallback;
        } catch (_) {
            return fallback;
        }
    };

    const safeGetRawStorageItem = (key, fallback = null) => {
        try {
            const storage = getStorageLocal();
            const valor = storage ? storage.getItem(String(key)) : null;
            return valor ?? fallback;
        } catch (_) {
            return fallback;
        }
    };

    const safeSetRawStorageItem = (key, value) => {
        try {
            const storage = getStorageLocal();
            if (!storage) return false;
            storage.setItem(String(key), String(value));
            return true;
        } catch (_) {
            return false;
        }
    };

    const safeRemoveRawStorageItem = key => {
        try {
            const storage = getStorageLocal();
            if (!storage) return false;
            storage.removeItem(String(key));
            return true;
        } catch (_) {
            return false;
        }
    };

    const isChaveStorageGlobal = key => STORAGE_CHAVES_GLOBAIS.has(String(key ?? ''));

    const carregarSessaoAutenticacaoStorage = () => {
        const sessao = safeParseJSON(safeGetRawStorageItem(STORAGE.AUTH_SESSION, null), null);
        if (!sessao || typeof sessao !== 'object') return null;

        const usernameKey = normalizarNomeUsuarioStorage(sessao.usernameKey);
        const token = String(sessao.token ?? '').trim();
        if (!usernameKey || !token) return null;

        const usuarios = safeParseJSON(safeGetRawStorageItem(STORAGE.AUTH_USERS, null), []);
        if (!Array.isArray(usuarios) || !usuarios.length) return null;

        const usuario = usuarios.find(item => {
            if (!item || typeof item !== 'object') return false;
            const key = normalizarNomeUsuarioStorage(item.usernameKey ?? item.username);
            return key === usernameKey;
        });

        if (!usuario) return null;
        if (String(usuario.sessionToken ?? '') !== token) return null;

        return { usernameKey, token };
    };

    const obterOwnerUsernameKeyStorage = () => {
        const usuarios = safeParseJSON(safeGetRawStorageItem(STORAGE.AUTH_USERS, null), []);
        if (!Array.isArray(usuarios) || !usuarios.length) return '';

        const dono = usuarios.find(item => item && typeof item === 'object' && Boolean(item.owner));
        const base = dono ?? usuarios[0];
        return normalizarNomeUsuarioStorage(base?.usernameKey ?? base?.username);
    };

    const isUsuarioAtivoOwnerStorage = () => {
        const sessao = carregarSessaoAutenticacaoStorage();
        if (!sessao?.usernameKey) return false;
        const ownerKey = obterOwnerUsernameKeyStorage();
        return Boolean(ownerKey && ownerKey === sessao.usernameKey);
    };

    const obterEscopoStorageUsuario = () => carregarSessaoAutenticacaoStorage()?.usernameKey || '';

    const montarChaveStorageEscopada = (key, usernameKey = obterEscopoStorageUsuario()) => {
        const chave = String(key ?? '');
        if (!chave) return chave;
        if (isChaveStorageGlobal(chave)) return chave;
        if (!usernameKey) return chave;
        return `${STORAGE_SCOPE_PREFIX}${usernameKey}::${chave}`;
    };

    let ultimoUsuarioMigradoVerificado = null;
    const migrarStorageLegadoParaUsuarioAtivo = () => {
        const usuarioAtivo = obterEscopoStorageUsuario();
        if (!usuarioAtivo) {
            ultimoUsuarioMigradoVerificado = null;
            return false;
        }

        if (ultimoUsuarioMigradoVerificado === usuarioAtivo) return false;
        ultimoUsuarioMigradoVerificado = usuarioAtivo;

        const ownerKey = obterOwnerUsernameKeyStorage();
        if (!ownerKey || ownerKey !== usuarioAtivo) return false;

        const migradoPara = normalizarNomeUsuarioStorage(safeGetRawStorageItem(STORAGE_MIGRACAO_LEGADO_KEY, ''));
        if (migradoPara === ownerKey) return false;

        let copiados = 0;
        for (const chave of Object.values(STORAGE)) {
            if (!chave || isChaveStorageGlobal(chave)) continue;

            const valorLegado = safeGetRawStorageItem(chave, null);
            if (valorLegado == null) continue;

            const chaveEscopada = montarChaveStorageEscopada(chave, ownerKey);
            if (safeGetRawStorageItem(chaveEscopada, null) != null) continue;

            if (safeSetRawStorageItem(chaveEscopada, valorLegado)) copiados += 1;
        }

        safeSetRawStorageItem(STORAGE_MIGRACAO_LEGADO_KEY, ownerKey);
        return copiados > 0;
    };

    const limparStorageEscopadoUsuario = usernameKey => {
        const storage = getStorageLocal();
        if (!storage) return true;

        const chaveUsuario = normalizarNomeUsuarioStorage(usernameKey);
        if (!chaveUsuario) return false;

        const prefixo = `${STORAGE_SCOPE_PREFIX}${chaveUsuario}::`;
        const chavesRemover = [];
        for (let i = 0; i < storage.length; i += 1) {
            const chave = storage.key(i);
            if (!chave || !chave.startsWith(prefixo)) continue;
            chavesRemover.push(chave);
        }

        for (const chave of chavesRemover) {
            storage.removeItem(chave);
        }

        return true;
    };

    const safeGetItem = (key, fallback = null) => {
        migrarStorageLegadoParaUsuarioAtivo();
        return safeGetRawStorageItem(montarChaveStorageEscopada(key), fallback);
    };

    const safeSetItem = (key, value) => {
        migrarStorageLegadoParaUsuarioAtivo();
        return safeSetRawStorageItem(montarChaveStorageEscopada(key), value);
    };

    const safeRemoveItem = key => {
        migrarStorageLegadoParaUsuarioAtivo();
        return safeRemoveRawStorageItem(montarChaveStorageEscopada(key));
    };

    const safeClearStorage = () => {
        try {
            migrarStorageLegadoParaUsuarioAtivo();

            const storage = getStorageLocal();
            if (!storage) return true;

            let ok = true;
            const usuarioAtivo = obterEscopoStorageUsuario();
            if (usuarioAtivo) {
                ok = limparStorageEscopadoUsuario(usuarioAtivo) !== false;
            }

            const chavesRemover = [];
            for (let i = 0; i < storage.length; i += 1) {
                const chave = storage.key(i);
                if (!chave || isChaveStorageGlobal(chave)) continue;
                if (chave.startsWith(STORAGE_SCOPE_PREFIX)) continue;
                chavesRemover.push(chave);
            }

            for (const chave of chavesRemover) {
                storage.removeItem(chave);
            }

            return ok;
        } catch (_) {
            return false;
        }
    };

    const safeClearUserStorage = usernameKey => {
        try {
            return limparStorageEscopadoUsuario(usernameKey);
        } catch (_) {
            return false;
        }
    };

    const safeGetJSON = (key, fallback = []) => {
        const bruto = safeGetItem(key, null);
        if (bruto == null) return fallback;

        return safeParseJSON(bruto, fallback);
    };

    const safeSetJSON = (key, value) => safeSetItem(key, JSON.stringify(value));

    const safeGetNumber = (key, fallback = 0) => {
        const valor = Number(safeGetItem(key, ''));
        return Number.isFinite(valor) ? valor : fallback;
    };


    const limitarHistorico = (lista, limite = LIMITE_HISTORICO_PADRAO) => {
        if (!Array.isArray(lista)) return [];

        const limiteFinal = Math.max(0, Number(limite) || LIMITE_HISTORICO_PADRAO);
        if (lista.length > limiteFinal) {
            lista.length = limiteFinal;
        }

        return lista;
    };


    const baixarJson = (dados, nomeArquivo) => {
        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    };

    const sanitizarNomeArquivo = (nome, fallback = 'arquivo') => {
        const nomeBase = String(nome ?? '')
            .trim()
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/[\u0000-\u001f\u007f]+/g, '')
            .replace(/\s+/g, ' ')
            .replace(/^\.+|\.+$/g, '')
            .replace(/\.json$/i, '')
            .trim();

        return nomeBase || fallback;
    };

    const MODAL_NOME_BACKUP_ID = 'modal-nome-backup';
    let resolverModalNomeBackup = null;

    const concluirModalNomeBackup = valor => {
        const modal = global.document?.getElementById(MODAL_NOME_BACKUP_ID);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }

        const resolver = resolverModalNomeBackup;
        resolverModalNomeBackup = null;
        if (typeof resolver === 'function') resolver(valor);
        return true;
    };

    const fecharModalNomeBackup = () => concluirModalNomeBackup(null);

    const confirmarModalNomeBackup = () => {
        const modal = global.document?.getElementById(MODAL_NOME_BACKUP_ID);
        if (!modal) return false;

        const input = modal.querySelector('#backup-nome-arquivo-input');
        concluirModalNomeBackup(input ? input.value : '');
        return true;
    };

    const garantirModalNomeBackup = () => {
        const doc = global.document;
        if (!doc?.body) return null;

        let modal = doc.getElementById(MODAL_NOME_BACKUP_ID);
        if (modal) return modal;

        modal = doc.createElement('div');
        modal.id = MODAL_NOME_BACKUP_ID;
        modal.className = 'modal-geral modal-nome-backup';
        modal.innerHTML = `
            <div class="modal-content modal-nome-backup-conteudo" role="dialog" aria-modal="true" aria-label="Nome do arquivo de backup">
                <label class="backup-nome-label" for="backup-nome-arquivo-input">Nome do arquivo de backup (sem .json):</label>
                <input type="text" id="backup-nome-arquivo-input" class="backup-nome-input" autocomplete="off" spellcheck="false" maxlength="120">
                <div class="backup-nome-acoes">
                    <button type="button" class="backup-nome-btn backup-nome-btn-confirmar" id="btn-confirmar-nome-backup">OK</button>
                    <button type="button" class="backup-nome-btn backup-nome-btn-cancelar" data-acao="cancelar-nome-backup">Cancelar</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', event => {
            if (event.target === modal) fecharModalNomeBackup();
        });

        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                fecharModalNomeBackup();
                return;
            }

            if (event.key === 'Enter') {
                const alvo = event.target;
                if (alvo instanceof HTMLInputElement) {
                    event.preventDefault();
                    confirmarModalNomeBackup();
                }
            }
        });

        modal.querySelectorAll('[data-acao="cancelar-nome-backup"]').forEach(item => {
            item.addEventListener('click', fecharModalNomeBackup);
        });

        const botaoConfirmar = modal.querySelector('#btn-confirmar-nome-backup');
        if (botaoConfirmar) {
            botaoConfirmar.addEventListener('click', confirmarModalNomeBackup);
        }

        doc.body.appendChild(modal);
        return modal;
    };

    const solicitarNomeArquivoBackupCustom = ({ nomePadrao = 'backup_financas' } = {}) => {
        const doc = global.document;
        if (!doc?.body || typeof global.Promise !== 'function') return null;

        const modal = garantirModalNomeBackup();
        if (!modal) return null;

        if (typeof resolverModalNomeBackup === 'function') {
            const resolverAnterior = resolverModalNomeBackup;
            resolverModalNomeBackup = null;
            resolverAnterior(null);
        }

        if (typeof fecharPopupsConfiguracoes === 'function') fecharPopupsConfiguracoes();

        const input = modal.querySelector('#backup-nome-arquivo-input');
        if (input) input.value = String(nomePadrao ?? '');

        modal.style.display = 'flex';
        modal.classList.add('active');

        if (input) {
            const focar = () => {
                input.focus();
                if (typeof input.select === 'function') input.select();
            };

            if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(focar);
            else focar();
        }

        return new Promise(resolve => {
            resolverModalNomeBackup = resolve;
        });
    };

    const escapeCsvCell = value => {
        const texto = String(value ?? '');
        const precisaAspas = /[;"\n\r]/.test(texto);
        const normalizado = texto.replace(/"/g, '""');
        return precisaAspas ? `"${normalizado}"` : normalizado;
    };

    const baixarCsv = (linhas, nomeArquivo = 'planilha_financas.csv') => {
        if (!Array.isArray(linhas) || !linhas.length) return false;

        const conteudo = linhas
            .map(colunas => (Array.isArray(colunas) ? colunas : [colunas])
                .map(escapeCsvCell)
                .join(';'))
            .join('\r\n');

        const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = global.document?.createElement('a');
        if (!link) {
            URL.revokeObjectURL(url);
            return false;
        }

        link.href = url;
        link.download = nomeArquivo;
        link.click();
        global.setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
    };

    const formatarNumeroPlanilha = valor => {
        const numero = Number(valor ?? 0);
        if (!Number.isFinite(numero)) return '0,00';
        return numero.toFixed(2).replace('.', ',');
    };

    const normalizarDataParaExportacao = valor => {
        if (valor == null || valor === '') return null;

        if (valor instanceof Date) {
            if (Number.isNaN(valor.getTime())) return null;
            return valor;
        }

        if (typeof valor === 'number') {
            const dataNumero = new Date(valor);
            if (Number.isNaN(dataNumero.getTime())) return null;
            return dataNumero;
        }

        const texto = String(valor).trim();
        if (!texto) return null;

        const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchIso) {
            const dataIso = new Date(`${matchIso[1]}-${matchIso[2]}-${matchIso[3]}T00:00:00`);
            if (!Number.isNaN(dataIso.getTime())) return dataIso;
        }

        const matchBr = texto.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
        if (matchBr) {
            const ano = Number(matchBr[3] || new Date().getFullYear());
            const mes = Number(matchBr[2]) - 1;
            const dia = Number(matchBr[1]);
            const dataBr = new Date(ano, mes, dia);
            if (!Number.isNaN(dataBr.getTime())) return dataBr;
        }

        const dataFallback = new Date(texto);
        if (!Number.isNaN(dataFallback.getTime())) return dataFallback;
        return null;
    };

    const extrairDataHistoricoExportacao = item => {
        if (!item || typeof item !== 'object') return null;

        const timestamp = Number(item.timestamp);
        if (Number.isFinite(timestamp)) {
            const dataTs = normalizarDataParaExportacao(timestamp);
            if (dataTs) return dataTs;
        }

        const dataTexto = item.data ?? item.dataReferencia ?? '';
        return normalizarDataParaExportacao(dataTexto);
    };

    const formatarMesAnoExportacao = data => {
        if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
        return `${NOMES_MESES[data.getMonth()]}/${data.getFullYear()}`;
    };

    let carregamentoXlsxPromise = null;
    const XLSX_LIB_SOURCES = Object.freeze([
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    ]);

    const carregarBibliotecaXlsx = () => {
        if (global.XLSX?.utils && typeof global.XLSX.writeFile === 'function') {
            return Promise.resolve(global.XLSX);
        }

        if (carregamentoXlsxPromise) return carregamentoXlsxPromise;

        const doc = global.document;
        if (!doc || typeof doc.createElement !== 'function') {
            return Promise.reject(new Error('Documento indisponivel para carregar biblioteca XLSX.'));
        }

        const carregarIndice = indice => new Promise((resolve, reject) => {
            if (global.XLSX?.utils && typeof global.XLSX.writeFile === 'function') {
                resolve(global.XLSX);
                return;
            }

            const src = XLSX_LIB_SOURCES[indice];
            if (!src) {
                reject(new Error('Nao foi possivel carregar a biblioteca XLSX.'));
                return;
            }

            const existente = doc.querySelector(`script[data-fin-xlsx="1"][src="${src}"]`);
            if (existente) {
                const validar = () => {
                    if (global.XLSX?.utils && typeof global.XLSX.writeFile === 'function') resolve(global.XLSX);
                    else if (indice + 1 < XLSX_LIB_SOURCES.length) carregarIndice(indice + 1).then(resolve).catch(reject);
                    else reject(new Error('Biblioteca XLSX indisponivel.'));
                };
                global.setTimeout(validar, 120);
                return;
            }

            const script = doc.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.finXlsx = '1';
            script.onload = () => {
                if (global.XLSX?.utils && typeof global.XLSX.writeFile === 'function') {
                    resolve(global.XLSX);
                    return;
                }
                if (indice + 1 < XLSX_LIB_SOURCES.length) carregarIndice(indice + 1).then(resolve).catch(reject);
                else reject(new Error('Biblioteca XLSX carregada sem API esperada.'));
            };
            script.onerror = () => {
                script.remove?.();
                if (indice + 1 < XLSX_LIB_SOURCES.length) carregarIndice(indice + 1).then(resolve).catch(reject);
                else reject(new Error('Falha ao carregar biblioteca XLSX.'));
            };
            (doc.head || doc.body || doc.documentElement).appendChild(script);
        });

        carregamentoXlsxPromise = carregarIndice(0).catch(erro => {
            carregamentoXlsxPromise = null;
            throw erro;
        });

        return carregamentoXlsxPromise;
    };

    const sanitizarNomeAbaXlsx = (nome, fallback = 'Planilha') => {
        const texto = String(nome ?? '').replace(/[\\/*?:[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        const base = texto || String(fallback || 'Planilha');
        return base.slice(0, 31);
    };

    const calcularLargurasAoA = (linhas, limites = []) => {
        const lista = Array.isArray(linhas) ? linhas : [];
        const maxCols = lista.reduce((m, row) => Math.max(m, Array.isArray(row) ? row.length : 0), 0);
        const cols = [];
        for (let c = 0; c < maxCols; c += 1) {
            let largura = 10;
            for (let r = 0; r < lista.length; r += 1) {
                const row = Array.isArray(lista[r]) ? lista[r] : [lista[r]];
                const value = row[c];
                const texto = value == null ? '' : String(value);
                largura = Math.max(largura, Math.min(64, texto.length + 2));
            }
            const cfg = limites[c];
            if (Number.isFinite(cfg?.wch) && cfg.wch > 0) largura = Math.max(largura, cfg.wch);
            cols.push({ wch: largura });
        }
        return cols;
    };

    const aplicarFormatoColunasSheet = (sheet, linhas, opcoes = {}) => {
        if (!sheet || !Array.isArray(linhas) || linhas.length < 2) return;
        const rowCount = linhas.length;
        const moedaCols = Array.isArray(opcoes.moedaCols) ? opcoes.moedaCols : [];
        const inteiroCols = Array.isArray(opcoes.inteiroCols) ? opcoes.inteiroCols : [];

        const aplicarFormato = (colunas, formato) => {
            for (const colIndex of colunas) {
                if (!Number.isFinite(colIndex) || colIndex < 0) continue;
                for (let r = 1; r < rowCount; r += 1) {
                    const ref = `${String.fromCharCode(65 + colIndex)}${r + 1}`;
                    const cell = sheet[ref];
                    if (!cell || typeof cell !== 'object') continue;
                    if (typeof cell.v !== 'number' || !Number.isFinite(cell.v)) continue;
                    cell.z = formato;
                }
            }
        };

        aplicarFormato(moedaCols, '"R$" #,##0.00');
        aplicarFormato(inteiroCols, '#,##0');
    };

    const criarSheetAoA = (XLSX, linhas, cfg = {}) => {
        const src = Array.isArray(linhas) ? linhas : [];
        const sheet = XLSX.utils.aoa_to_sheet(src);
        if (!sheet) return null;

        if (src.length > 1 && Array.isArray(src[0]) && src[0].length) {
            const ultimaCol = src[0].length - 1;
            const letraUltima = XLSX.utils.encode_col(ultimaCol);
            sheet['!autofilter'] = { ref: `A1:${letraUltima}${src.length}` };
        }
        sheet['!cols'] = calcularLargurasAoA(src, Array.isArray(cfg.cols) ? cfg.cols : []);
        aplicarFormatoColunasSheet(sheet, src, cfg);
        return sheet;
    };

    const rotuloBooleanoExportacao = valor => (valor ? 'Sim' : 'Nao');
    const normalizarFormaPagamentoExportacao = valor => {
        const raw = String(valor ?? '').trim();
        if (!raw) return '';
        let texto = raw.toLowerCase();
        try {
            texto = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (_) {
            /* noop */
        }
        const chave = texto.replace(/\s+/g, '_').replace(/-/g, '_');
        const mapa = {
            pix: 'PIX',
            dinheiro: 'Dinheiro',
            debito: 'Debito',
            credito: 'Credito',
            transferencia: 'Transferencia',
            boleto: 'Boleto',
            mercado_pago: 'Mercado Pago'
        };
        return mapa[chave] || raw;
    };

    const normalizarNumero2 = valor => {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return 0;
        return Number(numero.toFixed(2));
    };

    const textoDataHoraExportacao = valor => {
        const data = normalizarDataParaExportacao(valor);
        if (!data) return '';
        return data.toLocaleString('pt-BR');
    };

    const textoDataExportacao = valor => {
        const data = normalizarDataParaExportacao(valor);
        if (!data) return '';
        return data.toLocaleDateString('pt-BR');
    };

    const obterLinhasClientesExportacao = clientes => {
        const linhas = [[
            'ID', 'Cliente', 'Telefone', 'Vencimento', 'Mes/Ano',
            'Valor total', 'Pago parcial', 'Valor restante',
            'Status', 'Pago?', 'Forma de pagamento'
        ]];

        for (const cliente of Array.isArray(clientes) ? clientes : []) {
            if (!cliente || typeof cliente !== 'object') continue;
            const data = normalizarDataParaExportacao(cliente.data);
            const valorTotal = normalizarNumero2(cliente.valor);
            const pagoParcial = normalizarNumero2(cliente.pagoParcial);
            const restante = Math.max(0, normalizarNumero2(valorTotal - pagoParcial));
            const pago = Boolean(cliente.pago);
            const status = pago ? 'Pago' : (pagoParcial > 0 ? 'Parcial' : 'Pendente');

            linhas.push([
                Number(cliente.id) || String(cliente.id ?? ''),
                String(cliente.nome ?? '').trim() || 'Sem nome',
                String(cliente.telefone ?? '').trim(),
                data ? data.toLocaleDateString('pt-BR') : String(cliente.data ?? ''),
                formatarMesAnoExportacao(data),
                valorTotal,
                pagoParcial,
                restante,
                status,
                rotuloBooleanoExportacao(pago),
                normalizarFormaPagamentoExportacao(cliente.formaPagamento)
            ]);
        }

        return linhas;
    };

    const obterLinhasDespesasExportacao = despesas => {
        const linhas = [[
            'ID', 'Descricao', 'Valor', 'Vencimento', 'Mes/Ano',
            'Status', 'Recorrente', 'Serie recorrente'
        ]];

        for (const item of Array.isArray(despesas) ? despesas : []) {
            if (!item || typeof item !== 'object') continue;
            const data = normalizarDataParaExportacao(item.data);
            const valor = normalizarNumero2(item.valor);
            linhas.push([
                Number(item.id) || String(item.id ?? ''),
                String(item.nome ?? '').trim() || 'Sem descricao',
                valor,
                data ? data.toLocaleDateString('pt-BR') : String(item.data ?? ''),
                formatarMesAnoExportacao(data),
                String(item.status ?? 'pendente').trim() || 'pendente',
                rotuloBooleanoExportacao(Boolean(item.recorrente)),
                item.baseRecorrenteId == null ? '' : String(item.baseRecorrenteId)
            ]);
        }

        return linhas;
    };

    const obterInfoMovimentoCarteiraExport = item => {
        const tipoRaw = String(item?.tipo ?? '').trim().toLowerCase();
        const entradas = new Set(['entrada', 'depositar', 'deposito', 'recebimento', 'recebido']);
        const saidas = new Set(['saida', 'sacar', 'despesa', 'pagamento', 'transferir_poupanca', 'transferencia_poupanca', 'enviar_poupanca', 'guardar_poupanca']);
        const valorBase = Math.abs(normalizarNumero2(item?.valor));
        const ehEntrada = entradas.has(tipoRaw);
        const ehSaida = saidas.has(tipoRaw) || (!ehEntrada && tipoRaw.includes('saida')) || tipoRaw === 'sacar';
        const tipoMovimento = ehEntrada ? 'Entrada' : (ehSaida ? 'Saida' : 'Movimento');
        const valorAssinado = ehEntrada ? valorBase : (ehSaida ? -valorBase : normalizarNumero2(item?.valor));
        return { tipoRaw, tipoMovimento, valorBase, valorAssinado };
    };

    const obterLinhasExtratoCarteiraExportacao = historicoCarteira => {
        const linhas = [[
            'Data/Hora', 'Mes/Ano', 'Tipo', 'Tipo bruto',
            'Descricao', 'Categoria', 'Forma de pagamento',
            'Valor', 'Valor assinado'
        ]];

        for (const item of Array.isArray(historicoCarteira) ? historicoCarteira : []) {
            if (!item || typeof item !== 'object') continue;
            const data = extrairDataHistoricoExportacao(item);
            const info = obterInfoMovimentoCarteiraExport(item);
            linhas.push([
                item.data || textoDataHoraExportacao(item.timestamp),
                formatarMesAnoExportacao(data),
                info.tipoMovimento,
                info.tipoRaw || String(item.tipo ?? ''),
                String(item.descricao ?? item.nome ?? '').trim() || 'Movimentacao',
                String(item.categoria ?? '').trim(),
                normalizarFormaPagamentoExportacao(item.formaPagamento),
                info.valorBase,
                info.valorAssinado
            ]);
        }

        return linhas;
    };

    const obterLinhasEconomiasAplicacoesExportacao = ({ saldoCarteira, saldoPoupanca, historicoPoupanca }) => {
        const linhas = [[
            'Secao', 'Origem', 'Data/Hora', 'Mes/Ano',
            'Tipo', 'Descricao', 'Categoria', 'Forma de pagamento',
            'Valor', 'Valor assinado'
        ]];

        const agora = new Date();
        linhas.push([
            'Resumo', 'Carteira', agora.toLocaleString('pt-BR'), formatarMesAnoExportacao(agora),
            'Saldo atual', 'Saldo atual da carteira', '', '', normalizarNumero2(saldoCarteira), normalizarNumero2(saldoCarteira)
        ]);
        linhas.push([
            'Resumo', 'Poupanca', agora.toLocaleString('pt-BR'), formatarMesAnoExportacao(agora),
            'Saldo atual', 'Saldo atual de poupanca / aplicacoes', '', '', normalizarNumero2(saldoPoupanca), normalizarNumero2(saldoPoupanca)
        ]);

        for (const item of Array.isArray(historicoPoupanca) ? historicoPoupanca : []) {
            if (!item || typeof item !== 'object') continue;
            const data = extrairDataHistoricoExportacao(item);
            const info = obterInfoMovimentoCarteiraExport(item);
            linhas.push([
                'Aplicacoes', 'Poupanca', item.data || textoDataHoraExportacao(item.timestamp), formatarMesAnoExportacao(data),
                info.tipoMovimento, String(item.descricao ?? item.nome ?? '').trim() || 'Movimentacao',
                String(item.categoria ?? '').trim(),
                normalizarFormaPagamentoExportacao(item.formaPagamento),
                info.valorBase, info.valorAssinado
            ]);
        }

        return linhas;
    };

    const normalizarItemVendaComercioExport = item => {
        if (!item || typeof item !== 'object') return null;
        const nome = String(item.nome ?? '').trim();
        const precoUnitario = normalizarNumero2(item.precoUnitario);
        const quantidade = Math.max(1, Math.floor(Number(item.quantidade) || 1));
        const custoUnitario = Math.max(0, normalizarNumero2(item.custoUnitario));
        if (!nome || precoUnitario <= 0) return null;
        return {
            nome,
            quantidade,
            precoUnitario,
            custoUnitario,
            subtotal: normalizarNumero2(precoUnitario * quantidade),
            custoTotal: normalizarNumero2(custoUnitario * quantidade)
        };
    };

    const obterLinhasVendasComercioExportacao = vendasStateRaw => {
        const linhas = [[
            'Data ref', 'Criado em', 'ID venda', 'Titulo/Comanda',
            'Forma pagamento', 'Itens (qtd)', 'Itens (resumo)',
            'Subtotal', 'Desconto', 'Acrescimo', 'Total',
            'Custo total', 'Lucro estimado',
            'Exportado', 'Exportado em'
        ]];

        const estado = vendasStateRaw && typeof vendasStateRaw === 'object' ? vendasStateRaw : { dias: {} };
        const dias = estado.dias && typeof estado.dias === 'object' ? estado.dias : {};
        const chavesDias = Object.keys(dias).sort();

        for (const dataRef of chavesDias) {
            const lista = Array.isArray(dias[dataRef]) ? dias[dataRef] : [];
            for (const vendaRaw of lista) {
                if (!vendaRaw || typeof vendaRaw !== 'object') continue;

                let itens = Array.isArray(vendaRaw.itens)
                    ? vendaRaw.itens.map(normalizarItemVendaComercioExport).filter(Boolean)
                    : [];

                if (!itens.length) {
                    const itemLegacy = normalizarItemVendaComercioExport(vendaRaw);
                    if (itemLegacy) itens = [itemLegacy];
                }
                if (!itens.length) continue;

                const subtotalCalc = normalizarNumero2(itens.reduce((acc, it) => acc + it.subtotal, 0));
                const custoCalc = normalizarNumero2(itens.reduce((acc, it) => acc + it.custoTotal, 0));
                const desconto = Math.max(0, normalizarNumero2(vendaRaw.desconto));
                const acrescimo = Math.max(0, normalizarNumero2(vendaRaw.acrescimo));
                let subtotal = Math.max(0, normalizarNumero2(vendaRaw.subtotal));
                if (subtotal <= 0) subtotal = subtotalCalc;
                let total = Math.max(0, normalizarNumero2(vendaRaw.total));
                if (total <= 0) total = Math.max(0, normalizarNumero2(subtotal - desconto + acrescimo));
                const custoTotal = Math.max(0, normalizarNumero2(vendaRaw.custoTotal || custoCalc));
                const lucroEstimado = normalizarNumero2(vendaRaw.lucroEstimado ?? (total - custoTotal));
                const qtdItens = itens.reduce((acc, it) => acc + Math.max(1, Number(it.quantidade) || 1), 0);
                const resumoItens = itens.map(it => `${it.nome} x${it.quantidade}`).join(' | ');
                const criadoEmTs = Number(vendaRaw.criadoEm) || 0;
                const exportado = Boolean(vendaRaw.exportado);
                const exportadoEmTs = exportado ? (Number(vendaRaw.exportadoEm) || 0) : 0;

                linhas.push([
                    dataRef,
                    criadoEmTs ? textoDataHoraExportacao(criadoEmTs) : '',
                    String(vendaRaw.id ?? ''),
                    String(vendaRaw.titulo ?? '').trim(),
                    normalizarFormaPagamentoExportacao(vendaRaw.formaPagamento),
                    qtdItens,
                    resumoItens,
                    subtotal,
                    desconto,
                    acrescimo,
                    total,
                    custoTotal,
                    lucroEstimado,
                    rotuloBooleanoExportacao(exportado),
                    exportadoEmTs ? textoDataHoraExportacao(exportadoEmTs) : ''
                ]);
            }
        }

        return linhas;
    };

    const exportarPlanilhaCsvLegado = () => {
        const clientes = safeGetJSON(STORAGE.CLIENTES, []);
        const despesas = safeGetJSON(STORAGE.DESPESAS, []);
        const historicoCarteira = safeGetJSON(STORAGE.HISTORICO_CARTEIRA, []);
        const historicoPoupanca = safeGetJSON(STORAGE.HISTORICO_POUPANCA, []);
        const saldoCarteira = safeGetNumber(STORAGE.SALDO_CARTEIRA, 0);
        const saldoPoupanca = safeGetNumber(STORAGE.SALDO_POUPANCA, 0);

        const linhas = [[
            'Tipo',
            'Categoria',
            'Descricao',
            'Valor',
            'Status',
            'Mes',
            'Data'
        ]];

        for (const cliente of clientes) {
            if (!cliente || typeof cliente !== 'object') continue;

            const data = normalizarDataParaExportacao(cliente.data);
            const valorTotal = Number(cliente.valor) || 0;
            const valorPagoParcial = Number(cliente.pagoParcial) || 0;
            const pago = Boolean(cliente.pago);
            const status = pago ? 'Pago' : (valorPagoParcial > 0 ? 'Parcial' : 'Pendente');

            linhas.push([
                'Clientes',
                'Cobranca',
                String(cliente.nome ?? 'Sem nome').trim() || 'Sem nome',
                formatarNumeroPlanilha(valorTotal),
                status,
                formatarMesAnoExportacao(data),
                data ? data.toLocaleDateString('pt-BR') : ''
            ]);
        }

        for (const despesa of despesas) {
            if (!despesa || typeof despesa !== 'object') continue;

            const data = normalizarDataParaExportacao(despesa.data);
            const valor = Number(despesa.valor) || 0;
            const status = String(despesa.status ?? '').trim() || 'pendente';

            linhas.push([
                'Despesas',
                status,
                String(despesa.nome ?? 'Sem nome').trim() || 'Sem nome',
                formatarNumeroPlanilha(valor),
                status,
                formatarMesAnoExportacao(data),
                data ? data.toLocaleDateString('pt-BR') : ''
            ]);
        }

        const adicionarMovimentacoes = (lista, origem) => {
            if (!Array.isArray(lista)) return;
            for (const item of lista) {
                if (!item || typeof item !== 'object') continue;
                const info = obterInfoMovimentoCarteiraExport(item);
                const data = extrairDataHistoricoExportacao(item);
                const descricao = String(item.descricao ?? item.nome ?? 'Movimentacao').trim() || 'Movimentacao';

                linhas.push([
                    'Carteira/Poupanca',
                    origem,
                    descricao,
                    formatarNumeroPlanilha(info.valorAssinado),
                    info.tipoMovimento,
                    formatarMesAnoExportacao(data),
                    data ? data.toLocaleDateString('pt-BR') : ''
                ]);
            }
        };

        adicionarMovimentacoes(historicoCarteira, 'Carteira');
        adicionarMovimentacoes(historicoPoupanca, 'Poupanca');

        const hoje = new Date();
        const dataHoje = hoje.toLocaleDateString('pt-BR');
        const mesHoje = formatarMesAnoExportacao(hoje);

        linhas.push(['Saldos', 'Carteira', 'Saldo atual carteira', formatarNumeroPlanilha(saldoCarteira), 'Atual', mesHoje, dataHoje]);
        linhas.push(['Saldos', 'Poupanca', 'Saldo atual poupanca', formatarNumeroPlanilha(saldoPoupanca), 'Atual', mesHoje, dataHoje]);

        if (linhas.length <= 1) {
            global.alert('Sem dados para exportar na planilha.');
            return false;
        }

        const dataNome = new Date().toISOString().split('T')[0];
        baixarCsv(linhas, `planilha_financas_${dataNome}.csv`);
        return true;
    };

    const exportarPlanilhaManual = async () => {
        const clientes = safeGetJSON(STORAGE.CLIENTES, []);
        const despesas = safeGetJSON(STORAGE.DESPESAS, []);
        const historicoCarteira = safeGetJSON(STORAGE.HISTORICO_CARTEIRA, []);
        const historicoPoupanca = safeGetJSON(STORAGE.HISTORICO_POUPANCA, []);
        const saldoCarteira = safeGetNumber(STORAGE.SALDO_CARTEIRA, 0);
        const saldoPoupanca = safeGetNumber(STORAGE.SALDO_POUPANCA, 0);
        const vendasComercio = safeGetJSON(STORAGE.COMERCIO_VENDAS || 'comercio_vendas_dias', { dias: {} });

        const totalRegistros = (Array.isArray(clientes) ? clientes.length : 0)
            + (Array.isArray(despesas) ? despesas.length : 0)
            + (Array.isArray(historicoCarteira) ? historicoCarteira.length : 0)
            + (Array.isArray(historicoPoupanca) ? historicoPoupanca.length : 0);

        if (totalRegistros <= 0) {
            global.alert('Sem dados para exportar na planilha.');
            return false;
        }

        try {
            const XLSX = await carregarBibliotecaXlsx();
            if (!XLSX?.utils || typeof XLSX.writeFile !== 'function') throw new Error('XLSX indisponivel');

            const wb = XLSX.utils.book_new();
            const dataNome = new Date().toISOString().split('T')[0];
            const nomeArquivo = `finances_excel_sheets_${dataNome}.xlsx`;

            const linhasClientes = obterLinhasClientesExportacao(clientes);
            const linhasDespesas = obterLinhasDespesasExportacao(despesas);
            const linhasEconomias = obterLinhasEconomiasAplicacoesExportacao({
                saldoCarteira,
                saldoPoupanca,
                historicoPoupanca
            });
            const linhasVendasComercio = obterLinhasVendasComercioExportacao(vendasComercio);
            const linhasExtratoCarteira = obterLinhasExtratoCarteiraExportacao(historicoCarteira);

            const sheets = [
                {
                    nome: 'Clientes_Cobrancas',
                    linhas: linhasClientes,
                    cfg: { moedaCols: [5, 6, 7], cols: [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 13 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 18 }] }
                },
                {
                    nome: 'Despesas',
                    linhas: linhasDespesas,
                    cfg: { moedaCols: [2], cols: [{ wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 13 }, { wch: 15 }, { wch: 12 }, { wch: 11 }, { wch: 18 }] }
                },
                {
                    nome: 'Economias_Aplicacoes',
                    linhas: linhasEconomias,
                    cfg: { moedaCols: [8, 9], cols: [{ wch: 14 }, { wch: 14 }, { wch: 19 }, { wch: 14 }, { wch: 14 }, { wch: 34 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 15 }] }
                },
                {
                    nome: 'Vendas_Comercio',
                    linhas: linhasVendasComercio,
                    cfg: { moedaCols: [7, 8, 9, 10, 11, 12], inteiroCols: [5], cols: [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 44 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 10 }, { wch: 18 }] }
                },
                {
                    nome: 'Extrato_Carteira',
                    linhas: linhasExtratoCarteira,
                    cfg: { moedaCols: [7, 8], cols: [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 38 }, { wch: 22 }, { wch: 18 }, { wch: 13 }, { wch: 14 }] }
                }
            ];

            for (const item of sheets) {
                const ws = criarSheetAoA(XLSX, item.linhas, item.cfg);
                if (!ws) continue;
                XLSX.utils.book_append_sheet(wb, ws, sanitizarNomeAbaXlsx(item.nome, 'Aba'));
            }

            wb.Props = {
                Title: 'Finances - Exportacao Excel/Sheets',
                Subject: 'Exportacao de dados financeiros',
                Author: 'Finances',
                CreatedDate: new Date()
            };

            XLSX.writeFile(wb, nomeArquivo, { compression: true });
            return true;
        } catch (erro) {
            console.error('[FinCommon] Falha ao gerar planilha XLSX. Fallback CSV ativado.', erro);
            global.alert('Nao foi possivel gerar a planilha Excel/Sheets agora. Vamos exportar CSV simples como fallback.');
            return exportarPlanilhaCsvLegado();
        }
    };

    const BACKUP_CAMPOS_PADRAO = Object.freeze({
        clientes: STORAGE.CLIENTES,
        saldo: STORAGE.SALDO_CARTEIRA,
        hist: STORAGE.HISTORICO_CARTEIRA,
        saldoP: STORAGE.SALDO_POUPANCA,
        histP: STORAGE.HISTORICO_POUPANCA,
        despesas: STORAGE.DESPESAS,
        authUsers: STORAGE.AUTH_USERS
    });

    const montarPayloadBackup = (mapaCampos = BACKUP_CAMPOS_PADRAO) => {
        const payload = {};
        for (const [campo, chaveStorage] of Object.entries(mapaCampos || {})) {
            if (!chaveStorage) continue;
            if (chaveStorage === STORAGE.AUTH_USERS && !isUsuarioAtivoOwnerStorage()) continue;
            const valor = safeGetItem(chaveStorage, null);
            if (valor != null) payload[campo] = valor;
        }
        return payload;
    };

    const exportarBackupStorage = ({
        nomeBase = 'backup_financas',
        mapaCampos = BACKUP_CAMPOS_PADRAO,
        solicitarNomeArquivo = true
    } = {}) => {
        const dataRef = new Date().toISOString().split('T')[0];
        const payload = montarPayloadBackup(mapaCampos);
        const nomePadrao = `${sanitizarNomeArquivo(nomeBase, 'backup_financas')}_${dataRef}`;

        const executarDownload = nomeInformado => {
            const nomeArquivoFinal = `${sanitizarNomeArquivo(nomeInformado, nomePadrao)}.json`;
            baixarJson(payload, nomeArquivoFinal);
            return true;
        };

        if (!solicitarNomeArquivo) {
            return executarDownload(nomePadrao);
        }

        const solicitacaoCustom = solicitarNomeArquivoBackupCustom({ nomePadrao });
        if (solicitacaoCustom && typeof solicitacaoCustom.then === 'function') {
            return solicitacaoCustom.then(nomeInformado => {
                if (nomeInformado === null) return false;
                return executarDownload(nomeInformado);
            });
        }

        if (typeof global.prompt === 'function') {
            const nomeInformado = global.prompt('Nome do arquivo de backup (sem .json):', nomePadrao);
            if (nomeInformado === null) return false;
            return executarDownload(nomeInformado);
        }

        return executarDownload(nomePadrao);
    };

    const aplicarBackupStorage = (dados, mapaCampos = BACKUP_CAMPOS_PADRAO) => {
        if (!dados || typeof dados !== 'object') return 0;

        let aplicados = 0;
        for (const [campo, chaveStorage] of Object.entries(mapaCampos || {})) {
            if (!chaveStorage) continue;
            if (chaveStorage === STORAGE.AUTH_USERS && !isUsuarioAtivoOwnerStorage()) continue;
            if (!Object.prototype.hasOwnProperty.call(dados, campo)) continue;
            if (dados[campo] == null) continue;
            if (safeSetItem(chaveStorage, dados[campo])) aplicados += 1;
        }
        return aplicados;
    };

    const importarBackupStorage = (event, {
        mapaCampos = BACKUP_CAMPOS_PADRAO,
        mensagemSucesso = 'Backup restaurado com sucesso.',
        mensagemErro = 'Erro ao ler arquivo de backup.',
        recarregarAoFinal = true,
        onSucesso = null
    } = {}) => {
        const file = event?.target?.files?.[0];
        if (!file) return false;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const dados = JSON.parse(e.target.result);
                const aplicados = aplicarBackupStorage(dados, mapaCampos);
                if (!aplicados) {
                    global.alert('Arquivo sem campos de backup compativeis.');
                    return;
                }

                if (typeof onSucesso === 'function') onSucesso(dados);
                global.alert(mensagemSucesso);
                if (recarregarAoFinal) global.location.reload();
            } catch (_) {
                global.alert(mensagemErro);
            } finally {
                if (event?.target && 'value' in event.target) {
                    event.target.value = '';
                }
            }
        };

        reader.readAsText(file);
        return true;
    };

    const carregarTema = () => {
        const temaSalvo = safeGetItem(STORAGE.TEMA_SISTEMA);
        if (temaSalvo === 'light') {
            global.document?.body?.classList?.add('light-mode');
        }
    };

    const carregarTemaExecutivo = () => {
        const ativo = safeGetItem(STORAGE.TEMA_EXECUTIVO) === '1';
        global.document?.body?.classList?.toggle('executive-mode', ativo);
        return ativo;
    };

    const alternarTemaExecutivo = () => {
        const body = global.document?.body;
        if (!body) return false;
        const ativo = !body.classList.contains('executive-mode');
        body.classList.toggle('executive-mode', ativo);
        safeSetItem(STORAGE.TEMA_EXECUTIVO, ativo ? '1' : '0');
        return ativo;
    };

    const irParaResumoAnoExecutivo = () => {
        const anoAtual = new Date().getFullYear();
        global.location.href = `resumo-ano.html?ano=${encodeURIComponent(String(anoAtual))}`;
        return true;
    };

    const alternarTemaComAnimacao = ({
        botaoId = 'btn-tema',
        storageKey = STORAGE.TEMA_SISTEMA,
        classeAnimacao = 'theme-switching',
        classeTema = 'light-mode',
        duracaoMs = 420,
        atrasoRemocaoMs = 40,
        timerAtual = null
    } = {}) => {
        const body = global.document?.body;
        if (!body) return null;

        const botaoTema = getEl(botaoId);
        if (botaoTema && typeof botaoTema.getBoundingClientRect === 'function') {
            const rect = botaoTema.getBoundingClientRect();
            body.style.setProperty('--theme-origin-x', `${Math.round(rect.left + rect.width / 2)}px`);
            body.style.setProperty('--theme-origin-y', `${Math.round(rect.top + rect.height / 2)}px`);
        } else {
            body.style.setProperty('--theme-origin-x', '50vw');
            body.style.setProperty('--theme-origin-y', '50vh');
        }

        body.classList.add(classeAnimacao);
        void body.offsetWidth;
        body.classList.toggle(classeTema);
        safeSetItem(storageKey, body.classList.contains(classeTema) ? 'light' : 'dark');

        global.clearTimeout(timerAtual);
        const atrasoTotal = Math.max(0, Number(duracaoMs) || 0) + Math.max(0, Number(atrasoRemocaoMs) || 0);
        return global.setTimeout(() => {
            body.classList.remove(classeAnimacao);
        }, atrasoTotal);
    };

    const toggleSidebarPadrao = ({
        wrapperId = 'app-wrapper',
        classeFechada = 'sidebar-closed'
    } = {}) => {
        const appWrapper = getEl(wrapperId);
        if (!appWrapper) return false;
        appWrapper.classList.toggle(classeFechada);
        return true;
    };

    const aplicarEstadoInicialSidebarPadrao = ({
        wrapperId = 'app-wrapper',
        storageKey = STORAGE.SIDEBAR_RETORNO_FECHADA,
        classeFechada = 'sidebar-closed'
    } = {}) => {
        const appWrapper = getEl(wrapperId);
        if (!appWrapper) return false;

        if (safeGetItem(storageKey) !== '1') return false;
        appWrapper.classList.add(classeFechada);
        safeRemoveItem(storageKey);
        return true;
    };

    const configurarGestosSidebarMobilePadrao = ({
        wrapperId = 'app-wrapper',
        sidebarId = 'sidebar',
        classeFechada = 'sidebar-closed',
        breakpoint = 768,
        limiarBorda = 28,
        limiarSwipe = 64,
        razaoHorizontal = 1.15
    } = {}) => {
        const appWrapper = getEl(wrapperId);
        const sidebar = getEl(sidebarId);
        if (!appWrapper || !sidebar || !global.document) return false;

        const listenerKey = `__finSidebarGestos_${wrapperId}_${sidebarId}`;
        if (global.document[listenerKey]) return true;
        global.document[listenerKey] = true;

        let inicioX = 0;
        let inicioY = 0;
        let rastreando = false;
        let origemBorda = false;
        let origemSidebar = false;

        const resetarGestos = () => {
            rastreando = false;
            origemBorda = false;
            origemSidebar = false;
        };

        const aoToqueIniciar = event => {
            if (global.innerWidth > breakpoint) return;
            const toque = event.touches?.[0];
            if (!toque) return;

            inicioX = toque.clientX;
            inicioY = toque.clientY;
            rastreando = true;

            const sidebarFechada = appWrapper.classList.contains(classeFechada);
            origemBorda = sidebarFechada && inicioX <= limiarBorda;

            const alvo = event.target;
            const limiteSidebar = sidebar.getBoundingClientRect().right + 8;
            origemSidebar = !sidebarFechada && (sidebar.contains(alvo) || inicioX <= limiteSidebar);
        };

        const aoToqueFinalizar = event => {
            if (!rastreando || global.innerWidth > breakpoint) {
                resetarGestos();
                return;
            }

            const toque = event.changedTouches?.[0];
            if (!toque) {
                resetarGestos();
                return;
            }

            const deltaX = toque.clientX - inicioX;
            const deltaY = toque.clientY - inicioY;
            const gestoHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * razaoHorizontal;

            if (gestoHorizontal) {
                if (origemBorda && deltaX >= limiarSwipe && appWrapper.classList.contains(classeFechada)) {
                    appWrapper.classList.remove(classeFechada);
                } else if (origemSidebar && deltaX <= -limiarSwipe && !appWrapper.classList.contains(classeFechada)) {
                    appWrapper.classList.add(classeFechada);
                }
            }

            resetarGestos();
        };

        global.document.addEventListener('touchstart', aoToqueIniciar, { passive: true });
        global.document.addEventListener('touchend', aoToqueFinalizar, { passive: true });
        global.document.addEventListener('touchcancel', resetarGestos, { passive: true });
        return true;
    };

    const confirmarResetSistema = ({
        textoConfirmacaoInicial = 'Aten\u00e7\u00e3o: isso vai apagar clientes, despesas, carteira, poupan\u00e7a e extratos. Deseja continuar?',
        textoConfirmacaoFinal = 'Confirma\u00e7\u00e3o final: essa a\u00e7\u00e3o n\u00e3o pode ser desfeita e apagar\u00e1 todas essas informa\u00e7\u00f5es.',
        textoPrompt = 'Digite ZERAR para confirmar:',
        palavraConfirmacao = 'ZERAR',
        textoSucesso = 'Dados zerados com sucesso (clientes, despesas, carteira, poupan\u00e7a e extratos).',
        textoCancelado = 'Acao cancelada.',
        redirecionarPara = 'index.html'
    } = {}) => {
        if (!global.confirm(textoConfirmacaoInicial)) return false;
        if (!global.confirm(textoConfirmacaoFinal)) return false;

        const prova = global.prompt(textoPrompt);
        if (prova && prova.toUpperCase() === String(palavraConfirmacao).toUpperCase()) {
            safeClearStorage();
            global.alert(textoSucesso);
            if (redirecionarPara) global.location.href = redirecionarPara;
            return true;
        }

        global.alert(textoCancelado);
        return false;
    };
    const CLASSE_POPUP_CONFIG_ABERTO = 'config-popup-open';

    const atualizarEstadoPopupConfiguracoes = () => {
        const doc = global.document;
        if (!doc?.body) return false;

        const aberto = Boolean(doc.querySelector('.configuracoes-menu.popup-open'));
        doc.body.classList.toggle(CLASSE_POPUP_CONFIG_ABERTO, aberto);
        return aberto;
    };

    const fecharPopupsConfiguracoes = ({ manterMenu = null } = {}) => {
        const doc = global.document;
        if (!doc) return false;

        doc.querySelectorAll('.configuracoes-menu.popup-open, .configuracoes-menu.expanded').forEach(menu => {
            if (!(menu instanceof Element) || menu === manterMenu) return;

            menu.classList.remove('popup-open');
            menu.classList.remove('expanded');

            const botaoMenu = menu.querySelector('.btn-configuracoes-toggle');
            const painelMenu = menu.querySelector('.configuracoes-menu-conteudo');

            if (botaoMenu) botaoMenu.setAttribute('aria-expanded', 'false');
            if (painelMenu) painelMenu.setAttribute('aria-hidden', 'true');
        });

        atualizarEstadoPopupConfiguracoes();
        return true;
    };

    const garantirEventosPopupConfiguracoes = () => {
        const doc = global.document;
        if (!doc || doc.__finConfigPopupEventos === '1') return false;

        doc.addEventListener('click', event => {
            const alvo = event.target;
            if (alvo instanceof Element && alvo.closest('.configuracoes-menu')) return;
            fecharPopupsConfiguracoes();
        });

        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape') fecharPopupsConfiguracoes();
        });

        doc.__finConfigPopupEventos = '1';
        return true;
    };

    const togglePainelConfiguracoes = (trigger) => {
        const botao = trigger instanceof Element
            ? trigger
            : global.document?.querySelector('.btn-configuracoes-toggle');
        if (!botao) return false;

        const menu = botao.closest('.configuracoes-menu');
        if (!menu) return false;

        const painel = menu.querySelector('.configuracoes-menu-conteudo');
        const expandido = !menu.classList.contains('popup-open');

        garantirEventosPopupConfiguracoes();

        if (expandido) {
            fecharPopupsConfiguracoes({ manterMenu: menu });
            menu.classList.add('popup-open');
            menu.classList.remove('expanded');
            botao.setAttribute('aria-expanded', 'true');
            if (painel) painel.setAttribute('aria-hidden', 'false');

            if (painel && typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(() => {
                    const primeiroFoco = painel.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]');
                    if (primeiroFoco instanceof HTMLElement && typeof primeiroFoco.focus === 'function') {
                        primeiroFoco.focus({ preventScroll: true });
                    }
                });
            }
        } else {
            menu.classList.remove('popup-open');
            menu.classList.remove('expanded');
            botao.setAttribute('aria-expanded', 'false');
            if (painel) painel.setAttribute('aria-hidden', 'true');
        }

        atualizarEstadoPopupConfiguracoes();
        return expandido;
    };

    const MODAL_IMPORTACAO_COLAGEM_ID = 'modal-importacao-colagem';

    const textoLimpoImportacao = valor => String(valor ?? '').trim();

    const normalizarDataIsoImportacao = valor => {
        const texto = textoLimpoImportacao(valor);
        if (!texto) return '';

        const tentarMontar = (ano, mes, dia) => {
            const y = Number(ano);
            const m = Number(mes);
            const d = Number(dia);
            if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
            if (m < 1 || m > 12 || d < 1 || d > 31) return '';
            const data = new Date(y, m - 1, d);
            if (
                data.getFullYear() !== y
                || data.getMonth() !== m - 1
                || data.getDate() !== d
            ) return '';
            return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        };

        const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return tentarMontar(iso[1], iso[2], iso[3]);

        const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return tentarMontar(br[3], br[2], br[1]);

        const brHifen = texto.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (brHifen) return tentarMontar(brHifen[3], brHifen[2], brHifen[1]);

        const data = new Date(texto);
        if (!Number.isNaN(data.getTime())) {
            return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        }

        return '';
    };

    const parseNumeroImportacao = valor => {
        if (typeof valor === 'number') return Number.isFinite(valor) ? valor : Number.NaN;

        const textoBase = textoLimpoImportacao(valor);
        if (!textoBase) return Number.NaN;

        const texto = textoBase.replace(/[^\d,.-]/g, '');
        if (!texto) return Number.NaN;

        let normalizado = texto;
        const temPonto = normalizado.includes('.');
        const temVirgula = normalizado.includes(',');

        if (temPonto && temVirgula) {
            if (normalizado.lastIndexOf(',') > normalizado.lastIndexOf('.')) {
                normalizado = normalizado.replace(/\./g, '').replace(',', '.');
            } else {
                normalizado = normalizado.replace(/,/g, '');
            }
        } else if (temVirgula) {
            normalizado = normalizado.replace(',', '.');
        }

        const numero = Number(normalizado);
        return Number.isFinite(numero) ? numero : Number.NaN;
    };

    const parseBooleanoImportacao = (valor, fallback = false) => {
        if (typeof valor === 'boolean') return valor;

        const texto = textoLimpoImportacao(valor).toLowerCase();
        if (!texto) return fallback;

        if (['1', 'true', 'sim', 's', 'yes', 'y', 'ok', 'pago', 'ativa', 'ativo'].includes(texto)) return true;
        if (['0', 'false', 'nao', 'não', 'n', 'no', 'pendente', 'inativo', 'inativa'].includes(texto)) return false;
        return fallback;
    };

    const normalizarStatusDespesaImportacao = valor => {
        const texto = textoLimpoImportacao(valor).toLowerCase();
        if (!texto) return 'pendente';
        if (texto.includes('pag') || texto.includes('quit')) return 'pago';
        return 'pendente';
    };


    const TIPOS_CLIENTE_IMPORTACAO = Object.freeze(['c', 'cli', 'cliente', 'clientes']);
    const TIPOS_DESPESA_IMPORTACAO = Object.freeze(['d', 'desp', 'despesa', 'despesas']);

    const normalizarTipoImportacao = valor => {
        const texto = textoLimpoImportacao(valor).toLowerCase();
        if (TIPOS_CLIENTE_IMPORTACAO.includes(texto)) return 'cliente';
        if (TIPOS_DESPESA_IMPORTACAO.includes(texto)) return 'despesa';
        return null;
    };

    const obterDataPadraoImportacao = (base = new Date()) => {
        const ano = base.getFullYear();
        const mes = String(base.getMonth() + 1).padStart(2, '0');
        return `${ano}-${mes}-10`;
    };

    const normalizarDataLinhaLivreImportacao = (valor, fallbackData = obterDataPadraoImportacao()) => {
        const texto = textoLimpoImportacao(valor);
        if (!texto) return fallbackData;

        const hoje = new Date();
        const matchDiaMes = texto.match(/^(\d{1,2})[\/-](\d{1,2})$/);
        if (matchDiaMes) {
            const dataComAnoAtual = `${hoje.getFullYear()}-${String(Number(matchDiaMes[2])).padStart(2, '0')}-${String(Number(matchDiaMes[1])).padStart(2, '0')}`;
            return normalizarDataIsoImportacao(dataComAnoAtual) || fallbackData;
        }

        const matchDiaMesAnoCurto = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
        if (matchDiaMesAnoCurto) {
            const anoBase = Number(matchDiaMesAnoCurto[3]);
            const anoCompleto = anoBase >= 70 ? (1900 + anoBase) : (2000 + anoBase);
            const dataCompleta = `${anoCompleto}-${String(Number(matchDiaMesAnoCurto[2])).padStart(2, '0')}-${String(Number(matchDiaMesAnoCurto[1])).padStart(2, '0')}`;
            return normalizarDataIsoImportacao(dataCompleta) || fallbackData;
        }

        return normalizarDataIsoImportacao(texto) || fallbackData;
    };

    const parseLinhaLivreImportacao = (linha, tipoInicial = null, dataPadrao = obterDataPadraoImportacao()) => {
        let texto = textoLimpoImportacao(linha);
        if (!texto) return null;

        let tipo = tipoInicial;

        const prefixoSeparado = texto.match(/^([a-zç]+)\s*[:\-]\s*(.+)$/i);
        if (prefixoSeparado) {
            const tipoDetectado = normalizarTipoImportacao(prefixoSeparado[1]);
            if (tipoDetectado) {
                tipo = tipoDetectado;
                texto = textoLimpoImportacao(prefixoSeparado[2]);
            }
        }

        if (!tipo) {
            const prefixoPorEspaco = texto.match(/^(clientes?|cliente|cli|despesas?|despesa|desp)\s+(.+)$/i);
            if (prefixoPorEspaco) {
                tipo = normalizarTipoImportacao(prefixoPorEspaco[1]);
                texto = textoLimpoImportacao(prefixoPorEspaco[2]);
            }
        }

        if (!tipo) {
            const prefixoCurto = texto.match(/^([cd])\s+(.+)$/i);
            if (prefixoCurto) {
                tipo = normalizarTipoImportacao(prefixoCurto[1]);
                texto = textoLimpoImportacao(prefixoCurto[2]);
            }
        }

        let dataBruta = '';
        const matchDataFim = texto.match(/(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s*$/);
        if (matchDataFim && typeof matchDataFim.index === 'number') {
            dataBruta = matchDataFim[1];
            texto = textoLimpoImportacao(texto.slice(0, matchDataFim.index));
        }

        const matchValorFim = texto.match(/(?:^|\s)(R\$\s*)?(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|-?\d+(?:,\d{1,2})|-?\d+(?:\.\d{1,2})?)\s*$/i);
        if (!matchValorFim || typeof matchValorFim.index !== 'number') return null;

        const valorTexto = `${matchValorFim[1] || ''}${matchValorFim[2]}`.trim();
        const valorNumerico = parseNumeroImportacao(valorTexto);
        if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;

        const nomeBruto = texto.slice(0, matchValorFim.index).replace(/[;,:-]+\s*$/, '');
        const nome = textoLimpoImportacao(nomeBruto);
        if (!nome) return null;

        const data = normalizarDataLinhaLivreImportacao(dataBruta, dataPadrao);
        const tipoFinal = tipo || 'cliente';

        if (tipoFinal === 'despesa') {
            return {
                tipo: 'despesa',
                registro: { nome, valor: valorTexto, data, status: '', recorrente: '' }
            };
        }

        return {
            tipo: 'cliente',
            registro: { nome, valor: valorTexto, data, telefone: '', pago: '', pagoParcial: '' }
        };
    };
    const gerarIdImportacao = (ocupados, indice = 0) => {
        let tentativa = Date.now() * 1000 + (indice % 997);
        while (ocupados.has(tentativa)) tentativa += 1;
        ocupados.add(tentativa);
        return tentativa;
    };

    const normalizarClienteImportado = (entrada, ocupados, indice = 0) => {
        if (!entrada || typeof entrada !== 'object') return null;

        const nome = textoLimpoImportacao(entrada.nome ?? entrada.name ?? entrada.cliente);
        const data = normalizarDataIsoImportacao(entrada.data ?? entrada.vencimento ?? entrada.date);
        const valorNumerico = parseNumeroImportacao(entrada.valor ?? entrada.total ?? entrada.amount);

        if (!nome || !data || !Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;

        const valorAjustado = Number(valorNumerico.toFixed(2));

        const statusPagoBruto = entrada.pago ?? entrada.paid ?? entrada.recebido ?? '';
        const statusPagoPorTexto = textoLimpoImportacao(entrada.status).toLowerCase();
        const pago = parseBooleanoImportacao(statusPagoBruto, statusPagoPorTexto.includes('pag'));

        const parcialBruto = entrada.pagoParcial ?? entrada.parcial ?? entrada.valorPago ?? entrada.paidAmount ?? '';
        const parcialNumero = parseNumeroImportacao(parcialBruto);
        const parcialBase = Number.isFinite(parcialNumero) ? parcialNumero : (pago ? valorAjustado : 0);
        const pagoParcialAjustado = Math.max(0, Math.min(valorAjustado, Number(parcialBase.toFixed(2))));

        const telefone = textoLimpoImportacao(entrada.telefone ?? entrada.whatsapp ?? entrada.phone ?? entrada.celular);
        const idEntrada = Number(entrada.id);
        const id = Number.isInteger(idEntrada) && idEntrada > 0 && !ocupados.has(idEntrada)
            ? (ocupados.add(idEntrada), idEntrada)
            : gerarIdImportacao(ocupados, indice);

        return {
            id,
            nome,
            telefone,
            valor: valorAjustado.toFixed(2),
            pagoParcial: (pago ? valorAjustado : pagoParcialAjustado).toFixed(2),
            data,
            pago
        };
    };

    const normalizarDespesaImportada = (entrada, ocupados, indice = 0) => {
        if (!entrada || typeof entrada !== 'object') return null;

        const nome = textoLimpoImportacao(entrada.nome ?? entrada.name ?? entrada.despesa);
        const data = normalizarDataIsoImportacao(entrada.data ?? entrada.vencimento ?? entrada.date);
        const valorNumerico = parseNumeroImportacao(entrada.valor ?? entrada.total ?? entrada.amount);

        if (!nome || !data || !Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;

        const idEntrada = Number(entrada.id);
        const id = Number.isInteger(idEntrada) && idEntrada > 0 && !ocupados.has(idEntrada)
            ? (ocupados.add(idEntrada), idEntrada)
            : gerarIdImportacao(ocupados, indice);

        const status = normalizarStatusDespesaImportacao(entrada.status ?? (parseBooleanoImportacao(entrada.pago, false) ? 'pago' : 'pendente'));
        const recorrente = parseBooleanoImportacao(entrada.recorrente ?? entrada.recurrente ?? entrada.recurring, false);

        return {
            id,
            nome,
            valor: Number(valorNumerico.toFixed(2)),
            data,
            status,
            recorrente,
            baseRecorrenteId: recorrente ? id : null
        };
    };

    const inferirTipoRegistroImportado = entrada => {
        if (!entrada || typeof entrada !== 'object') return null;

        const tipoBruto = normalizarTipoImportacao(entrada.tipo);
        if (tipoBruto) return tipoBruto;

        if (Object.prototype.hasOwnProperty.call(entrada, 'status') || Object.prototype.hasOwnProperty.call(entrada, 'recorrente')) {
            return 'despesa';
        }

        if (
            Object.prototype.hasOwnProperty.call(entrada, 'telefone')
            || Object.prototype.hasOwnProperty.call(entrada, 'pagoParcial')
            || Object.prototype.hasOwnProperty.call(entrada, 'pago')
        ) {
            return 'cliente';
        }

        return null;
    };

    const extrairRegistrosJsonImportacao = dados => {
        const clientesEntrada = [];
        const despesasEntrada = [];

        if (Array.isArray(dados)) {
            for (const item of dados) {
                const tipo = inferirTipoRegistroImportado(item);
                if (tipo === 'cliente') clientesEntrada.push(item);
                else if (tipo === 'despesa') despesasEntrada.push(item);
            }
            return { clientesEntrada, despesasEntrada };
        }

        if (!dados || typeof dados !== 'object') return { clientesEntrada, despesasEntrada };

        const extrairArray = valor => {
            if (Array.isArray(valor)) return valor;
            if (typeof valor !== 'string') return [];
            try {
                const convertido = JSON.parse(valor);
                return Array.isArray(convertido) ? convertido : [];
            } catch (_) {
                return [];
            }
        };

        const candidatosClientes = extrairArray(dados.clientes);
        if (!candidatosClientes.length) {
            candidatosClientes.push(...extrairArray(dados.cobrancas));
        }

        const candidatosDespesas = extrairArray(dados.despesas);
        if (!candidatosDespesas.length) {
            candidatosDespesas.push(...extrairArray(dados.contas));
        }

        clientesEntrada.push(...candidatosClientes);
        despesasEntrada.push(...candidatosDespesas);

        const itensGenericos = Array.isArray(dados.itens) ? dados.itens : [];
        for (const item of itensGenericos) {
            const tipo = inferirTipoRegistroImportado(item);
            if (tipo === 'cliente') clientesEntrada.push(item);
            else if (tipo === 'despesa') despesasEntrada.push(item);
        }

        return { clientesEntrada, despesasEntrada };
    };
    const separarColunasImportacao = linha => {
        const delimitador = [';', '|', '\t'].find(item => linha.includes(item));
        if (!delimitador) return null;

        const partes = linha.split(delimitador).map(parte => parte.trim());

        // Em colagens com tabulacao (planilhas), colunas vazias deslocam "nome/valor".
        // Para esse caso, compactamos vazios e preservamos o formato tradicional com ';'.
        if (delimitador === ';') return partes;
        return partes.filter(parte => parte.length > 0);
    };

    const parseTextoImportacaoColagem = texto => {
        const bruto = textoLimpoImportacao(texto);
        if (!bruto) {
            return { clientesEntrada: [], despesasEntrada: [], ignoradas: 0, detalhes: [] };
        }

        try {
            const dados = JSON.parse(bruto);
            const extraidos = extrairRegistrosJsonImportacao(dados);
            return {
                clientesEntrada: extraidos.clientesEntrada,
                despesasEntrada: extraidos.despesasEntrada,
                ignoradas: 0,
                detalhes: []
            };
        } catch (_) {
            // segue para parser por linhas
        }

        const linhas = bruto.split(/\r?\n/);
        const clientesEntrada = [];
        const despesasEntrada = [];
        const detalhes = [];
        let ignoradas = 0;
        let modoAtual = null;
        const dataPadrao = obterDataPadraoImportacao();

        for (let i = 0; i < linhas.length; i += 1) {
            const numeroLinha = i + 1;
            const linha = textoLimpoImportacao(linhas[i]);
            if (!linha) continue;
            if (/^(#|\/\/)/.test(linha)) continue;

            const matchClientes = linha.match(/^clientes?\s*:\s*(.*)$/i);
            if (matchClientes) {
                modoAtual = 'cliente';
                if (!textoLimpoImportacao(matchClientes[1])) continue;
            }

            const matchDespesas = linha.match(/^despesas?\s*:\s*(.*)$/i);
            if (matchDespesas) {
                modoAtual = 'despesa';
                if (!textoLimpoImportacao(matchDespesas[1])) continue;
            }

            const conteudo = matchClientes ? matchClientes[1] : (matchDespesas ? matchDespesas[1] : linha);
            let tipo = modoAtual;
            const colunas = separarColunasImportacao(conteudo);

            if (colunas) {
                const marcadorTipo = normalizarTipoImportacao(colunas[0]);
                if (marcadorTipo) {
                    tipo = marcadorTipo;
                    colunas.shift();
                }

                if (!tipo) tipo = 'cliente';
                if (colunas.length < 2) {
                    ignoradas += 1;
                    detalhes.push(`Linha ${numeroLinha}: faltam nome e valor.`);
                    continue;
                }

                if (tipo === 'cliente') {
                    const [nome, valor, data = '', telefone = '', pago = '', pagoParcial = ''] = colunas;
                    const valorNumero = parseNumeroImportacao(valor);
                    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
                        const fallback = parseLinhaLivreImportacao(conteudo, tipo, dataPadrao);
                        if (fallback?.tipo === 'cliente') {
                            clientesEntrada.push(fallback.registro);
                            continue;
                        }

                        ignoradas += 1;
                        detalhes.push(`Linha ${numeroLinha}: valor inválido.`);
                        continue;
                    }

                    const dataFinal = normalizarDataLinhaLivreImportacao(data, dataPadrao);
                    clientesEntrada.push({ nome, valor, data: dataFinal, telefone, pago, pagoParcial });
                } else {
                    const [nome, valor, data = '', status = '', recorrente = ''] = colunas;
                    const valorNumero = parseNumeroImportacao(valor);
                    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
                        const fallback = parseLinhaLivreImportacao(conteudo, tipo, dataPadrao);
                        if (fallback?.tipo === 'despesa') {
                            despesasEntrada.push(fallback.registro);
                            continue;
                        }

                        ignoradas += 1;
                        detalhes.push(`Linha ${numeroLinha}: valor inválido.`);
                        continue;
                    }

                    const dataFinal = normalizarDataLinhaLivreImportacao(data, dataPadrao);
                    despesasEntrada.push({ nome, valor, data: dataFinal, status, recorrente });
                }
                continue;
            }

            const linhaLivre = parseLinhaLivreImportacao(conteudo, tipo, dataPadrao);
            if (linhaLivre) {
                if (linhaLivre.tipo === 'despesa') despesasEntrada.push(linhaLivre.registro);
                else clientesEntrada.push(linhaLivre.registro);
                continue;
            }

            ignoradas += 1;
            detalhes.push(`Linha ${numeroLinha}: formato inválido. Use "Nome Valor [Data]" ou formato com C/D.`);
        }

        return { clientesEntrada, despesasEntrada, ignoradas, detalhes };
    };
    const importarListaPorColagem = ({ texto, substituir }) => {
        const resultadoParse = parseTextoImportacaoColagem(texto);

        const clientesBase = substituir ? [] : safeGetJSON(STORAGE.CLIENTES, []);
        const despesasBase = substituir ? [] : safeGetJSON(STORAGE.DESPESAS, []);

        const idsClientes = new Set(clientesBase.map(item => Number(item?.id)).filter(Number.isFinite));
        const idsDespesas = new Set(despesasBase.map(item => Number(item?.id)).filter(Number.isFinite));

        const clientesImportados = [];
        const despesasImportadas = [];

        for (let i = 0; i < resultadoParse.clientesEntrada.length; i += 1) {
            const normalizado = normalizarClienteImportado(resultadoParse.clientesEntrada[i], idsClientes, i);
            if (normalizado) clientesImportados.push(normalizado);
            else {
                resultadoParse.ignoradas += 1;
                resultadoParse.detalhes.push(`Cliente ignorado na posição ${i + 1}.`);
            }
        }

        for (let i = 0; i < resultadoParse.despesasEntrada.length; i += 1) {
            const normalizado = normalizarDespesaImportada(resultadoParse.despesasEntrada[i], idsDespesas, i);
            if (normalizado) despesasImportadas.push(normalizado);
            else {
                resultadoParse.ignoradas += 1;
                resultadoParse.detalhes.push(`Despesa ignorada na posição ${i + 1}.`);
            }
        }

        if (!clientesImportados.length && !despesasImportadas.length) {
            return {
                ok: false,
                mensagem: 'Nenhum item válido foi encontrado para importar.',
                detalhes: resultadoParse.detalhes
            };
        }

        const clientesFinal = substituir ? clientesImportados : [...clientesBase, ...clientesImportados];
        const despesasFinal = substituir ? despesasImportadas : [...despesasBase, ...despesasImportadas];

        safeSetJSON(STORAGE.CLIENTES, clientesFinal);
        safeSetJSON(STORAGE.DESPESAS, despesasFinal);

        return {
            ok: true,
            clientes: clientesImportados.length,
            despesas: despesasImportadas.length,
            ignoradas: resultadoParse.ignoradas,
            detalhes: resultadoParse.detalhes
        };
    };

    const garantirModalImportacaoColagem = () => {
        const doc = global.document;
        if (!doc?.body) return null;

        let modal = doc.getElementById(MODAL_IMPORTACAO_COLAGEM_ID);
        if (modal) return modal;

        modal = doc.createElement('div');
        modal.id = MODAL_IMPORTACAO_COLAGEM_ID;
        modal.className = 'modal-geral modal-importacao-colagem';
        modal.innerHTML = `
            <div class="modal-content modal-importacao-colagem-conteudo">
                <span class="close-modal" data-acao="fechar-importacao-colagem">&times;</span>
                <h3>Importar lista por colagem</h3>
                <p class="importacao-colagem-ajuda">
                    Cole JSON (clientes/despesas) ou linhas nos formatos:<br>
                    Nome Valor [Data opcional] (se faltar data: dia 10 do mês atual)<br>
                    C;Nome;Valor;Data(AAAA-MM-DD ou DD/MM/AAAA);Telefone;Pago;PagoParcial<br>
                    D;Nome;Valor;Data(AAAA-MM-DD ou DD/MM/AAAA);Status;Recorrente
                </p>
                <textarea id="importacao-colagem-texto" class="importacao-colagem-texto" placeholder="Exemplo:\nOTAVIO R$ 550,00\nKARLA R$ 500,00 10/02\nC;Ana Julia;280;10/02/2026;11999999999;não;0\nD;Internet;120;05/02/2026;pago;sim"></textarea>
                <label class="importacao-colagem-opcao">
                    <input type="checkbox" id="importacao-colagem-substituir">
                    <span>Substituir dados atuais (clientes e despesas)</span>
                </label>
                <div class="importacao-colagem-acoes">
                    <button type="button" class="btn-mini" data-acao="fechar-importacao-colagem">Cancelar</button>
                    <button type="button" class="btn-acao-principal" id="btn-importacao-colagem-confirmar">Importar</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', event => {
            if (event.target === modal) fecharImportadorColagem();
        });

        modal.querySelectorAll('[data-acao="fechar-importacao-colagem"]').forEach(item => {
            item.addEventListener('click', fecharImportadorColagem);
        });

        const botaoConfirmar = modal.querySelector('#btn-importacao-colagem-confirmar');
        if (botaoConfirmar) {
            botaoConfirmar.addEventListener('click', executarImportacaoColagem);
        }

        doc.body.appendChild(modal);
        return modal;
    };

    function abrirImportadorColagem() {
        fecharPopupsConfiguracoes();

        const appWrapper = global.document?.getElementById('app-wrapper');
        if (appWrapper) appWrapper.classList.add('sidebar-closed');

        const modal = garantirModalImportacaoColagem();
        if (!modal) return false;
        modal.style.display = 'flex';

        const textarea = modal.querySelector('#importacao-colagem-texto');
        if (textarea) {
            global.requestAnimationFrame(() => textarea.focus());
        }

        return true;
    }

    function fecharImportadorColagem() {
        const modal = global.document?.getElementById(MODAL_IMPORTACAO_COLAGEM_ID);
        if (!modal) return false;
        modal.style.display = 'none';
        return true;
    }

    function executarImportacaoColagem() {
        const modal = global.document?.getElementById(MODAL_IMPORTACAO_COLAGEM_ID);
        if (!modal) return false;

        const textarea = modal.querySelector('#importacao-colagem-texto');
        const checkSubstituir = modal.querySelector('#importacao-colagem-substituir');
        const texto = textarea ? textarea.value : '';
        const substituir = Boolean(checkSubstituir?.checked);

        if (!textoLimpoImportacao(texto)) {
            global.alert('Cole uma lista antes de importar.');
            return false;
        }

        const resultado = importarListaPorColagem({ texto, substituir });

        if (!resultado.ok) {
            const resumoDetalhes = Array.isArray(resultado.detalhes) && resultado.detalhes.length
                ? `\n\nDetalhes:\n- ${resultado.detalhes.slice(0, 4).join('\n- ')}`
                : '';
            global.alert(`${resultado.mensagem}${resumoDetalhes}`);
            return false;
        }

        const linhasResumo = [
            `Clientes adicionados: ${resultado.clientes}.`,
            `Despesas adicionadas: ${resultado.despesas}.`
        ];
        if (resultado.ignoradas > 0) {
            linhasResumo.push(`Linhas ignoradas: ${resultado.ignoradas}.`);
        }

        const resumoDetalhes = Array.isArray(resultado.detalhes) && resultado.detalhes.length
            ? `\n\nObservações:\n- ${resultado.detalhes.slice(0, 4).join('\n- ')}`
            : '';

        global.alert(`Importação concluída com sucesso.\n\n${linhasResumo.join('\n')}${resumoDetalhes}`);

        if (textarea) textarea.value = '';
        if (checkSubstituir) checkSubstituir.checked = false;

        fecharImportadorColagem();
        global.location.reload();
        return true;
    }

    const MP_USER_ACCESS_TOKEN_KEY = 'mp_user_access_token';
    const MP_USER_WEBHOOK_SECRET_KEY = 'mp_user_webhook_secret';
    const MP_USER_WHATSAPP_NUMERO_KEY = 'mp_user_whatsapp_numero';
    const MODAL_MP_CREDENCIAIS_ID = 'modal-mp-credenciais';

    const obterCredenciaisMercadoPagoUsuario = () => ({
        accessToken: String(safeGetItem(MP_USER_ACCESS_TOKEN_KEY, '') || '').trim(),
        webhookSecret: String(safeGetItem(MP_USER_WEBHOOK_SECRET_KEY, '') || '').trim(),
        whatsappNumero: String(safeGetItem(MP_USER_WHATSAPP_NUMERO_KEY, '') || '').trim()
    });

    const salvarCredenciaisMercadoPagoUsuario = ({ accessToken = '', webhookSecret = '', whatsappNumero = '' } = {}) => {
        const token = String(accessToken || '').trim();
        const secret = String(webhookSecret || '').trim();
        const numero = String(whatsappNumero || '').trim();

        if (token) safeSetItem(MP_USER_ACCESS_TOKEN_KEY, token);
        else safeRemoveItem(MP_USER_ACCESS_TOKEN_KEY);

        if (secret) safeSetItem(MP_USER_WEBHOOK_SECRET_KEY, secret);
        else safeRemoveItem(MP_USER_WEBHOOK_SECRET_KEY);

        if (numero) safeSetItem(MP_USER_WHATSAPP_NUMERO_KEY, numero);
        else safeRemoveItem(MP_USER_WHATSAPP_NUMERO_KEY);

        return { accessToken: token, webhookSecret: secret, whatsappNumero: numero };
    };

    const preencherModalCredenciaisMercadoPago = modal => {
        if (!(modal instanceof Element)) return false;
        const dados = obterCredenciaisMercadoPagoUsuario();
        const tokenEl = modal.querySelector('#mp-user-access-token');
        const secretEl = modal.querySelector('#mp-user-webhook-secret');
        const numeroEl = modal.querySelector('#mp-user-whatsapp-numero');
        const feedbackEl = modal.querySelector('#mp-user-credenciais-feedback');

        if (tokenEl) tokenEl.value = dados.accessToken;
        if (secretEl) secretEl.value = dados.webhookSecret;
        if (numeroEl) numeroEl.value = dados.whatsappNumero;
        if (feedbackEl) feedbackEl.textContent = '';
        return true;
    };

    const fecharModalCredenciaisMercadoPago = () => {
        const modal = global.document?.getElementById(MODAL_MP_CREDENCIAIS_ID);
        if (!modal) return false;
        modal.style.display = 'none';
        return true;
    };

    const salvarModalCredenciaisMercadoPago = () => {
        const modal = global.document?.getElementById(MODAL_MP_CREDENCIAIS_ID);
        if (!modal) return false;

        const tokenEl = modal.querySelector('#mp-user-access-token');
        const secretEl = modal.querySelector('#mp-user-webhook-secret');
        const numeroEl = modal.querySelector('#mp-user-whatsapp-numero');
        const feedbackEl = modal.querySelector('#mp-user-credenciais-feedback');

        salvarCredenciaisMercadoPagoUsuario({
            accessToken: tokenEl?.value ?? '',
            webhookSecret: secretEl?.value ?? '',
            whatsappNumero: numeroEl?.value ?? ''
        });

        if (feedbackEl) {
            feedbackEl.textContent = 'Credenciais salvas para o usuario atual.';
            feedbackEl.dataset.tipo = 'ok';
        }

        global.setTimeout(() => {
            fecharModalCredenciaisMercadoPago();
        }, 420);

        return true;
    };

    const limparModalCredenciaisMercadoPago = () => {
        const modal = global.document?.getElementById(MODAL_MP_CREDENCIAIS_ID);
        if (!modal) return false;

        salvarCredenciaisMercadoPagoUsuario({});
        preencherModalCredenciaisMercadoPago(modal);

        const feedbackEl = modal.querySelector('#mp-user-credenciais-feedback');
        if (feedbackEl) {
            feedbackEl.textContent = 'Credenciais removidas deste usuario.';
            feedbackEl.dataset.tipo = 'warn';
        }
        return true;
    };

    const garantirModalCredenciaisMercadoPago = () => {
        const doc = global.document;
        if (!doc?.body) return null;

        let modal = doc.getElementById(MODAL_MP_CREDENCIAIS_ID);
        if (modal) return modal;

        modal = doc.createElement('div');
        modal.id = MODAL_MP_CREDENCIAIS_ID;
        modal.className = 'modal-geral modal-mp-credenciais';
        modal.innerHTML = `
            <div class="modal-content modal-mp-credenciais-conteudo">
                <button type="button" class="close-modal close-modal-btn" id="btn-fechar-mp-credenciais" aria-label="Fechar">
                    <span aria-hidden="true">&times;</span>
                </button>
                <h3>Tokens Mercado Pago (usuario atual)</h3>
                <p class="mp-credenciais-ajuda">
                    Salvos por usuario. Usados nas chamadas do app para gerar link/PIX e consultar status.
                </p>
                <label class="mp-credenciais-campo">
                    <span>Access Token</span>
                    <input type="password" id="mp-user-access-token" autocomplete="off" placeholder="APP_USR-... ou TEST-...">
                </label>
                <label class="mp-credenciais-campo">
                    <span>Webhook Secret (opcional)</span>
                    <input type="password" id="mp-user-webhook-secret" autocomplete="off" placeholder="Segredo do webhook">
                </label>
                <label class="mp-credenciais-campo">
                    <span>WhatsApp recibo (opcional)</span>
                    <input type="text" id="mp-user-whatsapp-numero" autocomplete="tel" placeholder="5511999999999">
                </label>
                <p class="mp-credenciais-feedback" id="mp-user-credenciais-feedback" aria-live="polite"></p>
                <div class="mp-credenciais-acoes">
                    <button type="button" class="btn-mini" id="btn-mp-credenciais-limpar">Limpar</button>
                    <button type="button" class="btn-mini" id="btn-mp-credenciais-cancelar">Cancelar</button>
                    <button type="button" class="btn-acao-principal" id="btn-mp-credenciais-salvar">Salvar</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', event => {
            if (event.target === modal) fecharModalCredenciaisMercadoPago();
        });

        const fechar = () => fecharModalCredenciaisMercadoPago();
        modal.querySelector('#btn-fechar-mp-credenciais')?.addEventListener('click', fechar);
        modal.querySelector('#btn-mp-credenciais-cancelar')?.addEventListener('click', fechar);
        modal.querySelector('#btn-mp-credenciais-limpar')?.addEventListener('click', limparModalCredenciaisMercadoPago);
        modal.querySelector('#btn-mp-credenciais-salvar')?.addEventListener('click', salvarModalCredenciaisMercadoPago);

        doc.body.appendChild(modal);
        return modal;
    };

    const abrirModalCredenciaisMercadoPago = () => {
        fecharPopupsConfiguracoes();

        const appWrapper = global.document?.getElementById('app-wrapper');
        if (appWrapper) appWrapper.classList.add('sidebar-closed');

        const modal = garantirModalCredenciaisMercadoPago();
        if (!modal) return false;
        preencherModalCredenciaisMercadoPago(modal);
        modal.style.display = 'flex';

        const campo = modal.querySelector('#mp-user-access-token');
        if (campo && typeof global.requestAnimationFrame === 'function') {
            global.requestAnimationFrame(() => campo.focus());
        }
        return true;
    };

    const inserirBotaoExportacaoPlanilha = () => {
        const doc = global.document;
        if (!doc) return;

        const menus = doc.querySelectorAll('.configuracoes-menu-conteudo');
        if (!menus.length) return;

        for (const menu of menus) {
            if (!(menu instanceof Element)) continue;
            if (menu.querySelector('[data-exportar-planilha="1"]')) continue;

            const botao = doc.createElement('button');
            botao.type = 'button';
            botao.className = 'btn-backup btn-backup-sheet';
            botao.dataset.exportarPlanilha = '1';
            botao.innerHTML = '<i class="fa-solid fa-file-excel"></i><span>Exportar Excel / Sheets</span>';
            botao.addEventListener('click', exportarPlanilhaManual);

            const botaoExportar = menu.querySelector('.btn-backup-export');
            const botaoImportar = menu.querySelector('.btn-backup-import');

            if (botaoImportar && botaoImportar.parentNode === menu) {
                menu.insertBefore(botao, botaoImportar);
            } else if (botaoExportar && botaoExportar.parentNode === menu && botaoExportar.nextSibling) {
                menu.insertBefore(botao, botaoExportar.nextSibling);
            } else if (botaoExportar && botaoExportar.parentNode === menu) {
                menu.appendChild(botao);
            } else {
                const referencia = menu.querySelector('.backup-divider') || menu.querySelector('.btn-reset');
                if (referencia) menu.insertBefore(botao, referencia);
                else menu.appendChild(botao);
            }
        }
    };
    const inserirBotaoCredenciaisMercadoPago = () => {
        const doc = global.document;
        if (!doc) return;

        const menus = doc.querySelectorAll('.configuracoes-menu-conteudo');
        if (!menus.length) return;

        for (const menu of menus) {
            if (!(menu instanceof Element)) continue;
            if (menu.querySelector('[data-mp-credenciais="1"]')) continue;

            const botao = doc.createElement('button');
            botao.type = 'button';
            botao.className = 'btn-backup btn-backup-mp-credenciais';
            botao.dataset.mpCredenciais = '1';
            botao.innerHTML = '<i class="fa-solid fa-key"></i><span>Tokens Mercado Pago</span>';
            botao.addEventListener('click', abrirModalCredenciaisMercadoPago);

            const referencia = menu.querySelector('.backup-divider') || menu.querySelector('.btn-reset');
            if (referencia) menu.insertBefore(botao, referencia);
            else menu.appendChild(botao);
        }
    };
    const inserirBotaoImportacaoColagem = () => {
        const doc = global.document;
        if (!doc) return;

        const menus = doc.querySelectorAll('.configuracoes-menu-conteudo');
        if (!menus.length) return;

        for (const menu of menus) {
            if (!(menu instanceof Element)) continue;
            if (menu.querySelector('[data-importacao-colagem="1"]')) continue;

            const botao = doc.createElement('button');
            botao.type = 'button';
            botao.className = 'btn-backup btn-backup-paste';
            botao.dataset.importacaoColagem = '1';
            botao.innerHTML = '<i class="fa-solid fa-paste"></i><span>Importar por colagem</span>';
            botao.addEventListener('click', abrirImportadorColagem);

            const referencia = menu.querySelector('.backup-divider') || menu.querySelector('.btn-reset');
            if (referencia) menu.insertBefore(botao, referencia);
            else menu.appendChild(botao);
        }
    };

    const inserirBotaoFecharPopupConfiguracoes = () => {
        const doc = global.document;
        if (!doc) return;

        const paineis = doc.querySelectorAll('.configuracoes-menu-conteudo');
        if (!paineis.length) return;

        const fecharMenuPopup = menu => {
            if (!(menu instanceof Element)) return false;

            menu.classList.remove('popup-open');
            menu.classList.remove('expanded');

            const botaoMenu = menu.querySelector('.btn-configuracoes-toggle');
            const painelMenu = menu.querySelector('.configuracoes-menu-conteudo');

            if (botaoMenu) botaoMenu.setAttribute('aria-expanded', 'false');
            if (painelMenu) painelMenu.setAttribute('aria-hidden', 'true');

            atualizarEstadoPopupConfiguracoes();
            return true;
        };

        for (const painel of paineis) {
            if (!(painel instanceof Element)) continue;
            if (painel.querySelector('[data-config-popup-close="1"]')) continue;

            const botao = doc.createElement('button');
            botao.type = 'button';
            botao.className = 'configuracoes-popup-fechar';
            botao.dataset.configPopupClose = '1';
            botao.setAttribute('aria-label', 'Fechar configurações');
            botao.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

            botao.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const menu = botao.closest('.configuracoes-menu');
                fecharMenuPopup(menu);
            });

            painel.prepend(botao);
        }
    };

    const inicializarImportadorColagem = () => {
        inserirBotaoExportacaoPlanilha();
        inserirBotaoImportacaoColagem();
        inserirBotaoCredenciaisMercadoPago();
        inserirBotaoFecharPopupConfiguracoes();
        garantirModalImportacaoColagem();
        garantirModalNomeBackup();
        garantirModalCredenciaisMercadoPago();
    };

    const iniciarImportadorColagemQuandoPronto = () => {
        if (!global.document) return;
        inicializarImportadorColagem();
        global.setTimeout(inicializarImportadorColagem, 220);
    };

    if (global.document?.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', iniciarImportadorColagemQuandoPronto, { once: true });
    } else {
        iniciarImportadorColagemQuandoPronto();
    }

    const normalizarVersaoPatchPorSw = swVersion => {
        const raw = String(swVersion ?? '').trim();
        if (!raw) return '';
        const match = raw.match(/finances-pwa-v(\d{4})-(\d{2})-(\d{2})-(\d+)/i);
        if (match) return `${match[1]}.${match[2]}.${match[3]}-${match[4]}`;
        return raw;
    };

    const obterUltimaVersaoPatchNotesLocal = () => {
        const lista = safeParseJSON(safeGetRawStorageItem('menu_patch_notes_v1', null), []);
        if (!Array.isArray(lista) || !lista.length) return '';

        const ordenada = lista.slice().sort((a, b) => {
            const ta = Date.parse(a?.releasedAt);
            const tb = Date.parse(b?.releasedAt);
            if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
            if (Number.isNaN(ta)) return 1;
            if (Number.isNaN(tb)) return -1;
            return tb - ta;
        });

        return String(ordenada[0]?.version ?? '').trim();
    };

    const deveAbrirPatchNotesAutomaticoNoMenu = () => {
        const pendingRedirect = String(safeGetRawStorageItem('fin_pwa_post_update_menu_patchnotes', '') || '').trim() === '1';

        const latestVersion = obterUltimaVersaoPatchNotesLocal();
        const seenVersion = String(safeGetRawStorageItem('menu_patch_notes_last_seen_version', '') || '').trim();
        if (latestVersion && seenVersion !== latestVersion) return true;

        const backendSeen = String(safeGetRawStorageItem('menu_patch_notes_last_seen_backend_version', '') || '').trim();
        const backendCache = safeParseJSON(safeGetRawStorageItem('menu_backend_app_version_info_v1', null), null);
        const backendVersion = String(
            (backendCache?.version ?? backendCache?.backend?.version ?? '')
        ).trim();
        if (backendVersion && backendSeen !== backendVersion) return true;

        const frontendSeen = String(safeGetRawStorageItem('menu_patch_notes_last_seen_frontend_pwa_version', '') || '').trim();
        const frontendCache = safeParseJSON(safeGetRawStorageItem('menu_frontend_pwa_version_info_v1', null), null);
        const frontendVersion = normalizarVersaoPatchPorSw(frontendCache?.swVersion ?? frontendCache?.version ?? '');
        if (frontendVersion && frontendSeen !== frontendVersion) return true;

        return pendingRedirect;
    };

    const resolveMenuHrefWithAutoPatchNotes = (destino = 'menu.html') => {
        const destinoRaw = String(destino ?? '').trim() || 'menu.html';
        if (!/menu\.html/i.test(destinoRaw)) return destinoRaw;

        try {
            const base = global.location?.origin || 'http://localhost';
            const url = new URL(destinoRaw, base);
            const patchParamAtual = String(url.searchParams.get('patchnotes') || '').toLowerCase();
            if (patchParamAtual === '1' || patchParamAtual === 'true' || patchParamAtual === 'open') {
                if (/^https?:\/\//i.test(destinoRaw)) return url.toString();
                const pathAtual = String(url.pathname || 'menu.html').replace(/^\//, '') || 'menu.html';
                return `${pathAtual}${url.search}${url.hash}`;
            }

            if (!deveAbrirPatchNotesAutomaticoNoMenu()) return destinoRaw;

            url.searchParams.set('patchnotes', '1');
            if (String(safeGetRawStorageItem('fin_pwa_post_update_menu_patchnotes', '') || '').trim() === '1') {
                url.searchParams.set('updated', '1');
            }

            if (/^https?:\/\//i.test(destinoRaw)) return url.toString();
            const path = String(url.pathname || 'menu.html').replace(/^\//, '') || 'menu.html';
            return `${path}${url.search}${url.hash}`;
        } catch (_) {
            return destinoRaw;
        }
    };

    const iniciarAnimacaoEntradaPagina = (duracaoMs = DURACAO_ENTRADA_PAGINA_PADRAO) => {
        const body = global.document?.body;
        if (!body) return;
        if (body.dataset.pageOpenAnimated === '1') return;

        const reduzirMovimento = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduzirMovimento) {
            body.dataset.pageOpenAnimated = '1';
            return;
        }

        body.dataset.pageOpenAnimated = '1';
        body.classList.add(CLASSE_ENTRADA_PAGINA);

        global.requestAnimationFrame(() => {
            global.requestAnimationFrame(() => {
                body.classList.add(CLASSE_ENTRADA_PAGINA_ATIVA);
            });
        });

        const limpezaMs = Math.max(420, Number(duracaoMs) || DURACAO_ENTRADA_PAGINA_PADRAO);
        global.setTimeout(() => {
            body.classList.remove(CLASSE_ENTRADA_PAGINA);
            body.classList.remove(CLASSE_ENTRADA_PAGINA_ATIVA);
        }, limpezaMs + 140);
    };

    global.alternarTemaExecutivo = alternarTemaExecutivo;
    global.irParaResumoAnoExecutivo = irParaResumoAnoExecutivo;
    global.alternarTemaComAnimacao = alternarTemaComAnimacao;
    global.toggleSidebarPadrao = toggleSidebarPadrao;
    global.aplicarEstadoInicialSidebarPadrao = aplicarEstadoInicialSidebarPadrao;
    global.configurarGestosSidebarMobilePadrao = configurarGestosSidebarMobilePadrao;
    global.confirmarResetSistema = confirmarResetSistema;
    global.togglePainelConfiguracoes = togglePainelConfiguracoes;
    global.abrirImportadorColagem = abrirImportadorColagem;
    global.fecharImportadorColagem = fecharImportadorColagem;
    global.executarImportacaoColagem = executarImportacaoColagem;
    global.exportarPlanilhaManual = exportarPlanilhaManual;
    global.exportarBackupStorage = exportarBackupStorage;
    global.importarBackupStorage = importarBackupStorage;
    global.abrirModalCredenciaisMercadoPago = abrirModalCredenciaisMercadoPago;
    global.fecharModalCredenciaisMercadoPago = fecharModalCredenciaisMercadoPago;

    global.FinCommon = Object.freeze({
        LIMITE_HISTORICO_PADRAO,
        DURACAO_ENTRADA_PAGINA_PADRAO,
        STORAGE,
        NOMES_MESES,
        getEl,
        formatarMoeda,
        parseValorInput,
        formatarDataBr,
        getDataLocal,
        getHojeLocal,
        escapeHtml,
        safeGetItem,
        safeSetItem,
        safeRemoveItem,
        safeClearStorage,
        safeClearUserStorage,
        safeGetJSON,
        safeSetJSON,
        safeGetNumber,
        limitarHistorico,
        baixarJson,
        carregarTema,
        carregarTemaExecutivo,
        alternarTemaExecutivo,
        irParaResumoAnoExecutivo,
        alternarTemaComAnimacao,
        toggleSidebarPadrao,
        aplicarEstadoInicialSidebarPadrao,
        configurarGestosSidebarMobilePadrao,
        confirmarResetSistema,
        togglePainelConfiguracoes,
        abrirImportadorColagem,
        fecharImportadorColagem,
        executarImportacaoColagem,
        abrirModalCredenciaisMercadoPago,
        fecharModalCredenciaisMercadoPago,
        obterCredenciaisMercadoPagoUsuario,
        salvarCredenciaisMercadoPagoUsuario,
        resolveMenuHrefWithAutoPatchNotes,
        deveAbrirPatchNotesAutomaticoNoMenu,
        exportarPlanilhaManual,
        exportarBackupStorage,
        importarBackupStorage,
        iniciarAnimacaoEntradaPagina
    });
})(window);



























