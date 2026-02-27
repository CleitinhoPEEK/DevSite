const Auth = window.FinAuth;
if (!Auth) {
    throw new Error('auth.js não foi carregado antes de login.js');
}
const I18n = window.FinI18n;
const t = (key, fallback, vars) => (I18n && typeof I18n.t === 'function'
    ? I18n.t(key, vars, fallback)
    : (fallback ?? key));

const form = document.getElementById('login-form');
const inputUsuario = document.getElementById('login-usuario');
const inputSenha = document.getElementById('login-senha');
const titulo = document.getElementById('login-titulo');
const subtitulo = document.getElementById('login-subtitulo');
const botaoSubmit = document.getElementById('login-submit');
const feedback = document.getElementById('login-feedback');

const params = new URLSearchParams(window.location.search);
const destino = Auth.resolverDestinoPosLogin(params.get('next'));

const definirFeedback = (mensagem, erro = false) => {
    if (!feedback) return;
    feedback.textContent = mensagem || '';
    feedback.classList.toggle('erro', Boolean(erro));
    feedback.classList.toggle('ok', Boolean(mensagem) && !erro);
};

const usuarioAtual = Auth.obterUsuarioAtualAutenticacao();
if (usuarioAtual) {
    window.location.href = destino;
}

const modoPrimeiroAcesso = !Auth.temUsuariosAutenticacao();
const aplicarTextosPrimeiroAcesso = () => {
    if (!modoPrimeiroAcesso) return;
    if (titulo) titulo.textContent = t('login.firstAccessTitle', 'Primeiro acesso');
    if (subtitulo) subtitulo.textContent = t('login.firstAccessSubtitle', 'Defina seu usuário proprietário para liberar o sistema.');
    if (botaoSubmit) botaoSubmit.textContent = t('login.firstAccessSubmit', 'Criar proprietário');
};
aplicarTextosPrimeiroAcesso();
window.addEventListener('fin:i18n-change', aplicarTextosPrimeiroAcesso);

if (form) {
    form.addEventListener('submit', event => {
        event.preventDefault();

        const usuario = inputUsuario ? inputUsuario.value : '';
        const senha = inputSenha ? inputSenha.value : '';

        const resultado = modoPrimeiroAcesso
            ? Auth.criarUsuarioInicial(usuario, senha)
            : Auth.autenticarUsuario(usuario, senha);

        if (!resultado.ok) {
            definirFeedback(resultado.mensagem || t('login.loginError', 'Não foi possível entrar.'), true);
            return;
        }

        definirFeedback(t('login.loginOkRedirecting', 'Acesso liberado. Redirecionando...'), false);
        window.location.href = destino;
    });
}
