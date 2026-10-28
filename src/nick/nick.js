/* =================================================
   ✨ KATRIELLY BOT — NICK, TABELA E GERALINK
   📁 Arquivo: nick.js

   <prefixo>nick <nome>    → manda o nome em 35 modelos de nick prontos
   <prefixo>tabela         → mostra a tabela com os 35 modelos (exemplo)
   <prefixo>geralink ...   → gera link direto do WhatsApp (wa.me)
================================================= */
const config = require("../../config");

// -------------------------------------------------
// 🔤 FONTES (letras matemáticas do Unicode)
// -------------------------------------------------
function fonteMat(maiuscula, minuscula, digito, excecoes = {}) {
    return (ch) => {
        if (excecoes[ch]) return excecoes[ch];
        const c = ch.codePointAt(0);
        if (c >= 65 && c <= 90 && maiuscula) return String.fromCodePoint(maiuscula + c - 65);
        if (c >= 97 && c <= 122 && minuscula) return String.fromCodePoint(minuscula + c - 97);
        if (c >= 48 && c <= 57 && digito) return String.fromCodePoint(digito + c - 48);
        return ch;
    };
}

function mapa(de, para) {
    const a = [...de], b = [...para], m = {};
    a.forEach((ch, i) => { m[ch] = b[i]; });
    return (ch) => m[ch] ?? m[ch.toLowerCase()] ?? ch;
}

const F = {
    negrito: fonteMat(0x1D400, 0x1D41A, 0x1D7CE),
    italico: fonteMat(0x1D434, 0x1D44E, 0, { h: "ℎ" }),
    negritoItalico: fonteMat(0x1D468, 0x1D482),
    cursiva: fonteMat(0x1D49C, 0x1D4B6, 0, { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" }),
    cursivaNegrito: fonteMat(0x1D4D0, 0x1D4EA),
    gotica: fonteMat(0x1D504, 0x1D51E, 0, { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" }),
    goticaNegrito: fonteMat(0x1D56C, 0x1D586),
    duplo: fonteMat(0x1D538, 0x1D552, 0x1D7D8, { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" }),
    sans: fonteMat(0x1D5A0, 0x1D5BA, 0x1D7E2),
    sansNegrito: fonteMat(0x1D5D4, 0x1D5EE, 0x1D7EC),
    sansItalico: fonteMat(0x1D608, 0x1D622),
    sansNegritoItalico: fonteMat(0x1D63C, 0x1D656),
    mono: fonteMat(0x1D670, 0x1D68A, 0x1D7F6),
    largo: fonteMat(0xFF21, 0xFF41, 0xFF10),
    bolha: fonteMat(0x24B6, 0x24D0, 0, { "0": "⓪", "1": "①", "2": "②", "3": "③", "4": "④", "5": "⑤", "6": "⑥", "7": "⑦", "8": "⑧", "9": "⑨" }),
    bolhaPreta: (ch) => /[a-z]/i.test(ch) ? String.fromCodePoint(0x1F150 + ch.toUpperCase().charCodeAt(0) - 65) : ch,
    quadrado: (ch) => /[a-z]/i.test(ch) ? String.fromCodePoint(0x1F130 + ch.toUpperCase().charCodeAt(0) - 65) : ch,
    quadradoPreto: (ch) => /[a-z]/i.test(ch) ? String.fromCodePoint(0x1F170 + ch.toUpperCase().charCodeAt(0) - 65) : ch,
    parenteses: (ch) => /[a-z]/i.test(ch) ? String.fromCodePoint(0x249C + ch.toLowerCase().charCodeAt(0) - 97) : ch,
    versalete: mapa("abcdefghijklmnopqrstuvwxyz", "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ"),
    pequeno: mapa("abcdefghijklmnopqrstuvwxyz0123456789", "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᑫʳˢᵗᵘᵛʷˣʸᶻ⁰¹²³⁴⁵⁶⁷⁸⁹"),
    oriental: mapa("abcdefghijklmnopqrstuvwxyz", "卂乃匚ᗪ乇千Ꮆ卄丨ﾌҜㄥ爪几ㄖ卩Ɋ尺丂ㄒㄩᐯ山乂ㄚ乙"),
    grego: mapa("abcdefghijklmnopqrstuvwxyz", "αв¢∂єƒgнιנкℓмησρqяѕтυνωχуz"),
    estranho: mapa("abcdefghijklmnopqrstuvwxyz", "ąცƈɖɛʄɠɧıʝƙƖɱŋơ℘զཞʂɬų۷ῳҳყʑ"),
    invertido: mapa("abcdefghijklmnopqrstuvwxyz", "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz")
};

const aplicar = (texto, fn) => [...texto].map(fn).join("");
const marcar = (texto, marca) => [...texto].map(ch => ch === " " ? ch : ch + marca).join("");

// -------------------------------------------------
// 🎨 OS 35 MODELOS
// -------------------------------------------------
const MODELOS = [
    ["Negrito",              t => aplicar(t, F.negrito)],
    ["Itálico",              t => aplicar(t, F.italico)],
    ["Negrito itálico",      t => aplicar(t, F.negritoItalico)],
    ["Cursiva",              t => aplicar(t, F.cursiva)],
    ["Cursiva negrito",      t => aplicar(t, F.cursivaNegrito)],
    ["Gótica",               t => aplicar(t, F.gotica)],
    ["Gótica negrito",       t => aplicar(t, F.goticaNegrito)],
    ["Contorno",             t => aplicar(t, F.duplo)],
    ["Moderna",              t => aplicar(t, F.sans)],
    ["Moderna negrito",      t => aplicar(t, F.sansNegrito)],
    ["Moderna itálico",      t => aplicar(t, F.sansItalico)],
    ["Moderna forte",        t => aplicar(t, F.sansNegritoItalico)],
    ["Máquina de escrever",  t => aplicar(t, F.mono)],
    ["Largo",                t => aplicar(t, F.largo)],
    ["Bolhas",               t => aplicar(t, F.bolha)],
    ["Bolhas pretas",        t => aplicar(t, F.bolhaPreta)],
    ["Quadrados",            t => aplicar(t, F.quadrado)],
    ["Quadrados pretos",     t => aplicar(t, F.quadradoPreto)],
    ["Parênteses",           t => aplicar(t, F.parenteses)],
    ["Versalete",            t => aplicar(t, F.versalete)],
    ["Pequenininho",         t => aplicar(t, F.pequeno)],
    ["Oriental",             t => aplicar(t, F.oriental)],
    ["Grego",                t => aplicar(t, F.grego)],
    ["Estranho",             t => aplicar(t, F.estranho)],
    ["De cabeça pra baixo",  t => [...aplicar(t, F.invertido)].reverse().join("")],
    ["Riscado",              t => marcar(t, "̶")],
    ["Sublinhado",           t => marcar(t, "̲")],
    ["Espaçado",             t => [...aplicar(t.toUpperCase(), F.largo)].join(" ")],
    ["Gamer",                t => `꧁༒☬ ${aplicar(t, F.goticaNegrito)} ☬༒꧂`],
    ["Estrela",              t => `★彡 ${aplicar(t, F.cursivaNegrito)} 彡★`],
    ["Free Fire",            t => `乂${aplicar(t, F.versalete)}乂`],
    ["Rei",                  t => `♛ ${aplicar(t, F.negrito)} ♛`],
    ["Asas",                 t => `𓆩 ${aplicar(t, F.sansNegrito)} 𓆪`],
    ["Flor",                 t => `✿ ${aplicar(t, F.cursiva)} ✿`],
    ["Raio",                 t => `⚡ ${aplicar(t, F.oriental)} ⚡`]
];

function prefixo() {
    try {
        const db = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../../database/botconfig.json"), "utf8"));
        if (typeof db.PREFIX === "string" && db.PREFIX.trim()) return db.PREFIX.trim();
    } catch {}
    return config.PREFIX;
}

// Tira acento (as fontes especiais não têm letra acentuada) e limita o tamanho
function limparNome(texto) {
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().slice(0, 25);
}

function gerarNicks(nome) {
    return MODELOS.map(([titulo, fn]) => ({ titulo, nick: fn(nome) }));
}

// -------------------------------------------------
// ✨ <prefixo>nick <nome>
// -------------------------------------------------
async function cmdNick(sock, msg, args) {
    const from = msg.key.remoteJid;
    const P = prefixo();
    const nome = limparNome(args.join(" "));
    if (!nome) {
        return sock.sendMessage(from, { text: `🎀 *GERADOR DE NICK*\n\nDigite o nome junto com o comando.\nEx.: *${P}nick Lucas*\n\nPra ver os modelos: *${P}tabela*` }, { quoted: msg });
    }
    const linhas = gerarNicks(nome).map((n, i) => `*${String(i + 1).padStart(2, "0")}* ➜ ${n.nick}`);
    return sock.sendMessage(from, {
        text: `🎀 *NICKS PARA:* ${nome}\n\n${linhas.join("\n\n")}\n\n🎀 Segure em cima do nick pra copiar.\n🎀 ${config.BOT_NAME}`
    }, { quoted: msg });
}

// -------------------------------------------------
// 📋 <prefixo>tabela
// -------------------------------------------------
async function cmdTabela(sock, msg) {
    const from = msg.key.remoteJid;
    const P = prefixo();
    const exemplo = "Nick";
    const linhas = gerarNicks(exemplo).map((n, i) => `*${String(i + 1).padStart(2, "0")}* • ${n.titulo}\n      ${n.nick}`);
    return sock.sendMessage(from, {
        text: `🎀 *TABELA DE MODELOS DE NICK*\n\nSão ${MODELOS.length} modelos. Exemplo com o nome "${exemplo}":\n\n${linhas.join("\n")}\n\n🎀 Pra gerar com o seu nome: *${P}nick seu nome*\n🎀 ${config.BOT_NAME}`
    }, { quoted: msg });
}

// -------------------------------------------------
// 🔗 <prefixo>geralink
//   • respondendo/marcando alguém → link do número da pessoa
//   • <prefixo>geralink 5511999999999 mensagem → link com mensagem pronta
//   • sem nada → link do seu próprio número
// -------------------------------------------------
function numeroDoJid(jid) {
    const j = String(jid || "");
    return j.endsWith("@s.whatsapp.net") ? j.split("@")[0].split(":")[0] : null;
}

async function cmdGeraLink(sock, msg, args) {
    const from = msg.key.remoteJid;
    const P = prefixo();
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};

    let numero = null;
    let resto = [...args];

    if (resto[0] && /^\+?[\d\s()-]{8,}$/.test(resto[0])) {
        numero = resto.shift().replace(/\D/g, "");
    } else if (ctx.mentionedJid?.[0] || ctx.participant) {
        const alvo = ctx.mentionedJid?.[0] || ctx.participant;
        numero = numeroDoJid(alvo);
        resto = resto.filter(a => !a.startsWith("@"));
        if (!numero) {
            return sock.sendMessage(from, { text: `🔗 Não consegui ver o número dessa pessoa (o WhatsApp esconde em alguns grupos).\n\nDigite o número: *${P}geralink 5511999999999*` }, { quoted: msg });
        }
    } else {
        numero = numeroDoJid(msg.key.participantAlt) || numeroDoJid(msg.key.participant) || numeroDoJid(from);
        if (!numero) {
            return sock.sendMessage(from, { text: `🔗 Não consegui ver o seu número aqui.\n\nDigite o número: *${P}geralink 5511999999999*` }, { quoted: msg });
        }
    }

    if (numero.length < 10 || numero.length > 15) {
        return sock.sendMessage(from, { text: `🔗 Número inválido. Use com DDI e DDD.\nEx.: *${P}geralink 5511999999999 Olá!*` }, { quoted: msg });
    }

    const texto = resto.join(" ").trim();
    const link = `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
    return sock.sendMessage(from, {
        text: `🔗 *LINK GERADO*\n\n📱 Número: +${numero}${texto ? `\n💬 Mensagem: ${texto}` : ""}\n\n${link}\n\n🎀 Quem clicar abre a conversa direto.\n🎀 ${config.BOT_NAME}`
    }, { quoted: msg });
}

module.exports = { cmdNick, cmdTabela, cmdGeraLink, gerarNicks, MODELOS };
