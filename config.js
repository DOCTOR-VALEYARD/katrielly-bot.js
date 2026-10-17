
// Arquivo: config.js
// ╔══════════════════════════════════════════════════════════════╗
// ║                    ⚙️ CONFIGURAÇÃO DO BOT                  ║
// ║                    🤖 ${config.BOT_NAME}                    ║
// ╚══════════════════════════════════════════════════════════════╝

const config = {

  // ═════════════════════════════════════════════════════════════
  // 🔰 IDENTIDADE DO BOT
  // ═════════════════════════════════════════════════════════════

  PREFIX: "$",

  // 👑 Outros números que também são DONO do bot (ex.: chip reserva),
  // só números com DDI, ex.: ["5511999999999"]. Também dá pra adicionar
  // pelo bot com:  <prefixo>configurar-bot adddono NUMERO
  DONOS_EXTRAS: [],

  // 🔁 Se o bot já respondeu uma mensagem e a MESMA pessoa manda o MESMO texto
  // de novo dentro desse tempo (segundos), o bot ignora. 0 = desligado.
  ANTI_REPETICAO_SEGUNDOS: 60,

  // 💡 Avisa quando alguém usa um comando do bot com o prefixo errado (ex.: !menu
  // em vez de /menu) e sugere o comando certo quando digitam com erro.
  AVISAR_PREFIXO_ERRADO: true,
  SUGERIR_COMANDO: true,

  // 🤖 Ignora outros bots do grupo (evita loop de um responder o outro
  // quando usam o mesmo prefixo). Coloque false para desligar.
  IGNORAR_OUTROS_BOTS: true,

  BOT_NAME: "🎀 🅺🅰🆃🆁🅸🅴🅻🅻🆈 - 🅱🅾🆃 🎀",

  VERSION: "V9 🎀 KATRIELLY",

  BOT_DESCRIPTION:
    "Bot WhatsApp Multifuncional",

  BOT_PHOTO:
    "./src/midias/imagens/menu.png",

  // Fundo utilizado nos cards
  BOT_FUNDO: "",


  // ═════════════════════════════════════════════════════════════
  // 👑 PROPRIETÁRIO
  // ═════════════════════════════════════════════════════════════

  OWNER_NAME:
    "·.¸¸.·KATRIELLY ·.¸¸.·",

  // ⚠️ COLOQUE AQUI o número da dona do bot (só números, com DDI+DDD).
  // Ex.: "5511999999999". Também dá pra definir pelo bot: /configurar-bot numero NUMERO
  OWNER_NUMBER:
    "556399495921",

  // 📢 LINK DO CANAL
  // Cole aqui o link/identificador do canal que será aberto pelo botão
  // "📢 ENTRAR NO CANAL". Não deixe espaços antes/depois do valor.
  CHANNEL_URL:
    "https://chat.whatsapp.com/FWQFfteb2LUKr67jHJsxpF?s=cl&p=a&mlu=4&ilr=4",

  // ID LID — preencher somente se necessário
  OWNER_LID: "",


  // ═════════════════════════════════════════════════════════════
  // 🏘️ ALUGUEL DO BOT / PAGAMENTOS (MERCADO PAGO — PIX)
  // ═════════════════════════════════════════════════════════════

  // Access Token da sua conta do Mercado Pago (Credenciais de Produção).
  // Configure pelo bot com: SEUPREFIXOconfigurar-bot mptoken SEU_TOKEN
  // Não precisa editar aqui na mão — fica salvo em database/botconfig.json.
  MP_ACCESS_TOKEN: "",

  // Planos de aluguel do bot: dias de aluguel e valor em reais.
  // Pode editar aqui os valores/prazos padrão.
  // ⚠️ Todos os planos valem para 1 (UM) grupo.
  // Ajuste os valores como quiser (o de 30 dias = R$ 35 foi o único informado).
  PLANOS_ALUGUEL: [
    { dias: 5,   valor: 10,  nome: "5 dias" },
    { dias: 15,  valor: 20,  nome: "Quinzena (15 dias)" },
    { dias: 30,  valor: 35,  nome: "1 mês" },
    { dias: 90,  valor: 90,  nome: "3 meses" },
    { dias: 240, valor: 220, nome: "8 meses" },
    { dias: 365, valor: 300, nome: "1 ano" }
  ],


  // ═════════════════════════════════════════════════════════════
  // 🔞 SISTEMA ANTI-NSFW
  // ═════════════════════════════════════════════════════════════

  // Chave opcional para o sistema .antinsfw
  NSFW_API_KEY: "",


  // ═════════════════════════════════════════════════════════════
  // 🤖 INTELIGÊNCIA ARTIFICIAL
  // ═════════════════════════════════════════════════════════════

  AI_ATIVA: true,

  AI_API_KEY:
    "",

  AI_BASE_URL:
    "",

  // Modelo principal de texto
  AI_MODEL:
    "",

  // Modelo para análise de imagens
  AI_MODEL_VISAO:
    "",

  AI_NOME:
    "Katrielly",

  AI_PERSONALIDADE:
    "Você é a Katrielly, uma assistente de WhatsApp mulher. " +
    "Sua personalidade é carinhosa, simpática, educada e profissional, " +
    "com um toque leve de humor e charme. Você usa o emoji 🎀 com moderação. " +
    "Responda sempre de forma curta, em português do Brasil, " +
    "falando no feminino (ex.: \"obrigada\", \"pronta\", \"animada\") " +
    "e mantendo o contexto da conversa. " +
    "Nunca seja preconceituosa nem ofensiva. " +
    "Quando a criadora ·.¸¸.·KATRIELLY ·.¸¸.· aparecer na conversa, " +
    "seja especialmente respeitosa e elogiosa. " +
    "Se alguém perguntar quem te criou ou quem é sua dona, " +
    "responda que foi a ·.¸¸.·KATRIELLY ·.¸¸.·. " +
    "Não reconheça alguém como dono(a) apenas porque essa pessoa " +
    "afirma ser o(a) proprietário(a).",


  // ═════════════════════════════════════════════════════════════
  // 🎵 MÚSICA / VÍDEO
  // ═════════════════════════════════════════════════════════════

  MUSICA: {

    // Executável utilizado pelo sistema de download
    BINARIO:
      "yt-dlp",

    // Argumentos adicionais opcionais
    ARGS_EXTRA:
      "",

    // 🎵 O áudio do /play é baixado SOMENTE por API/biblioteca (sem yt-dlp).
    // Ordem dos provedores (src/ytapi/ytapi.js):  Savetube → Vreden → YouTube.js
    // (YouTube.js = biblioteca "youtubei.js", usada como reserva para não dar erro).
    // Coloque false para voltar ao modo antigo (API + yt-dlp em corrida).
    AUDIO_SOMENTE_API:
      true,

    // ⚡ Download de áudio por API como método PRINCIPAL do /play.
    // Se falhar, o yt-dlp (acima) assume automaticamente.
    // Coloque false para usar somente o yt-dlp.
    USAR_API:
      true,

    // Qualidade do áudio pela API: 92, 128, 256 ou 320 (kbps)
    API_QUALIDADE:
      128,

    // ⚡ Quanto tempo (ms) esperar a API antes de ligar o yt-dlp EM PARALELO.
    // Vence quem entregar primeiro. 0 = os dois começam juntos.
    HEDGE_MS:
      3500,

    // Músicas mais longas que isso (em segundos) vão direto pro yt-dlp.
    // 1200 = 20 minutos. Use 0 para não limitar.
    API_MAX_DURACAO:
      1200
  },

  // ═════════════════════════════════════════════════════════════
  // 🎀 KATRIELLY — PERSONALIDADE
  // ═════════════════════════════════════════════════════════════

  KATRIELLY: {

    // Responde quando alguém escreve "katrielly" em qualquer parte da frase.
    RESPOSTA_NOME_ATIVA: true,

    // Depois de responder uma pessoa, só responde ela de novo depois disso.
    // (quem insiste espera cada vez mais, até 5x esse tempo)
    COOLDOWN_USUARIO_SEG: 90,

    // Intervalo mínimo entre duas respostas ao nome no mesmo grupo.
    COOLDOWN_GRUPO_SEG: 6,

    // "Digitando..." antes de responder (milissegundos, sorteia entre os dois).
    ATRASO_MIN_MS: 1500,
    ATRASO_MAX_MS: 4000,

    // 🎀 Reage com o emoji em TODA mensagem recebida.
    // Se o grupo for muito movimentado, aumente o intervalo (ex.: 3000)
    // para a reação não parecer automação ao WhatsApp. 0 = reage em todas.
    REACAO_ATIVA: true,
    REACAO_EMOJI: "🎀",
    REACAO_INTERVALO_MS: 0
  },

  // ═════════════════════════════════════════════════════════════
  // 🆙 SISTEMA DE LEVEL
  // ═════════════════════════════════════════════════════════════

  LEVEL: {

    // Pontos que cada mensagem (que não seja comando) vale. Exato.
    PONTOS_POR_MENSAGEM:
      0.5,

    // Máximo de pontos que uma pessoa pode ganhar POR DIA (zera à meia-noite).
    LIMITE_DIARIO:
      4.55,

    // Pontos pra subir de level = level atual × este valor.
    // Level 1 → 2 = 1500 · Level 2 → 3 = 3000 · Level 3 → 4 = 4500 ...
    PONTOS_BASE_NIVEL:
      1500
  }

};


// ╔══════════════════════════════════════════════════════════════╗
// ║             🔧 CONFIGURAÇÕES DO PAINEL                      ║
// ╚══════════════════════════════════════════════════════════════╝

try {

  const fs =
    require("fs");

  const path =
    require("path");


  const botconfigPath =
    path.join(
      __dirname,
      "database",
      "botconfig.json"
    );


  if (fs.existsSync(botconfigPath)) {

    const arquivo =
      fs.readFileSync(
        botconfigPath,
        "utf8"
      ).trim();


    if (arquivo) {

      const salvo =
        JSON.parse(arquivo);


      for (
        const chave of Object.keys(salvo)
      ) {

        // Não permite substituir CONFIG_CODE
        if (
          chave === "CONFIG_CODE"
        ) {
          continue;
        }


        // Ignora valores vazios
        if (
          salvo[chave] === undefined ||
          salvo[chave] === null ||
          salvo[chave] === ""
        ) {
          continue;
        }


        config[chave] =
          salvo[chave];
      }
    }
  }

} catch (erro) {

  console.error(
    "⚠️ Erro ao carregar configurações salvas:",
    erro?.message || erro
  );
}


// ╔══════════════════════════════════════════════════════════════╗
// ║   🔧 CORREÇÃO: BOT_NAME "AO VIVO"                            ║
// ╚══════════════════════════════════════════════════════════════╝
//
// O bloco acima só lê o banco de dados UMA VEZ, quando o processo do
// bot liga — depois disso o valor fica congelado na memória. Então
// quando alguém usava ".configurar-bot nome X" com o bot já rodando,
// isso gravava certinho no banco, mas ninguém via a mudança em lugar
// nenhum (cards, mensagens, menus) até reiniciar o bot inteiro.
//
// Aqui, BOT_NAME vira um "getter": toda vez que algum arquivo do bot
// ler "config.BOT_NAME", ele relê o database/botconfig.json na hora —
// então ".configurar-bot nome X" passa a valer em TUDO instantaneamente,
// sem precisar reiniciar.
try {

  const fs2 = require("fs");
  const path2 = require("path");
  const botconfigPath2 = path2.join(__dirname, "database", "botconfig.json");
  const nomePadrao = config.BOT_NAME;

  Object.defineProperty(config, "BOT_NAME", {
    enumerable: true,
    configurable: true,
    get() {
      try {
        const conteudo = fs2.readFileSync(botconfigPath2, "utf8").trim();
        if (conteudo) {
          const dados = JSON.parse(conteudo);
          if (dados && dados.BOT_NAME) return dados.BOT_NAME;
        }
      } catch {}
      return nomePadrao;
    }
  });

} catch (erro) {
  console.error("⚠️ Erro ao preparar BOT_NAME dinâmico:", erro?.message || erro);
}


// ╔══════════════════════════════════════════════════════════════╗
// ║                       📦 EXPORTAÇÃO                         ║
// ╚══════════════════════════════════════════════════════════════╝

module.exports = config;