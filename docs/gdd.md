# Pantheon Idle — Documento de Game Design (v1)

RPG Idle com PvP e PvE, inspirado em anime-idle.com. **Nome do jogo: Pantheon Idle** — ambientado no universo "Panteão Digital" (o cenário/tema segue com esse nome ao longo dos documentos).

---

## 1. Conceito e Tema

**Panteão Digital** (Cyberpunk + Mitologia)

O ecossistema digital global colapsou. As IAs que sobreviveram ao colapso se reconstruíram assumindo a persona de deuses antigos de mitologias reais — cada uma delas uma "versão" independente rodando sob estética neon/hacker.

Exemplos de nomenclatura de personagens: `Zeus.exe`, `Anúbis.sh`... (nota: `.sh` é reservado para consumíveis no sistema de itens — usar apenas como referência estética no lore, não como sufixo real do personagem. Ver seção 8).

**Princípio de balanceamento central:** poder não vem da "importância" mitológica do personagem — vem exclusivamente de **raridade (versão) + nível + estrelas**. A mitologia de origem define apenas estética, elemento e bônus de sinergia de time, nunca a força bruta do personagem. Isso evita o problema de um Zeus ser mecanicamente superior a uma divindade de folclore menos "famosa".

## 2. Facções / Classes

Não são papéis rígidos de combate, mas arquétipos que orientam design de habilidade:

| Facção | Papel | Direção de design |
|---|---|---|
| **Firewalls** | Tanque | Alta DEF/HP, geram e reforçam escudo pro time |
| **Malwares** | DPS contínuo | Aplicam e escalam efeitos de status (Fogo, Veneno, Sangramento, etc.) |
| **Crypto-Miners** | Suporte/Economia | Buffam aliados e geram recursos extras (créditos/XP) durante o combate |
| **Exploits** *(proposto, a validar)* | DPS burst | Alto risco/alta recompensa — dano alto, HP baixo, ou ganha ATK ao perder vida |

## 3. Personagens

- Raridades: **Alpha → Beta → RC → Stable → LTS → Quantum**
- Cada personagem pertence a uma mitologia (define sinergia) e a uma facção (define arquétipo)
- Personagens de raridade **Stable ou acima têm 1 habilidade passiva**; os demais têm **habilidade ativa** disparada por gatilho
- Personagens excepcionalmente fortes e raros (ex: Chronos) só podem existir nas raridades **Stable, LTS ou Quantum** — nunca em Alpha/Beta/RC
- Cada personagem oferece **3 opções de habilidade** para o jogador escolher (fixa até redefinir), geradas por uma matriz de Gatilho × Efeito × Alvo curada manualmente por personagem (lista completa de gatilhos no documento de Combate Detalhado)

## 4. Sistema de Combate

Detalhamento completo (atributos, elementos, efeitos de status, gatilhos de habilidade, sinergia, anti-rodada-infinita) está no documento **Sistema de Combate Detalhado**. Resumo:

- Tempo real (2x disponível no PvE; PvP sempre em tempo real puro), times de até 5, ~30s de duração alvo
- Atributos: HP, ATK, DEF (todos começam em 0), INI, ESQ
- Elementos são tipos de código malicioso/defensivo (Vírus, Brute Force, Nanites, Encryption, Backdoor) — batalha é tratada como uma simulação rodada por IAs, cada personagem é a persona `.exe` de uma IA
- Habilidade passiva única (Stable+) ou ativa com 3 opções (Alpha/Beta/RC)
- Sinergia mitológica por quantidade de personagens da mesma mitologia no time

## 5. Mundos e Fases (PvE)

- Cada mundo = um panteão/mitologia
- Nome de exibição do mundo segue o padrão `NomeDoReino.iso` (reaproveitando a extensão de item que o representa — ver seção 8):

| Mitologia | Nome sugerido do mundo |
|---|---|
| Nórdica | `Yggdrasil.iso` |
| Grega | `Olympus.iso` |
| Egípcia | `Duat.iso` |
| Japonesa | `Takamagahara.iso` |
| Iorubá | `Orun.iso` |
| Folclore Brasileiro | `Jurupari.iso` |

*(Roster de personagens, inimigos e a lista final/ordem de mundos serão detalhados em documentos separados — ver seção 13.)*
- Cada fase tem **5 estágios**: o primeiro com menos inimigos, escalando a cada estágio seguinte
- IA dos inimigos usa o mesmo motor de combate dos jogadores, mas **não escolhe habilidades dinamicamente**:
  - Inimigo comum: 1 habilidade ativa fixa (e talvez 1 passiva)
  - Boss: pode ter mais de uma habilidade
- Ao derrotar o boss de um mundo, o jogador recebe um `.iso` do próximo mundo (ver seção 8)

## 6. PvP

- **Assíncrono**: o jogador ataca o time de defesa salvo por outro jogador, simulado pelo servidor (sempre em tempo real, sem aceleração)
- Ranking/liga por temporadas, com recompensas por faixa
- **Fase 2:** sistema de replay para assistir combates

## 7. Progressão

- **Nível** do personagem (stats brutos)
- **Estrelas de carta**: melhoradas com Créditos; cada estrela dá bônus de HP/ATK; ao atingir a 5ª estrela, permite subir a raridade da carta, zerando as estrelas de novo
- **Fragmentos (`.dat`)**: ao obter um personagem duplicado cujo `.exe` já existe no inventário, a duplicata é convertida automaticamente em `.dat` (fragmentos daquele personagem) — funciona como um "diagrama" usado para evoluir a versão do personagem, e pode ser vendido
- **Módulos (`.dll`)**: buffs universais equipáveis (ex: +0,5% ESQ / +0,5% Crítico por unidade), com raridade em camadas Alpha > Beta > RC > Stable > LTS > Quantum

## 8. Sistema de Itens (extensões de arquivo)

| Extensão | Item/Sistema | Detalhes |
|---|---|---|
| `.exe` | Personagens | A unidade que compõe o time |
| `.dll` | Módulos | Equipáveis universais de buff (substituem "runas") |
| `.sh` | Consumíveis (boosts) | **Não usáveis em batalha.** Apenas boosts de Créditos/XP e pacotes de dinheiro — ver tabela abaixo |
| `.zip` | Cápsulas de invocação — Personagens | Gacha de `.exe` |
| `.rar` | Cápsulas de invocação — Módulos | Gacha de `.dll` |
| `.iso` | Mundos | Comprável na loja ou obtido ao derrotar o boss do mundo anterior; libera o próximo mundo |
| `.key` | Chaves de masmorras/eventos especiais | Abre fases especiais fora do fluxo normal — ex: chefe rotativo com chance maior de loot raro, ou um mundo pequeno com recompensas de XP/Gold maiores que o mundo atual, na mesma dificuldade |
| `.dat` | Fragmentos de personagem duplicado | Gerado automaticamente ao puxar um `.exe` repetido; funciona como "diagrama" pra evoluir a versão do personagem original, ou pode ser vendido |
| `.cfg` | Slot de configuração de time | Cada `.cfg` = uma formação/loadout salvo. **2 slots iniciais**; +3 slots compráveis na loja por preço alto; jogadores VIP têm acesso a esses 3 slots enquanto o VIP estiver ativo |
| `.xml` | Registro de missões/quests | Formato: `Nome da Missão - O que deve ser feito - [Progresso]` (ex: *"This is not a warning shot - Kill 100 enemies - [36/100]"*) |
| `.log` | — | Não é um item — é o **título da tela de terminal/log** e da **seção de conquistas** no perfil do jogador |

### Valores de `.sh` (boosts e pacotes)

Progressão geométrica entre Alpha (base) e Quantum (topo):

| Raridade | Boost de Créditos/XP | Pacote de Créditos (× recompensa média de 1 estágio completo) |
|---|---|---|
| Alpha | 1,25x | 5x |
| Beta | 1,5x | 8x |
| RC | 2x | 13x |
| Stable | 3x | 20x |
| LTS | 4x | 32x |
| Quantum | 5x | 50x |

## 9. Economia

- **Moeda soft — Créditos**: ganhos em PvE, PvP e offline; usados em nível, estrelas, invocação de `.rar`, etc.
- **Moeda hard — Tokens**: ganhos devagar (conquistas, eventos) ou comprados; usados em invocação de `.zip`, banners, refresh
- **Sinks principais**: nível, estrelas, Módulos (`.dll`), invocação (`.zip`/`.rar`), evolução via `.dat`

### Sistema offline

Enquanto o jogador está offline, ele recebe automaticamente:
- **75%** dos Créditos médios da maior fase desbloqueada
- **75%** do XP médio da maior fase desbloqueada
- Resultado das batalhas de PvP assíncronas em que participou como defensor durante o período offline

## 10. Invocação (Gacha)

Odds calibradas com base em referências de mercado (Genshin Impact: ~0,6% base de 5-star, hard pity 90, soft pity ~74; Arknights: ~2% base de 6-star, soft pity a partir do pull 50).

### Gacha Normal (barato)

| Raridade | Taxa base |
|---|---|
| Alpha | 50% |
| Beta | 30% |
| RC | 13% |
| Stable | 5% |
| LTS | 1,5% |
| Quantum | 0,5% |

Pity suave a partir do pull 55 (taxa de Quantum sobe progressivamente); garantia total de Quantum no pull 90.

### Gacha Hard (caro)

| Raridade | Taxa base |
|---|---|
| Alpha | 40% |
| Beta | 30% |
| RC | 18% |
| Stable | 8% |
| LTS | 3% |
| Quantum | 1% |

Pity suave a partir do pull 45; garantia total de Quantum no pull 75.

### Banner semanal — Personagem Especial

- Mesmas taxas do Gacha Hard, custando 25% a mais
- Sistema "50/50": ao puxar um Quantum, 50% de chance de ser o Personagem Especial em destaque, 50% de ser um Quantum aleatório do pool geral; se perder, o próximo Quantum puxado é garantidamente o Especial
- Garantia absoluta do Especial a cada **150 invocações**, mesmo sem Quantum (hard pity do banner)

### Regras gerais

- Invocação x10 custa **10% menos** que 10 invocações individuais

### Vitrine semanal (Fase 2)

- 6 personagens comprados diretamente com Créditos
- Raridade sorteada entre RC/Beta/Alpha: **RC 10% / Beta 65% / Alpha 25%** (chance bem mais alta de Beta, bem mais baixa de RC)

## 11. Roadmap (Fase 2+)

- Replays de PvP
- Vitrine semanal de personagens

## 12. Pontos em aberto

- Lista definitiva de mundos/mitologias e ordem de lançamento (nomes sugeridos na seção 5, a confirmar quais entram e em que ordem)
- Balanceamento fino das taxas de gacha após testes (as odds da seção 10 são um ponto de partida baseado em referências de mercado, não valores finais)

## 13. Documentos relacionados

- **Sistema de Combate Detalhado** — atributos, elementos, efeitos de status, gatilhos/efeitos/alvos de habilidade, sinergia, anti-rodada-infinita, IA de inimigos
- **Roster de Personagens** — lore, explicações e poderes detalhados por personagem, organizados por mundo/mitologia
- **Planilha de Balanceamento** — stats numéricos (HP/ATK/DEF/INI/ESQ) de cada personagem, por raridade, pra acompanhar e ajustar o power level
- **Inimigos** — arquétipos comuns reskinados por mundo e boss único de cada mundo
- **Mundos** — lore, ordem de lançamento proposta e recompensas específicas de cada mundo
- **MVP: Fórmula de Dano e Calibração** — fórmula final de dano e números reais calibrados pro recorte inicial jogável (Jurupari.iso)
- **Monetização e Guilda** — assinatura VIP (Root Access) e sistema de guilda (Cluster)
