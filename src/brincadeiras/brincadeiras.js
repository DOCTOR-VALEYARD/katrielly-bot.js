const config = require('../../config');
const { montarMenu, mini } = require('../menu-estilo/menu-estilo');

async function brincadeiras(sock, msg) {
  const from = msg.key.remoteJid;
  const resp = montarMenu({
    titulo: 'BRINCADEIRAS',
    emoji: '🎭',
    acesso: 'todos',
    introducao: [`🎀 ${mini('diversão, resenha e sistema social')}`],
    secoes: [
      { emoji: '🎲', titulo: 'INTERAÇÕES', itens: [
        ['tapa', '@pessoa'], ['matar', '@pessoa'], ['beijar', '@pessoa'], ['abracar', '@pessoa'],
        ['amizade', '@pessoa'], ['compatibilidade', '@pessoa'], ['dupla', '@pessoa']
      ] },
      { emoji: '💞', titulo: 'RELACIONAMENTOS', itens: [
        ['familia', '[@pessoas] [data]'], 'familias', ['casamento', '@pessoa [data]'],
        'meucasal', ['divorcio', '@pessoa'], 'topcasais'
      ] },
      { emoji: '📊', titulo: 'ENQUETES', itens: [
        'enquete', ['enquete', '<pergunta>']
      ] },
      { emoji: '🎯', titulo: 'MISSÕES E CONQUISTAS', itens: [
        'missao', 'missoes', 'conquistas', 'xp', 'nivel', 'topxp'
      ] },
      { emoji: '💰', titulo: 'GOLD', itens: [
        'checkin', 'trabalhar', ['roubar', '@pessoa'], 'bonus', ['transferir', '@pessoa <gold>'],
        ['presente', '@pessoa <presente>'], 'inventario', 'topgold'
      ] }
    ]
  });
  await sock.sendMessage(from, { text: resp }, { quoted: msg });
}
module.exports = { brincadeiras };
