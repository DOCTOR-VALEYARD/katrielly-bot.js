/* =================================================
   🎀 KATRIELLY BOT — YTLIB (2ª biblioteca de download de música)
   📁 src/ytlib/ytlib.js

   Baixa o ÁUDIO de um vídeo do YouTube usando a biblioteca "youtubei.js"
   (já instalada no projeto). Ela é o provedor de RESERVA do /play:
   se o Savetube e o Vreden falharem, o ytapi.js chama esta função.

   ✅ Não usa yt-dlp nem ffmpeg
   ✅ Tenta vários "clientes" do YouTube (se um é bloqueado, tenta o próximo)
   ✅ Grava direto no disco e valida o arquivo antes de aceitar
   ✅ Guarda o áudio no formato original (m4a ou webm) — sem conversão
================================================= */

const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

// Ordem de tentativa. Os primeiros costumam entregar link direto sem
// precisar decifrar o player; os últimos são reservas.
const CLIENTES = ['ANDROID_VR', 'IOS', 'TV', 'MWEB', 'WEB_EMBEDDED', 'ANDROID'];

// Tentativas de formato: m4a (toca em tudo no WhatsApp) e depois qualquer um.
const FORMATOS = [
    { format: 'mp4', extensao: '.m4a' },
    { format: 'any', extensao: '.webm' }
];

const TIMEOUT_POR_TENTATIVA_MS = 40000;
const TAMANHO_MINIMO = 10000;                 // abaixo disso = arquivo quebrado
const TAMANHO_MAXIMO = 100 * 1024 * 1024;     // 100 MB (proteção)

let instanciaPromise = null;

function obterInstancia() {
    if (!instanciaPromise) {
        instanciaPromise = Promise.resolve()
            .then(() => require('youtubei.js'))
            .then(({ Innertube }) => Innertube.create({ retrieve_player: true }))
            .catch(erro => {
                instanciaPromise = null; // tenta criar de novo na próxima vez
                throw erro;
            });
        // Renova a sessão de tempos em tempos (o YouTube expira sessões antigas).
        setTimeout(() => { instanciaPromise = null; }, 30 * 60 * 1000).unref?.();
    }
    return instanciaPromise;
}

function limparArquivosParciais(destinoSemExtensao) {
    for (const f of FORMATOS) {
        try { fs.unlinkSync(destinoSemExtensao + f.extensao); } catch {}
    }
}

async function gravarStream(streamWeb, destino, sinal) {
    const leitura = typeof streamWeb?.getReader === 'function'
        ? Readable.fromWeb(streamWeb)
        : streamWeb;
    await pipeline(leitura, fs.createWriteStream(destino), { signal: sinal });
}

function validar(destino) {
    const bytes = fs.existsSync(destino) ? fs.statSync(destino).size : 0;
    if (bytes < TAMANHO_MINIMO) throw new Error('arquivo de áudio veio vazio ou incompleto');
    if (bytes > TAMANHO_MAXIMO) throw new Error('arquivo de áudio grande demais');
    return bytes;
}

// baixarAudioYoutubeJs(idDoVideo, destinoSemExtensao)
//   → { arquivo, bytes, cliente, titulo: null }   (sucesso)
//   → lança Error com o motivo de cada tentativa  (falha total)
async function baixarAudioYoutubeJs(idDoVideo, destinoSemExtensao) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(String(idDoVideo || ''))) {
        throw new Error('id de vídeo inválido');
    }

    const yt = await obterInstancia();
    const falhas = [];

    for (const cliente of CLIENTES) {
        for (const { format, extensao } of FORMATOS) {
            const destino = destinoSemExtensao + extensao;
            const controle = new AbortController();
            const relogio = setTimeout(() => controle.abort(), TIMEOUT_POR_TENTATIVA_MS);

            try {
                const stream = await yt.download(idDoVideo, {
                    type: 'audio',
                    quality: 'best',
                    format,
                    client: cliente
                });
                await gravarStream(stream, destino, controle.signal);
                const bytes = validar(destino);
                clearTimeout(relogio);
                console.log(`🎵 [YTLIB] ✅ youtubei.js (${cliente}/${format}) entregou ${(bytes / 1024 / 1024).toFixed(2)} MB`);
                return { arquivo: destino, bytes, cliente, titulo: null };
            } catch (erro) {
                clearTimeout(relogio);
                const motivo = controle.signal.aborted
                    ? 'demorou demais'
                    : String(erro?.message || erro).split('\n')[0].slice(0, 120);
                falhas.push(`${cliente}/${format}: ${motivo}`);
                limparArquivosParciais(destinoSemExtensao);

                // Vídeo indisponível/privado/removido: trocar de cliente não adianta.
                if (/unavailable|private|removed|terminated|not available in your country|copyright|members-only|live event/i.test(motivo)) {
                    throw new Error(`vídeo indisponível (${motivo})`);
                }
                // Formato mp4 não existe nesse cliente? tenta o próximo formato/cliente.
            }
        }
    }

    throw new Error(`youtubei.js falhou em todos os clientes (${falhas.slice(-3).join(' | ')})`);
}

module.exports = { baixarAudioYoutubeJs };
