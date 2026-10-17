
/* =================================================
   📊 SISTEMA DE NÍVEL, XP E MOEDAS
   📁 Arquivo: level.js
   🤖 ${config.BOT_NAME} • ${config.OWNER_NAME}
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");

const { enviarSimples } = require("../envio-simples/envio-simples");


// ═══════════════════════════════════════════════════════════════
// 📂 CONFIGURAÇÃO DO BANCO
// ═══════════════════════════════════════════════════════════════

const DB_DIR = path.join(__dirname, "../../database");
const DB_PATH = path.join(DB_DIR, "usuarios.json");


// Garante que a pasta database exista
function garantirBanco() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, {
            recursive: true
        });
    }
}


// ═══════════════════════════════════════════════════════════════
// 📥 CARREGAR BANCO DE DADOS
// ═══════════════════════════════════════════════════════════════

function loadDB() {

    garantirBanco();

    if (!fs.existsSync(DB_PATH)) {
        return {};
    }

    try {

        const conteudo = fs.readFileSync(
            DB_PATH,
            "utf8"
        ).trim();

        if (!conteudo) {
            return {};
        }

        const dados = JSON.parse(conteudo);

        if (
            typeof dados !== "object" ||
            Array.isArray(dados) ||
            dados === null
        ) {
            console.warn(
                "⚠️ Banco inválido. Criando banco vazio."
            );

            return {};
        }

        return dados;

    } catch (erro) {

        console.error(
            "❌ Erro ao carregar usuarios.json:",
            erro
        );

        return {};
    }
}


// ═══════════════════════════════════════════════════════════════
// 💾 SALVAR BANCO DE DADOS
// ═══════════════════════════════════════════════════════════════

function saveDB(dados) {

    garantirBanco();

    const arquivoTemporario =
        `${DB_PATH}.tmp`;

    try {

        const conteudo =
            JSON.stringify(
                dados,
                null,
                2
            );

        // Escreve primeiro em arquivo temporário.
        // Isso reduz o risco de destruir o banco
        // caso o processo seja interrompido durante a escrita.
        fs.writeFileSync(
            arquivoTemporario,
            conteudo,
            "utf8"
        );

        fs.renameSync(
            arquivoTemporario,
            DB_PATH
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao salvar usuarios.json:",
            erro
        );

        if (
            fs.existsSync(
                arquivoTemporario
            )
        ) {
            try {
                fs.unlinkSync(
                    arquivoTemporario
                );
            } catch {}
        }

        throw erro;
    }
}


// ═══════════════════════════════════════════════════════════════
// 👤 CRIAR / GARANTIR USUÁRIO
// ═══════════════════════════════════════════════════════════════

function garantirUsuario(
    db,
    usuarioId,
    nome = "Viajante"
) {

    if (!db[usuarioId]) {

        db[usuarioId] = {
            nivel: 1,
            xp: 0,
            ouro: 0,
            nome,
            ultimaAtividade: Date.now()
        };

        return db[usuarioId];
    }


    // Corrige possíveis dados antigos/incompletos
    if (
        typeof db[usuarioId].nivel !== "number" ||
        db[usuarioId].nivel < 1
    ) {
        db[usuarioId].nivel = 1;
    }

    if (
        typeof db[usuarioId].xp !== "number" ||
        db[usuarioId].xp < 0
    ) {
        db[usuarioId].xp = 0;
    }

    if (
        typeof db[usuarioId].ouro !== "number" ||
        db[usuarioId].ouro < 0
    ) {
        db[usuarioId].ouro = 0;
    }

    if (!db[usuarioId].nome) {
        db[usuarioId].nome = nome;
    }

    return db[usuarioId];
}


// ═══════════════════════════════════════════════════════════════
// ⚙️ REGRAS DO LEVEL (tudo editável em config.js → LEVEL)
// ═══════════════════════════════════════════════════════════════
//  • Cada mensagem (que não seja comando) vale PONTOS_POR_MENSAGEM.
//  • Por dia a pessoa só pode ganhar LIMITE_DIARIO pontos.
//  • Para subir do level N pro N+1 ela precisa de N × PONTOS_BASE_NIVEL pontos
//    (level 1→2 = 1500, level 2→3 = 3000, level 3→4 = 4500, ...).
//  • Ao subir, só os pontos que passaram do necessário sobram pro próximo nível.

function regrasLevel() {
    const c = config.LEVEL || {};
    return {
        porMensagem: Number.isFinite(c.PONTOS_POR_MENSAGEM) ? c.PONTOS_POR_MENSAGEM : 0.5,
        limiteDiario: Number.isFinite(c.LIMITE_DIARIO) ? c.LIMITE_DIARIO : 4.55,
        base: Number.isFinite(c.PONTOS_BASE_NIVEL) ? c.PONTOS_BASE_NIVEL : 1500
    };
}

// Pontos necessários pra sair do nível informado.
function xpParaProximoNivel(nivel) {
    const { base } = regrasLevel();
    return Math.max(1, Math.floor(Number(nivel) || 1)) * base;
}

// Evita sujeira de ponto flutuante (0.1 + 0.2 = 0.30000000000000004)
function arredondar(n) {
    return Math.round(n * 100) / 100;
}

// Dia atual no fuso do Brasil (vira à meia-noite de Brasília).
function diaDeHoje() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}


// ═════════════════════════════════════════════════
// 📢 ANÚNCIO DE LEVEL UP (um por vez, por pessoa)
// ═════════════════════════════════════════════════

const anunciosEmAndamento = new Set();

async function anunciarLevelUp(sock, grupoId, usuarioId, nivel, recompensaOuro) {

    // Se já tem um aviso dessa pessoa sendo enviado, não manda outro.
    const chave = `${grupoId}|${usuarioId}`;
    if (anunciosEmAndamento.has(chave)) return;
    anunciosEmAndamento.add(chave);

    try {

        const nomeExibicao = usuarioId.split("@")[0];
        const proximo = xpParaProximoNivel(nivel);

        const legendaSubida = `
〔 🎉 𝐋𝐄𝐕𝐄𝐋 𝐔𝐏 〕
『 🆙 𝐍𝐎𝐕𝐎 𝐍𝐈́𝐕𝐄𝐋 』
    └─ @${nomeExibicao}
        └─ Você subiu de nível!
━━━━━━━━━━━━━━
> 📈 𝐍𝐈́𝐕𝐄𝐋
   └─ ${nivel}
> 🪙 𝐑𝐄𝐂𝐎𝐌𝐏𝐄𝐍𝐒𝐀
   └─ +${recompensaOuro} moedas de ouro
> 🎯 𝐏𝐑𝐎́𝐗𝐈𝐌𝐎 𝐍𝐈́𝐕𝐄𝐋
   └─ ${proximo.toLocaleString("pt-BR")} pontos
━━━━━━━━━━━━━━
🤍 ${config.BOT_NAME}
👑 ${config.OWNER_NAME}
━━━━━━━━━━━━━━`;

        try {
            await enviarSimples(sock, grupoId, {
                caption: legendaSubida,
                mentions: [usuarioId]
            });
        } catch (erro) {
            console.error("❌ Erro ao anunciar Level Up:", erro);
        }

    } finally {
        // segura a trava por alguns segundos pra não virar chuva de avisos
        setTimeout(() => anunciosEmAndamento.delete(chave), 15000);
    }
}


// ═══════════════════════════════════════════════════════════════
// 🆙 PROCESSAMENTO DE LEVEL
// ═══════════════════════════════════════════════════════════════

async function processLevel(sock, msg) {

    try {

        // 🚫 Ignora mensagens sem participante (PV / status)
        if (!msg?.key?.participant) {
            return;
        }

        // 📝 Extrai texto
        const textoMensagem =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            "";

        if (!textoMensagem) {
            return;
        }

        // 🚫 Comandos não dão pontos
        const prefixo = config.PREFIX || ".";
        if (textoMensagem.trim().startsWith(prefixo)) {
            return;
        }

        // 👤 Dados do usuário
        const usuarioId = msg.key.participant;
        const grupoId = msg.key.remoteJid;
        const nomeUsuario = msg.pushName?.trim() || "Viajante";

        // 📂 Carrega banco
        const db = loadDB();
        const usuario = garantirUsuario(db, usuarioId, nomeUsuario);

        usuario.nome = nomeUsuario;
        usuario.ultimaAtividade = Date.now();

        // ───────────────────────────────────────────────────────
        // 📅 LIMITE DIÁRIO
        // ───────────────────────────────────────────────────────
        const { porMensagem, limiteDiario } = regrasLevel();
        const hoje = diaDeHoje();

        if (usuario.diaPontos !== hoje) {
            usuario.diaPontos = hoje;
            usuario.pontosHoje = 0;
        }
        if (!Number.isFinite(usuario.pontosHoje)) usuario.pontosHoje = 0;

        const restanteHoje = arredondar(limiteDiario - usuario.pontosHoje);

        if (restanteHoje <= 0) {
            // Já bateu o limite de hoje: não ganha mais nada até meia-noite.
            return;
        }

        // Exatamente PONTOS_POR_MENSAGEM, só cortando na última se passar do limite.
        const ganho = arredondar(Math.min(porMensagem, restanteHoje));

        usuario.pontosHoje = arredondar(usuario.pontosHoje + ganho);
        usuario.xp = arredondar((usuario.xp || 0) + ganho);

        // ───────────────────────────────────────────────────────
        // 🆙 LEVEL UP — cada nível pede mais pontos que o anterior
        // 🔒 Tudo até o saveDB é síncrono (sem await no meio) pra que
        // mensagens simultâneas não anunciem a mesma subida várias vezes.
        // ───────────────────────────────────────────────────────
        let nivelSubiu = false;
        let ouroDaSubida = 0;

        while (usuario.xp >= xpParaProximoNivel(usuario.nivel)) {
            usuario.xp = arredondar(usuario.xp - xpParaProximoNivel(usuario.nivel));
            usuario.nivel += 1;

            const recompensaOuro = usuario.nivel * 50;
            usuario.ouro += recompensaOuro;

            nivelSubiu = true;
            ouroDaSubida += recompensaOuro;
        }

        saveDB(db);

        if (nivelSubiu) {
            await anunciarLevelUp(sock, grupoId, usuarioId, usuario.nivel, ouroDaSubida);
        }

    } catch (erro) {

        console.error("❌ Erro no sistema de Level:", erro);
    }
}


// ═══════════════════════════════════════════════════════════════
// 💰 ADICIONAR OURO
// ═══════════════════════════════════════════════════════════════

async function addGold(
    usuarioId,
    quantidade
) {

    if (
        !usuarioId ||
        !Number.isFinite(quantidade) ||
        quantidade <= 0
    ) {
        return false;
    }


    const valor =
        Math.floor(quantidade);


    if (valor <= 0) {
        return false;
    }


    const db =
        loadDB();


    const usuario =
        garantirUsuario(
            db,
            usuarioId,
            "Usuário"
        );


    usuario.ouro +=
        valor;


    saveDB(db);


    console.log(
        `[💰 OURO] +${valor} → ${usuarioId}`
    );


    return true;
}


// ═══════════════════════════════════════════════════════════════
// 📉 REMOVER OURO
// ═══════════════════════════════════════════════════════════════

async function removeGold(
    usuarioId,
    quantidade
) {

    if (
        !usuarioId ||
        !Number.isFinite(quantidade) ||
        quantidade <= 0
    ) {
        return 0;
    }


    const valorSolicitado =
        Math.floor(quantidade);


    if (valorSolicitado <= 0) {
        return 0;
    }


    const db =
        loadDB();


    if (!db[usuarioId]) {
        return 0;
    }


    const usuario =
        garantirUsuario(
            db,
            usuarioId,
            "Usuário"
        );


    // Nunca permite saldo negativo
    const valorRemovido =
        Math.min(
            valorSolicitado,
            usuario.ouro
        );


    usuario.ouro -=
        valorRemovido;


    saveDB(db);


    console.log(
        `[💰 OURO] -${valorRemovido} → ${usuarioId}`
    );


    return valorRemovido;
}


// ═══════════════════════════════════════════════════════════════
// 💳 CONSULTAR SALDO
// ═══════════════════════════════════════════════════════════════

function getBalance(usuarioId) {

    if (!usuarioId) {

        return {
            nivel: 1,
            xp: 0,
            ouro: 0
        };
    }


    const db =
        loadDB();


    if (!db[usuarioId]) {

        return {
            nivel: 1,
            xp: 0,
            ouro: 0
        };
    }


    return db[usuarioId];
}


// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTAÇÕES
// ═══════════════════════════════════════════════════════════════

module.exports = {
    processLevel,
    xpParaProximoNivel,
    loadDB,
    saveDB,
    addGold,
    removeGold,
    getBalance
};