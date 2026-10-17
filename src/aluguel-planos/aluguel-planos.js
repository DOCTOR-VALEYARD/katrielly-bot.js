/* =================================================
   💎 ALUGUEL DO BOT — controle dos planos pagos via Pix
   📁 Arquivo: aluguel-planos.js
   Guarda quem tem aluguel ativo e até quando, separado do resto
   do banco pra não misturar com config do bot.
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");

const vipPath = path.join(__dirname, "../dados/aluguel-planos.json");

function ler() {
    try {
        return fs.existsSync(vipPath) ? JSON.parse(fs.readFileSync(vipPath, "utf-8")) : {};
    } catch {
        return {};
    }
}

function salvar(db) {
    fs.writeFileSync(vipPath, JSON.stringify(db, null, 2), "utf-8");
}

function soNumeros(v) {
    return String(v || "").replace(/\D/g, "");
}

// 📋 Planos disponíveis — vem do config.js, mas cai num padrão se faltar.
function listarPlanos() {
    const configurados = config.PLANOS_ALUGUEL || config.PLANOS_VIP; // PLANOS_VIP = nome antigo
    const planos = Array.isArray(configurados) && configurados.length
        ? configurados
        : [
        { dias: 5, valor: 10, nome: "5 dias" },
        { dias: 15, valor: 20, nome: "Quinzena (15 dias)" },
        { dias: 30, valor: 35, nome: "1 mês" },
        { dias: 90, valor: 90, nome: "3 meses" },
        { dias: 240, valor: 220, nome: "8 meses" },
        { dias: 365, valor: 300, nome: "1 ano" }
    ];
    return planos.map(p => ({
        dias: Number(p.dias),
        valor: Number(p.valor),
        nome: p.nome ? String(p.nome) : nomeDoPlano(Number(p.dias))
    }));
}

function planoPorDias(dias) {
    return listarPlanos().find(p => p.dias === Number(dias)) || null;
}

// 🏷️ Nome amigável do plano (5 dias, quinzena, mês, 3 meses, 8 meses, 1 ano...)
function nomeDoPlano(dias) {
    const d = Number(dias);
    if (d === 15) return "Quinzena (15 dias)";
    if (d === 30) return "1 mês";
    if (d === 90) return "3 meses";
    if (d === 240) return "8 meses";
    if (d === 365) return "1 ano";
    return `${d} dias`;
}

// 🏘️ Quantos grupos o plano permite.
// 🎀 Agora TODO plano vale para 1 (um) grupo — não existe mais plano de 2 grupos.
function limiteGruposPorDias(dias) {
    return Number(dias) > 0 ? 1 : 0;
}

// 🏘️ Quantos grupos o aluguel atual dessa pessoa permite — já olhando pro
// plano que ela tem ativo hoje (não pro que ela comprou lá atrás).
function limiteGruposAtual(id) {
    const numero = soNumeros(id);
    if (!ehVip(numero)) return 0;
    const db = ler();
    const registro = db[numero];
    return limiteGruposPorDias(registro?.ultimoPlano);
}

// ✅ Verifica se o número está com aluguel ativo agora.
function ehVip(id) {
    const numero = soNumeros(id);
    if (!numero) return false;
    const db = ler();
    const registro = db[numero];
    if (!registro || !registro.expiraEm) return false;
    return Date.now() < registro.expiraEm;
}

// ⏳ Quanto tempo falta (em ms), ou null se não tem aluguel / já expirou.
function tempoRestante(id) {
    const numero = soNumeros(id);
    const db = ler();
    const registro = db[numero];
    if (!registro || !registro.expiraEm) return null;
    const restante = registro.expiraEm - Date.now();
    return restante > 0 ? restante : null;
}

// 🎁 Ativa/estende o aluguel de alguém por X dias. Se já tiver, soma os
// dias em cima do que resta em vez de substituir (fidelidade não perde
// o tempo que já tinha pago).
function ativarVip(id, dias, extra = {}) {
    const numero = soNumeros(id);
    const db = ler();
    const agora = Date.now();
    const baseAtual = db[numero]?.expiraEm && db[numero].expiraEm > agora
        ? db[numero].expiraEm
        : agora;
    const novaExpiracao = baseAtual + Number(dias) * 24 * 60 * 60 * 1000;

    db[numero] = {
        ...(db[numero] || {}),
        desde: db[numero]?.desde || agora,
        ultimaRenovacao: agora,
        expiraEm: novaExpiracao,
        ultimoPlano: Number(dias),
        ...extra
    };
    salvar(db);
    return db[numero];
}

function removerVip(id) {
    const numero = soNumeros(id);
    const db = ler();
    delete db[numero];
    salvar(db);
}

function formatarData(ms) {
    return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

module.exports = {
    listarPlanos,
    planoPorDias,
    ehVip,
    tempoRestante,
    ativarVip,
    removerVip,
    formatarData,
    limiteGruposPorDias,
    limiteGruposAtual,
    nomeDoPlano
};
