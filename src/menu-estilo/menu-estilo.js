/* =================================================
   🎀 KATRIELLY BOT — ESTILO DOS MENUS EM TEXTO
   📁 src/menu-estilo/menu-estilo.js

   Um só lugar define o visual de TODOS os menus em texto:
   molduras ╒▣▣▣ / ╔╦╦╗, comandos em letrinhas pequenas e rodapé.
   Quem monta um menu só informa as seções e os comandos:

     const { montarMenu } = require("../menu-estilo/menu-estilo");
     const texto = montarMenu({
         titulo: "MENU ADMINISTRATIVO", emoji: "🛡️",
         secoes: [
             { emoji: "🔒", titulo: "PROTEÇÕES", itens: ["antitrava", "antiloc"] },
             { emoji: "⚖️", titulo: "PUNIÇÕES", itens: [["warn", "@pessoa"], ["autoban", "1/0"]] }
         ],
         acesso: "administrativo"
     });

   Itens aceitos em "itens":
     "cmd"                         → /cmd
     ["cmd", "@pessoa"]            → /cmd @pessoa   (argumentos ficam normais)
     { cmd, args, desc }           → /cmd args ➜ descrição
     { texto: "💎 Recursos" }      → linha de texto (sem prefixo de comando)
================================================= */

const config = require("../../config");

// ─────────────────────────────────────────────────
// 🔡 LETRINHAS PEQUENAS (superscrito)
// ─────────────────────────────────────────────────
const MINUSCULAS = {
    a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ",
    j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ",
    t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ"
    // "q" não existe em superscrito no Unicode comum — fica normal.
};

const MAIUSCULAS = {
    A: "ᴬ", B: "ᴮ", C: "ᶜ", D: "ᴰ", E: "ᴱ", F: "ᶠ", G: "ᴳ", H: "ᴴ", I: "ᴵ",
    J: "ᴶ", K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ", O: "ᴼ", P: "ᴾ", R: "ᴿ", S: "ˢ",
    T: "ᵀ", U: "ᵁ", V: "ⱽ", W: "ᵂ", X: "ˣ", Y: "ʸ", Z: "ᶻ"
    // "Q" também não existe — fica normal.
};

const DIGITOS = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

function semAcento(texto) {
    return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// "antitrava" → "ᵃⁿᵗⁱᵗʳᵃᵛᵃ"   |   "top10" → "ᵗᵒᵖ¹⁰"
function mini(texto) {
    let saida = "";
    for (const ch of semAcento(texto)) {
        const minuscula = ch.toLowerCase();
        if (MINUSCULAS[minuscula]) saida += MINUSCULAS[minuscula];
        else if (DIGITOS[ch] !== undefined) saida += DIGITOS[ch];
        else saida += ch;
    }
    return saida;
}

// "PROTEÇÕES" → "ᴾᴿᴼᵀᴱᶜᴼᴱˢ"   (títulos: maiúsculas em superscrito)
function miniTitulo(texto) {
    let saida = "";
    for (const ch of semAcento(texto)) {
        const maiuscula = ch.toUpperCase();
        if (MAIUSCULAS[maiuscula]) saida += MAIUSCULAS[maiuscula];
        else if (DIGITOS[ch] !== undefined) saida += DIGITOS[ch];
        else saida += ch;
    }
    return saida;
}

// Letrinhas pequenas SEM mexer no nome do bot / da criadora
// (eles já têm a fonte própria deles e não devem ser alterados).
function preservandoNomes(texto, conversor) {
    const protegidos = [config.BOT_NAME, config.OWNER_NAME]
        .filter(n => typeof n === "string" && n.trim())
        .sort((a, b) => b.length - a.length);

    let partes = [String(texto ?? "")];
    for (const nome of protegidos) {
        partes = partes.flatMap(p =>
            typeof p === "string" ? p.split(nome).flatMap((x, i, arr) => (i < arr.length - 1 ? [x, { fixo: nome }] : [x])) : [p]
        );
    }
    return partes.map(p => (typeof p === "string" ? conversor(p) : p.fixo)).join("");
}

// Texto de botão / título de lista: letras maiúsculas e minúsculas viram
// superscrito (maiúsculas ficam maiores), números e emojis continuam iguais.
function estiloBotao(texto) {
    return preservandoNomes(texto, parte => {
        let saida = "";
        for (const ch of semAcento(parte)) {
            if (MAIUSCULAS[ch]) saida += MAIUSCULAS[ch];
            else if (MINUSCULAS[ch]) saida += MINUSCULAS[ch];
            else if (DIGITOS[ch] !== undefined) saida += DIGITOS[ch];
            else saida += ch;
        }
        return saida;
    });
}

// Cabeçalhos tipo "〔 📋 PRINCIPAL 〕" dentro de mensagens de botão
function estilizarCabecalhos(texto) {
    return String(texto ?? "").replace(/〔([^〕\n]*)〕/g, (_, interno) => `〔${estiloBotao(interno)}〕`);
}

// ─────────────────────────────────────────────────
// 🧱 PEÇAS DO MENU
// ─────────────────────────────────────────────────
const SEPARADOR = "▣╠╬╬╬╬╬╬╬╬╬╬╣";

function linhaItem(item, prefixo) {
    if (typeof item === "string") return `▣║╠🎀 ${prefixo}${mini(item)}`;

    if (Array.isArray(item)) {
        const [cmd, args] = item;
        return `▣║╠🎀 ${prefixo}${mini(cmd)}${args ? ` ${args}` : ""}`;
    }

    if (item && item.texto) return `▣║╠🎀 ${item.texto}`;

    if (item && item.cmd) {
        const args = item.args ? ` ${item.args}` : "";
        const desc = item.desc ? ` ➜ ${mini(item.desc)}` : "";
        return `▣║╠🎀 ${prefixo}${mini(item.cmd)}${args}${desc}`;
    }
    return null;
}

// Uma caixa de comandos (igual ao modelo de PROTEÇÕES / GRUPO / ...)
function secao({ emoji = "🎀", titulo, itens = [] }, prefixo = config.PREFIX) {
    const linhas = itens.map(i => linhaItem(i, prefixo)).filter(Boolean);
    if (!linhas.length) return "";

    return [
        "╒▣▣▣▣▣▣▣",
        `❲ ${emoji} ${miniTitulo(titulo)}`,
        "╘▣▣▣▣▣▣▣",
        "▣╔╦╦╦╦╦╦╦╦╦╦╗",
        linhas.join(`\n${SEPARADOR}\n`),
        "▣╚╩╩╩╩╩╩╩╩╩╩╝",
        "▣▣▣▣▣▣▣▣▣▣▣▣"
    ].join("\n");
}

function cabecalho(titulo, emoji = "🎀") {
    return [
        "🎀━━━━━━━━━━━━━━🎀",
        `${emoji} ${miniTitulo(titulo)} ${emoji}`,
        "🎀━━━━━━━━━━━━━━🎀"
    ].join("\n");
}

function rodape({ acesso = "todos", status = "operacional" } = {}) {
    return [
        "🎀━━━━━━━━━━━━━━🎀",
        `🎀 ${mini("sistema")}: ${config.BOT_NAME}`,
        `👑 ${mini("responsável")}: ${config.OWNER_NAME}`,
        `🔓 ${mini("acesso")}: ${mini(acesso)}`,
        `🟢 ${mini("status")}: ${mini(status)}`
    ].join("\n");
}

// Menu completo: cabeçalho + seções + rodapé
function montarMenu({ titulo, emoji = "🎀", introducao = [], secoes = [], acesso = "todos", prefixo = config.PREFIX } = {}) {
    const blocos = [cabecalho(titulo, emoji)];
    if (introducao.length) blocos.push(introducao.join("\n"));
    for (const s of secoes) {
        const caixa = secao(s, prefixo);
        if (caixa) blocos.push(caixa);
    }
    blocos.push(rodape({ acesso }));
    return blocos.join("\n\n");
}

// Converte um texto antigo de menu ("🎀 /cmd args" por linha) para itens.
function itensDeTexto(conteudo, prefixo = config.PREFIX) {
    return String(conteudo || "")
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => {
            const limpa = l.replace(/^[^\p{L}\p{N}/!#$.]+/u, "");
            const m = limpa.match(new RegExp(`^${prefixo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\p{L}\\p{N}_-]+)\\s*(.*)$`, "u"));
            if (!m) return { texto: l };
            return m[2] ? [m[1], m[2]] : m[1];
        });
}

module.exports = {
    mini,
    miniTitulo,
    estiloBotao,
    estilizarCabecalhos,
    secao,
    cabecalho,
    rodape,
    montarMenu,
    itensDeTexto
};
