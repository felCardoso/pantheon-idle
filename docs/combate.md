# Pantheon Idle — Sistema de Combate Detalhado (v2)

Contexto narrativo: cada batalha é uma **simulação de combate rodada pelas IAs**, e cada personagem é a persona `.exe` de uma IA lutando pelo seu time dentro dessa simulação. Um `.exe` derrotado é ejetado da simulação, não apagado.

---

## 1. Formato Geral e Fluxo de Combate

- **Tempo real:** Com velocidade 2x disponível para o jogador acelerar no PvE.
- **PvP sempre em tempo real:** Sem opção de acelerar (evita vantagem injusta de quem acelera contra quem não pode reagir).
- **Times de até 5 personagens (`.exe`)** por lado.
- **Sistema de Fila (Line-up):** A ordem do time é definida previamente pelo jogador na aba de configuração. O combate ocorre na linha de frente: o primeiro da fila ataca o primeiro da fila adversária. Após a resolução do ataque, ambos vão para o final de suas respectivas filas, e os segundos colocados assumem a frente. O posicionamento na fila também é estratégico para o alcance de buffs localizados.
- **Duração alvo:** ~30s em fases fáceis, aumentando em fases mais difíceis conforme a Integridade (HP) e Firewall (DEF) dos inimigos escalam.

## 2. Atributos do Personagem (`.exe`)

Os atributos são divididos entre Visíveis (Interface Padrão) e Ocultos (Mecânicas de Background).

### Atributos Visíveis

Aparecem na interface base do jogador e ditam a estabilidade e o poder bruto do personagem.

| Atributo                | Função              | Observações                                                        |
| :---------------------- | :------------------ | :----------------------------------------------------------------- |
| **HP (Integridade)**    | Vida / Estabilidade | Reduzida a 0 = `.exe` ejetado da simulação (derrotado).            |
| **ATK (Processamento)** | Dano base           | Multiplicado por modificadores de habilidade, elemento e sinergia. |

### Atributos Ocultos

_Regra Geral: Todos começam com valor base `0`. Eles não aparecem na UI base e só são alterados através de habilidades (ativas/passivas) ou pela instalação de Módulos (`runas.dll`). São calculados em formato decimal (ex: 20% = 0.20)._

| Atributo | Nome Temático | Comportamento Mecânico                                                                                                                                                                                             |
| :------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DEF**  | **Firewall**  | Redução/Mitigação de dano em percentual. Ignora apenas dano físico/padrão.                                                                                                                                         |
| **INI**  | **Ping**      | Define a prioridade da ação no choque da linha de frente. Quem tem o maior Ping ataca primeiro (se o alvo for ejetado, seu ataque é cancelado). **Empate de Ping:** Ambos atacam e recebem o dano simultaneamente. |
| **ESQ**  | **Evasion**   | Chance percentual de desviar completamente de um ataque recebido (fazer o pacote de dados errar o alvo).                                                                                                           |
| **ESP**  | **ICE**       | Retaliação (Espinhos). Devolve automaticamente ao atacante uma porcentagem do dano físico/padrão recebido.                                                                                                         |

### Mecânica Transversal: Escudo (Shielding)

Escudo é um valor temporário que absorve dano antes de afetar a Integridade (HP).

- Não é um atributo permanente; só existe quando ativado via habilidade ou Módulo (`.dll`).
- Absorve dano até se esgotar; qualquer dano excedente "vaza" para a Integridade do `.exe`.
- Serve como base para gatilhos de sistema (ex: "ao receber escudo", "quando o escudo quebra").

## 3. Efeitos de Status (Malwares e Protocolos)

Não existe um sistema de elementos (vantagens intrínsecas de tipo). Todo o controle de combate e interações táticas ocorrem através da aplicação de status, que afetam diretamente a integridade, os atributos e a fila de ação dos `.exe`.

| Status                             | Efeito Prático                                                                                        | Atributo/Mecânica Afetada |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------- | :------------------------ |
| **Leak** _(Vazamento)_             | Dano fixo por rodada, ignora Firewall (DEF) e pode ser empilhado (stacks).                            | Integridade (HP)          |
| **Trojan**                         | Dano por rodada que ignora completamente qualquer Escudo ativo.                                       | Integridade (HP)          |
| **Crash**                          | O alvo sofre uma falha crítica e perde a próxima ação na fila.                                        | Ação / Turno              |
| **Fragmentação**                   | Multiplica o dano causado a Escudos (ex: Dano 1.X, onde X é definido pela habilidade de quem aplica). | Escudo                    |
| **Nanites**                        | Antivírus reparador. Aplica cura/reparo contínuo por rodada.                                          | Integridade (HP)          |
| **Throttling** _(Enfraquecimento)_ | Reduz o Processamento (ATK) em X% por N rodadas.                                                      | Processamento (ATK)       |
| **Lag** _(Lentidão)_               | Atrasa o Ping (INI), diminuindo a prioridade de ataque no choque frontal.                             | Ping (INI)                |
| **Target** _(Marcado)_             | O próximo ataque recebido tem acerto crítico garantido.                                               | —                         |

## 4. Clusters de Panteão (Sinergia Mitológica)

Como cada `.exe` é baseado na persona de um deus mitológico, alocar IAs da mesma origem no mesmo time gera uma ressonância de rede (Cluster), concedendo bônus passivos de **Integridade (HP)** e **Processamento (ATK)**.

**Regra de Isolamento:** O bônus se aplica **exclusivamente** aos personagens daquela mitologia específica, não ao time inteiro. Múltiplos clusters podem coexistir na mesma equipe.
_Exemplo prático:_ Se a equipe possuir 2x arquivos do Folclore Brasileiro e 3x arquivos da Mitologia Grega, os personagens BR recebem +5% de status, enquanto os Gregos recebem +12%.

| Nº de `.exe` da mesma Mitologia | Bônus Recebido (Apenas para o Cluster) |
| :------------------------------ | :------------------------------------- |
| 2 Arquivos                      | +5% HP e ATK                           |
| 3 Arquivos                      | +12% HP e ATK                          |
| 4 Arquivos                      | +21% HP e ATK                          |
| 5 Arquivos                      | +32% HP e ATK                          |

## 5. Arquitetura de Habilidades

O kit de combate de cada personagem não é randômico para o jogador, sendo curado e balanceado pelo design do jogo. O sistema é baseado em duas categorias estruturais, definidas pela Raridade (Nível de Compilação): **Alpha $\rightarrow$ Beta $\rightarrow$ Stable $\rightarrow$ LTS $\rightarrow$ Zero-Day**.

- **Habilidades Ativas (Selecionáveis):** Todo personagem possui **3 opções** de habilidades ativas. O jogador só pode equipar **uma por vez** antes do combate, na aba "Time".
- **Habilidades Passivas (Bloqueadas por Tier):** Apenas personagens a partir da raridade **LTS** (LTS e Zero-Day) possuem uma habilidade passiva única, ativada permanentemente na simulação.

### 6. A Matriz de Habilidades

Todas as habilidades são construídas cruzando variáveis de três pilares: **Gatilho × Efeito × Alvo**.

**1. Gatilhos Disponíveis (Eventos de Sistema)**

- **Boot Sequence** _(Opening)_: Dispara quando a simulação (batalha) inicia.
- **Loop Start** _(Start of round)_: Dispara no início de cada rodada.
- **Loop End** _(End of round)_: Dispara no final de cada rodada.
- **Background Service** _(Constant)_: Passiva constantemente ativa.
- **Pre-Execution** _(Before Attacking)_: Dispara imediatamente antes do próprio ataque.
- **Execution** _(On Attack)_: Substitui o ataque básico durante o choque na linha de frente.
- **Post-Execution** _(After Attacking)_: Dispara após atacar e sobreviver.
- **Counter** _(Riposte)_: Dispara na linha de frente ao receber um acerto direto.
- **Data Loss** _(Wounded)_: Dispara ao perder Integridade (HP).
- **Critical Sector** _(Threshold)_: Dispara a primeira vez que a Integridade (HP) cair abaixo de 50%.
- **System Failure** _(Last Breath)_: Dispara ao ser ejetado (morrer).
- **Process Terminated** _(On Kill)_: Dispara ao ejetar (matar) um inimigo.
- **Firewall Active** _(Shielded)_: Dispara ao receber um Escudo.
- **Firewall Breach** _(Shield Broken)_: Dispara quando o próprio Escudo é quebrado.
- **Nanites Received** _(Healed)_: Dispara ao ser curado.
- **Co-op Processing** _(Attack Support)_: Dispara instantes antes de um aliado atacar.
- **Proxy Defense** _(Bodyguard)_: Dispara quando o aliado imediatamente à frente perde HP.
- **Network Breach** _(Ally Wounded)_: Dispara quando um aliado perde HP.
- **Node Offline** _(Ally Fallen)_: Dispara quando um aliado é ejetado.
- **Network Firewall** _(Ally Shielded)_: Dispara quando um aliado recebe Escudo.
- **Network Breach** _(Ally Shield Broken)_: Dispara quando o Escudo de um aliado quebra.
- **Instance Spawned** _(Reinforcements)_: Dispara quando um aliado é invocado na simulação.
- **Trojan Echo** _(Trojan Echo)_: Dispara quando um aliado aplica o status _Trojan_.
- **Leak Echo** _(Leak Echo)_: Dispara quando um aliado aplica o status _Leak_.
- **Crash Echo:** Dispara quando um aliado aplica _Crash_ (Atordoamento).
- **Ghosting:** Dispara quando o personagem esquiva com sucesso de um ataque (sinergia direta com o atributo ESQ).
- **Ping Advantage:** Dispara durante o choque frontal, _apenas_ se o personagem possuir um INI (Ping) maior que o adversário.

**2. Efeitos Disponíveis (Ações Executáveis)**

- Dano direto físico/padrão.
- Aplicação de Status de Malwares (Leak, Trojan, Crash, Fragmentação, Lag, Target).
- Cura (Nanites).
- Geração de Escudo.
- Buff de Atributo (Aumenta Processamento, Firewall, Ping, Evasion ou ICE).
- Debuff de Atributo (Throttling ou quebra direta de status inimigo).

**3. Alvos Possíveis (Direcionamento de Pacotes)**

- `Self` (O próprio invocador).
- 1 Aliado (Filtros: Menor HP / Maior ATK / Aliado da Frente / Aleatório).
- Todos os Aliados.
- 1 Inimigo (Filtros: Menor Evasion / Maior Ping / Aleatório).
- Todos os Inimigos.

## 7. Prevenção de Loop (Anti-Rodada Infinita)

Para evitar cenários de empate técnico ou loops infinitos de cura entre dois `.exe` de suporte, a simulação possui protocolos rígidos de encerramento baseados em ciclos (rodadas).

- **Limite Absoluto de Ciclos:** A simulação é forçada a encerrar na rodada 50.
- **System Overload (Enrage):** A partir da rodada de corte 30, a simulação solta um aviso (simulação de broadcast) e começa a superaquecer. Todos os personagens vivos recebem Dano Absoluto (ignora Firewall) ao final de cada rodada.
- **Escalonamento da Sobrecarga:** O Dano Absoluto cresce progressivamente. Exemplo: 5% do HP máximo na rodada 31, 10% na rodada 32, 15% na rodada 33, forçando aos poucos o fim do combate.
- **Condição de Desempate:** Se o limite absoluto de ciclos for atingido e a simulação for abortada, o empate no PvP retorna a recompensa normal em Créditos e XP para ambos os jogadores e no PvE o empate retorna a recompensa normal em Créditos e XP, mas sem a progressão para o próximo nível.

## 8. Scripts Inimigos (IA de Combate)

Os adversários controlados pelo jogo (Malwares, Antivírus Corporativos, etc.) não utilizam uma inteligência artificial dinâmica de tomada de decisão. Eles operam como _scripts_ fixos.

- **Motor Unificado:** Os inimigos utilizam exatamente o mesmo motor de combate, regras matemáticas, atributos e efeitos de status aplicados aos `.exe` do jogador.
- **Ações Hardcoded:** A IA não escolhe habilidades ativamente. O kit de combate é pré-definido pelo design da fase.
- **Inimigo Padrão:** Possui apenas 1 habilidade ativa fixa (e, dependendo da dificuldade, 1 habilidade passiva constante).
- **Processos Mestres (Bosses):** Podem possuir múltiplas habilidades ativas e passivas rodando em sequência fixa ou ativadas por gatilhos de Integridade (ex: Threshold de 50% de HP).
