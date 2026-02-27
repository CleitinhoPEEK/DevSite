(function attachFinAuth(global) {
    const Common = global.FinCommon;
    if (!Common) {
        throw new Error('common.js nÃ£o foi carregado antes de auth.js');
    }

    const {
        STORAGE,
        safeGetJSON,
        safeSetJSON,
        safeRemoveItem,
        safeClearUserStorage,
        escapeHtml
    } = Common;

    const STORAGE_USERS = STORAGE.AUTH_USERS || 'auth_usuarios';
    const STORAGE_SESSION = STORAGE.AUTH_SESSION || 'auth_sessao';
    const LOGIN_PAGE = 'login.html';
    const MODAL_AUTH_USERS_ID = 'modal-usuarios-auth';
    const DEV_PROFILE_PADRAO = Object.freeze({
        username: 'MayckUlian',
        password: 'change-me'
    });
    const DEV_PROFILES_PADRAO = Object.freeze([
        DEV_PROFILE_PADRAO,
        Object.freeze({
            username: 'User505',
            password: 'change-me'
        })
    ]);
    const I18n = global.FinI18n || null;
    const t = (key, fallback, vars) => (
        I18n && typeof I18n.t === 'function'
            ? I18n.t(key, vars, fallback)
            : (fallback ?? key)
    );

    const normalizarNomeUsuario = value => String(value ?? '').trim().replace(/\s+/g, ' ');
    const chaveUsuario = value => normalizarNomeUsuario(value).toLowerCase();

    const gerarHashSenha = (senha, salt = '') => {
        const texto = `${String(salt)}::${String(senha ?? '')}`;
        let hash = 0x811c9dc5;

        for (let i = 0; i < texto.length; i += 1) {
            hash ^= texto.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }

        return `h${(hash >>> 0).toString(16).padStart(8, '0')}`;
    };

    const gerarSalt = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const gerarTokenSessao = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;

    const normalizarRegistroUsuario = (item, index = 0) => {
        if (!item || typeof item !== 'object') return null;

        const username = normalizarNomeUsuario(item.username ?? item.nome ?? '');
        const usernameKey = chaveUsuario(item.usernameKey ?? username);
        const passwordHash = String(item.passwordHash ?? '');
        const salt = String(item.salt ?? '');

        if (!username || !usernameKey || !passwordHash || !salt) return null;

        const createdAt = Number(item.createdAt);
        const updatedAt = Number(item.updatedAt);

        const isDefaultDev = DEV_PROFILES_PADRAO.some(profile => usernameKey === chaveUsuario(profile.username));

        return {
            id: Number(item.id) || (Date.now() + index),
            username,
            usernameKey,
            passwordHash,
            salt,
            owner: Boolean(item.owner),
            developer: Boolean(item.developer) || isDefaultDev,
            createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
            updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
            sessionToken: String(item.sessionToken ?? '')
        };
    };

    const carregarUsuariosAuth = () => {
        const bruto = safeGetJSON(STORAGE_USERS, []);
        if (!Array.isArray(bruto)) return [];

        const normalizados = [];
        for (let i = 0; i < bruto.length; i += 1) {
            const item = normalizarRegistroUsuario(bruto[i], i);
            if (item) normalizados.push(item);
        }

        let houveMudancaDev = false;
        for (let i = 0; i < DEV_PROFILES_PADRAO.length; i += 1) {
            const perfilDev = DEV_PROFILES_PADRAO[i];
            const devUserKey = chaveUsuario(perfilDev.username);
            const usuarioDevExistente = normalizados.find(user => user.usernameKey === devUserKey);

            if (usuarioDevExistente) {
                if (!usuarioDevExistente.developer) {
                    usuarioDevExistente.developer = true;
                    usuarioDevExistente.updatedAt = Date.now();
                    houveMudancaDev = true;
                }
                continue;
            }

            const agora = Date.now();
            const salt = gerarSalt();
            normalizados.push({
                id: agora + normalizados.length,
                username: perfilDev.username,
                usernameKey: devUserKey,
                passwordHash: gerarHashSenha(perfilDev.password, salt),
                salt,
                owner: false,
                developer: true,
                createdAt: agora,
                updatedAt: agora,
                sessionToken: ''
            });
            houveMudancaDev = true;
        }

        if (houveMudancaDev) {
            safeSetJSON(STORAGE_USERS, normalizados);
        }

        if (normalizados.length && !normalizados.some(user => user.owner)) {
            normalizados[0].owner = true;
            normalizados[0].updatedAt = Date.now();
            safeSetJSON(STORAGE_USERS, normalizados);
        }

        return normalizados;
    };

    const salvarUsuariosAuth = users => safeSetJSON(STORAGE_USERS, users);

    const carregarSessaoAuth = () => {
        const sessao = safeGetJSON(STORAGE_SESSION, null);
        if (!sessao || typeof sessao !== 'object') return null;
        return {
            usernameKey: String(sessao.usernameKey ?? ''),
            token: String(sessao.token ?? ''),
            loginAt: Number(sessao.loginAt) || Date.now()
        };
    };

    const salvarSessaoAuth = ({ usernameKey, token }) => {
        if (!usernameKey || !token) return false;
        return safeSetJSON(STORAGE_SESSION, {
            usernameKey,
            token,
            loginAt: Date.now()
        });
    };

    const limparSessaoAuth = () => safeRemoveItem(STORAGE_SESSION);

    const usuarioPublico = user => (user
        ? {
            username: user.username,
            usernameKey: user.usernameKey,
            owner: Boolean(user.owner),
            developer: Boolean(user.developer)
        }
        : null);

    const obterUsuarioAutenticadoInterno = () => {
        const sessao = carregarSessaoAuth();
        if (!sessao?.usernameKey || !sessao?.token) {
            limparSessaoAuth();
            return null;
        }

        const usuarios = carregarUsuariosAuth();
        const usuario = usuarios.find(item => item.usernameKey === sessao.usernameKey);
        if (!usuario || !usuario.sessionToken || usuario.sessionToken !== sessao.token) {
            limparSessaoAuth();
            return null;
        }

        return usuario;
    };

    const obterArquivoPaginaAtual = () => {
        const pathname = String(global.location?.pathname ?? '');
        const arquivo = pathname.split('/').pop();
        return (arquivo || 'index.html').toLowerCase();
    };

    const isPaginaLogin = () => obterArquivoPaginaAtual() === LOGIN_PAGE;

    const resolverDestinoPosLogin = value => {
        const bruto = String(value ?? '').trim();
        if (!bruto) return 'index.html';
        if (/^https?:/i.test(bruto) || bruto.startsWith('//') || bruto.includes('\\')) return 'index.html';

        const semBarraInicial = bruto.replace(/^\/+/, '');
        const arquivo = semBarraInicial.split('?')[0].split('#')[0];

        if (!/^[a-zA-Z0-9._-]+\.html$/.test(arquivo)) return 'index.html';
        return semBarraInicial;
    };

    const destinoAtualParaLogin = () => {
        const arquivo = obterArquivoPaginaAtual();
        const query = String(global.location?.search ?? '');
        const hash = String(global.location?.hash ?? '');
        return `${arquivo}${query}${hash}`;
    };

    const redirecionarParaLogin = () => {
        const next = encodeURIComponent(destinoAtualParaLogin());
        global.location.href = `${LOGIN_PAGE}?next=${next}`;
    };

    function temUsuariosAutenticacao() {
        return carregarUsuariosAuth().length > 0;
    }

    function autenticarUsuario(username, senha) {
        const nome = normalizarNomeUsuario(username);
        const senhaTexto = String(senha ?? '');

        if (!nome || !senhaTexto) {
            return { ok: false, mensagem: t('auth.messages.enterUserPass', 'Informe usuario e senha.') };
        }

        const usuarios = carregarUsuariosAuth();
        if (!usuarios.length) {
            return { ok: false, codigo: 'sem_usuarios', mensagem: t('auth.messages.noUsers', 'Nenhum usuario cadastrado.') };
        }

        const usuario = usuarios.find(item => item.usernameKey === chaveUsuario(nome));
        if (!usuario) {
            return { ok: false, mensagem: t('auth.messages.invalidCredentials', 'Usuario ou senha invalidos.') };
        }

        const hash = gerarHashSenha(senhaTexto, usuario.salt);
        if (hash !== usuario.passwordHash) {
            return { ok: false, mensagem: t('auth.messages.invalidCredentials', 'Usuario ou senha invalidos.') };
        }

        const token = gerarTokenSessao();
        usuario.sessionToken = token;
        usuario.updatedAt = Date.now();
        salvarUsuariosAuth(usuarios);
        salvarSessaoAuth({ usernameKey: usuario.usernameKey, token });

        return { ok: true, user: usuarioPublico(usuario) };
    }

    function criarUsuarioInicial(username, senha) {
        const nome = normalizarNomeUsuario(username);
        const senhaTexto = String(senha ?? '');

        if (temUsuariosAutenticacao()) {
            return { ok: false, mensagem: t('auth.messages.alreadyHasUser', 'Ja existe usuario cadastrado.') };
        }

        if (nome.length < 3) {
            return { ok: false, mensagem: t('auth.messages.minUser', 'Use um nome com pelo menos 3 caracteres.') };
        }

        if (senhaTexto.length < 4) {
            return { ok: false, mensagem: t('auth.messages.minPass', 'Use uma senha com pelo menos 4 caracteres.') };
        }

        const agora = Date.now();
        const salt = gerarSalt();
        const token = gerarTokenSessao();
        const usuario = {
            id: agora,
            username: nome,
            usernameKey: chaveUsuario(nome),
            passwordHash: gerarHashSenha(senhaTexto, salt),
            salt,
            owner: true,
            createdAt: agora,
            updatedAt: agora,
            sessionToken: token
        };

        salvarUsuariosAuth([usuario]);
        salvarSessaoAuth({ usernameKey: usuario.usernameKey, token });
        return { ok: true, user: usuarioPublico(usuario) };
    }

    function salvarUsuarioPeloProprietÃ¡rio(username, senha) {
        const atual = obterUsuarioAutenticadoInterno();
        if (!atual?.owner) {
            return { ok: false, mensagem: t('auth.messages.onlyOwnerManage', 'Apenas o proprietario pode gerenciar usuarios.') };
        }

        const nome = normalizarNomeUsuario(username);
        const senhaTexto = String(senha ?? '');

        if (nome.length < 3) {
            return { ok: false, mensagem: t('auth.messages.minUser', 'Use um nome com pelo menos 3 caracteres.') };
        }

        if (senhaTexto.length < 4) {
            return { ok: false, mensagem: t('auth.messages.minPass', 'Use uma senha com pelo menos 4 caracteres.') };
        }

        const usuarios = carregarUsuariosAuth();
        const key = chaveUsuario(nome);
        const indice = usuarios.findIndex(item => item.usernameKey === key);
        const agora = Date.now();

        if (indice >= 0) {
            const usuario = usuarios[indice];
            usuario.username = nome;
            usuario.salt = gerarSalt();
            usuario.passwordHash = gerarHashSenha(senhaTexto, usuario.salt);
            usuario.updatedAt = agora;

            if (usuario.usernameKey === atual.usernameKey) {
                const novoToken = gerarTokenSessao();
                usuario.sessionToken = novoToken;
                salvarSessaoAuth({ usernameKey: usuario.usernameKey, token: novoToken });
            }

            salvarUsuariosAuth(usuarios);
            return { ok: true, atualizou: true, user: usuarioPublico(usuario) };
        }

        const salt = gerarSalt();
        const novoUsuario = {
            id: agora,
            username: nome,
            usernameKey: key,
            passwordHash: gerarHashSenha(senhaTexto, salt),
            salt,
            owner: false,
            createdAt: agora,
            updatedAt: agora,
            sessionToken: ''
        };
        usuarios.push(novoUsuario);
        salvarUsuariosAuth(usuarios);
        return { ok: true, atualizou: false, user: usuarioPublico(novoUsuario) };
    }

    function removerUsuarioPeloProprietÃ¡rio(usernameKey) {
        const atual = obterUsuarioAutenticadoInterno();
        if (!atual?.owner) {
            return { ok: false, mensagem: t('auth.messages.onlyOwnerRemove', 'Apenas o proprietario pode remover usuarios.') };
        }

        const key = chaveUsuario(usernameKey);
        if (!key) return { ok: false, mensagem: t('auth.messages.invalidUser', 'Usuario invalido.') };

        const usuarios = carregarUsuariosAuth();
        if (usuarios.length <= 1) {
            return { ok: false, mensagem: t('auth.messages.cannotRemoveLast', 'Nao e possivel remover o ultimo usuario.') };
        }

        const alvo = usuarios.find(item => item.usernameKey === key);
        if (!alvo) return { ok: false, mensagem: t('auth.messages.userNotFound', 'Usuario nao encontrado.') };
        if (alvo.owner) return { ok: false, mensagem: t('auth.messages.cannotRemoveOwner', 'Nao e permitido remover o proprietario.') };
        if (alvo.usernameKey === atual.usernameKey) {
            return { ok: false, mensagem: t('auth.messages.cannotRemoveSelf', 'Nao e permitido remover seu proprio usuario.') };
        }

        const restante = usuarios.filter(item => item.usernameKey !== key);
        salvarUsuariosAuth(restante);
        safeClearUserStorage(key);
        return { ok: true };
    }

    function listarUsuariosAutenticacao() {
        const usuarios = carregarUsuariosAuth();
        return usuarios
            .slice()
            .sort((a, b) => a.username.localeCompare(b.username, 'pt-BR'))
            .map(usuarioPublico);
    }

    function obterUsuarioAtualAutenticacao() {
        return usuarioPublico(obterUsuarioAutenticadoInterno());
    }

    function sairContaAutenticacao({ redirecionar = true } = {}) {
        const sessao = carregarSessaoAuth();
        const usuarios = carregarUsuariosAuth();
        if (sessao?.usernameKey && sessao?.token) {
            const usuario = usuarios.find(item => item.usernameKey === sessao.usernameKey && item.sessionToken === sessao.token);
            if (usuario) {
                usuario.sessionToken = '';
                usuario.updatedAt = Date.now();
                salvarUsuariosAuth(usuarios);
            }
        }

        limparSessaoAuth();
        if (redirecionar) global.location.href = LOGIN_PAGE;
        return true;
    }

    function exigirAutenticacaoPagina() {
        if (isPaginaLogin()) return true;
        const usuario = obterUsuarioAutenticadoInterno();
        if (usuario) return true;

        redirecionarParaLogin();
        return false;
    }

    const definirFeedbackModalUsuarios = (texto = '', erro = false) => {
        const modal = global.document?.getElementById(MODAL_AUTH_USERS_ID);
        if (!modal) return;

        const feedback = modal.querySelector('#usuarios-auth-feedback');
        if (!feedback) return;

        feedback.textContent = texto;
        feedback.classList.toggle('erro', Boolean(erro));
        feedback.classList.toggle('ok', Boolean(texto) && !erro);
    };

    const renderizarListaModalUsuarios = () => {
        const modal = global.document?.getElementById(MODAL_AUTH_USERS_ID);
        if (!modal) return;

        const listaEl = modal.querySelector('#usuarios-auth-lista');
        if (!listaEl) return;

        const usuarios = listarUsuariosAutenticacao();
        const atual = obterUsuarioAtualAutenticacao();

        if (!usuarios.length) {
            listaEl.innerHTML = '<li class="usuarios-auth-item usuarios-auth-vazio">' + escapeHtml(t('auth.messages.noUsersRegistered', 'Nenhum usuario cadastrado.')) + '</li>';
            return;
        }

        listaEl.innerHTML = usuarios.map(usuario => {
            const isAtual = atual?.usernameKey === usuario.usernameKey;
            const podeExcluir = !usuario.owner && !isAtual;

            return `
                <li class="usuarios-auth-item">
                    <div class="usuarios-auth-item-main">
                        <strong>${escapeHtml(usuario.username)}</strong>
                        <div class="usuarios-auth-badges">
                            ${usuario.owner ? `<span class="usuarios-auth-badge usuarios-auth-badge-owner">${escapeHtml(t('auth.labels.owner', 'Proprietario'))}</span>` : `<span class="usuarios-auth-badge">${escapeHtml(usuario.developer ? t('auth.labels.developer', 'Desenvolvedor') : t('auth.labels.user', 'Usuario'))}</span>`}
                            ${isAtual ? `<span class="usuarios-auth-badge usuarios-auth-badge-current">${escapeHtml(t('auth.labels.activeSession', 'Sessao ativa'))}</span>` : ''}
                        </div>
                    </div>
                    <button type="button" class="btn-mini usuarios-auth-remover" data-auth-remover="${escapeHtml(usuario.usernameKey)}" ${podeExcluir ? '' : 'disabled'}>
                        ${escapeHtml(t('common.remove', 'Remover'))}
                    </button>
                </li>
            `;
        }).join('');
    };

    const garantirModalUsuarios = () => {
        const doc = global.document;
        if (!doc?.body) return null;

        let modal = doc.getElementById(MODAL_AUTH_USERS_ID);
        if (modal) return modal;

        modal = doc.createElement('div');
        modal.id = MODAL_AUTH_USERS_ID;
        modal.className = 'modal-geral modal-usuarios-auth';
        modal.innerHTML = `
            <div class="modal-content modal-usuarios-auth-conteudo">
                <span class="close-modal" data-auth-close="1">&times;</span>
                <h3>${escapeHtml(t('auth.messages.usersAndPasswords', 'Usuarios e senhas'))}</h3>
                <p class="usuarios-auth-ajuda">${escapeHtml(t('auth.messages.helpOwnerOnly', 'Somente o proprietario pode cadastrar, alterar senha e remover usuarios.'))}</p>

                <div class="usuarios-auth-form">
                    <input type="text" id="usuarios-auth-nome" placeholder="${escapeHtml(t('auth.messages.userNamePlaceholder', 'Nome do usuario'))}" autocomplete="username">
                    <input type="password" id="usuarios-auth-senha" placeholder="${escapeHtml(t('auth.messages.passwordPlaceholder', 'Senha'))}" autocomplete="new-password">
                    <button type="button" class="btn-acao-principal" id="btn-usuarios-auth-salvar">${escapeHtml(t('auth.messages.saveUser', 'Salvar usuario'))}</button>
                </div>

                <p id="usuarios-auth-feedback" class="usuarios-auth-feedback" aria-live="polite"></p>
                <ul id="usuarios-auth-lista" class="usuarios-auth-lista"></ul>
            </div>
        `;

        modal.addEventListener('click', event => {
            if (event.target === modal) fecharModalUsuarios();
        });

        modal.querySelectorAll('[data-auth-close="1"]').forEach(botao => {
            botao.addEventListener('click', fecharModalUsuarios);
        });

        const botaoSalvar = modal.querySelector('#btn-usuarios-auth-salvar');
        if (botaoSalvar) {
            botaoSalvar.addEventListener('click', () => {
                const nomeEl = modal.querySelector('#usuarios-auth-nome');
                const senhaEl = modal.querySelector('#usuarios-auth-senha');
                const nome = nomeEl ? nomeEl.value : '';
                const senha = senhaEl ? senhaEl.value : '';

                const resultado = salvarUsuarioPeloProprietÃ¡rio(nome, senha);
                if (!resultado.ok) {
                    definirFeedbackModalUsuarios(resultado.mensagem, true);
                    return;
                }

                definirFeedbackModalUsuarios(
                    resultado.atualizou
                        ? t('auth.messages.passwordUpdated', 'Senha atualizada com sucesso.')
                        : t('auth.messages.userCreated', 'Usuario cadastrado com sucesso.'),
                    false
                );

                if (senhaEl) senhaEl.value = '';
                renderizarListaModalUsuarios();
                inserirControlesAutenticacaoMenu();
                inserirMenuUsuarioTopoSidebar();
            });
        }

        const listaEl = modal.querySelector('#usuarios-auth-lista');
        if (listaEl) {
            listaEl.addEventListener('click', event => {
                const alvo = event.target;
                if (!(alvo instanceof Element)) return;

                const botao = alvo.closest('[data-auth-remover]');
                if (!botao) return;

                const userKey = botao.getAttribute('data-auth-remover') || '';
                if (!userKey) return;

                if (!global.confirm(t('auth.messages.removeUserConfirm', 'Deseja remover este usuario?'))) return;
                const resultado = removerUsuarioPeloProprietÃ¡rio(userKey);
                if (!resultado.ok) {
                    definirFeedbackModalUsuarios(resultado.mensagem, true);
                    return;
                }

                definirFeedbackModalUsuarios(t('auth.messages.userRemoved', 'Usuario removido com sucesso.'), false);
                renderizarListaModalUsuarios();
                inserirControlesAutenticacaoMenu();
                inserirMenuUsuarioTopoSidebar();
            });
        }

        doc.body.appendChild(modal);
        return modal;
    };

    function abrirModalUsuarios() {
        const atual = obterUsuarioAtualAutenticacao();
        if (!atual?.owner) {
            global.alert(t('auth.messages.onlyOwnerManage', 'Apenas o proprietario pode gerenciar usuarios.'));
            return false;
        }

        const modal = garantirModalUsuarios();
        if (!modal) return false;

        modal.style.display = 'flex';
        definirFeedbackModalUsuarios('', false);
        renderizarListaModalUsuarios();

        const nomeEl = modal.querySelector('#usuarios-auth-nome');
        if (nomeEl) global.requestAnimationFrame(() => nomeEl.focus());

        return true;
    }

    function fecharModalUsuarios() {
        const modal = global.document?.getElementById(MODAL_AUTH_USERS_ID);
        if (!modal) return false;

        modal.style.display = 'none';
        definirFeedbackModalUsuarios('', false);
        return true;
    }


    function alternarMenuUsuarioTopo(menu, expandir) {
        if (!(menu instanceof Element)) return false;

        const deveExpandir = typeof expandir === 'boolean'
            ? expandir
            : !menu.classList.contains('expanded');

        const botao = menu.querySelector('.sidebar-usuario-toggle');
        menu.classList.toggle('expanded', deveExpandir);
        if (botao) botao.setAttribute('aria-expanded', deveExpandir ? 'true' : 'false');
        return deveExpandir;
    }

    function fecharMenusUsuarioTopo(excecao = null) {
        const doc = global.document;
        if (!doc) return;

        doc.querySelectorAll('.sidebar-usuario-menu.expanded').forEach(menu => {
            if (menu === excecao) return;
            alternarMenuUsuarioTopo(menu, false);
        });
    }

    function inserirMenuUsuarioTopoSidebar() {
        const doc = global.document;
        if (!doc) return;

        const atual = obterUsuarioAtualAutenticacao();
        const sidebars = doc.querySelectorAll('.sidebar');
        if (!sidebars.length) return;

        for (const sidebar of sidebars) {
            if (!(sidebar instanceof Element)) continue;

            let menu = sidebar.querySelector(':scope > .sidebar-usuario-menu');
            if (!atual) {
                if (menu) menu.remove();
                continue;
            }

            if (!menu) {
                menu = doc.createElement('div');
                menu.className = 'sidebar-usuario-menu';
                menu.innerHTML = `
                    <button type="button" class="sidebar-usuario-toggle" aria-expanded="false">
                        <span class="sidebar-usuario-identidade">
                            <i class="fa-solid fa-user"></i>
                            <span class="sidebar-usuario-textos">
                                <small>${escapeHtml(t('auth.labels.activeSession', 'Sessao ativa'))}</small>
                                <strong class="sidebar-usuario-nome"></strong>
                            </span>
                        </span>
                        <i class="fa-solid fa-chevron-down sidebar-usuario-seta" aria-hidden="true"></i>
                    </button>
                    <div class="sidebar-usuario-painel">
                        <button type="button" class="sidebar-usuario-acao sidebar-usuario-sair">
                            <i class="fa-solid fa-right-from-bracket"></i>
                            <span>${escapeHtml(t('auth.messages.logoutButton', 'Sair da conta'))}</span>
                        </button>
                    </div>
                `;

                sidebar.insertBefore(menu, sidebar.firstChild);
            }

            const nomeEl = menu.querySelector('.sidebar-usuario-nome');
            if (nomeEl) nomeEl.textContent = atual.username || t('menu.userGeneric', 'Usuario');

            const sessaoTipo = menu.querySelector('.sidebar-usuario-textos small');
            if (sessaoTipo) {
                sessaoTipo.textContent = atual.owner
                    ? t('auth.labels.owner', 'Proprietario')
                    : (atual.developer
                        ? t('auth.labels.developer', 'Desenvolvedor')
                        : t('auth.labels.activeSession', 'Sessao ativa'));
            }

            if (menu.dataset.authBound !== '1') {
                const botaoToggle = menu.querySelector('.sidebar-usuario-toggle');
                if (botaoToggle) {
                    botaoToggle.addEventListener('click', () => {
                        const abrir = !menu.classList.contains('expanded');
                        if (abrir) fecharMenusUsuarioTopo(menu);
                        alternarMenuUsuarioTopo(menu, abrir);
                    });
                }

                const botaoSair = menu.querySelector('.sidebar-usuario-sair');
                if (botaoSair) {
                    botaoSair.addEventListener('click', () => {
                        if (!global.confirm(t('auth.messages.logoutConfirm', 'Deseja sair da conta atual?'))) return;
                        sairContaAutenticacao({ redirecionar: true });
                    });
                }

                menu.dataset.authBound = '1';
            }

            alternarMenuUsuarioTopo(menu, false);
        }

        if (!doc.__finAuthSidebarMenuBound) {
            doc.addEventListener('click', event => {
                const alvo = event.target;
                if (!(alvo instanceof Element)) return;
                if (alvo.closest('.sidebar-usuario-menu')) return;
                fecharMenusUsuarioTopo();
            });

            doc.__finAuthSidebarMenuBound = '1';
        }
    }

    function inserirControlesAutenticacaoMenu() {
        const doc = global.document;
        if (!doc) return;

        const menus = doc.querySelectorAll('.configuracoes-menu-conteudo');
        if (!menus.length) return;

        const atual = obterUsuarioAtualAutenticacao();
        const owner = Boolean(atual?.owner);

        for (const menu of menus) {
            if (!(menu instanceof Element)) continue;

            let botaoUsuarios = menu.querySelector('[data-auth-open="1"]');
            if (!owner) {
                if (botaoUsuarios) botaoUsuarios.remove();
            } else {
                if (!botaoUsuarios) {
                    botaoUsuarios = doc.createElement('button');
                    botaoUsuarios.type = 'button';
                    botaoUsuarios.className = 'btn-backup btn-backup-users';
                    botaoUsuarios.dataset.authOpen = '1';
                    botaoUsuarios.innerHTML = '<i class="fa-solid fa-user-shield"></i><span>' + escapeHtml(t('auth.messages.usersAndPasswords', 'Usuarios e senhas')) + '</span>';
                    botaoUsuarios.addEventListener('click', event => {
                        abrirModalUsuarios();

                        const alvoBotao = event.currentTarget;
                        if (!(alvoBotao instanceof Element)) return;

                        const menuConfig = alvoBotao.closest('.configuracoes-menu');
                        if (!(menuConfig instanceof Element)) return;

                        menuConfig.classList.remove('popup-open');
                        menuConfig.classList.remove('expanded');

                        const botaoToggle = menuConfig.querySelector('.btn-configuracoes-toggle');
                        const painelMenu = menuConfig.querySelector('.configuracoes-menu-conteudo');

                        if (botaoToggle) botaoToggle.setAttribute('aria-expanded', 'false');
                        if (painelMenu) painelMenu.setAttribute('aria-hidden', 'true');
                        global.document?.body?.classList?.remove('config-popup-open');

                        // Fecha a sidebar (principalmente no mobile) ao abrir o modal de usuarios.
                        const appWrapper = global.document?.getElementById('app-wrapper');
                        if (appWrapper) appWrapper.classList.add('sidebar-closed');
                    });

                    const referencia = menu.querySelector('.backup-divider') || menu.querySelector('.btn-reset');
                    if (referencia) menu.insertBefore(botaoUsuarios, referencia);
                    else menu.appendChild(botaoUsuarios);
                }

                botaoUsuarios.disabled = false;
                botaoUsuarios.title = t('auth.messages.manageUsersTitle', 'Gerenciar usuarios e senhas');
            }

            const botaoSair = menu.querySelector('[data-auth-logout="1"]');
            if (botaoSair) botaoSair.remove();
        }
    }

    const inicializarAuthProtegido = () => {
        inserirMenuUsuarioTopoSidebar();
        inserirControlesAutenticacaoMenu();

        const atual = obterUsuarioAtualAutenticacao();
        if (atual?.owner) garantirModalUsuarios();
    };

    if (!global.__finAuthI18nBound) {
        global.addEventListener('fin:i18n-change', () => {
            inserirMenuUsuarioTopoSidebar();
            inserirControlesAutenticacaoMenu();
            const modal = global.document?.getElementById(MODAL_AUTH_USERS_ID);
            if (modal && modal.style.display !== 'none') {
                renderizarListaModalUsuarios();
            }
        });
        global.__finAuthI18nBound = true;
    }

    if (!isPaginaLogin()) {
        if (!exigirAutenticacaoPagina()) {
            return;
        }

        if (global.document?.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', inicializarAuthProtegido, { once: true });
        } else {
            inicializarAuthProtegido();
        }
        global.setTimeout(inicializarAuthProtegido, 220);
    }

    global.abrirModalUsuarios = abrirModalUsuarios;
    global.fecharModalUsuarios = fecharModalUsuarios;
    global.sairContaUsuario = () => sairContaAutenticacao({ redirecionar: true });

    global.FinAuth = Object.freeze({
        temUsuariosAutenticacao,
        autenticarUsuario,
        criarUsuarioInicial,
        salvarUsuarioPeloProprietÃ¡rio,
        removerUsuarioPeloProprietÃ¡rio,
        listarUsuariosAutenticacao,
        obterUsuarioAtualAutenticacao,
        sairContaAutenticacao,
        exigirAutenticacaoPagina,
        resolverDestinoPosLogin,
        abrirModalUsuarios,
        fecharModalUsuarios
    });
})(window);

