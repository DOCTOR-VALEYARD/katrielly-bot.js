/* =================================================
   📨 ANTIG — PROTEÇÃO CONTRA MENSAGENS EM MASSA (FLOOD)
   Comando: <prefixo>antig

   Detecta, por grupo (quando ligado), padrões de mensagem em massa de
   uma MESMA pessoa:
     • rajada: muitas mensagens em poucos segundos,
     • repetição: mesma mensagem/figurinha/mídia várias vezes seguidas,
     • colagem gigante: um textão repetido/encaminhado em série.

   Medida progressiva:
     1ª vez → advertência (sem apagar nada normal).
     Continuou → apaga as mensagens da rajada e avisa.
     Insistiu → remove do grupo (se "kick" ligado).

   Mensagens normais (uma aqui, outra ali) nunca disparam. Admins e o
   dono nunca são afetados.
================================================= */
const config = require("../../config");
const B = require("../seguranca-base/seguranca-base");

const SISTEMA = "antig";
const PADRAO = {
    on: true,
    kick: true,
    janela: 10000,   // 10s
    limite: 6,       // msgs na janela = flood
    repeticao: 4,    // mesma coisa repetida = flood
    kickApos: 3      // nº de rajadas puníveis até remover
};

const estados = B.mapaLimitado(8000); // chave -> { marcas:[], ultimo:"", repetidas:0, strikes:0, avisado:false }

// "impressão" da mensagem: texto normalizado OU tipo+hash da mídia
function impressao(m) {
    const texto = (B.textoDe(m) || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (texto) return `t:${texto.slice(0, 120)}`;
    for (const t of ["stickerMessage", "imageMessage", "videoMessage", "audioMessage", "documentMessage"]) {
        if (m?.[t]) {
            const h = m[t].fileSha256;
            const hs = h ? (typeof h === "string" ? h : Buffer.from(h).toString("base64")) : t;
            return `m:${t}:${hs}`;
        }
    }
    return null;
}

// ==================================================
// 🔎 PROCESSAMENTO AUTOMÁTICO (chamado no messages.upsert)
// Retorna true se tratou (apagou/puniu) → o bot para ali.
// ==================================================
async function processarAntig(sock, msg) {
    try {
        const grupo = msg?.key?.remoteJid;
        if (!grupo?.endsWith("@g.us") || msg.key.fromMe) return false;
        const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
        if (!cfg.on) return false;

        const autor = B.autorMsg(msg);
        if (await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt])) return false;

        const m = B.conteudoReal(msg.message);
        const imp = impressao(m);
        if (imp === null) return false;

        const chave = `${grupo}:${B.norm(autor)}`;
        const agora = Date.now();
        const st = estados.get(chave) || { marcas: [], ultimo: "", repetidas: 0, strikes: 0, avisado: false };

        st.marcas = st.marcas.filter(x => agora - x.t < cfg.janela);
        st.marcas.push({ t: agora, id: msg.key.id });
        if (imp === st.ultimo) st.repetidas++; else { st.repetidas = 1; st.ultimo = imp; }

        const rajada = st.marcas.length >= cfg.limite;
        const repetindo = st.repetidas >= cfg.repeticao;
        estados.set(chave, st);

        if (!rajada && !repetindo) return false;

        // 1ª vez: só adverte (não apaga mensagem normal)
        if (!st.avisado) {
            st.avisado = true;
            estados.set(chave, st);
            await B.enviar(sock, grupo, {
                text: `〔 📨 ᴀɴᴛɪɢ — ᴄᴀʟᴍᴀ ʟᴀ́ 〕\n\n👤 @${B.norm(autor)}\n⚠️ Você tá mandando mensagem demais de uma vez. Maneira, senão eu começo a apagar. 😏\n\n${B.rodape()}`,
                mentions: [autor]
            });
            return true;
        }

        // Já avisado: precisa ser admin pra agir
        if (!(await B.botEhAdmin(sock, grupo))) return true;

        // apaga a mensagem atual + as recentes da rajada
        await B.apagar(sock, grupo, msg.key);
        for (const x of st.marcas.slice(-cfg.limite)) {
            if (x.id && x.id !== msg.key.id) await B.apagar(sock, grupo, { remoteJid: grupo, id: x.id, participant: autor, fromMe: false });
        }

        st.strikes++;
        st.marcas = [];
        st.repetidas = 0;
        let removido = false;
        if (cfg.kick && st.strikes >= Math.max(1, cfg.kickApos)) {
            removido = await B.remover(sock, grupo, autor);
            if (removido) estados.delete(chave); else estados.set(chave, st);
        } else {
            estados.set(chave, st);
        }

        await B.enviar(sock, grupo, {
            text: `〔 📨 ᴀɴᴛɪɢ — ꜰʟᴏᴏᴅ ᴄᴏɴᴛɪᴅᴏ 〕\n\n👤 @${B.norm(autor)}\n🗑️ Apaguei a enxurrada de mensagens.\n` +
                (removido ? `🚪 Removido(a) por insistir.\n` : cfg.kick ? `⚠️ Aviso ${st.strikes}/${cfg.kickApos}.\n` : "") +
                `\n${B.rodape()}`,
            mentions: [autor]
        });
        return true;
    } catch (e) {
        console.error("⚠️ [antig] erro contido:", e?.message || e);
        return false;
    }
}

// ==================================================
// ⚙️ COMANDO <prefixo>antig
// ==================================================
async function cmdAntig(sock, msg, args = []) {
    const grupo = msg.key.remoteJid;
    const P = config.PREFIX;
    if (!grupo?.endsWith("@g.us")) return B.enviar(sock, grupo, { text: "📨 Esse comando só funciona em grupos." }, { quoted: msg });
    const autor = B.autorMsg(msg);
    if (!msg.key.fromMe && !(await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt]))) {
        return B.enviar(sock, grupo, { text: "❌ Só administrador mexe na proteção." }, { quoted: msg });
    }

    const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
    const sub = String(args[0] || "").toLowerCase();
    const estado = B.lerEstado(sub);

    if (estado !== null) {
        B.salvarCfg(grupo, SISTEMA, { on: estado });
        const semAdm = estado && !(await B.botEhAdmin(sock, grupo)) ? "\n\n⚠️ Me dá *admin* pra eu apagar e remover; sem isso eu só aviso." : "";
        return B.enviar(sock, grupo, { text: `〔 📨 ᴀɴᴛɪɢ 〕\n\n🔒 Estado: *${B.onOff(estado)}*${semAdm}\n\n${B.rodape()}` }, { quoted: msg });
    }
    if (sub === "kick") {
        const v = B.lerEstado(args[1]);
        if (v === null) return B.enviar(sock, grupo, { text: `Use: ${P}antig kick on / off` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { kick: v });
        return B.enviar(sock, grupo, { text: `📨 Remover quem insiste: *${v ? "sim" : "não"}*` }, { quoted: msg });
    }
    if (sub === "limite") {
        const n = parseInt(args[1], 10);
        if (!(n >= 3 && n <= 30)) return B.enviar(sock, grupo, { text: `Use: ${P}antig limite 6 (3 a 30 msgs)` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { limite: n });
        return B.enviar(sock, grupo, { text: `📨 Flood a partir de *${n}* mensagens em ${Math.round(cfg.janela / 1000)}s.` }, { quoted: msg });
    }
    if (sub === "repeticao" || sub === "repetição") {
        const n = parseInt(args[1], 10);
        if (!(n >= 2 && n <= 20)) return B.enviar(sock, grupo, { text: `Use: ${P}antig repeticao 4 (2 a 20)` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { repeticao: n });
        return B.enviar(sock, grupo, { text: `📨 Mesma mensagem *${n}x* seguidas = flood.` }, { quoted: msg });
    }

    return B.enviar(sock, grupo, {
        text: `〔 📨 ᴀɴᴛɪɢ — ᴍᴇɴsᴀɢᴇɴs ᴇᴍ ᴍᴀssᴀ 〕\n\n` +
            `🔒 Estado: *${B.onOff(cfg.on)}*\n` +
            `⚡ Rajada: *${cfg.limite}* msgs / ${Math.round(cfg.janela / 1000)}s\n` +
            `🔁 Repetição: *${cfg.repeticao}x* a mesma\n` +
            `🚪 Remover quem insiste: *${cfg.kick ? `sim (${cfg.kickApos}ª vez)` : "não"}*\n\n` +
            `❀ ${P}antig on / off\n❀ ${P}antig kick on / off\n❀ ${P}antig limite 6\n❀ ${P}antig repeticao 4\n\n${B.rodape()}`
    }, { quoted: msg });
}

module.exports = { processarAntig, cmdAntig, impressao };
