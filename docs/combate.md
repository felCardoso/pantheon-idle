# Pantheon Idle — Sistema de Combate e Inimigos (v3.1)

Contexto narrativo: cada batalha é uma **simulação de combate rodada pelas IAs**, e cada personagem é a persona `.exe` de uma IA lutando pelo seu time dentro dessa simulação. Um `.exe` derrotado é ejetado da simulação, não apagado.

---

## 1. Formato Geral e Fluxo de Combate (Relay & Bench)

O combate ocorre em um formato de equipe 5x5, mas o confronto direto no processamento de dados é sempre **1 contra 1 em tempo real**.

- **Tempo Real Contínuo:** O combate flui sem turnos. Os personagens atacam com base em sua Velocidade de Ataque (`VEL`).
- **Vanguarda (Carta Ativa):** O primeiro personagem da fila definida pelo jogador. É o único `.exe` que ataca, recebe dano e utiliza sua _Habilidade Ativa_.
- **Banco (Cartas Inativas):** Os outros 4 personagens da equipe. Eles não recebem dano e não atacam diretamente, mas aplicam suas _Habilidades de Banco_ para conceder buffs contínuos à Carta Ativa.
- **Rotação de Fila:** Quando a Integridade (HP) da Carta Ativa chega a 0, o processo é ejetado. O próximo personagem na fila assume imediatamente a posição de Vanguarda. O combate termina quando os 5 processos de um dos lados são ejetados.
- **Duração Alvo:** ~30 segundos em fases fáceis, escalando conforme a dificuldade e o Firewall inimigo aumentam.

---

## 2. Atributos do Personagem (`.exe`)

Os atributos ditam a estabilidade do processo. Eles são divididos entre Visíveis (Interface) e Ocultos (Mecânicas de Fundo).

### Atributos Visíveis

| Atributo                | Função              | Observações                                                         |
| :---------------------- | :------------------ | :------------------------------------------------------------------ |
| **HP (Integridade)**    | Vida / Estabilidade | Reduzida a 0 = `.exe` ejetado da simulação.                         |
| **ATK (Processamento)** | Dano base           | Multiplicado por modificadores de habilidade e sinergia de cluster. |

### Atributos Ocultos

_Iniciam em `0` e só são alterados por Habilidades, Banco ou Módulos (`.dll`)._

| Atributo | Nome Temático | Comportamento Mecânico                                                                                                  |
| :------- | :------------ | :---------------------------------------------------------------------------------------------------------------------- |
| **DEF**  | **Firewall**  | Redução/Mitigação de dano em percentual. Ignora apenas dano físico/padrão.                                              |
| **VEL**  | **Ping**      | Velocidade de Ataque. Define a frequência (Cooldown/Tick) com que o processo executa seus ataques básicos na Vanguarda. |
| **ESQ**  | **Evasion**   | Chance percentual de desviar completamente de um pacote de dados (ataque inimigo).                                      |
| **ESP**  | **ICE**       | Retaliação (Espinhos). Devolve automaticamente ao atacante uma porcentagem do dano recebido.                            |

### Mecânica Transversal: Escudo (Shielding)

Absorve dano antes da Integridade (HP). Não é permanente. Qualquer dano excedente quebra o escudo e "vaza" para a Integridade.

---

## 3. O Novo Sistema de Habilidades (Loadout)

O kit de habilidades exige escolhas táticas na tela de montagem do time. A Raridade dita o quão complexo o `.exe` pode ser (**Alpha $\rightarrow$ Beta $\rightarrow$ Stable $\rightarrow$ LTS $\rightarrow$ Zero-Day**).

- **Habilidade Ativa (Ataque/Defesa em Campo):** Todo personagem possui **2 opções** de habilidades ativas. O jogador escolhe **1** para ser equipada. Ela só dispara quando a carta está na Vanguarda (Ativa).
- **Habilidade de Banco (Suporte/Buff):** Todo personagem possui **2 opções** de habilidades de banco. O jogador escolhe **1** para ser equipada. Ela buffa exclusivamente a Vanguarda aliada enquanto o personagem aguarda Inativo.
- **Habilidade Passiva (Desbloqueio por Tier):** Habilidade única e fixa. Desbloqueada automaticamente apenas para personagens **Zero-Day**. Pode alterar regras do personagem permanentemente na simulação. Também pode ser desbloqueada através das melhorias de personagem, quando ele sobe para a v2.0.

---

## 4. Efeitos de Status (Malwares e Protocolos)

Não há "elementos" com pedra-papel-tesoura. O controle tático é feito via injeção de status.

| Status                             | Efeito Prático                                                                                      |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------- |
| **Leak** _(Vazamento)_             | Dano fixo por segundo, ignora Firewall (DEF) e pode empilhar (stacks).                              |
| **Trojan**                         | Dano por segundo que ignora completamente qualquer Escudo ativo.                                    |
| **Crash**                          | O alvo sofre falha crítica, interrompendo sua ação atual e impedindo ataques por X segundos (Stun). |
| **Fragmentação**                   | Multiplica o dano causado contra Escudos (ex: Dano 1.5x em escudos).                                |
| **Nanites**                        | Antivírus reparador. Aplica cura/reparo contínuo por segundo.                                       |
| **Throttling** _(Enfraquecimento)_ | Reduz o Processamento (ATK) em X% por N segundos.                                                   |
| **Lag** _(Lentidão)_               | Reduz o Ping (VEL), diminuindo consideravelmente a Velocidade de Ataque do alvo.                    |
| **Target** _(Marcado)_             | O próximo ataque recebido tem acerto crítico garantido.                                             |

---

## 5. Clusters de Panteão (Sinergia Mitológica)

Alocar IAs da mesma mitologia no mesmo time gera uma ressonância de rede. O bônus se aplica **exclusivamente** aos personagens daquela mitologia, não ao time inteiro (permitindo múltiplos clusters menores).

| Nº de `.exe` da Mitologia | Bônus Recebido (Apenas para o Cluster) |
| :------------------------ | :------------------------------------- |
| **2 Arquivos**            | +5% HP e ATK                           |
| **3 Arquivos**            | +12% HP e ATK                          |
| **4 Arquivos**            | +21% HP e ATK                          |
| **5 Arquivos**            | +32% HP e ATK                          |

---

## 6. Prevenção de Loop (Anti-Batalha Infinita)

Para evitar batalhas infinitas (ex: dois suportes curando eternamente na Vanguarda), a simulação possui limites de tempo de execução:

- **System Overload (Enrage - Aos 30 segundos):** A simulação superaquece. Vivos começam a receber Dano Absoluto periódico (ignora Firewall) a cada 5 segundos (ex: 5% aos 31s, 10% aos 36s...).
- **Limite Absoluto (Aos 50 segundos):** A simulação é encerrada à força pelo sistema por risco térmico.
- **Desempate:** Em caso de encerramento forçado, no PvP ou PvE o jogador recebe recompensas padrão de empate (XP/Gold), mas sem progressão para a próxima fase no caso do PvE.

---

## 7. Inimigos e IA de Combate

Os adversários (Malwares, Antivírus Corporativos) utilizam o mesmo motor de combate e atributos dos jogadores, mas operam como **scripts fixos**. A IA não tem escolhas dinâmicas de habilidades.

### A. Inimigos Comuns (Arquétipos Base)

Reutilizados em todos os mundos com reskin visual temático. Escalam em quantidade e status ao longo dos 5 estágios de uma fase. Eles possuem apenas **1 habilidade ativa fixa** (sem Habilidade de Banco, já que eles lutam simultaneamente na simulação deles).

| Arquétipo            | Papel         | Elemento Típico | Comportamento Padrão                                          |
| :------------------- | :------------ | :-------------- | :------------------------------------------------------------ |
| **Script Kiddie**    | Horda         | Vírus           | Ataque básico; chance de aplicar Lentidão (Lag).              |
| **Firewall Turret**  | Tanque        | Encryption      | Início de batalha $\rightarrow$ ganha escudo próprio.         |
| **Corrupted Daemon** | Dano Contínuo | Brute Force     | Ao atacar $\rightarrow$ aplica Leak ou Corrosão.              |
| **Rogue Process**    | Rápido        | Backdoor        | Alta VEL/ESQ; Ataca numa frequência muito maior que o normal. |

_Exemplo de progressão de fase:_
Estágio 1 (3 Script Kiddies) $\rightarrow$ Estágio 3 (2 Kiddies, 1 Daemon, 1 Turret) $\rightarrow$ Estágio 5 (Boss do Mundo).

---

### B. Processos Mestres (Bosses de Mundo)

Bosses são antagonistas únicos. Aparecem no último estágio da última fase de um mundo. Possuem **2 ou mais habilidades** operando simultaneamente em cooldowns ou em gatilhos de HP. Derrotá-los concede o `.iso` do próximo mundo.

#### `Yggdrasil.iso` — Fenrir.exe

_O processo que consome o sistema._

- **Passiva:** Ao perder 30% da vida, ganha +30% ATK e +20% VEL permanentemente (ataca mais rápido e mais forte conforme sofre dano).
- **Ativa:** A cada 4 segundos ataca toda a linha inimiga aplicando Leak (Sangramento).

#### `Olympus.iso` — Arachne.exe

_Exploit visual de controle._

- **Ativa (Abertura):** No início da batalha, aplica Crash (Atordoamento) no processo de maior ATK inimigo.
- **Passiva:** 20% de chance de aplicar Crash de 2 segundos em quem a atacar diretamente.

#### `Duat.iso` — Set.exe

_O caos do painel egípcio._

- **Ativa:** Ao atacar, aplica Corrosão (reduz Firewall inimigo por 3 segundos).
- **Passiva:** Quando um aliado (inimigo comum) é ejetado, Set.exe ganha Escudo e +ATK permanente.

#### `Takamagahara.iso` — Yamata-no-Orochi.exe

_Processamento paralelo massivo._

- **Ativa:** Cada "ataque" causa múltiplos hits sequenciais instantâneos com dano reduzido (simulando 8 frentes).
- **Passiva (Threshold):** Ao cair para 50% de HP, injeta Vírus (Leak) massivo em todo o time inimigo.

#### `Orun.iso` — Ogum.exe

_Guerra direta em ferro digital._

- **Ativa:** Causa dano massivo focado automaticamente no alvo de menor HP restante (Executor).
- **Ativa (Cooldown):** A cada 3 segundos, seu ataque ignora o Firewall (DEF) e quebra Escudos imediatamente.

#### `Jurupari.iso` — Anhangá.exe

_Corrupção lenta e invisível._

- **Ativa (Abertura):** Aplica Throttling (Enfraquecimento) temporário em todos os adversários no boot da batalha.
- **Passiva:** Cura-se constantemente de parte do dano recebido e espalha Vírus para o atacante simultaneamente.
