/* =================================================
   🎵 MENU DE MÍDIAS — card personalizado por solicitação
   O nome do solicitante fica somente dentro da imagem.
   Nenhum telefone, JID, LID ou identificador é exibido no texto.
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { buscarFotoContexto } = require("../foto-contexto/foto-contexto");

function nomeSeguro(msg, metadata) {
    const autor = msg?.key?.participantAlt || msg?.key?.participant || msg?.key?.remoteJid;
    const participante = metadata?.participants?.find(p =>
        [p.id, p.lid, p.jid, p.participantAlt].filter(Boolean).some(id => String(id) === String(autor))
    );
    const nome = String(msg?.pushName || participante?.name || participante?.notify || "Usuário").trim();
    // Remove identificadores acidentais caso o WhatsApp não forneça um nome real.
    const limpo = nome.replace(/[+]?\d{6,}/g, "").replace(/[@]/g, "").trim();
    return limpo || "Usuário";
}

async function menumidias(sock, msg) {
    const from = msg?.key?.remoteJid;
    if (!from) return;

    const caminhoImagem = path.join(__dirname, "../../media_menu_card.png");
    let metadata = null;
    try { if (from.endsWith("@g.us")) metadata = await sock.groupMetadata(from); } catch {}
    const nome = nomeSeguro(msg, metadata);

    const { montarMenu, mini } = require("../menu-estilo/menu-estilo");
    const legenda = montarMenu({
        titulo: "CENTRAL DE MÍDIAS",
        emoji: "🎵",
        acesso: "todos",
        introducao: [`🎀 ${mini("escolha uma opção ou digite o comando manualmente")}`],
        secoes: [
            { emoji: "🎶", titulo: "MÚSICA E ÁUDIO", itens: [
                ["play", "nome ou link"], ["play", "mp4 nome ou link"], ["katrielly-yt", "link (somente áudio)"]
            ] },
            { emoji: "🎬", titulo: "VÍDEOS POR LINK", itens: [
                ["video", "link"], ["tiktok", "link"], ["instagram", "link"], ["kwai", "link"]
            ] },
            { emoji: "🖼️", titulo: "FIGURINHA E CONVERSÃO", itens: [
                "s", "sticker", "f", "gif", "toimg", ["katrielly-auto", "(automática, admin ativa)"]
            ] },
            { emoji: "📂", titulo: "ARQUIVOS E COLEÇÃO", itens: [
                ["pinterest", "link do Pinterest"], ["mediafire", "link"]
            ] }
        ]
    }).trim();

    try {
        return await sock.sendMessage(from, { text: legenda }, { quoted: msg });
    } catch (erro) {
        console.error("❌ Erro ao enviar menu de mídias:", erro.message);
    }
}

module.exports = { menumidias };
