// src/menuadm.js
const config = require("../../config");
const fs = require("fs");
const path = require("path");


// ═══════════════════════════════════════════════════════════════
// 🛡️ MENU ADMINISTRATIVO
// ═══════════════════════════════════════════════════════════════

async function menuadm(sock, msg) {

    const from =
        msg?.key?.remoteJid;

    if (!from) {
        return;
    }


    // 🔐 Somente administradores podem abrir o painel administrativo.
    try {
        const meta = await sock.groupMetadata(from);
        const autor = msg.key.participant || msg.key.remoteJid;
        const admin = meta.participants.some(p => (p.id === autor || p.lid === autor) && p.admin);
        if (!admin) return sock.sendMessage(from, { text: "❌ O menu administrativo é exclusivo para administradores." }, { quoted: msg });
    } catch {
        return sock.sendMessage(from, { text: "❌ Não consegui verificar sua permissão de administrador." }, { quoted: msg });
    }

    // ═════════════════════════════════════════════════════════════
    // 🖼️ IMAGEM DO MENU
    // ═════════════════════════════════════════════════════════════

    const caminhoImagem =
        path.join(
            __dirname, "../midias/imagens/menu.png"
        );


    // ═════════════════════════════════════════════════════════════
    // 📋 MENU
    // ═════════════════════════════════════════════════════════════

    const { montarMenu } = require("../menu-estilo/menu-estilo");

    const resposta = montarMenu({
        titulo: "MENU ADMINISTRATIVO",
        emoji: "🛡️",
        acesso: "administrativo",
        secoes: [
            { emoji: "🔒", titulo: "PROTEÇÕES", itens: [
                "antitrava", "antip", "antib", "antir", "antig", "antiloc", "antidoc", "antiimg", "antivideo", "antilink", "antinota",
                "antinudes", "antifake", "antispam", "antiflood", "somenteadm", "antipalavrao",
                "antiamor", "antinsfw"
            ] },
            { emoji: "⚔️", titulo: "GRUPO", itens: [
                "ban", "kick", "promover", "rebaixar", "aviso", "marcar", "hidetag", "citar", "abrir",
                "fechar", "regras", "convite", "adms", "admins", "statusadm", "limpar", "bemvindo",
                "saudacao", "aceitar", "mencao", "sair", "alugar"
            ] },
            { emoji: "⚖️", titulo: "PUNIÇÕES", itens: [
                ["warn", "@pessoa"], ["unwarn", "@pessoa"], ["mute", "@pessoa"], ["unmute", "@pessoa"],
                ["autoban", "1/0"], ["manutencao", "1/0"], "advertidos", "mutados"
            ] },
            { emoji: "📊", titulo: "RESUMO E ATIVIDADE", itens: [
                "resumo", "atividades", "top10", "rankativo", "rankinativos", "relatorio"
            ] },
            { emoji: "🧰", titulo: "FERRAMENTAS ADM", itens: [
                "add", "lista", "tirarlista", "blacklist", "logban", "modulos", "limparbot"
            ] }
        ]
    });


    // ═════════════════════════════════════════════════════════════
    // 📤 ENVIO
    // ═════════════════════════════════════════════════════════════

    try {

        if (fs.existsSync(caminhoImagem)) {

            const bufferImagem =
                fs.readFileSync(
                    caminhoImagem
                );


            await sock.sendMessage(
                from,
                {
                    image: bufferImagem,
                    caption: resposta
                },
                {
                    quoted: msg
                }
            );

            return;
        }


        // ─────────────────────────────────────────────────────────
        // ⚠️ FALLBACK SEM IMAGEM
        // ─────────────────────────────────────────────────────────

        await sock.sendMessage(
            from,
            {
                text:
                    `${resposta}\n\n` +
                    `⚠️ *Imagem do menu não localizada.*`
            },
            {
                quoted: msg
            }
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao enviar menu administrativo:",
            erro
        );
    }
}


// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════

module.exports = {
    menuadm
};