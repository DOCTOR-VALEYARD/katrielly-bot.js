const config = require("../../config");
const { montarMenu } = require("../menu-estilo/menu-estilo");

async function menugold(sock, msg) {
    const from = msg.key.remoteJid;
    const resposta = montarMenu({
        titulo: "MENU GOLD",
        emoji: "💰",
        acesso: "todos",
        secoes: [
            { emoji: "💸", titulo: "ECONOMIA E MOEDAS", itens: [
                { cmd: "saldo", desc: "ver saldo gold" },
                { cmd: "roubar", args: "[@user]", desc: "roubar gold" },
                { cmd: "loja", desc: "comprar itens" },
                { cmd: "duelo", args: "[@user]", desc: "apostar gold" },
                { cmd: "resgatar", desc: "resgatar token" }
            ] },
            { emoji: "🏆", titulo: "RANKING", itens: [
                { cmd: "rank", desc: "ver ranking" },
                { cmd: "perfil", desc: "seu perfil" }
            ] },
            { emoji: "📊", titulo: "CONVERSÃO", itens: [
                { texto: "1000 ᴳᵒˡᵈ = 1 ᴾʳᵉᵐⁱᵘᵐ" }
            ] }
        ]
    });
    await sock.sendMessage(from, { text: resposta }, { quoted: msg });
}
module.exports = { menugold };
