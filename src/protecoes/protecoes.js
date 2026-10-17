/* =================================================
   🎀 KATRIELLY BOT — PROTEÇÕES DE GRUPO
   📁 src/protecoes/protecoes.js

   Comandos (cada um liga/desliga; só administrador):
     antitrava  → apaga mensagens "trava" (caracteres unicode, textos
                  gigantes, mensagens que fazem o WhatsApp travar)
     antiloc    → apaga localização e remove quem enviou (avisa o motivo)
     antidoc    → apaga documentos; 1ª vez = advertência, reincidiu = remove
     antiimg    → apaga QUALQUER imagem
     antivideo  → apaga QUALQUER vídeo (inclui memes e GIFs)

   Uso:  /antitrava          (alterna ligado/desligado)
         /antitrava on       (liga)
         /antitrava off      (desliga)
         /anti trava         (também funciona com espaço)

   Regras gerais:
   • Administradores, o dono e o próprio bot NUNCA são punidos.
   • O bot precisa ser ADMINISTRADOR do grupo para apagar/remover.
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { getDB, saveDB } = require("../grupo-db/grupo-db");
const { isAdmin, isBotAdmin } = require("../grupo/grupo");

// ─────────────────────────────────────────────────
// 🧾 CATÁLOGO DAS PROTEÇÕES
// ─────────────────────────────────────────────────
const PROTECOES = {
    antitrava: {
        chave: "antitrava",
        titulo: "ANTI-TRAVA",
        emoji: "🛡️",
        aliases: ["trava", "antitrava", "anti-trava"],
        oQueFaz: "apaga qualquer mensagem com características de *trava* (caracteres unicode estranhos, texto gigante e mensagens que fazem o WhatsApp travar)."
    },
    antiloc: {
        chave: "antiloc",
        titulo: "ANTI-LOCALIZAÇÃO",
        emoji: "📍",
        aliases: ["loc", "antiloc", "anti-loc", "localizacao", "localização", "antilocalizacao"],
        oQueFaz: "apaga qualquer *localização* (fixa ou em tempo real) e *remove* quem enviou, informando o motivo."
    },
    antidoc: {
        chave: "antidoc",
        titulo: "ANTI-DOCUMENTO",
        emoji: "📄",
        aliases: ["doc", "antidoc", "anti-doc", "documento", "antidocumento"],
        oQueFaz: "apaga qualquer *documento*. Quem enviar leva uma *advertência*; se enviar de novo, é *removido*."
    },
    antiimg: {
        chave: "antiimg",
        titulo: "ANTI-IMAGEM",
        emoji: "🖼️",
        aliases: ["img", "antiimg", "anti-img", "imagem", "antiimagem", "foto"],
        oQueFaz: "apaga *qualquer imagem* enviada no grupo, sem exceção de assunto (só administradores podem enviar)."
    },
    antivideo: {
        chave: "antivideo",
        titulo: "ANTI-VÍDEO",
        emoji: "🎬",
        aliases: ["video", "vídeo", "antivideo", "antivídeo", "anti-video", "anti-vídeo"],
        oQueFaz: "apaga *qualquer vídeo* enviado, inclusive memes e GIFs, não importa qual seja (só administradores podem enviar)."
    }
};

function semAcento(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Descobre qual proteção o comando representa.
// Aceita:  antitrava | antivídeo | "anti" + "trava" (com espaço)
function resolverProtecao(command, args = []) {
    const cmd = semAcento(command);
    if (PROTECOES[cmd]) return { def: PROTECOES[cmd], resto: args };

    if (cmd === "anti") {
        const alvo = semAcento(args[0]);
        for (const def of Object.values(PROTECOES)) {
            if (def.aliases.some(a => semAcento(a) === alvo)) {
                return { def, resto: args.slice(1) };
            }
        }
    }
    return null;
}

// ─────────────────────────────────────────────────
// 🗃️ LEITURA DO ESTADO (com cache curto — roda a cada mensagem)
// ─────────────────────────────────────────────────
let cacheDB = { quando: 0, dados: {} };

function lerGrupos() {
    const agora = Date.now();
    if (agora - cacheDB.quando > 2500) {
        try { cacheDB = { quando: agora, dados: getDB() }; } catch { cacheDB = { quando: agora, dados: {} }; }
    }
    return cacheDB.dados;
}

function invalidarCache() { cacheDB.quando = 0; }

// ─────────────────────────────────────────────────
// 📦 DESEMBRULHAR A MENSAGEM (temporária, visualização única, etc.)
// ─────────────────────────────────────────────────
const EMBRULHOS = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "deviceSentMessage",
    "groupMentionedMessage",
    "editedMessage"
];

function desembrulhar(message) {
    let atual = message;
    for (let i = 0; i < 6; i++) {
        if (!atual || typeof atual !== "object") break;

        // Edição de mensagem: o conteúdo novo vem dentro do protocolMessage.
        const edicao = atual.protocolMessage?.editedMessage;
        if (edicao) { atual = edicao; continue; }

        const nome = EMBRULHOS.find(n => atual[n]?.message);
        if (!nome) break;
        atual = atual[nome].message;
    }
    return atual || {};
}

// ─────────────────────────────────────────────────
// 🔎 DETECÇÃO DE TRAVA
// ─────────────────────────────────────────────────
const LIMITE_TEXTO_ABSURDO = 10000;   // acima disso já é suspeito por si só
const LIMITE_TEXTO_LONGO = 4000;      // acima disso, só se tiver caracteres estranhos
const LIMITE_PALAVRA_GIGANTE = 1500;  // "palavra" sem espaço com esse tamanho

function intervaloExotico(cp) {
    return (
        (cp >= 0x0F00 && cp <= 0x0FFF) ||   // tibetano
        (cp >= 0xA980 && cp <= 0xA9DF) ||   // javanês
        (cp >= 0x1B00 && cp <= 0x1BFF) ||   // balinês / sundanês / batak
        (cp >= 0x1C00 && cp <= 0x1C4F) ||   // lepcha
        (cp >= 0xA900 && cp <= 0xA92F) ||   // kayah li
        (cp >= 0xAA00 && cp <= 0xAA7F) ||   // cham / mianmar estendido
        (cp >= 0xA9E0 && cp <= 0xA9FF) ||   // mianmar estendido-B
        (cp >= 0x12000 && cp <= 0x1254F) || // cuneiforme
        (cp >= 0x13000 && cp <= 0x1342F) || // hieróglifos
        (cp >= 0x1D000 && cp <= 0x1D24F)    // símbolos musicais
    );
}

function ehInvisivel(cp) {
    return (
        (cp >= 0x200B && cp <= 0x200F) ||
        (cp >= 0x202A && cp <= 0x202E) ||
        (cp >= 0x2060 && cp <= 0x206F) ||
        cp === 0xFEFF || cp === 0x061C || cp === 0x180E ||
        cp === 0x034F || cp === 0x115F || cp === 0x1160 ||
        cp === 0x3164 || cp === 0xFFA0
    );
}

const REGEX_MARCA = /\p{M}/u;

function analisarTexto(texto) {
    const t = String(texto || "");
    if (!t) return null;

    if (t.length > LIMITE_TEXTO_ABSURDO) {
        return `texto gigante (${t.length.toLocaleString("pt-BR")} caracteres)`;
    }

    const analisado = t.length > 60000 ? t.slice(0, 60000) : t;
    let total = 0;
    let invisiveis = 0;
    let marcas = 0;
    let corridaMarcas = 0;
    let maiorCorrida = 0;
    let privados = 0;
    let tags = 0;
    let exoticos = 0;
    let astrais = 0;
    let corridaSemEspaco = 0;
    let maiorSemEspaco = 0;
    let corridaVariacao = 0;
    let maiorVariacao = 0;

    for (const ch of analisado) {
        const cp = ch.codePointAt(0);
        total++;

        if (cp > 0xFFFF) astrais++;

        if (ehInvisivel(cp)) invisiveis++;
        if ((cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0x10FFFF)) privados++;
        if (cp >= 0xE0000 && cp <= 0xE007F) tags++;
        if (intervaloExotico(cp)) exoticos++;

        if ((cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF)) {
            corridaVariacao++;
            if (corridaVariacao > maiorVariacao) maiorVariacao = corridaVariacao;
        } else {
            corridaVariacao = 0;
        }

        if (cp >= 0x0300 && REGEX_MARCA.test(ch)) {
            marcas++;
            corridaMarcas++;
            if (corridaMarcas > maiorCorrida) maiorCorrida = corridaMarcas;
        } else {
            corridaMarcas = 0;
        }

        if (/\s/.test(ch)) {
            corridaSemEspaco = 0;
        } else {
            corridaSemEspaco++;
            if (corridaSemEspaco > maiorSemEspaco) maiorSemEspaco = corridaSemEspaco;
        }
    }

    if (invisiveis >= 15 || (total >= 20 && invisiveis / total > 0.2)) return "excesso de caracteres invisíveis";
    if (maiorCorrida >= 8) return "caracteres empilhados (zalgo)";
    if (marcas >= 80 && marcas / total > 0.25) return "excesso de marcas unicode";
    if (privados >= 10) return "caracteres unicode privados";
    if (tags >= 3) return "caracteres unicode ocultos";
    if (maiorVariacao >= 10) return "sequência de seletores unicode";
    if (exoticos >= 30) return "excesso de caracteres unicode raros";
    if (maiorSemEspaco >= LIMITE_PALAVRA_GIGANTE) return "bloco de texto gigante sem espaços";
    if (astrais >= 1500) return "excesso de símbolos";
    if (t.length > LIMITE_TEXTO_LONGO) {
        const estranhos = invisiveis + marcas + privados + exoticos;
        if (estranhos / total > 0.05) return "texto longo com caracteres estranhos";
    }
    return null;
}

const TIPOS_INTERATIVOS_SUSPEITOS = [
    "buttonsMessage",
    "listMessage",
    "templateMessage",
    "interactiveMessage",
    "orderMessage",
    "productMessage",
    "invoiceMessage",
    "highlyStructuredMessage"
];

function detectarTrava(conteudo) {
    if (!conteudo || typeof conteudo !== "object") return null;

    // Mensagens interativas "montadas" por cliente modificado/bot são o
    // caminho clássico de trava — um usuário comum não consegue enviá-las.
    for (const tipo of TIPOS_INTERATIVOS_SUSPEITOS) {
        if (conteudo[tipo]) return "mensagem interativa suspeita";
    }

    // Texto / legenda
    const textos = [
        conteudo.conversation,
        conteudo.extendedTextMessage?.text,
        conteudo.extendedTextMessage?.matchedText,
        conteudo.extendedTextMessage?.title,
        conteudo.extendedTextMessage?.description,
        conteudo.imageMessage?.caption,
        conteudo.videoMessage?.caption,
        conteudo.documentMessage?.caption,
        conteudo.documentMessage?.fileName,
        conteudo.documentMessage?.title,
        conteudo.locationMessage?.name,
        conteudo.locationMessage?.address,
        conteudo.liveLocationMessage?.caption
    ];
    for (const texto of textos) {
        const motivo = analisarTexto(texto);
        if (motivo) return motivo;
    }

    // Contatos com vcard gigante ou lista enorme de contatos
    const vcard = conteudo.contactMessage?.vcard;
    if (vcard && String(vcard).length > 8000) return "contato com dados gigantes";
    const lista = conteudo.contactsArrayMessage?.contacts;
    if (Array.isArray(lista)) {
        if (lista.length > 30) return "lista gigante de contatos";
        if (lista.some(c => String(c?.vcard || "").length > 8000)) return "contato com dados gigantes";
    }

    // Menções em massa dentro da mesma mensagem
    const contexto =
        conteudo.extendedTextMessage?.contextInfo ||
        conteudo.imageMessage?.contextInfo ||
        conteudo.videoMessage?.contextInfo ||
        conteudo.documentMessage?.contextInfo ||
        null;
    if (Array.isArray(contexto?.mentionedJid) && contexto.mentionedJid.length > 1500) {
        return "menções em massa";
    }

    return null;
}

// ─────────────────────────────────────────────────
// 🧭 CLASSIFICAÇÃO DA MENSAGEM
// ─────────────────────────────────────────────────
function classificar(conteudo) {
    return {
        trava: detectarTrava(conteudo),
        loc: !!(conteudo.locationMessage || conteudo.liveLocationMessage),
        doc: !!conteudo.documentMessage,
        video: !!(conteudo.videoMessage || conteudo.ptvMessage),
        img: !!conteudo.imageMessage
    };
}

// ─────────────────────────────────────────────────
// ⚠️ ADVERTÊNCIAS DO ANTI-DOC (usa o mesmo banco do comando "advertidos")
// ─────────────────────────────────────────────────
const arquivoAvisos = path.join(__dirname, "../../database/recursos-avancados.json");

function lerAvisos() {
    try {
        return fs.existsSync(arquivoAvisos)
            ? JSON.parse(fs.readFileSync(arquivoAvisos, "utf8")) || {}
            : {};
    } catch { return {}; }
}

function salvarAvisos(db) {
    try {
        fs.mkdirSync(path.dirname(arquivoAvisos), { recursive: true });
        fs.writeFileSync(arquivoAvisos, JSON.stringify(db, null, 2), "utf8");
    } catch (e) { console.error("⚠️ Protecoes: erro ao salvar advertência:", e?.message || e); }
}

// ─────────────────────────────────────────────────
// ✉️ TEXTOS (padrão Katrielly)
// ─────────────────────────────────────────────────
function rodape() {
    return `🎀 ${config.BOT_NAME}\n👑 ${config.OWNER_NAME}`;
}

function numero(jid) {
    return String(jid || "").split("@")[0].split(":")[0];
}

async function enviar(sock, from, texto, mentions = []) {
    try { await sock.sendMessage(from, { text: texto, mentions }); } catch {}
}

async function apagar(sock, msg) {
    try { await sock.sendMessage(msg.key.remoteJid, { delete: msg.key }); return true; }
    catch (e) { console.error("⚠️ Protecoes: não consegui apagar:", e?.message || e); return false; }
}

async function remover(sock, from, jid) {
    try { await sock.groupParticipantsUpdate(from, [jid], "remove"); return true; }
    catch (e) { console.error("⚠️ Protecoes: não consegui remover:", e?.message || e); return false; }
}

// ─────────────────────────────────────────────────
// 🛡️ PROCESSAR CADA MENSAGEM DO GRUPO
// Retorna true quando a mensagem foi tratada (apagada) e o roteador deve parar.
// ─────────────────────────────────────────────────
async function processarProtecoes(sock, msg) {
    const from = msg?.key?.remoteJid;
    if (!from || !from.endsWith("@g.us") || msg.key.fromMe || !msg.message) return false;

    const flags = lerGrupos()[from];
    if (!flags) return false;
    if (!(flags.antitrava || flags.antiloc || flags.antidoc || flags.antiimg || flags.antivideo)) return false;

    const conteudo = desembrulhar(msg.message);
    const tipos = classificar(conteudo);

    // Qual regra foi quebrada? (a mais grave tem prioridade)
    let regra = null;
    if (flags.antitrava && tipos.trava) regra = "trava";
    else if (flags.antiloc && tipos.loc) regra = "loc";
    else if (flags.antidoc && tipos.doc) regra = "doc";
    else if (flags.antivideo && tipos.video) regra = "video";
    else if (flags.antiimg && tipos.img) regra = "img";
    if (!regra) return false;

    const autor = msg.key.participantAlt || msg.key.participant;
    const autorId = msg.key.participant || autor;
    if (!autorId) return false;

    // Admin, dono e bot passam livres.
    if (await isAdmin(sock, from, autorId).catch(() => false)) return false;
    if (autor && autor !== autorId && await isAdmin(sock, from, autor).catch(() => false)) return false;

    // Sem ser admin, o bot não consegue agir.
    if (!(await isBotAdmin(sock, from).catch(() => false))) return false;

    const marca = `@${numero(autorId)}`;
    const mencoes = [autorId];

    switch (regra) {

        case "trava": {
            await apagar(sock, msg);
            await enviar(sock, from,
`🎀━━━━━━━━━━━━━━🎀
🛡️ *ANTI-TRAVA ATIVO* 🛡️
🎀━━━━━━━━━━━━━━🎀

🚫 Uma mensagem de ${marca} foi apagada.
📌 *Motivo:* ${tipos.trava}
⚠️ Mensagens com características de trava não são permitidas neste grupo.

${rodape()}`, mencoes);
            return true;
        }

        case "loc": {
            await apagar(sock, msg);
            const removido = await remover(sock, from, autorId);
            await enviar(sock, from,
`🎀━━━━━━━━━━━━━━🎀
📍 *ANTI-LOCALIZAÇÃO* 📍
🎀━━━━━━━━━━━━━━🎀

${removido ? `🚫 ${marca} foi *removido(a)* do grupo.` : `🚫 A localização de ${marca} foi apagada.`}
📌 *Motivo:* envio de localização
⚠️ Compartilhar localização é proibido neste grupo por segurança.
${removido ? "" : "\n❗ Não consegui remover a pessoa. Verifique se tenho permissão de administradora."}
${rodape()}`, mencoes);
            return true;
        }

        case "doc": {
            await apagar(sock, msg);

            const db = lerAvisos();
            db.protecoes ||= {};
            db.protecoes.doc ||= {};
            db.protecoes.doc[from] ||= {};
            const anteriores = Number(db.protecoes.doc[from][autorId] || 0);

            if (anteriores >= 1) {
                // Reincidente: remove
                delete db.protecoes.doc[from][autorId];
                salvarAvisos(db);
                const removido = await remover(sock, from, autorId);
                await enviar(sock, from,
`🎀━━━━━━━━━━━━━━🎀
📄 *ANTI-DOCUMENTO* 📄
🎀━━━━━━━━━━━━━━🎀

${removido ? `🚫 ${marca} foi *removido(a)* do grupo.` : `🚫 ${marca} enviou documento novamente.`}
📌 *Motivo:* reincidência no envio de documentos (já havia sido advertido)
${removido ? "" : "\n❗ Não consegui remover a pessoa. Verifique se tenho permissão de administradora."}
${rodape()}`, mencoes);
            } else {
                db.protecoes.doc[from][autorId] = 1;
                // Também aparece em /advertidos
                db.warns ||= {};
                db.warns[from] ||= {};
                db.warns[from][autorId] = Number(db.warns[from][autorId] || 0) + 1;
                salvarAvisos(db);
                await enviar(sock, from,
`🎀━━━━━━━━━━━━━━🎀
📄 *ANTI-DOCUMENTO* 📄
🎀━━━━━━━━━━━━━━🎀

⚠️ ${marca}, seu documento foi apagado e você recebeu uma *ADVERTÊNCIA*.
📌 Documentos não são permitidos neste grupo.
🚨 Se enviar outro, será *removido(a)* automaticamente.

${rodape()}`, mencoes);
            }
            return true;
        }

        case "video": {
            await apagar(sock, msg);
            await enviar(sock, from,
`🎀━━━━━━━━━━━━━━🎀
🎬 *ANTI-VÍDEO ATIVO* 🎬
🎀━━━━━━━━━━━━━━🎀

🚫 O vídeo de ${marca} foi apagado.
📌 Neste grupo *nenhum vídeo* é permitido, nem memes.

${rodape()}`, mencoes);
            return true;
        }

        case "img": {
            await apagar(sock, msg);
            await enviar(sock, from,
`🎀━━━━━━━━━━━━━━🎀
🖼️ *ANTI-IMAGEM ATIVO* 🖼️
🎀━━━━━━━━━━━━━━🎀

🚫 A imagem de ${marca} foi apagada.
📌 Neste grupo *nenhuma imagem* é permitida.

${rodape()}`, mencoes);
            return true;
        }
    }

    return false;
}

// ─────────────────────────────────────────────────
// 🎛️ COMANDOS LIGAR / DESLIGAR
// ─────────────────────────────────────────────────
function textoAviso(def) {
    return (
`🎀━━━━━━━━━━━━━━🎀
${def.emoji} *${def.titulo} ATIVADO* ${def.emoji}
🎀━━━━━━━━━━━━━━🎀

📢 *ATENÇÃO, GRUPO!*
A partir de agora eu ${def.oQueFaz}

👮 Administradores não são afetados.

${rodape()}`
    );
}

async function alternarProtecao(sock, msg, command, args = []) {
    const from = msg.key.remoteJid;
    const resolvido = resolverProtecao(command, args);
    if (!resolvido) return false;
    const { def, resto } = resolvido;

    if (!from?.endsWith("@g.us")) {
        await sock.sendMessage(from, { text: `🎀 Esse comando só funciona dentro de grupos.` }, { quoted: msg });
        return true;
    }

    const db = getDB();
    db[from] ||= {};

    const pedido = semAcento(resto[0]);
    let novoEstado;
    if (["on", "ativar", "ligar", "1", "sim"].includes(pedido)) novoEstado = true;
    else if (["off", "desativar", "desligar", "0", "nao"].includes(pedido)) novoEstado = false;
    else novoEstado = !db[from][def.chave];

    db[from][def.chave] = novoEstado;
    saveDB(db);
    invalidarCache();

    if (novoEstado) {
        // Aviso para todo mundo saber o que acontece agora.
        let mencoes = [];
        if (def.chave === "antiimg" || def.chave === "antivideo") {
            try {
                const meta = await sock.groupMetadata(from);
                mencoes = (meta.participants || []).map(p => p.id).filter(Boolean);
            } catch {}
        }
        await sock.sendMessage(from, { text: textoAviso(def), mentions: mencoes }, { quoted: msg });

        // Sem ser admin, nada disso funciona — avisa já.
        if (!(await isBotAdmin(sock, from).catch(() => false))) {
            await sock.sendMessage(from, {
                text: `⚠️ *Atenção:* eu ainda não sou *administradora* deste grupo. Me promova para a proteção funcionar. 🎀`
            }, { quoted: msg });
        }
    } else {
        await sock.sendMessage(from, {
            text:
`🎀━━━━━━━━━━━━━━🎀
${def.emoji} *${def.titulo} DESATIVADO* ${def.emoji}
🎀━━━━━━━━━━━━━━🎀

✅ Essa proteção foi desligada. Tudo liberado de novo!

${rodape()}`
        }, { quoted: msg });
    }
    return true;
}

// Lista de nomes de comando (para o roteador e para os menus)
const COMANDOS_PROTECAO = Object.keys(PROTECOES);

module.exports = {
    processarProtecoes,
    alternarProtecao,
    resolverProtecao,
    COMANDOS_PROTECAO,
    PROTECOES,
    // exportados para teste
    analisarTexto,
    detectarTrava,
    classificar,
    desembrulhar
};
