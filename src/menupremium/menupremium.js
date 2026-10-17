const config = require("../../config");
const { montarMenu, mini } = require("../menu-estilo/menu-estilo");

async function menupremium(sock, msg) {
    const from = msg.key.remoteJid;
    const resp = montarMenu({
        titulo: "MENU PREMIUM",
        emoji: "⭐",
        acesso: "premium",
        secoes: [
            { emoji: "💎", titulo: "VANTAGENS", itens: [
                { texto: `💎 ${mini("recursos exclusivos")}` },
                { texto: `🎁 ${mini("sem anúncios")}` },
                { texto: `⚡ ${mini("suporte prioritário")}` },
                { texto: `🔥 ${mini("mais de 50 comandos")}` },
                { texto: `💳 ${mini("preço")}: ${mini("entre em contato")}` }
            ] }
        ]
    });
    await sock.sendMessage(from, { text: resp }, { quoted: msg });
}
module.exports = { menupremium };
