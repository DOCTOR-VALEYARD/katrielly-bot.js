# 🎀 Katrielly Bot — v9 (organizado)


## 🎀 Versão KATRIELLY — o que mudou

- Bot renomeado para **🎀 🅺🅰🆃🆁🅸🅴🅻🅻🆈 - 🅱🅾🆃 🎀** (criadora: **·.¸¸.·KATRIELLY ·.¸¸.·**) e agora é **feminino** (textos e personalidade da IA).
- **Resposta ao nome**: quem escrever "katrielly" em qualquer parte da frase recebe uma resposta aleatória (76 mensagens, `src/katrielly/katrielly.js`). Nunca repete em sequência, espera um tempinho antes de responder e, depois de responder uma pessoa, só responde ela de novo depois do intervalo (`config.js → KATRIELLY`).
- **Reação 🎀** em toda mensagem (liga/desliga em `config.js → KATRIELLY.REACAO_ATIVA`).
- **Proteções novas** (cada uma liga/desliga, só admin; o bot precisa ser ADM): `antitrava`, `antiloc`, `antidoc`, `antiimg`, `antivideo` (também `anti trava`, `anti vídeo`...). Código em `src/protecoes/protecoes.js`.
- **Menus**: texto do menu agora é montado sozinho a partir das categorias; comandos que existiam mas não apareciam (efeitos de voz, efeitos, logos, gold, daily, spam, limpar, chute, antispam, antiflood, somenteadm, statusadm, admins...) foram adicionados. Nova categoria **🔒 PROTEÇÕES** e **🎙️ EFEITOS**.
- **Aluguel**: todos os planos valem para **1 grupo**: 5 dias, quinzena, 1 mês, 3 meses, 8 meses e 1 ano (valores em `config.js → PLANOS_ALUGUEL`).
- **Música**: o áudio do `/play` baixa **somente por API/biblioteca**: Savetube → Vreden → **YouTube.js** (`src/ytlib/ytlib.js`, nova biblioteca de reserva). O yt-dlp continua só para vídeo/TikTok/Instagram (baixa sozinho para a pasta do bot).

## 🎀 Menus em texto (estilo único)

Todos os menus em texto (principal, ADM, brincadeiras, mídias, gold, premium) usam o mesmo visual,
definido em **`src/menu-estilo/menu-estilo.js`**: molduras `╒▣▣▣` / `╔╦╦╗`, comandos e títulos em letrinhas
pequenas e o rodapé do sistema. Para criar um menu novo basta chamar `montarMenu({ titulo, secoes })`.
Botões e listas do menu interativo também usam as letrinhas pequenas.

## 📱 Termux / hospedagem (yt-dlp)

O áudio do `/play` baixa só por API (Savetube → Vreden → YouTube.js) e **não precisa de yt-dlp**.
O yt-dlp só é usado para vídeo/TikTok/Instagram. Ele é procurado nesta ordem: `config.MUSICA.BINARIO`,
yt-dlp já instalado (PATH), `python -m yt_dlp`, binário local. Se não existir e o sistema for Linux
(hospedagem), baixa sozinho. No **Termux** (Android) ele **não baixa nada e não dá erro**; se quiser vídeos lá,
rode `pkg install yt-dlp`.

## ✨ Versão KATRIELLY — o que mudou

- Bot renomeado para **KATRIELLY** (criador: ·.¸¸.·KATRIELLY ·.¸¸.·). Arquivo principal: `katriellybot.js` (`node katrielly.js` também funciona).
- Agora é um bot **masculino** (textos e personalidade da IA).
- **Cards removidos**: tudo funciona em modo simples (texto, ou foto com legenda).
- **Música aleatória removida** (a música normal continua). **Reações removidas** por completo.
- **Boas-vindas/despedida** com liga/desliga: `bemvindo on` / `bemvindo off` (só ADM, o bot ou o dono).
- **Level mais difícil**: 0,50 ponto por mensagem, máximo de 4,55 por dia; level 1→2 pede 1500 pontos, 2→3 pede 3000, 3→4 pede 4500... (editável em `config.js` → `LEVEL`).
- **Perfil novo** (`perfil`): foto, nome, número, cargo (dono/VIP/membro comum), grupo, level e barras de gado, fiel, infiel, feio e bonito com frases aleatórias.
- **Comando errado**: o bot marca a pessoa, mostra os comandos parecidos com a porcentagem de semelhança (útil quando o prefixo é outro) e avisa quando o comando não existe.

## Instalar (Termux)
```
bash instalar.sh          # instala tudo sozinho (Node, ffmpeg, yt-dlp, módulos...)
bash iniciar.sh           # liga o bot (reinicia sozinho se cair)
```
`bash instalar.sh --iniciar` instala e já liga. `--limpo` reinstala os módulos do zero.

## Atualizando de uma versão antiga
Copie esta pasta por cima (ou use a nova e traga só `database/`). Na primeira
inicialização o bot **move sozinho** áudios, gifs, figurinhas, imagens e jsons do
layout antigo para `src/midias` e `src/dados` — nada é apagado (sobras vão para `src/_antigos`).

## O que mudou
- `src/` agora tem **uma pasta por módulo** (`src/grupo/grupo.js`). Mapa em `src/LEIAME.md`.
- Botões **Entrar no canal / Falar com o criador** abrem direto, 1 toque.
- `citar` / `cita`: respondendo uma mensagem, reenvia ela marcando todos; `citar texto` reenvia o texto.
- Saudações (bom dia/boa tarde/boa noite) e **anti-amor** por áudio aleatório (`saudacao on`, `antiamor on`).
  Subir/apagar áudios: configurar-bot → SUBIR / APAGAR ÁUDIO, ou direto em `src/midias/audios/<categoria>/`.
- VIP virou **aluguel do bot** (`alugarbot`, `meualuguel`); `alugar` só para admin. Nenhum comando depende de aluguel.
- `criadora` → `criador`; donos extras: `configurar-bot adddono NUMERO`.
- **Anti-bot**: ignora outros bots do grupo (evita loop de prefixo). Desligar: `IGNORAR_OUTROS_BOTS: false` no `config.js`.
- O próprio número do bot e o dono passam por todas as travas.
- **33 efeitos de voz**: responda um áudio com `masculino`, `feminino`, `crianca`, `bebe`, `idoso`, `gigante`, `esquilo`, `grave`, `demonio`, `caverna`, `banheiro`, `igreja`, `estadio`, `tunel`, `agua`, `megafone`, `walkie`, `telefone`, `eco`, `radio`, `alien`, `fantasma`, `bebado`, `8bit`, `distorcao`, `reverso`, `coral`, `dueto`, `robo`, `vaporwave`, `nightcore`, `rapido`, `lento` (lista: `voz`).
- **30 efeitos de imagem**: responda uma foto com `efeitos NUMERO` (lista: `efeitos`).
- **Anti-amor reforçado**: pega abreviações e gírias (amr, mor, tkm, sdds, bjs, mô, 4mor, a m o r...) no meio de qualquer frase.
- **Anti-repetição**: se o bot já respondeu e a mesma pessoa manda o mesmo texto de novo em 60 s, ignora (`ANTI_REPETICAO_SEGUNDOS`).
- **Dica de prefixo**: `!menu` quando o certo é `/menu` → o bot marca a pessoa e mostra o comando certo; `/menuu` → "Você quis dizer /menu?".
- **Música**: sem download antes do clique; API e yt-dlp em corrida depois do clique.
