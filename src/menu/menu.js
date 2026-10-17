// src/menu.js - MENU COM SUPORTE A FOTO/VÍDEO E ÁUDIO
const config = require("../../config");
const { resolverCaminhoSalvo } = require("../caminhos/caminhos");
const fs = require("fs");
const path = require("path");
const { buscarFotoContexto } = require("../foto-contexto/foto-contexto");
const { enviarAudioDaPasta } = require("../audio-pastas/audio-pastas");
const { enviarNativeFlow, botao, botaoUrl } = require("../menuBotoes/menuBotoes");

function lerDB() {
    const dbPath = path.join(__dirname, "../../database/botconfig.json");
    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
        return {
            PREFIX: config.PREFIX,
            BOT_NAME: config.BOT_NAME,
            OWNER_NAME: config.OWNER_NAME,
            BOT_AUDIO: null,
            BOT_PHOTO: null
        };
    }
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

async function menu(sock, from, opcoes = {}) {
  try {
    const db = lerDB();
    const prefix = db.PREFIX || config.PREFIX || "/";
    const botName = db.BOT_NAME || config.BOT_NAME || "BOT";
    const ownerName = db.OWNER_NAME || config.OWNER_NAME || "Desconhecida";

    // 🔊 ÁUDIO DO MENU — agora puxa aleatoriamente de src/audios/menu/
    // (pode colocar quantos áudios quiser lá, sempre toca um diferente).
    // Se a pasta estiver vazia, cai no áudio único configurado pelo painel
    // (.configurar-bot), mantendo compatibilidade com quem já usava isso.
    let audioDoMenuEnviado = false;
    try {
        audioDoMenuEnviado = await enviarAudioDaPasta(sock, from, "menu");
    } catch (e) {
        console.log("Áudio da pasta 'menu' indisponível, tentando áudio configurado...");
    }

    const audioConfigurado = db.BOT_AUDIO ? resolverCaminhoSalvo(db.BOT_AUDIO) : null;
    if (!audioDoMenuEnviado && audioConfigurado && fs.existsSync(audioConfigurado)) {
        try {
            const audioBuffer = fs.readFileSync(audioConfigurado);
            await sock.sendMessage(from, { audio: audioBuffer, mimetype: "audio/mp4" });
        } catch (e) {
            console.log("Áudio não encontrado, pulando...");
        }
    }

    // 📋 Texto do menu montado AUTOMATICAMENTE a partir das categorias do menu
    // de botões — assim, todo comando novo (ou que estava escondido) aparece aqui
    // sem precisar editar este arquivo. Visual: src/menu-estilo/menu-estilo.js
    const { montarCategorias } = require("../menuBotoes/menuBotoes");
    const { montarMenu, mini } = require("../menu-estilo/menu-estilo");

    const cats = montarCategorias();
    const secoes = Object.entries(cats)
        .filter(([, lista]) => lista.length)
        .map(([titulo, lista]) => {
            const partes = titulo.split(" ");
            const emoji = partes.shift();
            return { emoji, titulo: partes.join(" "), itens: lista };
        });

    const text = montarMenu({
        titulo: "MENU PRINCIPAL",
        emoji: "🎀",
        acesso: "todos",
        introducao: [`👑 ${mini("criadora")}: ${ownerName}`, `🔑 ${mini("prefixo")}: ${prefix}`],
        prefixo: prefix,
        secoes
    });

    // 📋 MODO TEXTO — usado somente para "menu" sem prefixo.
    // Mantém o conteúdo existente do menu e acrescenta apenas o botão
    // do canal já configurado no bot.
    if (opcoes?.texto) {
        await sock.sendMessage(from, { text }, { quoted: opcoes.quoted });

        const linkCanal = [
            db.CHANNEL_URL,
            db.CHANNEL_LINK,
            db.CHANNEL,
            db.CANAL_URL,
            db.CANAL_LINK,
            db.CANAL,
            config.CHANNEL_URL
        ].find(v => typeof v === "string" && v.trim());

        if (linkCanal) {
            const link = /^https?:\/\//i.test(linkCanal.trim())
                ? linkCanal.trim()
                : `https://${linkCanal.trim()}`;

            await enviarNativeFlow(sock, from, {
                text: " ",
                footer: config.BOT_NAME || "Katrielly Bot",
                quoted: opcoes.quoted,
                buttons: [
                    botao(`BY : ${config.OWNER_NAME}`, "zoar_dono"),
                    botaoUrl("📢 ENTRAR NO CANAL", link)
                ]
            });
        } else {
            await enviarNativeFlow(sock, from, {
                text: " ",
                footer: config.BOT_NAME || "Katrielly Bot",
                quoted: opcoes.quoted,
                buttons: [botao(`BY : ${config.OWNER_NAME}`, "zoar_dono")]
            });
        }
        return;
    }

    // Mídia do menu SEMPRE vem direto de src/menu.png (ou menu.mp4 pra vídeo),
    // não depende mais do botconfig.json — assim nunca fica "sem achar a foto"
    // mesmo que ela exista fisicamente na pasta.
    const caminhoFotoMenu = path.join(__dirname, "../midias/imagens/menu.png");
    const caminhoVideoMenu = path.join(__dirname, "../midias/videos/menu.mp4");
    const ehVideo = fs.existsSync(caminhoVideoMenu);

    if (ehVideo) {
        const mediaBuffer = fs.readFileSync(caminhoVideoMenu);
        // 🎞️ Se a mídia salva veio de um GIF (BOT_PHOTO_GIF), manda com
        // gifPlayback pra tocar em loop igual gif, em vez de vídeo comum.
        await sock.sendMessage(from, {
            video: mediaBuffer,
            caption: text,
            mimetype: "video/mp4",
            gifPlayback: db.BOT_PHOTO_GIF === true
        });
    } else {
        let fotoBuffer = null;
        if (fs.existsSync(caminhoFotoMenu)) {
            try {
                fotoBuffer = fs.readFileSync(caminhoFotoMenu);
                console.log(`✅ menu.png encontrado (${fotoBuffer.length} bytes) em: ${caminhoFotoMenu}`);
            } catch (erroLeitura) {
                console.error(`❌ menu.png existe mas não consegui LER o arquivo em ${caminhoFotoMenu}:`, erroLeitura.message);
                fotoBuffer = null;
            }
        } else {
            console.error(`❌ menu.png NÃO EXISTE nesse caminho: ${caminhoFotoMenu}`);
        }

        try {
            // Modo simples: foto do menu com a legenda (ou só texto se não tiver foto)
            if (fotoBuffer) {
                await sock.sendMessage(from, { image: fotoBuffer, caption: text });
            } else {
                await sock.sendMessage(from, { text });
            }
        } catch (erroEnvio) {
            console.error("❌ Erro ao enviar a imagem do menu, mandando só texto:", erroEnvio);
            await sock.sendMessage(from, { text });
        }
    }

  } catch (error) {
    console.error("❌ ERRO AO ENVIAR MENU:", error);
    await sock.sendMessage(from, { text: "😥 Erro ao gerar o menu." });
  }
}

module.exports = { menu };

