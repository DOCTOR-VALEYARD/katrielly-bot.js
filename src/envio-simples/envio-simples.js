/* =================================================
   ✉️ ENVIO SIMPLES — KATRIELLY
   📁 Arquivo: envio-simples.js
   Substitui o antigo sistema de cards. Manda só texto (ou foto com
   legenda, quando houver foto de verdade), sem desenhar nada.
================================================= */

const config = require("../../config");

function linkCanalAtual() {
    try {
        const fs = require("fs");
        const path = require("path");
        const dbPath = path.join(__dirname, "../../database/botconfig.json");
        const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : {};
        const valor = [db.CHANNEL_URL, db.CHANNEL_LINK, db.CHANNEL, db.CANAL_URL, db.CANAL_LINK, db.CANAL]
            .find(v => typeof v === "string" && v.trim());
        const bruto = (valor || config.CHANNEL_URL || "").trim();
        if (!bruto) return null;
        if (/^https?:\/\//i.test(bruto)) return bruto;
        if (/^(whatsapp\.com\/channel\/|wa\.me\/)/i.test(bruto)) return `https://${bruto}`;
        return null;
    } catch {
        return null;
    }
}

function botaoCanal() {
    const url = linkCanalAtual();
    if (!url) return null;
    return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({ display_text: "📢 ENTRAR NO CANAL", url })
    };
}

/**
 * @param {*} sock
 * @param {string} from
 * @param {{ caption?: string, text?: string, mentions?: string[], nativeButtons?: object[], imageBuffer?: Buffer }} opcoes
 * @param {object} [msg] mensagem original (responde citando)
 * @param {(jid: string, conteudo: object) => Promise<any>} [enviarFn] envio customizado (ex.: com retentativa)
 */
async function enviarSimples(sock, from, opcoes = {}, msg, enviarFn) {
    const quoted = msg ? { quoted: msg } : undefined;
    const enviar = enviarFn || ((jid, conteudo) => sock.sendMessage(jid, conteudo, quoted));
    const texto = opcoes.caption || opcoes.text || "";
    const mentions = opcoes.mentions;
    const botoes = Array.isArray(opcoes.nativeButtons) ? opcoes.nativeButtons.filter(Boolean) : [];

    if (botoes.length) {
        try {
            const { enviarNativeFlow } = require("../menuBotoes/menuBotoes");
            return await enviarNativeFlow(sock, from, {
                text: texto,
                footer: "📢 CANAL",
                imageBuffer: opcoes.imageBuffer,
                buttons: botoes,
                mentions
            });
        } catch (erro) {
            console.error("⚠️ Botões indisponíveis, mandando texto simples:", erro?.message || erro);
        }
    }

    if (opcoes.imageBuffer) {
        return await enviar(from, { image: opcoes.imageBuffer, caption: texto, ...(mentions ? { mentions } : {}) });
    }
    return await enviar(from, { text: texto, ...(mentions ? { mentions } : {}) });
}

module.exports = { enviarSimples, botaoCanal, linkCanalAtual };
