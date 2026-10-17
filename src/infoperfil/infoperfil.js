
/* =================================================
   👤 SISTEMA DE PERFIL
   📁 Arquivo: infoperfil.js
   ================================================= */

const config = require("../../config");

async function infoperfil(sock, msg) {
    const from = msg.key.remoteJid;

    const resposta = `━━━━━━━━━━━━━━━━━━━━
      👤 *PERFIL DO JOGADOR*
━━━━━━━━━━━━━━━━━━━━

🎮 *SEU PERFIL, SUA EVOLUÇÃO*

╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴

📋 *INFORMAÇÕES DO PERFIL*

👤 Nome de cadastro
🆔 Código de identificação
🎖️ Nível atual
📊 Progresso de evolução
⭐ Experiência acumulada (EXP)
🪙 Saldo de moedas Gold
📅 Data de registro
🕒 Última atividade

╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴

🏆 *AVALIAÇÕES ESPECIAIS*

🐂 Nível de Gado
💍 Grau de Fidelidade
💅 Padrão de Beleza

╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴

⚡ *COMO CONSULTAR*

💠 Digite *${config.PREFIX}perfil*
para visualizar seu perfil completo.

👥 Para consultar o perfil de outra pessoa,
responda a uma mensagem dela com o comando.

━━━━━━━━━━━━━━━━━━━━
✨ *SISTEMA DE EVOLUÇÃO*
_Acompanhe seu progresso e evolua!_
━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(from, { text: resposta }, { quoted: msg });
}

module.exports = { infoperfil };