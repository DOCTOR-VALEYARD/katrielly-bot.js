/* =================================================
   🪪 PERFIL — KATRIELLY
   📁 Arquivo: perfil.js
   Manda a FOTO da pessoa com a legenda do perfil: nome, número, cargo
   (Dono / VIP / Membro comum), grupo, level e as barrinhas de
   gado, fiel, infiel, feio e bonito — cada uma com uma frase aleatória.
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { baixarBuffer } = require("../utils-imagem/utils-imagem");
const { xpParaProximoNivel } = require("../level/level");

const dbPath = path.join(__dirname, "../../database/usuarios.json");

// 📚 LEITURA DO BANCO
function lerUsuarios() {
    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch {
        return {};
    }
}

// 💾 SALVAR DADOS
function salvarUsuarios(dados) {
    fs.writeFileSync(dbPath, JSON.stringify(dados, null, 2), "utf8");
}

// 🎖️ CLASSIFICAÇÃO POR NÍVEL
function calcularPatente(nivel) {
    if (nivel >= 25) return "🏆 LENDÁRIO";
    if (nivel >= 18) return "🥇 DIAMANTE";
    if (nivel >= 12) return "🥈 OURO";
    if (nivel >= 7) return "🥉 PRATA";
    if (nivel >= 3) return "🔵 BRONZE";
    return "⚪ INICIANTE";
}

// ───────────────────────────────────────────────
// 🎲 NÚMEROS "ALEATÓRIOS" ESTÁVEIS
// Mesma pessoa + mesmo dia = mesmo resultado (não muda a cada vez que ela
// pede o perfil). No dia seguinte sorteia de novo.
// ───────────────────────────────────────────────
function criarSorteio(semente) {
    let h = 2166136261;
    for (let i = 0; i < semente.length; i++) {
        h ^= semente.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return function proximo() {
        h += 0x6d2b79f5;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function diaDeHoje() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function barra(porcentagem, tamanho = 10) {
    const cheios = Math.max(0, Math.min(tamanho, Math.round((porcentagem / 100) * tamanho)));
    return "█".repeat(cheios) + "░".repeat(tamanho - cheios);
}

// 💬 Frases por faixa (baixo / médio / alto). Pode editar à vontade.
const FRASES = {
    gado: {
        baixo: [
            "Nem sabe o que é pastar. Respeito.",
            "Zero capim, só dignidade.",
            "Pasto? Passa longe daqui.",
            "Gado nenhum, esse aí tem postura."
        ],
        medio: [
            "Já deu uma mugida ou outra, mas disfarça bem.",
            "Gado de fim de semana.",
            "Pastando de leve, ninguém percebe.",
            "Tem dias que o capim fala mais alto."
        ],
        alto: [
            "Já nasceu de chocalho no pescoço.",
            "Rebanho inteiro segue ele.",
            "Mugiu até no grupo, é gado de raiz.",
            "Dono do pasto, o rei da boiada."
        ]
    },
    fiel: {
        baixo: [
            "Lealdade em modo avião.",
            "Fiel só ao Wi-Fi.",
            "Compromisso? Só com a própria cama."
        ],
        medio: [
            "Fiel quando tem plateia.",
            "Leal, mas com o dedo coçando.",
            "Confiança de 50%, o resto é fé."
        ],
        alto: [
            "Fidelidade nível cachorro de filme.",
            "Leal até a morte, pode confiar.",
            "Esse aí devolve troco errado e avisa."
        ]
    },
    infiel: {
        baixo: [
            "Nem o vento ele trai.",
            "Santo de altar, nenhuma suspeita.",
            "Folha corrida limpa."
        ],
        medio: [
            "Olhou, mas não tocou. Ainda.",
            "Tem um histórico de curtidas suspeitas.",
            "Fica de olho, só por garantia."
        ],
        alto: [
            "Cuidado, perigo ambulante.",
            "Já tem até lista de espera.",
            "Se for namorar, instale câmera."
        ]
    },
    feio: {
        baixo: [
            "Espelho nem trinca quando ele passa.",
            "Beleza que dá sombra pro sol.",
            "Feio? Só se for de caráter... brincadeira."
        ],
        medio: [
            "Tem charme, mas precisa de filtro.",
            "Bonito de longe, só longe.",
            "Visual de quem acorda e vai."
        ],
        alto: [
            "Até o espelho pede desculpa.",
            "Foto só no escuro, por segurança.",
            "Salvo pela personalidade. Talvez."
        ]
    },
    bonito: {
        baixo: [
            "Beleza interior, bem lá no fundo.",
            "Charme escondido, bem escondido.",
            "A simpatia faz o serviço."
        ],
        medio: [
            "Bonitinho, apresentável e cheiroso.",
            "Dá pro gasto e ainda sobra.",
            "Passa em qualquer entrevista."
        ],
        alto: [
            "Capa de revista, sem Photoshop.",
            "Para o trânsito e a conversa.",
            "Tá pesado, tem que ter licença pra ser assim."
        ]
    }
};

function faixa(p) {
    if (p < 34) return "baixo";
    if (p < 67) return "medio";
    return "alto";
}

function escolher(lista, sorteio) {
    return lista[Math.floor(sorteio() * lista.length)];
}

function gerarEspecificacoes(jid) {
    const sorteio = criarSorteio(`${jid}|${diaDeHoje()}`);
    const gado = Math.floor(sorteio() * 101);
    const fiel = Math.floor(sorteio() * 101);
    const bonito = Math.floor(sorteio() * 101);
    const infiel = 100 - fiel;
    const feio = 100 - bonito;

    const linha = (chave, valor) => ({
        valor,
        barra: barra(valor),
        frase: escolher(FRASES[chave][faixa(valor)], sorteio)
    });

    return {
        gado: linha("gado", gado),
        fiel: linha("fiel", fiel),
        infiel: linha("infiel", infiel),
        feio: linha("feio", feio),
        bonito: linha("bonito", bonito)
    };
}

// ───────────────────────────────────────────────
// 🔎 AUXILIARES DE IDENTIDADE
// ───────────────────────────────────────────────
function soDigitos(v) {
    return String(v || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function normalizar(jid) {
    return String(jid || "").replace(/:\d+@/, "@");
}

function acharParticipante(meta, jid) {
    if (!meta?.participants) return null;
    const alvo = soDigitos(jid);
    return meta.participants.find(p => {
        const ids = [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(soDigitos);
        return ids.includes(alvo);
    }) || null;
}

function formatarNumero(digitos) {
    if (!digitos) return "não disponível";
    if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
        const ddd = digitos.slice(2, 4);
        const resto = digitos.slice(4);
        const parte1 = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
        const parte2 = resto.length === 9 ? resto.slice(5) : resto.slice(4);
        return `+55 (${ddd}) ${parte1}-${parte2}`;
    }
    return `+${digitos}`;
}

function ehVipSeguro(jid) {
    try {
        const { ehVip } = require("../aluguel-planos/aluguel-planos");
        return !!ehVip(jid);
    } catch {
        return false;
    }
}

async function buscarFoto(sock, candidatos) {
    for (const jid of candidatos.filter(Boolean)) {
        try {
            const url = await sock.profilePictureUrl(jid, "image");
            if (url) {
                const buffer = await baixarBuffer(url);
                if (buffer?.length) return buffer;
            }
        } catch { /* tenta o próximo */ }
    }
    return null;
}

// ───────────────────────────────────────────────
// 🪪 COMANDO PRINCIPAL
// ───────────────────────────────────────────────
async function perfil(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    const isGroup = String(from).endsWith("@g.us");
    const remetente = msg.key.participant || msg.key.remoteJid;
    const contexto = msg.message?.extendedTextMessage?.contextInfo;

    // 👤 Quem é o alvo: respondeu alguém > marcou alguém > número digitado > a própria pessoa
    let alvo = remetente;
    let alvoEhRemetente = true;
    const marcados = contexto?.mentionedJid || [];

    if (contexto?.participant) {
        alvo = contexto.participant;
        alvoEhRemetente = false;
    } else if (marcados.length) {
        alvo = marcados[0];
        alvoEhRemetente = false;
    } else if (args[0] && /\d{6,}/.test(args[0].replace(/\D/g, ""))) {
        const digitos = args[0].replace(/\D/g, "");
        alvo = `${digitos}@s.whatsapp.net`;
        alvoEhRemetente = false;
    }
    alvo = normalizar(alvo);

    // 🏘️ Dados do grupo
    let meta = null;
    if (isGroup) {
        try { meta = await sock.groupMetadata(from); } catch { meta = null; }
    }
    const participante = acharParticipante(meta, alvo);

    // 📞 Número de telefone (no WhatsApp novo o ID pode ser um LID, não o número)
    let jidTelefone = null;
    if (/@s\.whatsapp\.net$/i.test(alvo)) jidTelefone = alvo;
    else if (alvoEhRemetente && msg.key.participantAlt) jidTelefone = normalizar(msg.key.participantAlt);
    else if (participante?.phoneNumber) jidTelefone = normalizar(participante.phoneNumber);
    else if (participante?.id && /@s\.whatsapp\.net$/i.test(participante.id)) jidTelefone = normalizar(participante.id);

    const digitosNumero = jidTelefone ? soDigitos(jidTelefone) : "";
    const numeroTexto = digitosNumero ? formatarNumero(digitosNumero) : "oculto pelo WhatsApp";

    // 🗃️ Banco de usuários (se a pessoa nunca falou, usa valores iniciais)
    const banco = lerUsuarios();
    const chaveBanco = [alvo, jidTelefone].find(k => k && banco[k]) || alvo;
    const dados = banco[chaveBanco] || {};
    const nivel = dados.nivel || 1;
    const xp = Number(dados.xp) || 0;
    const moedas = dados.ouro || 0;
    const vitorias = dados.vitorias || 0;
    const derrotas = dados.derrotas || 0;
    const necessario = xpParaProximoNivel(nivel);
    const progresso = Math.max(0, Math.min(100, Math.round((xp / necessario) * 100)));
    const patente = calcularPatente(nivel);

    // 🏷️ Nome
    const nome =
        (alvoEhRemetente && msg.pushName) ||
        dados.nome ||
        dados.pushName ||
        digitosNumero ||
        "Sem nome";

    // 🎖️ Cargo
    const { ehDono } = require("../utils-validacao/utils-validacao");
    const ehDonoAlvo = ehDono([alvo, jidTelefone], config.OWNER_NUMBER);
    const ehAdm = !!participante?.admin;
    const vip = ehVipSeguro(alvo) || (jidTelefone ? ehVipSeguro(jidTelefone) : false);

    let cargo = "👤 Membro comum";
    if (ehDonoAlvo) cargo = "👑 Dono do bot";
    else if (vip) cargo = "💎 VIP";
    if (ehAdm && !ehDonoAlvo) cargo += " • 🛡️ Admin do grupo";

    const nomeGrupo = isGroup ? (meta?.subject || "Grupo") : "Conversa privada";

    // 📊 Barrinhas
    const e = gerarEspecificacoes(chaveBanco);

    const legenda = [
        `🪪 *PERFIL — ${nome}*`,
        `━━━━━━━━━━━━━━━━━━`,
        `👤 *Nome:* ${nome}`,
        `📞 *Número:* ${numeroTexto}`,
        `🎖️ *Cargo:* ${cargo}`,
        `🏘️ *Grupo:* ${nomeGrupo}`,
        ``,
        `⭐ *Level:* ${nivel} • ${patente}`,
        `📈 *Pontos:* ${xp.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} / ${necessario.toLocaleString("pt-BR")}`,
        `${barra(progresso)} ${progresso}%`,
        `💰 *Moedas:* ${Number(moedas).toLocaleString("pt-BR")}   ✅ ${vitorias}   ❌ ${derrotas}`,
        ``,
        `📋 *ESPECIFICAÇÕES*`,
        `🐂 *Gado:* ${e.gado.valor}%`,
        `${e.gado.barra}`,
        `_${e.gado.frase}_`,
        ``,
        `💍 *Fiel:* ${e.fiel.valor}%`,
        `${e.fiel.barra}`,
        `_${e.fiel.frase}_`,
        ``,
        `💔 *Infiel:* ${e.infiel.valor}%`,
        `${e.infiel.barra}`,
        `_${e.infiel.frase}_`,
        ``,
        `🤢 *Feio:* ${e.feio.valor}%`,
        `${e.feio.barra}`,
        `_${e.feio.frase}_`,
        ``,
        `😎 *Bonito:* ${e.bonito.valor}%`,
        `${e.bonito.barra}`,
        `_${e.bonito.frase}_`,
        `━━━━━━━━━━━━━━━━━━`,
        `🤍 ${config.BOT_NAME} • ${config.OWNER_NAME}`
    ].join("\n");

    const mentions = [alvo];
    const foto = await buscarFoto(sock, [alvo, jidTelefone]);

    try {
        if (foto) {
            return await sock.sendMessage(from, { image: foto, caption: legenda, mentions }, { quoted: msg });
        }
    } catch (erro) {
        console.error("⚠️ Não consegui enviar a foto do perfil, mandando só o texto:", erro?.message || erro);
    }

    return sock.sendMessage(from, { text: legenda, mentions }, { quoted: msg });
}

module.exports = { perfil, lerUsuarios, salvarUsuarios };
