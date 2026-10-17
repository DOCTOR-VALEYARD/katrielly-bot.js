/* =================================================
   🎵 KATRIELLY BOT — MUSICA V7 🎀
   📁 musica.js
   🎀 Criadora: ·.¸¸.·KATRIELLY ·.¸¸.·

   V6.7
   ✅ .play Artista -> escolhe uma música do artista
   ✅ .play Artista Música -> procura a música
   ✅ .play Música -> procura a música
   ✅ Busca vários resultados antes do download
   ✅ SOMENTE 1 download
   ✅ Retry automático trocando de cliente do YouTube (android/default/ios)
      se um estiver bloqueado (403 / "confirme que não é robô")
   ✅ Áudio enviado no formato ORIGINAL (m4a/webm/opus) — sem conversão
      pra MP3, que era a etapa mais lenta (ffmpeg recodificando tudo).
      O WhatsApp toca esses formatos direto, sem perda de qualidade.
   ✅ Vídeo e documento mantidos
   ✅ Card final mantido
================================================= */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const axios = require('axios');

const config = require('../../config');
const { enviarNativeFlow, botao, botaoUrl } = require('../menuBotoes/menuBotoes');

const { buscarFotoContexto } =
    require('../foto-contexto/foto-contexto');

const { baixarAudioApi } =
    require('../ytapi/ytapi');

// youtubei.js é usado somente para pesquisar. O yt-dlp continua sendo o
// fallback automático e também continua responsável pelo download.
let youtubeiInstanciaPromise = null;

function obterYoutubei() {
    if (!youtubeiInstanciaPromise) {
        youtubeiInstanciaPromise = Promise.resolve()
            .then(() => require('youtubei.js'))
            .then(({ Innertube }) => Innertube.create())
            .catch(erro => {
                // Se a dependência ainda não foi instalada ou o YouTube.js
                // não conseguir iniciar, a busca antiga assume imediatamente.
                youtubeiInstanciaPromise = null;
                throw erro;
            });
    }
    return youtubeiInstanciaPromise;
}

// =================================================
// 🎵 CONFIGURAÇÃO
// =================================================

async function baixarTikTokDireto(url, destino) {
    const resposta = await axios.get("https://www.tikwm.com/api/", { params: { url }, timeout: 20000, headers: { "User-Agent": "Mozilla/5.0" } });
    const dados = resposta.data?.data || {};
    const urlVideo = dados.play || dados.wmplay || dados.hdplay;
    if (!urlVideo) throw new Error("TikTok não retornou uma URL de vídeo utilizável");
    const video = await axios.get(urlVideo, { responseType: "arraybuffer", timeout: 60000, headers: { "User-Agent": "Mozilla/5.0" } });
    fs.writeFileSync(destino, Buffer.from(video.data));
    return { titulo: dados.title || "TikTok" };
}

// =================================================
// ⬇️ yt-dlp — DETECTA O QUE JÁ EXISTE, E SÓ BAIXA SE PRECISAR E PUDER
// =================================================
// Ordem de busca:
//   1) binário próprio em config.MUSICA.BINARIO (se você definiu)
//   2) yt-dlp já instalado no aparelho/servidor (PATH) — ex.: Termux com
//      "pkg install yt-dlp" ou "pip install yt-dlp"
//   3) python -m yt_dlp (se o módulo estiver instalado)
//   4) binário baixado antes na pasta do bot
//   5) baixa o binário oficial do GitHub — SOMENTE em Linux x64/arm64/armv7
//      (hospedagens). No Termux/Android o binário não roda, então NÃO baixa
//      e NÃO dá erro: o áudio do /play segue funcionando pelas APIs.
//
// O yt-dlp só é necessário para vídeo/TikTok/Instagram e como busca reserva.

const { execFile } = require('child_process');

function pastaEscrevivel() {
    for (const dir of [process.cwd(), path.join(__dirname, '..', '..'), os.tmpdir()]) {
        try { fs.accessSync(dir, fs.constants.W_OK); return dir; } catch {}
    }
    return os.tmpdir();
}

const YTDLP_PATH = path.join(pastaEscrevivel(), 'yt-dlp');
const YTDLP_URL_BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const YTDLP_MAX_IDADE_MS = 7 * 24 * 60 * 60 * 1000;

// Cookies opcionais: se existir cookies.txt na pasta do bot, é usado sozinho.
const COOKIES_PATH = [
    path.join(process.cwd(), 'cookies.txt'),
    path.join(__dirname, 'cookies.txt'),
    path.join(__dirname, '..', '..', 'cookies.txt')
].find(p => fs.existsSync(p)) || null;

function ehTermux() {
    return process.platform === 'android'
        || !!process.env.TERMUX_VERSION
        || String(process.env.PREFIX || '').includes('com.termux');
}

// Nome do binário oficial para este sistema (null = não existe/não roda aqui).
function nomeBinarioOficial() {
    if (ehTermux()) return null;
    if (process.platform !== 'linux') return null;
    if (process.arch === 'x64') return 'yt-dlp_linux';
    if (process.arch === 'arm64') return 'yt-dlp_linux_aarch64';
    if (process.arch === 'arm') return 'yt-dlp_linux_armv7l';
    return null;
}

function baixarArquivo(url, destino, redir = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                res.resume();
                if (redir <= 0) return reject(new Error('Redirecionamentos demais'));
                return resolve(baixarArquivo(res.headers.location, destino, redir - 1));
            }
            if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
            const arq = fs.createWriteStream(destino);
            res.pipe(arq);
            arq.on('finish', () => arq.close(() => resolve()));
            arq.on('error', reject);
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Testa se um comando funciona (ex.: "yt-dlp --version").
// Devolve a versão (ex.: "2025.11.12") ou null se o comando não existir/não rodar.
function testarComando(programa, argumentos) {
    return new Promise(resolve => {
        try {
            execFile(programa, argumentos, { timeout: 15000 }, (erro, stdout) => {
                const m = !erro && String(stdout || '').match(/\d{4}\.\d{2}\.\d{2}(?:\.\d+)?/);
                resolve(m ? m[0] : null);
            });
        } catch { resolve(null); }
    });
}

// Comando que será usado nos downloads (preenchido por garantirYtDlp).
let YTDLP_BIN = null;
let YTDLP_VERSAO = null;
let ytdlpPromise = null;
let avisouSemYtDlp = false;

function mensagemSemYtDlp() {
    return ehTermux()
        ? 'yt-dlp não está instalado no Termux. Para baixar vídeos/TikTok/Instagram rode: pkg install yt-dlp  (o áudio do /play funciona sem ele).'
        : 'yt-dlp indisponível neste servidor (o áudio do /play funciona pelas APIs).';
}

async function detectarYtDlp() {
    // 1) binário definido no config
    const configurado = config.MUSICA?.BINARIO;
    if (configurado && configurado !== 'yt-dlp') return configurado;

    // 2) já instalado no sistema (Termux: pkg install yt-dlp / pip install yt-dlp)
    YTDLP_VERSAO = await testarComando('yt-dlp', ['--version']);
    if (YTDLP_VERSAO) return 'yt-dlp';

    // 3) módulo Python
    for (const py of ['python3', 'python']) {
        YTDLP_VERSAO = await testarComando(py, ['-m', 'yt_dlp', '--version']);
        if (YTDLP_VERSAO) return `${py} -m yt_dlp`;
    }

    // 4) binário baixado antes (e ainda recente)
    const binarioOficial = nomeBinarioOficial();
    YTDLP_VERSAO = fs.existsSync(YTDLP_PATH) ? await testarComando(YTDLP_PATH, ['--version']) : null;
    if (YTDLP_VERSAO) {
        let velho = false;
        try { velho = Date.now() - fs.statSync(YTDLP_PATH).mtimeMs > YTDLP_MAX_IDADE_MS; } catch {}
        if (!velho || !binarioOficial) return `"${YTDLP_PATH}"`;
    }

    // 5) baixa — somente onde o binário oficial roda (hospedagem Linux)
    if (!binarioOficial) return null;   // Termux/Android/outros: não baixa, não dá erro

    console.log('⬇️ Baixando yt-dlp...');
    const temp = YTDLP_PATH + '.novo';
    try {
        await baixarArquivo(YTDLP_URL_BASE + binarioOficial, temp);
        fs.chmodSync(temp, 0o755);
        fs.renameSync(temp, YTDLP_PATH);
        console.log('✅ yt-dlp pronto em ' + YTDLP_PATH);
        YTDLP_VERSAO = '9999.99.99';   // baixado agora = versão mais recente
        return `"${YTDLP_PATH}"`;
    } catch (erro) {
        try { fs.unlinkSync(temp); } catch {}
        console.log('⚠️ Não consegui baixar o yt-dlp: ' + erro.message);
        if (fs.existsSync(YTDLP_PATH)) return `"${YTDLP_PATH}"`;  // usa o antigo se existir
        return null;
    }
}

// Retorna o comando do yt-dlp. Lança erro amigável se não existir (nunca trava o bot).
async function garantirYtDlp() {
    if (!ytdlpPromise) {
        ytdlpPromise = detectarYtDlp().then(bin => {
            YTDLP_BIN = bin;
            if (!bin && !avisouSemYtDlp) {
                avisouSemYtDlp = true;
                console.log('ℹ️ ' + mensagemSemYtDlp());
            }
            if (!bin) setTimeout(() => { ytdlpPromise = null; }, 10 * 60 * 1000).unref?.(); // tenta de novo depois
            return bin;
        });
    }
    const bin = await ytdlpPromise;
    if (!bin) throw new Error(mensagemSemYtDlp());
    return bin;
}

// Já procura quando o bot liga (silencioso se não houver).
garantirYtDlp().catch(() => {});

function comandoBase() {
    const extra = config.MUSICA?.ARGS_EXTRA ? ` ${config.MUSICA.ARGS_EXTRA}` : "";
    const cookies = COOKIES_PATH ? ` --cookies "${COOKIES_PATH}"` : "";
    // "--js-runtimes" só existe em yt-dlp novos; em versão antiga daria "no such option".
    const js = (!YTDLP_VERSAO || YTDLP_VERSAO >= '2025.11.01') ? ' --js-runtimes node' : '';
    return `${YTDLP_BIN || 'yt-dlp'}${js}${cookies}${extra}`;
}

// =================================================
// 🔠 BOLD
// =================================================

function toBold(str) {

    const BASE_UPPER = 0x1D400;
    const BASE_LOWER = 0x1D41A;
    const BASE_DIGIT = 0x1D7CE;

    return String(str)
        .normalize('NFD')
        .split('')
        .map(ch => {

            const code =
                ch.charCodeAt(0);

            if (
                code >= 65 &&
                code <= 90
            ) {
                return String.fromCodePoint(
                    BASE_UPPER +
                    code - 65
                );
            }

            if (
                code >= 97 &&
                code <= 122
            ) {
                return String.fromCodePoint(
                    BASE_LOWER +
                    code - 97
                );
            }

            if (
                code >= 48 &&
                code <= 57
            ) {
                return String.fromCodePoint(
                    BASE_DIGIT +
                    code - 48
                );
            }

            return ch;

        })
        .join('');
}

// =================================================
// ⏱️ DURAÇÃO
// =================================================

function formatDuration(s) {

    if (
        isNaN(s) ||
        s < 0
    ) {
        return "00:00";
    }

    const m =
        Math.floor(s / 60);

    const r =
        Math.floor(s % 60);

    return (
        String(m).padStart(2, '0') +
        ":" +
        String(r).padStart(2, '0')
    );
}

// =================================================
// 👁️ VISUALIZAÇÕES
// =================================================

function formatViews(n) {

    if (
        !n ||
        isNaN(n)
    ) {
        return "—";
    }

    return Number(n)
        .toLocaleString('pt-BR');
}

// =================================================
// 📅 DATA
// =================================================

function formatUploadDate(dateStr) {

    if (
        !dateStr ||
        String(dateStr).length !== 8
    ) {
        return "—";
    }

    const ano =
        String(dateStr).slice(0, 4);

    const mes =
        String(dateStr).slice(4, 6);

    const dia =
        String(dateStr).slice(6, 8);

    return `${dia}/${mes}/${ano}`;
}

// =================================================
// 🕐 HORA
// =================================================

function formatUploadTime(timestamp) {

    if (!timestamp) {
        return null;
    }

    try {

        return new Date(
            timestamp * 1000
        ).toLocaleTimeString(
            'pt-BR',
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );

    } catch {

        return null;
    }
}

// =================================================
// 🖼️ IMAGEM
// =================================================

function baixarImagem(url) {

    return new Promise(
        (resolve, reject) => {

            if (!url) {
                return reject(
                    new Error(
                        "URL da imagem vazia"
                    )
                );
            }

            https.get(
                url,
                res => {

                    if (
                        res.statusCode !== 200
                    ) {
                        return reject(
                            new Error(
                                `HTTP ${res.statusCode}`
                            )
                        );
                    }

                    const chunks = [];

                    res.on(
                        'data',
                        chunk => {
                            chunks.push(chunk);
                        }
                    );

                    res.on(
                        'end',
                        () => {

                            resolve(
                                Buffer.concat(
                                    chunks
                                )
                            );

                        }
                    );

                }
            ).on(
                'error',
                reject
            );
        }
    );
}

// =================================================
// ⏱️ LIMITE PARA OPERAÇÕES AUXILIARES
// =================================================
// Evita que capa, foto de contexto ou metadados do grupo deixem o
// comando pendurado depois que o áudio já foi entregue.
function comTimeout(promessa, tempoMs, valorFallback = null) {
    return Promise.race([
        Promise.resolve(promessa).catch(() => valorFallback),
        new Promise(resolve => {
            setTimeout(() => resolve(valorFallback), tempoMs);
        })
    ]);
}

// =================================================
// ⚙️ EXEC
// =================================================

function execPromise(
    comando,
    timeoutMs,
    ctl = null
) {

    return new Promise(
        (resolve, reject) => {

            console.log(
                `▶️ Comando: ${comando}`
            );

            // Com "ctl", o comando roda com "exec" na frente: o shell é
            // substituído pelo yt-dlp, então cancelar mata o processo de verdade.
            const filho = exec(
                ctl ? `exec ${comando}` : comando,
                {
                    maxBuffer:
                        1024 * 1024 * 30,

                    timeout:
                        timeoutMs
                },

                (
                    err,
                    stdout,
                    stderr
                ) => {

                    if (err) {

                        const detalhe =
                            (
                                stderr ||
                                err.message ||
                                ""
                            )
                            .trim()
                            .split('\n')
                            .filter(Boolean)
                            .slice(-3)
                            .join(' | ')
                            .slice(0, 800);

                        return reject(
                            new Error(
                                detalhe ||
                                "Falha no comando."
                            )
                        );
                    }

                    resolve({
                        stdout:
                            stdout || "",

                        stderr:
                            stderr || ""
                    });
                }
            );
            if (ctl) ctl.filho = filho;
        }
    );
}

// =================================================
// 🧹 LIMPEZA
// =================================================

function limparArquivos(
    template
) {

    // Igual ao encontrarArquivo: limpa QUALQUER arquivo com esse nome de
    // template, seja qual for a extensão que o yt-dlp tenha usado —
    // assim não sobra lixo de tentativas que falharam no meio do caminho.
    const pasta =
        path.dirname(template);

    const prefixo =
        path.basename(template);

    let arquivos = [];

    try {
        arquivos =
            fs.readdirSync(pasta);
    } catch {
        return;
    }

    for (
        const nome of arquivos
    ) {

        if (
            !nome.startsWith(prefixo)
        ) continue;

        try {
            fs.unlinkSync(
                path.join(pasta, nome)
            );
        } catch {}
    }
}

// =================================================
// ✂️ GARANTE QUE SÓ VAI ÁUDIO (sem vídeo grudado)
// =================================================
//
// Alguns clientes do YouTube (o "android"/"ios" usados aqui pra driblar
// bloqueio) às vezes não expõem uma trilha de áudio separada — nesse
// caso o fallback de formato escolhido baixe o VÍDEO inteiro junto
// (muito mais pesado, é por isso que às vezes a música demora mais pra
// enviar: o arquivo é maior do que precisa). Aqui a gente confere se
// veio vídeo junto e, se vier, tira só o áudio com cópia direta (sem
// recodificar — é rápido) antes de mandar pro WhatsApp.
async function garantirSoAudio(caminho) {
    // O WhatsApp/Baileys aceita os formatos de áudio entregues pelo yt-dlp
    // (m4a/webm/opus/mp3). Não recodificar: isso elimina a espera extra do
    // ffmpeg e preserva o arquivo original.
    if (!caminho || !fs.existsSync(caminho)) throw new Error("Arquivo de áudio não encontrado.");
    if (fs.statSync(caminho).size < 5000) throw new Error("Arquivo de áudio baixado está vazio ou incompleto.");
    return caminho;
}

// =================================================
// 🔎 ACHA ARQUIVO
// =================================================

function encontrarArquivo(
    template,
    modo
) {

    // Em vez de só procurar uma lista fixa de extensões (que pode não
    // bater com o container que aquele cliente específico do YouTube
    // devolveu), procura QUALQUER arquivo gerado com esse nome de
    // template, ignorando só os arquivos que sabemos que não são mídia
    // final (.part, .ytdl, .json, .description são sobras do yt-dlp).
    const pasta =
        path.dirname(template);

    const prefixo =
        path.basename(template);

    const IGNORAR = [
        '.part',
        '.ytdl',
        '.json',
        '.description',
        '.info.json',
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.vtt',
        '.ass',
        '.srt'
    ];

    let arquivos = [];

    try {
        arquivos =
            fs.readdirSync(pasta);
    } catch {
        return null;
    }

    for (
        const nome of arquivos
    ) {

        if (
            !nome.startsWith(prefixo)
        ) continue;

        if (
            IGNORAR.some(
                ext => nome.endsWith(ext)
            )
        ) continue;

        const caminho =
            path.join(pasta, nome);

        try {

            if (
                fs.statSync(caminho).size >= 5000
            ) {

                return caminho;
            }

        } catch {}
    }

    return null;
}

// =================================================
// 🔠 RÓTULOS
// =================================================

const L = {

    erroSemBusca:
        toBold("ERRO — SEM BUSCA"),

    motivo:
        toBold("MOTIVO"),

    comoUsar:
        toBold("COMO USAR"),

    video:
        toBold("VÍDEO"),

    documento:
        toBold("DOCUMENTO"),

    erroDownload:
        toBold("ERRO NO DOWNLOAD"),

    busca:
        toBold("BUSCA"),

    solicitadoPor:
        toBold("SOLICITADO POR"),

    info:
        toBold("INFO"),

    musicaEncontrada:
        toBold("MÚSICA ENCONTRADA"),

    musica:
        toBold("MÚSICA"),

    cantor:
        toBold("CANTOR"),

    canal:
        toBold("CANAL"),

    visualizacoes:
        toBold("VISUALIZAÇÕES"),

    publicadoEm:
        toBold("PUBLICADO EM"),

    musicaEnviada:
        toBold("MÚSICA ENVIADA"),

    katriellyBot:
        toBold("KATRIELLY BOT")
};

const LINHA =
    "━━━━━━━━━━━━━━━━━━━━";

// =================================================
// CONTROLE DE REFERÊNCIA
// =================================================

let aguardandoReferencia = null;

exports.setReferenciaEspera =
    ref => {

        aguardandoReferencia =
            ref;
    };

// =================================================
// 🔗 RESOLVE LINK CURTO DO TIKTOK
// =================================================

function resolverIdentidadeSolicitante(msg) {
    const pushName = String(msg?.pushName || "").trim();
    const key = msg?.key || {};
    const candidatos = [
        key.participantAlt,
        key.remoteJidAlt,
        key.participant,
        key.remoteJid
    ].filter(Boolean);

    const jidNumero = candidatos.find(jid =>
        /@(s\.whatsapp\.net|c\.us)$/i.test(String(jid))
    );

    const numero = jidNumero
        ? String(jidNumero).split("@")[0].replace(/\D/g, "")
        : "";

    const nome = pushName || (numero ? `+${numero}` : "Usuário");
    const exibicao = numero && pushName
        ? `${pushName} (+${numero})`
        : nome;

    return {
        nome,
        exibicao,
        numero,
        jid: jidNumero || candidatos[0] || ""
    };
}

function resolverRedirect(url, tentativas = 0) {
    return new Promise((resolve, reject) => {
        if (tentativas > 5) return resolve(url);

        let req;
        try {
            req = https.get(url, {
                headers: {
                    "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"
                }
            }, res => {
                const codigo = res.statusCode || 0;
                const destino = res.headers.location;
                res.resume();

                if (codigo >= 300 && codigo < 400 && destino) {
                    const proximo = new URL(destino, url).toString();
                    return resolverRedirect(proximo, tentativas + 1)
                        .then(resolve)
                        .catch(reject);
                }

                resolve(url);
            });
            req.on("error", () => resolve(url));
            req.setTimeout(12000, () => {
                req.destroy();
                resolve(url);
            });
        } catch {
            resolve(url);
        }
    });
}

// =================================================
// 🎵 COMANDO PRINCIPAL
// =================================================


// =================================================
// 🧠 RESULTADOS PENDENTES DO /PLAY
// =================================================
// Guarda somente os dados necessários para que o callback saiba qual
// resultado foi escolhido. Expira sozinho para não acumular memória.
const resultadosPlay = new Map();
const TEMPO_RESULTADO_PLAY = 10 * 60 * 1000;

function criarTokenPlay() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function salvarResultadoPlay(dados) {
    const token = criarTokenPlay();
    resultadosPlay.set(token, {
        ...dados,
        criadoEm: Date.now()
    });

    setTimeout(() => {
        resultadosPlay.delete(token);
    }, TEMPO_RESULTADO_PLAY);

    return token;
}

function limparNomeArquivo(nome, fallback = "arquivo") {
    const limpo = String(nome || fallback)
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return limpo || fallback;
}

function extrairJsonsYtDlp(stdout) {
    const saida = [];
    const linhas = String(stdout || "")
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    for (const linha of linhas) {
        try {
            const obj = JSON.parse(linha);
            if (obj && typeof obj === "object") saida.push(obj);
        } catch {}
    }
    return saida;
}

function extrairJsonYtDlp(stdout) {
    const lista = extrairJsonsYtDlp(stdout);
    return lista.length ? lista[lista.length - 1] : null;
}

// =================================================
// 🖼️ CAPA DA MÚSICA (thumbnail)
// =================================================
// Com --flat-playlist o yt-dlp quase sempre devolve só a lista "thumbnails"
// (e não o campo "thumbnail"), então a capa nunca aparecia. Aqui a gente
// monta uma lista de endereços possíveis e tenta um por um, sempre
// terminando na miniatura oficial do YouTube (i.ytimg.com), que existe
// para qualquer vídeo.
function listarUrlsCapa(info) {
    const urls = [];
    const add = (u) => {
        if (typeof u === 'string' && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
    };

    add(info?.thumbnail);

    if (Array.isArray(info?.thumbnails)) {
        const jpgs = info.thumbnails
            .filter(t => t && typeof t.url === 'string' && /\.jpe?g(\?|$)/i.test(t.url))
            .sort((a, b) => (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)));
        jpgs.forEach(t => add(t.url));
    }

    const id = info?.id || info?.display_id;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(String(id))) {
        add(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
        add(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`);
    }

    return urls;
}

async function baixarCapaMusica(info) {
    for (const url of listarUrlsCapa(info)) {
        const buffer = await comTimeout(baixarImagem(url), 3000, null);
        if (Buffer.isBuffer(buffer) && buffer.length > 2000) return buffer;
    }
    return null;
}

function textoYoutubei(valor, fallback = '') {
    if (valor == null) return fallback;
    try {
        const texto = String(valor).trim();
        return texto || fallback;
    } catch {
        return fallback;
    }
}

function numeroVisualizacoesYoutubei(valor) {
    const texto = textoYoutubei(valor).toLowerCase().replace(/\s/g, '');
    if (!texto) return 0;

    const sufixos = { k: 1e3, m: 1e6, b: 1e9, mil: 1e3, mi: 1e6, bi: 1e9 };
    const encontrado = texto.replace(/visualizações?|views?|devisualizações?/g, '')
        .replace(',', '.').match(/([\d.]+)(mil|mi|bi|k|m|b)?/);
    if (!encontrado) return 0;

    const base = Number(encontrado[1]);
    return Number.isFinite(base) ? Math.round(base * (sufixos[encontrado[2]] || 1)) : 0;
}

function segundosYoutubei(item) {
    const duracao = item?.duration;
    if (duracao && typeof duracao === 'object' && duracao.seconds != null) {
        return Number(duracao.seconds) || 0;
    }
    const texto = textoYoutubei(duracao || item?.length_text);
    const partes = texto.split(':').map(Number);
    if (!partes.length || partes.some(Number.isNaN)) return 0;
    return partes.length === 3
        ? partes[0] * 3600 + partes[1] * 60 + partes[2]
        : partes.length === 2 ? partes[0] * 60 + partes[1] : partes[0] || 0;
}

function normalizarResultadoYoutubei(item, busca) {
    const videoId = item?.video_id || item?.videoId || item?.id;
    if (!videoId) return null;

    const pagina = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnail = item?.best_thumbnail?.url || item?.thumbnails?.[0]?.url || null;
    const titulo = textoYoutubei(item?.title, busca);
    const autor = textoYoutubei(item?.author?.name || item?.author, '—');
    const publicado = textoYoutubei(item?.published, '');
    const visualizacoes = numeroVisualizacoesYoutubei(item?.view_count || item?.short_view_count);

    return {
        id: videoId,
        webpage_url: pagina,
        title: titulo,
        uploader: autor,
        channel: autor,
        duration: segundosYoutubei(item),
        view_count: visualizacoes,
        thumbnail,
        upload_date: null,
        timestamp: null,
        // Mantém a informação textual disponível sem interferir no download.
        description: publicado
    };
}

async function pesquisarResultadoYoutubei(busca, limite = 5) {
    const yt = await obterYoutubei();
    const pesquisa = await yt.search(busca, { type: 'video' });
    const maximo = Math.max(1, Math.min(Number(limite) || 5, 30));
    const candidatos = Array.from(pesquisa?.results || [])
        .map(item => normalizarResultadoYoutubei(item, busca))
        .filter(Boolean)
        .slice(0, maximo);

    if (!candidatos.length) {
        throw new Error('youtubei.js não retornou vídeos válidos.');
    }
    return { ...candidatos[0], candidatos };
}

async function pesquisarResultadoYtDlp(busca, limite = 5) {
    await garantirYtDlp();
    const link = busca.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/, "");
    const alvo = link
        ? link
        : `ytsearch${Math.max(1, Math.min(Number(limite) || 5, 30))}:${busca.replace(/"/g, '\\"')}`;

    const comando =
        `${comandoBase()} "${alvo}" ` +
        `--flat-playlist --playlist-end ${Math.max(1, Math.min(Number(limite) || 5, 30))} --skip-download ` +
        `--no-warnings --print-json`;

    const { stdout } = await execPromise(comando, 30000);
    const infos = extrairJsonsYtDlp(stdout);
    if (!infos.length) {
        throw new Error("Não encontrei informações para esse resultado.");
    }

    const candidatos = infos.map(info => {
        const videoId = info.id || info.display_id;
        const pagina = info.webpage_url ||
            (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
        if (!pagina) return null;
        return {
            ...info,
            webpage_url: pagina,
            title: info.title || busca,
            uploader: info.uploader || info.channel || "—",
            channel: info.channel || info.uploader || "—",
            duration: Number(info.duration || 0),
            view_count: Number(info.view_count || 0),
            thumbnail: listarUrlsCapa({ ...info, id: videoId })[0] || null,
            upload_date: info.upload_date || null,
            timestamp: info.timestamp || null
        };
    }).filter(Boolean);

    if (!candidatos.length) {
        throw new Error("Os resultados não possuem endereços de mídia válidos.");
    }

    return { ...candidatos[0], candidatos };
}

async function pesquisarResultado(busca, limite = 5) {
    // URLs já informadas continuam sendo resolvidas pelo fluxo original.
    if (!/https?:\/\/[^\s]+/i.test(busca)) {
        try {
            const resultado = await Promise.race([
                pesquisarResultadoYoutubei(busca, limite),
                new Promise((_, rejeitar) => setTimeout(
                    () => rejeitar(new Error('youtubei.js demorou demais.')),
                    12000
                ))
            ]);
            console.log('🔎 [youtubei.js] Busca concluída.');
            return resultado;
        } catch (erroYoutubei) {
            console.log(`🔎 [youtubei.js] Falhou, usando yt-dlp: ${erroYoutubei.message}`);
        }
    }

    return pesquisarResultadoYtDlp(busca, limite);
}

function formatarInfoPlay(info) {
    const duracao = formatDuration(info.duration);
    const visualizacoes = formatViews(info.view_count);

    let data = "";
    if (info.upload_date) {
        data = formatUploadDate(info.upload_date);
        if (info.timestamp) {
            const hora = formatUploadTime(info.timestamp);
            if (hora) data += ` às ${hora}`;
        }
    }

    return [
        `🎵 *${info.title || "Sem título"}*`,
        `👤 ${info.uploader || info.channel || "—"}`,
        `📺 ${info.channel || info.uploader || "—"}`,
        `⏱️ ${duracao || "—"}`,
        visualizacoes && visualizacoes !== "0" ? `👁️ ${visualizacoes}` : null,
        data ? `📅 ${data}` : null
    ].filter(Boolean).join("\n");
}


function obterLinkCanalMusica() {
    const candidatos = [
        config.CHANNEL_URL, config.CHANNEL_LINK, config.CHANNEL,
        config.CANAL_URL, config.CANAL_LINK, config.CANAL,
        config.CHANNEL_USERNAME, config.CANAL_USERNAME
    ];
    const valor = candidatos.find(v => typeof v === 'string' && v.trim());
    if (!valor) return null;
    const limpo = valor.trim();
    if (/^https?:\/\//i.test(limpo)) return limpo;
    if (/^(whatsapp\.com\/channel\/|wa\.me\/)/i.test(limpo)) return `https://${limpo}`;
    if (/^[A-Za-z0-9._-]+$/.test(limpo)) return `https://whatsapp.com/channel/${limpo}`;
    return null;
}

function obterLinkCriadorMusica() {
    const numero = String(config.OWNER_NUMBER || '').replace(/\D/g, '');
    return numero ? `https://wa.me/${numero}` : null;
}

async function enviarMensagemMusical(sock, jid, text, quoted, mentions) {
    const linkCanal = obterLinkCanalMusica();
    const buttons = [];
    if (linkCanal) buttons.push(botaoUrl("📢 ENTRAR NO CANAL", linkCanal));
    if (buttons.length) {
        return enviarNativeFlow(sock, jid, {
            text,
            footer: config.BOT_NAME || "LOBA KRYSSA - BOT",
            buttons,
            quoted,
            mentions
        });
    }
    return sock.sendMessage(jid, { text, mentions }, { quoted });
}

exports.baixarMusica = async function(sock, msg, args = []) {
    const from = msg?.key?.remoteJid;
    if (!from) return;

    let busca = [...args].join(" ").trim();

    // Compatibilidade: .play mp4 nome e .play video nome continuam
    // sendo aceitos, mas agora NÃO iniciam download automaticamente.
    busca = busca.replace(/^(mp4|video|vídeo|doc|documento)\s+/i, "").trim();

    if (!busca || busca.length < 2) {
        return enviarMensagemMusical(
            sock,
            from,
`〔 ❌ ${L.erroSemBusca} 〕\n\nUse:\n${config.PREFIX}play nome da música\n\nDepois escolha o formato:\n🎵 ÁUDIO\n🎬 VÍDEO\n📄 DOCUMENTO`,
            msg
        );
    }

    try {
        const info = await pesquisarResultado(busca);
        const token = salvarResultadoPlay({
            jid: from,
            solicitante: msg?.key?.participant || msg?.key?.remoteJid,
            url: info.webpage_url,
            info,
            candidatos: info.candidatos || [info]
        });

        const capaBuffer = await baixarCapaMusica(info);

        const texto = [
            `〔 🎵 RESULTADO 〕`,
            formatarInfoPlay(info),
            "Escolha o formato abaixo:"
        ].join("\n");

        const buttons = [
            botao("🎵 ÁUDIO", `play_audio:${token}`),
            botao("🎬 VÍDEO", `play_video:${token}`),
            botao("📄 DOCUMENTO", `play_doc:${token}`)
        ];

        // Em toda mensagem do fluxo musical, o canal fica disponível
        // diretamente, sem abrir outro menu.
        const linkCanal = obterLinkCanalMusica();
        if (linkCanal) buttons.push(botaoUrl("📢 ENTRAR NO CANAL", linkCanal));

        await enviarNativeFlow(sock, from, {
            text: texto,
            footer: config.BOT_NAME || "Katrielly Bot",
            buttons,
            imageBuffer: capaBuffer,
            quoted: msg
        });

    } catch (erro) {
        console.error("❌ /play pesquisa:", erro);
        await enviarMensagemMusical(
            sock,
            from,
`〔 ❌ ${L.erroDownload} 〕\n\nNão consegui pesquisar esse resultado.\n\n🔍 Busca: *${busca}*\n⚠️ ${erro.message || "Erro desconhecido."}`,
            msg
        );
    }
};

// =================================================
// 📥 DOWNLOAD APÓS ESCOLHA DO BOTÃO
// =================================================

async function baixarResultadoPlay(sock, msg, token, modo, opcoes = {}) {
    const silencioso = !!opcoes.silencioso;
    const from = msg?.key?.remoteJid;
    const resultado = resultadosPlay.get(token);

    if (!from || !resultado) {
        return enviarMensagemMusical(sock, from, "⚠️ Esse resultado do /play expirou. Faça a pesquisa novamente.", msg);
    }

    // Evita que outra pessoa use o callback de um resultado privado/grupo.
    const autor = msg?.key?.participant || msg?.key?.remoteJid;
    if (resultado.jid !== from || (resultado.solicitante && autor && resultado.solicitante !== autor)) {
        return enviarMensagemMusical(sock, from, "⚠️ Esse resultado foi solicitado por outro usuário.", msg);
    }

    const info = resultado.info || {};
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const template = path.join(__dirname, id);

    const titulo = limparNomeArquivo(info.title || "resultado");
    const candidatos = Array.isArray(resultado.candidatos) && resultado.candidatos.length
        ? resultado.candidatos
        : [info];

    let arquivoReal = null;

    try {
        if (!silencioso) {
            await enviarMensagemMusical(
                sock,
                from,
                `〔 ⏳ PREPARANDO 〕\n\n🎵 *${info.title || "resultado"}*\n📦 ${modo === "audio" ? "ÁUDIO" : modo === "video" ? "VÍDEO" : "DOCUMENTO"}\n\nAguarde o envio...`,
                msg
            );
        }

        const ehAudio = modo === "audio";
        const formato = ehAudio
            ? `-f "bestaudio/best"`
            : `-f "best[ext=mp4]/best"`;

        let ultimoErro = null;

        // Mostra "gravando áudio..." / "digitando..." enquanto baixa.
        try { await sock.sendPresenceUpdate(ehAudio ? "recording" : "composing", from); } catch {}

        // =========================================================
        // 🔒 CLIENTES DO yt-dlp
        // =========================================================
        // Nenhum dos fluxos converte o áudio para MP3/AAC/Opus: o arquivo
        // baixado é enviado no formato original.
        const clientes = [
            '--extractor-args "youtube:player_client=android,ios"',
            '--extractor-args "youtube:player_client=android"',
            ''
        ];

        // /play: baixa SÓ o que apareceu no resultado (não troca por outra música).
        const alvosYt = [candidatos[0] || info];
        const TIMEOUT_YT = ehAudio ? 50000 : 120000;
        const dormir = ms => new Promise(r => setTimeout(r, ms));

        // Erros que são do VÍDEO (indisponível, privado, bloqueado...): trocar de
        // cliente não adianta, então pula direto pro próximo vídeo.
        const erroDoVideo = e => /unavailable|private video|has been removed|terminated|not available in your country|blocked it|copyright|confirm your age|members-only|live event|premiere/i
            .test(String(e?.message || ''));

        const matarFilho = ctl => { try { ctl?.filho?.kill('SIGKILL'); } catch {} };

        // ---------- yt-dlp ----------
        const rodarYtDlp = async (tmpl, ctl) => {
            try { await garantirYtDlp(); } catch (e) { ultimoErro = e; return null; }
            for (const candidato of alvosYt) {
                if (ctl?.cancelado) return null;
                const alvo = String(candidato.webpage_url || candidato.url || resultado.url || "").replace(/"/g, '\\"');
                if (!alvo) continue;

                for (const cliente of clientes) {
                    if (ctl?.cancelado) return null;
                    const comando =
                        `${comandoBase()} "${alvo}" ` +
                        `${formato} --no-playlist --no-warnings ` +
                        `${cliente} --retries 1 --fragment-retries 1 --concurrent-fragments 8 ` +
                        `--socket-timeout 10 --extractor-retries 1 ` +
                        `--print-json -o "${tmpl}.%(ext)s"`;
                    try {
                        const { stdout } = await execPromise(comando, TIMEOUT_YT, ctl);
                        const achado = encontrarArquivo(tmpl, modo);
                        if (!achado) throw new Error("O download terminou, mas o arquivo não foi encontrado.");
                        const baixadoInfo = extrairJsonYtDlp(stdout);
                        return { arquivo: achado, titulo: baixadoInfo?.title || null, alvo: candidato, origem: 'yt-dlp' };
                    } catch (erro) {
                        if (ctl?.cancelado) return null;
                        ultimoErro = erro;
                        limparArquivos(tmpl);
                        if (erroDoVideo(erro)) break; // próximo vídeo
                        if (/429|too many requests/i.test(String(erro.message))) await dormir(1200);
                    }
                }
            }
            return null;
        };

        // ---------- API (só áudio) ----------
        const usarApi = ehAudio && config.MUSICA?.USAR_API !== false;

        const rodarApi = async (tmpl, ctl) => {
            const duracaoMax = Number(config.MUSICA?.API_MAX_DURACAO ?? 1200);
            const alvosApi = [{ ...info, webpage_url: info.webpage_url || info.url || resultado.url }];

            for (const alvoApi of alvosApi) {
                if (ctl.cancelado) return null;
                const linkApi = alvoApi.webpage_url || alvoApi.url;
                const duracao = Number(alvoApi.duration || 0);
                if (!linkApi) continue;
                if (duracaoMax > 0 && duracao > duracaoMax) {
                    console.log(`🎵 [API] Pulada: duração ${duracao}s acima do limite (${duracaoMax}s).`);
                    continue;
                }
                try {
                    const via = await baixarAudioApi(linkApi, tmpl, { qualidade: config.MUSICA?.API_QUALIDADE || 128 });
                    const achado = encontrarArquivo(tmpl, modo);
                    if (!achado) throw new Error("O download pela API terminou, mas o arquivo não foi encontrado.");
                    return { arquivo: achado, titulo: via.titulo || null, alvo: alvoApi, origem: 'api' };
                } catch (erroApi) {
                    console.log(`🎵 [API] Falhou: ${erroApi.message}`);
                    ultimoErro = erroApi;
                    limparArquivos(tmpl);
                    if (/em pausa/i.test(String(erroApi.message))) break; // API toda fora: nem insiste
                }
            }
            return null;
        };

        // Aplica o resultado de quem GANHOU (arquivo e título).
        const aplicarVencedor = v => {
            arquivoReal = v.arquivo;
            if (v.titulo && (v.origem === 'yt-dlp' || !info.title)) info.title = v.titulo;
        };

        if (usarApi && config.MUSICA?.AUDIO_SOMENTE_API !== false) {
            // 🎀 ÁUDIO SOMENTE POR API / BIBLIOTECA (sem yt-dlp).
            // Cadeia: Savetube → Vreden → YouTube.js (src/ytapi + src/ytlib).
            // Se a cadeia inteira falhar, tenta de novo uma vez antes de desistir.
            let r = null;
            for (let tentativa = 1; tentativa <= 2 && !r; tentativa++) {
                r = await rodarApi(`${template}_api`, { cancelado: false });
                if (!r && tentativa < 2) await dormir(1500);
            }
            if (r) {
                console.log(`⚡ [MÚSICA] Entregue por: ${r.origem}`);
                aplicarVencedor(r);
            }
        } else if (usarApi) {
            // ⚡ CORRIDA: a API começa na hora; se ela não entregar em HEDGE_MS
            // (ou falhar), o yt-dlp entra em paralelo. Vence quem terminar primeiro
            // e o outro é cancelado. Assim a espera é a do mais rápido, não a soma.
            const hedgeMs = Number(config.MUSICA?.HEDGE_MS ?? 3500);
            const ctlApi = { cancelado: false };
            const ctlYt = { cancelado: false, filho: null };
            const tmplApi = `${template}_api`;
            const tmplYt = `${template}_yt`;

            const apiP = rodarApi(tmplApi, ctlApi).catch(() => null);
            const ytP = (async () => {
                let apiRes = null;
                await Promise.race([apiP.then(r => { apiRes = r; }), dormir(hedgeMs)]);
                if (apiRes) return null; // API já entregou
                return rodarYtDlp(tmplYt, ctlYt);
            })().catch(() => null);

            const vencedor = await new Promise(resolve => {
                let restantes = 2;
                const fim = () => { if (--restantes === 0) resolve(null); };
                apiP.then(r => { if (r) resolve(r); }).finally(fim);
                ytP.then(r => { if (r) resolve(r); }).finally(fim);
            });

            if (vencedor?.origem === 'api') {
                ctlYt.cancelado = true; matarFilho(ctlYt);
                ytP.finally(() => limparArquivos(tmplYt));
            } else {
                ctlApi.cancelado = true;
                apiP.finally(() => limparArquivos(tmplApi));
            }
            if (vencedor) {
                console.log(`⚡ [MÚSICA] Entregue por: ${vencedor.origem}`);
                aplicarVencedor(vencedor);
            }
        } else {
            const r = await rodarYtDlp(template, null);
            if (r) aplicarVencedor(r);
        }

        if (!arquivoReal) {
            throw ultimoErro || new Error("Não foi possível baixar o resultado.");
        }

        if (ehAudio) {
            // NÃO converter, NÃO recodificar e NÃO extrair novamente.
            // O yt-dlp já baixou a faixa de áudio que será enviada.
            arquivoReal = await garantirSoAudio(arquivoReal);
        }

        const buffer = fs.readFileSync(arquivoReal);
        if (!buffer.length) throw new Error("O arquivo baixado está vazio.");

        const ext = path.extname(arquivoReal).toLowerCase();

        if (modo === "audio") {
            const mimetype =
                ext === ".webm" ? "audio/ogg; codecs=opus" :
                ext === ".opus" ? "audio/ogg; codecs=opus" :
                ext === ".mp3" ? "audio/mpeg" :
                "audio/mp4";

            await sock.sendMessage(from, {
                audio: buffer,
                mimetype,
                fileName: `${titulo}${ext || ".m4a"}`,
                ptt: false
            }, { quoted: msg });

        } else if (modo === "video") {
            await sock.sendMessage(from, {
                video: buffer,
                mimetype: ext === ".webm" ? "video/webm" : "video/mp4",
                fileName: `${titulo}${ext || ".mp4"}`
            }, { quoted: msg });

        } else {
            await sock.sendMessage(from, {
                document: buffer,
                mimetype: ext === ".webm" ? "video/webm" : "video/mp4",
                fileName: `${titulo}${ext || ".mp4"}`
            }, { quoted: msg });
        }

        if (!silencioso) {
            await enviarMensagemMusical(
                sock,
                from,
`〔 ✅ CONCLUÍDO 〕\n\n🎵 *${info.title || titulo}*\n📦 ${modo === "audio" ? "Áudio" : modo === "video" ? "Vídeo" : "Documento"}\n\n✨ Enviado com sucesso!`,
                msg
            );
        }

    } catch (erro) {
        console.error("❌ /play download:", erro);
        await enviarMensagemMusical(
            sock,
            from,
`〔 ❌ ERRO NO DOWNLOAD 〕\n\n🎵 *${info.title || "Resultado"}*\n⚠️ ${erro.message || "Não foi possível concluir o download."}`,
            msg
        );
    } finally {
        limparArquivos(template);
        resultadosPlay.delete(token);
    }
}

exports.processarEscolhaPlay = async function(sock, msg, idBotao) {
    const match = String(idBotao || "").match(/^play_(audio|video|doc):(.+)$/);
    if (!match) return false;

    const modo = match[1];
    const token = match[2];

    // Silencioso: o único comentário do /play é o card do resultado (com a
    // capa). Depois do clique só chega a mídia — igual à música aleatória.
    await baixarResultadoPlay(sock, msg, token, modo, { silencioso: true });
    return true;
};
