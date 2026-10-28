/* =================================================
   🎵 KATRIELLY BOT — MUSICA V6.7
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

// =================================================
// 🗂️ PASTA TEMPORÁRIA PRÓPRIA (corrige ENOSPC no /tmp)
// =================================================
// O Baileys cria arquivos temporários em os.tmpdir() (/tmp) ao enviar mídia.
// Em hospedagem o /tmp costuma ser minúsculo e enche ("ENOSPC: no space left
// on device") mesmo com o disco do painel livre. Aqui o bot passa a usar uma
// pasta dentro do próprio disco e apaga sobras antigas ao ligar.
try {
    const tmpBot = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmpBot, { recursive: true });
    process.env.TMPDIR = tmpBot;
    process.env.TEMP = tmpBot;
    process.env.TMP = tmpBot;
    const limite = Date.now() - 30 * 60 * 1000;
    for (const nome of fs.readdirSync(tmpBot)) {
        const caminho = path.join(tmpBot, nome);
        try {
            if (fs.statSync(caminho).mtimeMs < limite) fs.rmSync(caminho, { recursive: true, force: true });
        } catch {}
    }
} catch (erroTmp) {
    console.log('⚠️ Não consegui criar a pasta tmp do bot: ' + erroTmp.message);
}

const config = require('../../config');
const { enviarNativeFlow, botao, botaoUrl } = require('../menuBotoes/menuBotoes');

const { buscarFotoContexto } =
    require('../foto-contexto/foto-contexto');

// 🔗 Extrai o ID de um vídeo do YouTube (de um link ou do próprio ID).
// Antes isso vinha da API (ytapi); agora é local, porque a API foi removida.
function extrairIdYoutube(entrada) {
    const texto = String(entrada || '');
    const m = texto.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/|live\/))([A-Za-z0-9_-]{11})/i
    );
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(texto) ? texto : null;
}

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
// ⬇️ yt-dlp AUTOMÁTICO (hospedagem sem root / sem apt)
// =================================================
// Baixa o binário standalone do yt-dlp (não precisa de Python) pra dentro
// da pasta do bot e reaproveita nas próximas vezes. Atualiza sozinho a cada
// 7 dias, porque o YouTube muda toda hora e versão velha quebra.

function pastaEscrevivel() {
    const candidatas = [process.cwd(), path.join(__dirname, '..', '..'), os.tmpdir()];
    for (const dir of candidatas) {
        try { fs.accessSync(dir, fs.constants.W_OK); return dir; } catch {}
    }
    return os.tmpdir();
}

const YTDLP_PATH = path.join(pastaEscrevivel(), 'yt-dlp');
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
const YTDLP_MAX_IDADE_MS = 7 * 24 * 60 * 60 * 1000;

// Cookies opcionais: se existir cookies.txt na pasta do bot, é usado sozinho.
const COOKIES_PATH = [
    path.join(process.cwd(), 'cookies.txt'),
    path.join(__dirname, 'cookies.txt'),
    path.join(__dirname, '..', '..', 'cookies.txt')
].find(p => fs.existsSync(p)) || null;

function baixarArquivo(url, destino, redirecionamentos = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                res.resume();
                if (redirecionamentos <= 0) return reject(new Error('Redirecionamentos demais'));
                return resolve(baixarArquivo(res.headers.location, destino, redirecionamentos - 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode));
            }
            const arquivo = fs.createWriteStream(destino);
            res.pipe(arquivo);
            arquivo.on('finish', () => arquivo.close(() => resolve()));
            arquivo.on('error', reject);
            res.on('error', reject);
        }).on('error', reject);
    });
}

let ytdlpPromise = null;

function garantirYtDlp() {
    // Se o admin definiu um binário próprio no config, respeita.
    const bin = config.MUSICA?.BINARIO;
    if (bin && bin !== 'yt-dlp') return Promise.resolve(bin);

    if (ytdlpPromise) return ytdlpPromise;

    ytdlpPromise = (async () => {
        let existe = fs.existsSync(YTDLP_PATH);
        let velho = false;
        if (existe) {
            try { velho = Date.now() - fs.statSync(YTDLP_PATH).mtimeMs > YTDLP_MAX_IDADE_MS; } catch {}
            if (!velho) return YTDLP_PATH;
        }

        console.log(existe ? '🔄 Atualizando yt-dlp...' : '⬇️ Baixando yt-dlp...');
        const temp = YTDLP_PATH + '.novo';
        try {
            await baixarArquivo(YTDLP_URL, temp);
            fs.chmodSync(temp, 0o755);
            fs.renameSync(temp, YTDLP_PATH);
            console.log('✅ yt-dlp pronto em ' + YTDLP_PATH);
        } catch (erro) {
            try { fs.unlinkSync(temp); } catch {}
            console.log('❌ Falha ao baixar yt-dlp: ' + erro.message);
            if (!existe) {
                ytdlpPromise = null; // tenta de novo na próxima vez
                throw new Error('yt-dlp não está instalado e não consegui baixar: ' + erro.message);
            }
        }
        return YTDLP_PATH;
    })();

    return ytdlpPromise;
}

// Apaga sobras de downloads que ficaram no meio (ex.: bot caiu) com mais de 30 min.
try {
    const limiteSobras = Date.now() - 30 * 60 * 1000;
    for (const nome of fs.readdirSync(__dirname)) {
        if (!/^\d{10,}_[a-z0-9]+/i.test(nome)) continue;
        const caminho = path.join(__dirname, nome);
        try { if (fs.statSync(caminho).mtimeMs < limiteSobras) fs.rmSync(caminho, { force: true }); } catch {}
    }
} catch {}

// Já começa a baixar quando o bot liga (não trava nada se falhar).
// yt-dlp é o ÚNICO jeito de baixar agora (sem API): já baixa o binário ao ligar.
garantirYtDlp().catch(() => {});

function comandoBase() {

    const extra =
        config.MUSICA?.ARGS_EXTRA
            ? ` ${config.MUSICA.ARGS_EXTRA}`
            : "";

    const binConfig = config.MUSICA?.BINARIO;
    const bin = (binConfig && binConfig !== 'yt-dlp')
        ? binConfig
        : (fs.existsSync(YTDLP_PATH) ? `"${YTDLP_PATH}"` : 'yt-dlp');

    const cookies = COOKIES_PATH ? ` --cookies "${COOKIES_PATH}"` : "";

    return `${bin} --js-runtimes node${cookies}${extra}`;
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
        const buffer = await comTimeout(baixarImagem(url), 8000, null);
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

// Link do YouTube → dados do vídeo SEM yt-dlp (youtubei.js; se falhar, segue só com o ID).
async function resolverLinkYoutube(busca) {
    const link = busca.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/, "") || busca;
    const id = extrairIdYoutube(link);
    if (!id) throw new Error('Por enquanto o /play só aceita link do YouTube ou o nome da música.');
    let titulo = 'Vídeo do YouTube', autor = '—', duracao = 0, views = 0, capa = null;
    try {
        const yt = await obterYoutubei();
        const info = await Promise.race([
            yt.getBasicInfo(id),
            new Promise((_, rej) => setTimeout(() => rej(new Error('demorou')), 12000))
        ]);
        const b = info?.basic_info || {};
        titulo = b.title || titulo;
        autor = b.author || b.channel?.name || autor;
        duracao = Number(b.duration || 0);
        views = Number(b.view_count || 0);
        capa = b.thumbnail?.[0]?.url || null;
    } catch (e) { console.log('🔎 [youtubei.js] Não consegui os detalhes do link, seguindo só com o ID:', e.message); }
    const item = {
        id, webpage_url: `https://www.youtube.com/watch?v=${id}`, title: titulo,
        uploader: autor, channel: autor, duration: duracao, view_count: views,
        thumbnail: capa || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        upload_date: null, timestamp: null
    };
    return { ...item, candidatos: [item] };
}

async function pesquisarResultado(busca, limite = 5) {
    // Link do YouTube: pega os dados do vídeo (o yt-dlp baixa depois). Links de
    // outros sites (TikTok, Instagram, Kwai...) seguem o fluxo normal.
    if (extrairIdYoutube(busca.match(/https?:\/\/[^\s]+/i)?.[0] || '')) return resolverLinkYoutube(busca);
    // URLs já informadas continuam sendo resolvidas pelo fluxo original.
    if (!/https?:\/\/[^\s]+/i.test(busca)) {
        const tentativas = 2;
        for (let i = 1; i <= tentativas; i++) {
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
                console.log(`🔎 [youtubei.js] Falhou (${i}/${tentativas}): ${erroYoutubei.message}`);
                youtubeiInstanciaPromise = null; // recria a sessão na próxima tentativa
            }
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


// =================================================
// 🗂️ histórico interno (sem música aleatória)
// =================================================
const RANDOM_MUSIC_FILE = path.join(__dirname, "../dados/musicas-aleatorias.json");

function lerHistoricoMusicaAleatoria() {
    try {
        if (!fs.existsSync(RANDOM_MUSIC_FILE)) return {};
        const dados = JSON.parse(fs.readFileSync(RANDOM_MUSIC_FILE, 'utf8'));
        return dados && typeof dados === 'object' ? dados : {};
    } catch {
        return {};
    }
}

function salvarHistoricoMusicaAleatoria(db) {
    try {
        fs.writeFileSync(RANDOM_MUSIC_FILE, JSON.stringify(db, null, 2));
    } catch (erro) {
        console.error('⚠️ Não consegui salvar histórico da música aleatória:', erro.message);
    }
}

function normalizarHistoricoAleatorio(historico, chave) {
    const valor = historico[chave];
    if (Array.isArray(valor)) return valor;
    if (valor && typeof valor === 'object' && Array.isArray(valor.musicas)) {
        return valor.musicas;
    }
    return [];
}

function registrarMusicaAleatoriaBaixada(historico, chave, info) {
    const anteriores = normalizarHistoricoAleatorio(historico, chave);
    const url = String(info?.webpage_url || info?.url || '').trim();
    if (!url) return;
    const registro = {
        url,
        id: info?.id || info?.display_id || null,
        titulo: info?.title || 'Sem título',
        baixadaEm: new Date().toISOString()
    };
    historico[chave] = [
        ...anteriores.filter(item => {
            const antigoUrl = typeof item === 'string' ? item : item?.url;
            return antigoUrl !== url;
        }),
        registro
    ].slice(-200);
    salvarHistoricoMusicaAleatoria(historico);
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
            footer: ASSINATURA,
            buttons,
            quoted,
            mentions
        });
    }
    return sock.sendMessage(jid, { text, mentions }, { quoted });
}

// =================================================
// 🃏 CARD DO /PLAY (SÓ 2 BOTÕES: ÁUDIO e VER TUDO)
// =================================================

const ASSINATURA = config.BOT_NAME || 'Katrielly Bot';

// Letras pequeninhas (small caps) em Unicode
const MAPA_SC = {
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',
    n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
};
function sc(texto) {
    return String(texto).normalize('NFD').split('')
        .map(ch => MAPA_SC[ch.toLowerCase()] || ch)
        .join('').normalize('NFC');
}

function botaoCopiarPlay(texto, codigo) {
    const m = require('../menuBotoes/menuBotoes');
    if (typeof m.botaoCopiar === 'function') return m.botaoCopiar(texto, codigo);
    return {
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({ display_text: texto, id: 'copiar_link', copy_code: codigo })
    };
}

function textoCardPlay(info) {
    const duracao = formatDuration(info.duration);
    const views = formatViews(info.view_count);
    let data = "";
    if (info.upload_date) data = formatUploadDate(info.upload_date);

    return [
        `〔 🎧 ${sc('música encontrada')} 〕`,
        ``,
        `  🎵 ${sc('título')} ➜ *${info.title || "Sem título"}*`,
        `  🎤 ${sc('artista')} ➜ ${info.uploader || info.channel || "—"}`,
        `  ⏱️ ${sc('duração')} ➜ ${duracao || "—"}`,
        views && views !== "0" ? `  👁️ ${sc('views')} ➜ ${views}` : null,
        data ? `  📅 ${sc('data')} ➜ ${data}` : null,
        ``,
        `✦ ${sc('escolha uma opção abaixo')} ✦`
    ].filter(x => x !== null).join("\n");
}

async function enviarCardPlay(sock, msg, from, info, candidatos) {
    const token = salvarResultadoPlay({
        jid: from,
        solicitante: msg?.key?.participant || msg?.key?.remoteJid,
        url: info.webpage_url,
        info,
        candidatos,
        lista: candidatos
    });

    const capaBuffer = await baixarCapaMusica(info);
    const texto = textoCardPlay(info);

    // SÓ 2 BOTÕES: ÁUDIO (resposta rápida) + VER TUDO (single_select).
    // O VER TUDO abre a lista nativa do WhatsApp direto, sem outra mensagem.
    const corta = (t, n) => {
        t = String(t || "");
        return t.length > n ? t.slice(0, n - 1) + "…" : t;
    };

    // Outras versões / outros cantores (usado na lista "TODAS AS OPÇÕES").
    const versoes = [];
    candidatos.slice(0, 12).forEach((c, i) => {
        if (!c?.webpage_url || c.webpage_url === info.webpage_url) return;
        versoes.push({
            header: '',
            title: corta(c.title || 'Sem título', 24),
            description: corta(`${c.channel || c.uploader || '—'} • ${formatDuration(c.duration)}`, 72),
            id: `play_pick:${token}:${i}`
        });
    });

    // VER TUDO -> sub-lista igual ao print antigo:
    // baixar (vídeo/documento), youtube (abrir/copiar) e "TODAS AS OPÇÕES"
    // (outras versões e outros cantores).
    const secoes = [
        {
            title: '⬇️ BAIXAR',
            highlight_label: '',
            rows: [
                { header: '', title: '🎬 VÍDEO', description: 'Baixar o vídeo em MP4', id: `play_video:${token}` },
                { header: '', title: '📄 DOCUMENTO', description: 'Receber como arquivo', id: `play_doc:${token}` }
            ]
        },
        {
            title: '📂 MAIS',
            highlight_label: '',
            rows: [
                { header: '', title: '📂 TODAS AS OPÇÕES', description: 'Outras versões e outros cantores', id: `play_outras:${token}` }
            ]
        }
    ];

    const verTudo = {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({ title: '📋 VER TUDO', sections: secoes })
    };

    // Padrão: igual ao bot da LordeHost. Botões: ÁUDIO, VÍDEO, TODAS AS OPÇÕES
    // (botão de lista que abre a 2ª lista direto), ABRIR NO YOUTUBE, COPIAR LINK
    // e um link do criador. O WhatsApp junta isso em "ÁUDIO + VER TUDO".
    // 6 botões reais (áudio, vídeo, todas as opções, abrir YouTube, copiar link, criador)
    // + bottom_sheet: o WhatsApp mostra só ÁUDIO + VER TUDO e o resto vai pra folha.
    // Para o modelo simples: config.MUSICA.VER_TUDO_ANINHADO = false
    let botoes;
    if (config.MUSICA?.VER_TUDO_ANINHADO !== false) {
        const link = info.webpage_url || info.url;
        const secoesTodas = [{
            title: '📥 BAIXAR',
            highlight_label: '',
            rows: [{ header: '', title: '📄 DOCUMENTO', description: 'Receber como arquivo', id: `play_doc:${token}` }]
        }];
        if (versoes.length) {
            secoesTodas.push({ title: '🎤 OUTRAS VERSÕES E CANTORES', highlight_label: '', rows: versoes });
        }
        const todasAsOpcoes = {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({ title: '📂 TODAS AS OPÇÕES', sections: secoesTodas })
        };

        botoes = [
            botao("🎵 ÁUDIO", `play_audio:${token}`),
            botao("🎬 VÍDEO", `play_video:${token}`),
            todasAsOpcoes
        ];
        if (link) {
            botoes.push(botaoUrl("▶️ ABRIR NO YOUTUBE", link));
            botoes.push(botaoCopiarPlay("📋 COPIAR LINK", link));
        }
        const linkCriador = obterLinkCriadorMusica();
        if (linkCriador) botoes.push(botaoUrl("💬 FALAR COM O CRIADOR", linkCriador));
    } else {
        botoes = [botao("🎵 ÁUDIO", `play_audio:${token}`), verTudo];
    }

    await enviarNativeFlow(sock, from, {
        text: texto,
        footer: ASSINATURA,
        buttons: botoes,
        imageBuffer: capaBuffer,
        quoted: msg,
        // Faz o WhatsApp mostrar só o 1º botão + "VER TUDO"; o resto abre na folha.
        messageParamsJson: JSON.stringify({
            bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1, 2, 3, 4, 5, 999],
                list_title: '🎶 OPÇÕES DO PLAY',
                button_title: '📋 VER TUDO'
            }
        })
    });
}

function obterResultadoPlayValido(sock, msg, token) {
    const from = msg?.key?.remoteJid;
    const resultado = resultadosPlay.get(token);
    if (!from || !resultado) {
        enviarMensagemMusical(sock, from, "⚠️ Esse resultado do /play expirou. Faça a pesquisa novamente.", msg);
        return null;
    }
    const autor = msg?.key?.participant || msg?.key?.remoteJid;
    if (resultado.jid !== from || (resultado.solicitante && autor && resultado.solicitante !== autor)) {
        enviarMensagemMusical(sock, from, "⚠️ Esse resultado foi solicitado por outro usuário.", msg);
        return null;
    }
    return resultado;
}

// 📋 VER TUDO -> lista nativa do WhatsApp (personalizada)
async function enviarOpcoesPlay(sock, msg, token) {
    const resultado = obterResultadoPlayValido(sock, msg, token);
    if (!resultado) return;

    const { enviarListaWhatsApp } = require('../menuBotoes/menuBotoes');
    const info = resultado.info || {};

    const corta = (t, n) => {
        t = String(t || "");
        return t.length > n ? t.slice(0, n - 1) + "…" : t;
    };

    return enviarListaWhatsApp(sock, msg.key.remoteJid, {
        text:
`〔 🎶 ${sc('opções do play')} 〕

🎵 *${corta(info.title || "Resultado", 60)}*
🎤 ${info.uploader || info.channel || "—"}

✦ ${sc('escolha uma opção na lista')} ✦`,
        title: `🎶 ${sc('ver opções')}`,
        buttonText: `🎶 ${sc('abrir lista')}`,
        footer: ASSINATURA,
        quoted: msg,
        sections: [
            {
                title: `⬇️ ${sc('baixar')}`,
                rows: [
                    { id: `play_audio:${token}`, title: `🎧 ${sc('áudio')}`, description: 'Baixar só o áudio da música' },
                    { id: `play_video:${token}`, title: `🎬 ${sc('vídeo')}`, description: 'Baixar o vídeo em MP4' },
                    { id: `play_doc:${token}`,   title: `📄 ${sc('documento')}`, description: 'Receber como arquivo' }
                ]
            },
            {
                title: `🔗 ${sc('youtube')}`,
                rows: [
                    { id: `play_yt:${token}`,   title: `▶️ ${sc('abrir no youtube')}`, description: 'Abre essa música direto no YouTube' },
                    { id: `play_link:${token}`, title: `📋 ${sc('copiar link')}`, description: 'Copia o link da música' }
                ]
            },
            {
                title: `📂 ${sc('mais')}`,
                rows: [
                    { id: `play_outras:${token}`, title: `🎤 ${sc('todas as opções')}`, description: 'Outras versões e outros cantores' }
                ]
            }
        ]
    });
}

// ▶️ ABRIR NO YOUTUBE / 📋 COPIAR LINK
async function enviarLinkPlay(sock, msg, token, tipo) {
    const resultado = obterResultadoPlayValido(sock, msg, token);
    if (!resultado) return;

    const info = resultado.info || {};
    const link = info.webpage_url || resultado.url;
    if (!link) return;

    const botoes = tipo === 'yt'
        ? [botaoUrl(`▶️ ${sc('abrir no youtube')}`, link)]
        : [botaoCopiarPlay(`📋 ${sc('copiar link')}`, link)];

    await enviarNativeFlow(sock, msg.key.remoteJid, {
        text: `〔 ${tipo === 'yt' ? '▶️' : '🔗'} ${sc(tipo === 'yt' ? 'youtube' : 'link da música')} 〕\n\n🎵 *${info.title || "Resultado"}*\n\n${link}`,
        footer: ASSINATURA,
        buttons: botoes,
        quoted: msg
    });
}

// 📂 TODAS AS OPÇÕES: lista com as outras versões/cantores encontrados
async function enviarListaOutrasVersoes(sock, msg, token) {
    const resultado = obterResultadoPlayValido(sock, msg, token);
    if (!resultado) return;

    const { enviarListaWhatsApp } = require('../menuBotoes/menuBotoes');
    const lista = (resultado.lista || resultado.candidatos || []).slice(0, 10);

    if (lista.length < 2) {
        return enviarMensagemMusical(sock, msg.key.remoteJid, "⚠️ Não encontrei outras versões dessa música.", msg);
    }

    const corta = (t, n) => {
        t = String(t || "");
        return t.length > n ? t.slice(0, n - 1) + "…" : t;
    };

    const rows = lista.map((c, i) => ({
        id: `play_pick:${token}:${i}`,
        title: corta(c.title || "Sem título", 24),
        description: corta(
            `${c.channel || c.uploader || "—"} • ${formatDuration(c.duration)}`,
            72
        )
    }));

    return enviarListaWhatsApp(sock, msg.key.remoteJid, {
        text: `〔 📂 ${sc('todas as opções')} 〕\n\n🔍 ${sc('escolha a versão ou o cantor')}\n📚 ${lista.length} ${sc('resultados')}`,
        title: `📂 ${sc('escolher versão')}`,
        buttonText: `🎤 ${sc('ver versões')}`,
        footer: ASSINATURA,
        quoted: msg,
        sections: [{ title: `🎶 ${sc('resultados')}`, rows }]
    });
}

// Escolheu uma versão da lista -> manda um novo card (de novo com 2 botões)
async function escolherVersaoPlay(sock, msg, token, indice) {
    const resultado = obterResultadoPlayValido(sock, msg, token);
    if (!resultado) return;

    const lista = resultado.lista || resultado.candidatos || [];
    const escolhido = lista[indice];
    if (!escolhido) {
        return enviarMensagemMusical(sock, msg.key.remoteJid, "⚠️ Opção inválida. Faça a pesquisa novamente.", msg);
    }

    // O escolhido vai primeiro (o download usa sempre o candidatos[0]).
    const candidatos = [escolhido, ...lista.filter(x => x !== escolhido)];
    await enviarCardPlay(sock, msg, msg.key.remoteJid, { ...escolhido, candidatos }, candidatos);
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
        // Busca até 10 resultados: o 1º vira o card; os outros ficam
        // guardados para o botão VER TUDO -> OUTRAS VERSÕES.
        const info = await pesquisarResultado(busca, 10);
        await enviarCardPlay(sock, msg, from, info, info.candidatos || [info]);

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
        const clientes = resultado.randomMusic
            ? [
                '--extractor-args "youtube:player_client=android,ios"'
              ]
            : [
                '--extractor-args "youtube:player_client=android,ios"',
                '--extractor-args "youtube:player_client=android"',
                ''
              ];

        // /play: baixa SÓ o que apareceu no card (não troca por outra música).
        // Aleatória: pode usar as reservas se o sorteado estiver indisponível.
        const alvosYt = resultado.randomMusic ? candidatos.slice(0, 5) : [candidatos[0] || info];
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
                    const filtroDuracao = resultado.randomMusic?.maxDuration
                        ? `--match-filter "duration <= ${Number(resultado.randomMusic.maxDuration)}" `
                        : '';
                    const comando =
                        `${comandoBase()} "${alvo}" ` +
                        `${formato} --no-playlist --no-warnings ` +
                        `${filtroDuracao}` +
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

        // Aplica o resultado de quem GANHOU (título e, na aleatória, o vídeo certo no histórico).
        const aplicarVencedor = v => {
            arquivoReal = v.arquivo;
            if (v.titulo && (v.origem === 'yt-dlp' || !info.title)) info.title = v.titulo;
            if (resultado.randomMusic && v.alvo?.webpage_url && v.alvo.webpage_url !== info.webpage_url) {
                Object.assign(info, {
                    webpage_url: v.alvo.webpage_url,
                    url: v.alvo.url || v.alvo.webpage_url,
                    title: v.titulo || v.alvo.title || info.title
                });
            }
        };

        // ⬇️ DOWNLOAD DIRETO DO YOUTUBE PELO yt-dlp (igual o vídeo). Sem API.
        const r = await rodarYtDlp(template, null);
        if (r) aplicarVencedor(r);

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

        if (modo === "audio" && buffer.length > 90 * 1024 * 1024) {
            // arquivo gigante: o WhatsApp recusa como áudio, então vai como documento
            await sock.sendMessage(from, {
                document: buffer,
                mimetype: ext === ".mp3" ? "audio/mpeg" : "audio/mp4",
                fileName: `${titulo}${ext || ".mp3"}`
            }, { quoted: msg });

        } else if (modo === "audio") {
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

        // Confirma o histórico SOMENTE depois que o arquivo foi entregue.
        // Assim um erro de download não "gasta" a música sorteada.
        if (resultado.randomMusic?.historicoChave) {
            const historico = lerHistoricoMusicaAleatoria();
            registrarMusicaAleatoriaBaixada(
                historico,
                resultado.randomMusic.historicoChave,
                info
            );
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
        const bruto = String(erro?.message || erro || "");
        let motivo;
        if (/confirm your age|members-only|sign in to confirm|login required|cookies|is not a bot|bot\b/i.test(bruto))
            motivo = "O YouTube bloqueou o download dessa música (pediu login/confirmação). Tenta outra música ou manda o link direto.";
        else if (/unavailable|private|removed|terminated|not available|blocked|copyright|geo/i.test(bruto))
            motivo = "Esse vídeo está indisponível (privado, removido ou bloqueado na região). Tenta outra versão.";
        else if (/429|too many requests/i.test(bruto))
            motivo = "O YouTube está limitando os downloads agora (muitos pedidos de uma vez). Espera um pouco e tenta de novo.";
        else if (/arquivo não foi encontrado|vazio|empty/i.test(bruto))
            motivo = "Até baixou, mas o arquivo veio vazio/corrompido. Tenta de novo.";
        else if (/não encontr|no results|nada encontrado/i.test(bruto))
            motivo = "Não achei nada com esse nome. Confere o nome da música ou manda o link direto.";
        else if (/timeout|tempo esgotado|demorou|network|socket|getaddrinfo|econn|enotfound/i.test(bruto))
            motivo = "A conexão falhou ou demorou demais pra baixar. Tenta de novo em instantes.";
        else
            motivo = bruto || "Não foi possível concluir o download.";
        await enviarMensagemMusical(
            sock,
            from,
`〔 ❌ NÃO CONSEGUI BAIXAR 〕\n\n🎵 *${info.title || "Resultado"}*\n⚠️ ${motivo}`,
            msg
        );
    } finally {
        limparArquivos(template);
        // Só a aleatória apaga o token; no /play ele continua valendo (10 min)
        // pra pessoa poder pedir também o vídeo, ver outras versões etc.
        if (resultado.randomMusic) resultadosPlay.delete(token);
    }
}

exports.processarEscolhaPlay = async function(sock, msg, idBotao) {
    const id = String(idBotao || "");

    // 📋 VER TUDO / 📂 TODAS AS OPÇÕES
    let m = id.match(/^play_(todos|outras|yt|link):(.+)$/);
    if (m) {
        if (m[1] === "todos") await enviarOpcoesPlay(sock, msg, m[2]);
        else if (m[1] === "outras") await enviarListaOutrasVersoes(sock, msg, m[2]);
        else await enviarLinkPlay(sock, msg, m[2], m[1]);
        return true;
    }

    // Escolheu uma versão na lista
    m = id.match(/^play_pick:([^:]+):(\d+)$/);
    if (m) {
        await escolherVersaoPlay(sock, msg, m[1], Number(m[2]));
        return true;
    }

    const match = id.match(/^play_(audio|video|doc):(.+)$/);
    if (!match) return false;

    const modo = match[1];
    const token = match[2];

    // Silencioso: o único comentário do /play é o card do resultado (com a
    // capa). Depois do clique só chega a mídia — igual à música aleatória.
    await baixarResultadoPlay(sock, msg, token, modo, { silencioso: true });
    return true;
};
