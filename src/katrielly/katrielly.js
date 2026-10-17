/* =================================================
   🎀 KATRIELLY BOT — PERSONALIDADE
   📁 src/katrielly/katrielly.js

   1) RESPONDE QUANDO CHAMAM PELO NOME
      Se alguém escrever "katrielly" em qualquer parte da frase (maiúscula,
      minúscula, com ou sem acento), ela responde com uma mensagem
      aleatória da lista.
      • Nunca repete a mesma resposta em sequência no mesmo grupo.
      • Espera um tempinho antes de responder (parece mais natural).
      • Depois de responder uma pessoa, só responde ela de novo depois de
        um intervalo — e quem insiste demora cada vez mais (anti-spam).

   2) REAGE COM 🎀 EM TODAS AS MENSAGENS
      Liga/desliga em config.js → KATRIELLY.REACAO_ATIVA

   Tudo é configurável em config.js → KATRIELLY.
================================================= */

const config = require("../../config");

// ─────────────────────────────────────────────────
// ⚙️ CONFIGURAÇÃO (com valores padrão seguros)
// ─────────────────────────────────────────────────
function conf() {
    const c = config.KATRIELLY || {};
    return {
        respostaAtiva: c.RESPOSTA_NOME_ATIVA !== false,
        cooldownUsuarioSeg: Number(c.COOLDOWN_USUARIO_SEG ?? 90),
        cooldownGrupoSeg: Number(c.COOLDOWN_GRUPO_SEG ?? 6),
        atrasoMinMs: Number(c.ATRASO_MIN_MS ?? 1500),
        atrasoMaxMs: Number(c.ATRASO_MAX_MS ?? 4000),
        reacaoAtiva: c.REACAO_ATIVA !== false,
        reacaoEmoji: String(c.REACAO_EMOJI || "🎀"),
        reacaoIntervaloMs: Number(c.REACAO_INTERVALO_MS ?? 0)
    };
}

// ─────────────────────────────────────────────────
// 💬 MENSAGENS (use {nome} para marcar a pessoa)
// ─────────────────────────────────────────────────
const RESPOSTAS = [
    "Oi, {nome}! 🎀 Chamou? Pode falar que eu tô aqui.",
    "Falaram de mim? 💖 Tô presente, {nome}!",
    "Aqui, {nome}! ✨ Em que posso te ajudar hoje?",
    "Presente! 🎀 Fala comigo, {nome}.",
    "Chamou a Katrielly? Então prepara que lá vem atenção! 💕",
    "Eu ouvi meu nome! 👀 Diz aí, {nome}.",
    "Opa, {nome}! 🌸 Tava com saudade de ser chamada.",
    "Oii {nome}! 🎀 Sempre por aqui cuidando do grupo.",
    "Tô na área, {nome}! 💗 Pode mandar.",
    "Amor, {nome}, quando você me chama assim eu até me arrumo! 💅",
    "Katrielly na escuta! 🎧🎀 Pode falar, {nome}.",
    "Chamou, voltei! ✨ O que você precisa, {nome}?",
    "Oi, lindeza! 🎀 Precisando de algo é só pedir.",
    "Aqui estou, {nome}! 💖 Digita o menu se quiser ver tudo que eu faço.",
    "Eita, fui lembrada! 🥰 Obrigada pelo carinho, {nome}.",
    "Pode falar, {nome}! 🌷 Eu não mordo (só apago link 😌).",
    "Presente, {nome}! 🎀 Hoje eu tô inspirada.",
    "Tô aqui, tô viva e tô linda! 💅 E você, {nome}?",
    "Alguém disse Katrielly? 👑 Então a rainha chegou.",
    "Oi, {nome}! 🎀 Se for pedir música, é só usar o comando play.",
    "Chamou? Eu tava organizando o grupo aqui 📋✨ Fala, {nome}!",
    "Aqui, {nome}! 💕 Tô de olho em tudo, viu?",
    "Estou ouvindo, {nome}. 🎀 Pode continuar.",
    "Oi, flor! 🌸 Katrielly às ordens.",
    "Meu nome foi citado e eu apareci. 🪄 Que posso fazer por você, {nome}?",
    "Bom, {nome}, quando é comigo eu respondo com todo o meu charme. 💖",
    "Presente e sempre elegante! 🎀 Fala, {nome}.",
    "Chegou a Katrielly! ✨ Podem se comportar que eu tô de olho. 👀",
    "Sim, {nome}? 🎀 Pode dizer, sou toda ouvidos.",
    "Aqui! 🙋‍♀️ Katrielly, a bot mais querida do grupo. 💗",
    "Oi, {nome}! Vim rapidinho, mas com muito carinho. 🎀",
    "Me chamou, né? 😏 Pois não, {nome}.",
    "Tô online e radiante! ☀️🎀 Em que posso ajudar, {nome}?",
    "Opa! Ouvi meu nome ali. 🕵️‍♀️ Tá precisando de quê, {nome}?",
    "Katrielly por aqui! 💕 Se quiser ver meus comandos, é só chamar o menu.",
    "Oi {nome}, tudo bem? 🌷 Tô aqui pra o que precisar.",
    "Falou comigo? Então já tem minha atenção total. 🎀",
    "Chamada recebida! 📞🎀 Pode falar, {nome}.",
    "Aqui, {nome}! 💖 Hoje o grupo tá em boas mãos.",
    "Eu de novo, {nome}! 🥰 Sempre pronta pra ajudar.",
    "Prontinha! 🎀 Fala o que você quer, {nome}.",
    "Quem é que tá falando de mim? 😄 Oi, {nome}!",
    "Pode contar comigo, {nome}! 💞",
    "Se é pra falar comigo, que seja com carinho. 💗 Oi, {nome}!",
    "A Katrielly chegou e trouxe o laço! 🎀 Qual é a boa, {nome}?",
    "Dizem que quem chama a Katrielly nunca fica sem resposta. ✨ Fala, {nome}!",
    "Oiê! 🌸 Tô por aqui, {nome}.",
    "Chamou, {nome}? Deixa eu fechar o caderninho e já te atendo. 📓🎀",
    "Estou aqui, {nome}! 🎀 Mas se for mandar link, já aviso: eu vejo tudo. 👁️",
    "Atendendo com todo o prazer! 💕 Diz aí, {nome}.",
    "Katrielly em serviço! 🎀 O que vai ser hoje, {nome}?",
    "Uau, {nome}, adoro quando lembram de mim! 🥹💖",
    "Ei, {nome}! 🌟 Pode falar, tô prestando atenção.",
    "Tô aqui, vida! 🎀 Manda o que você precisa.",
    "Presente, chefia! 👩‍💼🎀 Fala comigo, {nome}.",
    "Fui chamada e vim linda. 💅 Qual é a missão, {nome}?",
    "Olá, {nome}! ✨ Sua assistente favorita no ar.",
    "Falou meu nome, apareci. 🪄 Magia é comigo mesmo!",
    "Oi {nome}! 🎀 Quer uma música? Use o comando play e eu busco pra você. 🎶",
    "Aqui, {nome}! 💖 E lembra: respeito é a regra número um por aqui.",
    "Alô, alô! 📡 Aqui é a Katrielly. Pode falar, {nome}.",
    "Já tô de ouvido atento, {nome}. 🎧💗",
    "Hmm, alguém sentiu minha falta? 😚 Oi, {nome}!",
    "Katrielly ao seu dispor, {nome}! 🎀✨",
    "Tá chamando por mim? Então bora conversar. 💬🎀",
    "Oi, {nome}! 🌺 Se precisar de ajuda com o grupo, me avisa.",
    "Cheguei! 🏃‍♀️💨 Pode falar, {nome}.",
    "Por aqui, {nome}! 💕 Mas me chama com carinho, tá? 😌",
    "Katrielly respondendo! 🎀 Como posso te ajudar, {nome}?",
    "Opa, fui mencionada! 📣 Tô aqui, {nome}.",
    "Disponível e sorrindo! 😁🎀 Fala, {nome}.",
    "Sim, sim, sou eu! 🙋‍♀️ O que foi, {nome}?",
    "Adoro ser chamada! 💞 Pode dizer, {nome}.",
    "Vim correndo, {nome}! 🎀 O que você quer comigo?",
    "Tô de plantão, {nome}! 🚨💖 Pode falar.",
    "Katrielly na área e de laço novo! 🎀✨ Oi, {nome}!"
];

// ─────────────────────────────────────────────────
// 🧠 CONTROLE ANTI-SPAM / ANTI-REPETIÇÃO (em memória)
// ─────────────────────────────────────────────────
const ultimoPorUsuario = new Map();   // "grupo|usuario" -> { quando, seguidas, janelaInicio }
const ultimoPorGrupo = new Map();     // grupo -> timestamp
const recentesPorGrupo = new Map();   // grupo -> [indices usados]
const ultimaReacaoPorChat = new Map();// chat -> timestamp

function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// Pega "katrielly" no meio de qualquer frase. Aceita pequenas variações de
// escrita (katriely, katrieli, katrilly...) e letras repetidas (katrieeelly).
const REGEX_NOME = /k+a+t+r+i+e*l+y+|k+a+t+r+i+e*l+i+|k+a+t+r+i+l+y+/;

function mencionaKatrielly(texto) {
    const limpo = normalizar(texto).replace(/[^a-z0-9\s@]/g, "");
    return REGEX_NOME.test(limpo);
}

function aleatorio(max) {
    return Math.floor(Math.random() * max);
}

function escolherResposta(grupo) {
    const recentes = recentesPorGrupo.get(grupo) || [];
    // Evita as últimas respostas (até metade da lista) — nunca repete em sequência.
    const limite = Math.min(recentes.length, Math.floor(RESPOSTAS.length / 2));
    const bloqueados = new Set(recentes.slice(-limite));
    let indice = aleatorio(RESPOSTAS.length);
    let tentativas = 0;
    while (bloqueados.has(indice) && tentativas < 50) {
        indice = aleatorio(RESPOSTAS.length);
        tentativas++;
    }
    recentes.push(indice);
    if (recentes.length > 40) recentes.shift();
    recentesPorGrupo.set(grupo, recentes);
    return RESPOSTAS[indice];
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

// Limpa registros antigos de tempos em tempos (não deixa a memória crescer).
setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of ultimoPorUsuario) {
        if (agora - v.quando > 60 * 60 * 1000) ultimoPorUsuario.delete(k);
    }
}, 10 * 60 * 1000).unref?.();

// ─────────────────────────────────────────────────
// 🎀 RESPONDER QUANDO CHAMAM PELO NOME
// Retorna true se respondeu (para o roteador parar).
// ─────────────────────────────────────────────────
async function responderAoNome(sock, msg, body) {
    const c = conf();
    if (!c.respostaAtiva) return false;
    if (!body || msg.key.fromMe) return false;
    if (!mencionaKatrielly(body)) return false;

    const from = msg.key.remoteJid;
    const usuario = msg.key.participant || msg.key.participantAlt || from;
    const agora = Date.now();

    // ⏳ Intervalo geral do grupo (evita várias respostas coladas)
    const ultimoGrupo = ultimoPorGrupo.get(from) || 0;
    if (agora - ultimoGrupo < c.cooldownGrupoSeg * 1000) return false;

    // ⏳ Intervalo por pessoa — quem insiste espera cada vez mais.
    const chaveUsuario = `${from}|${usuario}`;
    const registro = ultimoPorUsuario.get(chaveUsuario);
    if (registro) {
        const espera = c.cooldownUsuarioSeg * 1000 * Math.min(1 + registro.seguidas, 5);
        if (agora - registro.quando < espera) {
            // Ainda no intervalo: conta a insistência e fica em silêncio.
            registro.seguidas = Math.min(registro.seguidas + 1, 10);
            return false;
        }
    }

    ultimoPorGrupo.set(from, agora);
    const seguidasAntes = registro && agora - registro.quando < 15 * 60 * 1000 ? registro.seguidas : 0;
    ultimoPorUsuario.set(chaveUsuario, { quando: agora, seguidas: seguidasAntes > 0 ? seguidasAntes - 1 : 0 });

    const numero = String(usuario).split("@")[0].split(":")[0];
    const texto = escolherResposta(from).replace(/\{nome\}/g, `@${numero}`);

    try {
        // Um tempinho "digitando..." antes de responder, como uma pessoa.
        await sock.sendPresenceUpdate("composing", from).catch(() => {});
        const atraso = c.atrasoMinMs + aleatorio(Math.max(1, c.atrasoMaxMs - c.atrasoMinMs));
        await dormir(atraso);
        await sock.sendMessage(from, { text: texto, mentions: [usuario] }, { quoted: msg });
        await sock.sendPresenceUpdate("paused", from).catch(() => {});
    } catch (erro) {
        console.error("⚠️ Katrielly (resposta ao nome):", erro?.message || erro);
    }
    return true;
}

// ─────────────────────────────────────────────────
// 🎀 REAGIR COM O LAÇO EM TODAS AS MENSAGENS
// ─────────────────────────────────────────────────
const TIPOS_SEM_REACAO = new Set([
    "reactionMessage",
    "protocolMessage",
    "senderKeyDistributionMessage",
    "pollUpdateMessage",
    "keepInChatMessage"
]);

async function reagirComLaco(sock, msg) {
    const c = conf();
    if (!c.reacaoAtiva) return;
    if (!msg?.key || msg.key.fromMe || !msg.message) return;
    if (msg.key.remoteJid === "status@broadcast") return;

    const tipo = Object.keys(msg.message)[0];
    if (TIPOS_SEM_REACAO.has(tipo)) return;

    const chat = msg.key.remoteJid;
    if (c.reacaoIntervaloMs > 0) {
        const agora = Date.now();
        if (agora - (ultimaReacaoPorChat.get(chat) || 0) < c.reacaoIntervaloMs) return;
        ultimaReacaoPorChat.set(chat, agora);
    }

    try {
        await sock.sendMessage(chat, { react: { text: c.reacaoEmoji, key: msg.key } });
    } catch (erro) {
        // Reação é detalhe: se falhar, o bot segue normalmente.
    }
}

module.exports = {
    responderAoNome,
    reagirComLaco,
    mencionaKatrielly,
    RESPOSTAS
};
